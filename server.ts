import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("uzap.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    last_message TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    sender TEXT, -- 'user', 'ia', 'atendente'
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('onboarding_step', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('ia_active', '0');
`);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API Routes
  app.get("/api/metrics", (req, res) => {
    const totalMessages = db.prepare("SELECT COUNT(*) as count FROM messages").get() as any;
    const iaMessages = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'ia'").get() as any;
    const atendenteMessages = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'atendente'").get() as any;
    const totalContacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any;
    
    res.json({
      totalMessages: totalMessages.count,
      iaMessages: iaMessages.count,
      atendenteMessages: atendenteMessages.count,
      totalContacts: totalContacts.count,
      resolvedConversations: 0,
      satisfaction: "0%"
    });
  });

  app.get("/api/onboarding", (req, res) => {
    const step = db.prepare("SELECT value FROM settings WHERE key = 'onboarding_step'").get() as any;
    res.json({ step: parseInt(step.value) });
  });

  app.post("/api/onboarding", (req, res) => {
    const { step } = req.body;
    db.prepare("UPDATE settings SET value = ? WHERE key = 'onboarding_step'").run(step.toString());
    res.json({ success: true });
  });

  app.get("/api/knowledge", (req, res) => {
    const knowledge = db.prepare("SELECT * FROM knowledge ORDER BY created_at DESC").all();
    res.json(knowledge);
  });

  app.post("/api/knowledge", (req, res) => {
    const { content } = req.body;
    db.prepare("INSERT INTO knowledge (content) VALUES (?)").run(content);
    res.json({ success: true });
  });

  app.get("/api/contacts", (req, res) => {
    const contacts = db.prepare("SELECT * FROM contacts ORDER BY updated_at DESC").all();
    res.json(contacts);
  });

  app.post("/api/contacts", (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }
    const result = db.prepare("INSERT INTO contacts (name, phone, last_message) VALUES (?, ?, ?)").run(name, phone, "");
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/messages/:contactId", (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(req.params.contactId);
    res.json(messages);
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all() as any[];
    const result: any = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json(result);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value.toString());
    res.json({ success: true });
  });

  // WebSocket for Real-time
  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === "chat_message") {
        const { contactId, content, sender } = message;
        
        // Save user message
        db.prepare("INSERT INTO messages (contact_id, sender, content) VALUES (?, ?, ?)").run(contactId, sender, content);
        db.prepare("UPDATE contacts SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(content, contactId);

        // Broadcast to all clients
        broadcast({ type: "new_message", contactId, content, sender });

        // If it's a user message, trigger IA if active
        if (sender === "user") {
          const iaActive = db.prepare("SELECT value FROM settings WHERE key = 'ia_active'").get() as any;
          if (iaActive.value === "1") {
            try {
              const knowledge = db.prepare("SELECT content FROM knowledge").all() as any[];
              const context = knowledge.map(k => k.content).join("\n");
              
              const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [
                  { role: "user", parts: [{ text: `Contexto da empresa:\n${context}\n\nPergunta do cliente: ${content}` }] }
                ],
                config: {
                  systemInstruction: "Você é um assistente de IA da empresa Uzap. Responda de forma curta, profissional e prestativa baseando-se no contexto fornecido. Se não souber a resposta, peça para o cliente aguardar um atendente humano."
                }
              });

              const iaContent = response.text || "Desculpe, não consegui processar sua solicitação.";
              
              db.prepare("INSERT INTO messages (contact_id, sender, content) VALUES (?, 'ia', ?)").run(contactId, iaContent);
              broadcast({ type: "new_message", contactId, content: iaContent, sender: "ia" });
            } catch (error) {
              console.error("AI Error:", error);
            }
          }
        }
      }
    });
  });

  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Seed a contact if none exists
  const contactCount = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any;
  if (contactCount.count === 0) {
    db.prepare("INSERT INTO contacts (name, phone, last_message) VALUES (?, ?, ?)").run("Cliente Teste", "5511999999999", "Olá, gostaria de saber mais sobre os planos.");
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
