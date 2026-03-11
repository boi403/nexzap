import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  Bell, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Zap, 
  Settings, 
  Home, 
  Inbox, 
  Calendar, 
  Database, 
  Tag, 
  ChevronRight, 
  ChevronLeft,
  X, 
  Menu,
  HelpCircle,
  LayoutDashboard,
  MessageCircle,
  Bot,
  UserCircle,
  LogOut,
  ChevronDown,
  PlayCircle,
  Send,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['atendimento', 'automacao', 'gestao', 'ia', 'conta']);
  const [metrics, setMetrics] = useState({
    totalMessages: 0,
    iaMessages: 0,
    atendenteMessages: 0,
    totalContacts: 0,
    resolvedConversations: 0,
    satisfaction: "0%"
  });
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [iaActive, setIaActive] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatView, setMobileChatView] = useState<'list' | 'chat'>('list');
  
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    setupWebSocket();
    return () => socketRef.current?.close();
  }, []);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    try {
      const [mRes, oRes, sRes, cRes, kRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/onboarding'),
        fetch('/api/settings'),
        fetch('/api/contacts'),
        fetch('/api/knowledge')
      ]);
      
      const checkResponse = async (res: Response, name: string) => {
        if (!res.ok) throw new Error(`API ${name} failed with status ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error(`API ${name} returned non-JSON:`, text.substring(0, 100));
          throw new Error(`API ${name} did not return JSON`);
        }
        return res.json();
      };

      setMetrics(await checkResponse(mRes, 'metrics'));
      const onboarding = await checkResponse(oRes, 'onboarding');
      setOnboardingStep(onboarding.step);
      const settings = await checkResponse(sRes, 'settings');
      setIaActive(settings.ia_active === '1');
      setContacts(await checkResponse(cRes, 'contacts'));
      setKnowledge(await checkResponse(kRes, 'knowledge'));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchMessages = async (contactId: number) => {
    try {
      const res = await fetch(`/api/messages/${contactId}`);
      if (!res.ok) throw new Error(`Fetch messages failed: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Fetch messages did not return JSON");
      }
      setMessages(await res.json());
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message') {
        if (selectedContact && data.contactId === selectedContact.id) {
          setMessages(prev => [...prev, { sender: data.sender, content: data.content, created_at: new Date().toISOString() }]);
        }
        fetchData(); // Refresh metrics and contact list
      }
    };

    socketRef.current = socket;
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedContact) return;
    
    const msg = {
      type: 'chat_message',
      contactId: selectedContact.id,
      content: newMessage,
      sender: 'atendente'
    };

    socketRef.current?.send(JSON.stringify(msg));
    setNewMessage('');
  };

  const addKnowledge = async () => {
    if (!newKnowledge.trim()) return;
    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newKnowledge })
    });
    setNewKnowledge('');
    setShowKnowledgeModal(false);
    fetchData();
  };

  const updateOnboarding = async (step: number) => {
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step })
    });
    setOnboardingStep(step);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newContactName, phone: newContactPhone })
      });
      if (res.ok) {
        setNewContactName('');
        setNewContactPhone('');
        setShowNewContactModal(false);
        fetchData(); // Refresh contacts
      }
    } catch (error) {
      console.error("Error creating contact:", error);
    }
  };

  const toggleIa = async () => {
    const newValue = !iaActive;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ia_active', value: newValue ? '1' : '0' })
    });
    setIaActive(newValue);
  };

  const toggleMenu = (section: string) => {
    setExpandedMenus(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const dashboardMetrics = [
    { label: 'IA', value: metrics.iaMessages.toString(), icon: Bot, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { label: 'Atendentes', value: metrics.atendenteMessages.toString(), icon: Users, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  ];

  const weekMetricsList = [
    { label: 'Msgs Totais', value: metrics.totalMessages.toString(), icon: MessageCircle, subtitle: 'Tempo de resposta médio 0s', color: 'text-indigo-600' },
    { label: 'Msgs da IA', value: metrics.iaMessages.toString(), icon: Bot, subtitle: 'Tempo de resposta médio 0s', color: 'text-blue-600' },
    { label: 'Msgs Atendentes', value: metrics.atendenteMessages.toString(), icon: Users, subtitle: '0 campanhas diferentes', color: 'text-amber-600' },
    { label: 'Conversas Resolvidas', value: metrics.resolvedConversations.toString(), icon: CheckCircle, subtitle: 'Tempo médio para resolução 0s', color: 'text-indigo-600' },
    { label: 'Áudios IA', value: '0', icon: MessageSquare, subtitle: '0% do volume total de mensagens', color: 'text-rose-600' },
    { label: 'Mensagens em Massa', value: '0', icon: TrendingUp, subtitle: '0 campanhas diferentes', color: 'text-blue-600' },
    { label: 'Recuperação de conversas', value: '0', icon: BarChart3, subtitle: '0 (0%) responderam às msgs', color: 'text-rose-600' },
    { label: 'Satisfeitos', value: metrics.satisfaction, icon: CheckCircle, subtitle: '0 conversas • NPS médio 0', color: 'text-indigo-600' },
  ];

  const onboardingSteps = [
    {
      number: 1,
      title: 'Base de conhecimento',
      description: 'Vamos iniciar criando a fonte de informações de onde a IA se baseará para responder seus clientes',
      action: 'Criar a minha',
      status: onboardingStep > 1 ? 'Concluído' : 'Pendente',
      active: onboardingStep === 1,
      onClick: () => setShowKnowledgeModal(true)
    },
    {
      number: 2,
      title: 'Converse com sua IA',
      description: 'Teste os conhecimentos da sua IA em relação ao seu negócio',
      action: 'Conversar',
      status: onboardingStep > 2 ? 'Concluído' : 'Pendente',
      active: onboardingStep === 2,
      onClick: () => setActiveSection('inbox')
    },
    {
      number: 3,
      title: 'Conectar canal',
      description: 'Vincule o seu canal de atendimento ao sistema. Não se preocupe, a IA está em modo simulação e não irá enviar mensagens ainda',
      action: 'Conectar canal',
      status: onboardingStep > 3 ? 'Concluído' : '',
      active: onboardingStep === 3,
      onClick: () => updateOnboarding(4)
    },
    {
      number: 4,
      title: 'Modo automático',
      description: 'Ative o modo automático para que a IA possa responder seus clientes',
      action: iaActive ? 'Desativar' : 'Ativar',
      status: iaActive ? 'Ativo' : '',
      active: onboardingStep === 4,
      onClick: toggleIa
    },
  ];

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', section: 'dashboard', subitems: [] },
    { icon: Inbox, label: 'Caixa de entrada', section: 'inbox', subitems: [] },
    { icon: Users, label: 'Atendimento', section: 'atendimento', subitems: [{ icon: Users, label: 'Contatos' }, { icon: Calendar, label: 'Agenda' }, { icon: Database, label: 'CRM / Kanban' }] },
    { icon: Zap, label: 'Automação de mensagens', section: 'automacao', subitems: [{ icon: TrendingUp, label: 'Disparo em Massa' }, { icon: CheckCircle, label: 'Recuperação de Conversas' }, { icon: MessageSquare, label: 'Mensagens Programadas' }] },
    { icon: Settings, label: 'Gestão de Atendimento', section: 'gestao', subitems: [{ icon: Tag, label: 'Tags / Rótulos' }, { icon: Users, label: 'Departamentos' }, { icon: Users, label: 'Atendentes' }, { icon: Settings, label: 'Campos Personalizados' }, { icon: Zap, label: 'Respostas Rápidas' }, { icon: BarChart3, label: 'Relatórios' }] },
    { icon: Bot, label: 'IA & Canais', section: 'ia', subitems: [{ icon: Database, label: 'Base de Conhecimento' }, { icon: Users, label: 'Canais de Atendimento' }, { icon: Zap, label: 'Api / Integrações' }] },
    { icon: UserCircle, label: 'Minha Conta', section: 'conta', subitems: [{ icon: Settings, label: 'Planos e Preços' }, { icon: Settings, label: 'Assinatura' }, { icon: Settings, label: 'Ajustes' }, { icon: HelpCircle, label: 'Ajuda' }] },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-gray-800">
      {/* Mobile Header */}
      <header className="lg:hidden bg-indigo-600 text-white p-4 flex items-center justify-between sticky top-0 z-[60] shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <Menu size={24} />
          </button>
          <h1 className="text-2xl font-black tracking-tighter">uzap</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-white/10 rounded-lg transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-indigo-600"></span>
          </button>
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-xs">MR</div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-indigo-600 transition-all duration-300 z-[80] flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black text-white tracking-tighter">uzap</h1>
              <button onClick={() => setSidebarOpen(false)} className="hidden lg:flex p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"><span className="text-white font-bold">u</span></div>
              <button onClick={() => setSidebarOpen(true)} className="hidden lg:flex p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-white p-1 hover:bg-white/10 rounded-lg">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {menuItems.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <button onClick={() => { setActiveSection(item.section); if (item.subitems.length > 0) toggleMenu(item.section); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${activeSection === item.section ? 'bg-white/20 text-white font-semibold shadow-sm' : 'text-white/90 hover:bg-white/10'}`}>
                <item.icon size={20} className="shrink-0" />
                {sidebarOpen && <span className="text-[14px] flex-1 text-left">{item.label}</span>}
                {sidebarOpen && item.subitems.length > 0 && <ChevronDown size={16} className={`transition-transform duration-200 ${expandedMenus.includes(item.section) ? 'rotate-180' : ''}`} />}
                
                {/* Tooltip */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] shadow-xl">
                    {item.label}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </button>
              <AnimatePresence>
                {sidebarOpen && item.subitems.length > 0 && expandedMenus.includes(item.section) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white/5 rounded-lg ml-2">
                    {item.subitems.map((subitem, sidx) => (
                      <button key={sidx} className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-white/80 hover:text-white hover:bg-white/10 transition text-left">
                        <subitem.icon size={14} className="shrink-0" />
                        <span>{subitem.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
        <div className="p-4 space-y-2 mt-auto border-t border-white/10">
          {[
            { icon: TrendingUp, label: 'Instalar App' },
            { icon: Tag, label: 'Período de testes' },
            { icon: HelpCircle, label: 'Ajuda' }
          ].map((item, idx) => (
            <button key={idx} className="w-full flex items-center gap-3 px-3 py-2 text-white/90 hover:bg-white/10 rounded-lg transition text-sm group relative">
              <item.icon size={18} />
              {sidebarOpen && <span>{item.label}</span>}
              {!sidebarOpen && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] shadow-xl">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'} pl-0`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 hidden lg:flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition">
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <LayoutDashboard size={18} className="text-indigo-600" />
              <span className="font-semibold text-lg">Dashboard</span>
              <span className="text-gray-400 text-sm ml-4 hidden xl:inline">03/03/2026 - 09/03/2026 • Últimos 7 dias</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded uppercase tracking-wider">MATEUS OLIVEIRA REZENDE</p>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-500">Conversas não lidas:</span>
                  <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">0</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                <img src="https://picsum.photos/seed/user/100/100" alt="User" referrerPolicy="no-referrer" />
              </div>
              <Bell size={20} className="text-gray-400 hover:text-indigo-500 cursor-pointer transition" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-8">
          {activeSection === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-2 mb-6 border-l-4 border-indigo-500 pl-3"><h3 className="text-gray-700 font-bold">Mensagens Enviadas</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {dashboardMetrics.map((m, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <div className="flex items-center gap-2 mb-1"><m.icon size={16} className={m.color} /><span className="text-xs text-gray-500 font-medium">{m.label}</span></div>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-800">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-2 mb-6 border-l-4 border-indigo-500 pl-3"><h3 className="text-gray-700 font-bold">Média da velocidade de Resposta</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[{ label: 'IA', value: '0s', icon: Bot, color: 'text-blue-500' }, { label: 'Atendentes', value: '0s', icon: Users, color: 'text-amber-500' }, { label: 'Clientes', value: '0s', icon: UserCircle, color: 'text-indigo-500' }].map((m, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <div className="flex items-center gap-2 mb-1"><m.icon size={16} className={m.color} /><span className="text-xs text-gray-500 font-medium">{m.label}</span></div>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-800">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-6 border-l-4 border-indigo-500 pl-3"><h3 className="text-gray-700 font-bold">Últimos 7 dias</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {weekMetricsList.map((m, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-lg ${m.color} bg-gray-50 group-hover:bg-white transition-colors`}><m.icon size={20} /></div><span className="text-sm font-bold text-gray-600">{m.label}</span></div>
                      <p className="text-3xl font-black text-gray-800 mb-1">{m.value}</p>
                      <p className="text-[11px] text-gray-400">{m.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'inbox' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex h-[calc(100vh-10rem)] lg:h-[calc(100vh-12rem)]">
              {/* Contact List */}
              <div className={`${mobileChatView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/4 border-r border-gray-100 flex-col bg-gray-50/30`}>
                <div className="p-4 border-b border-gray-100 bg-white flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Conversas</h3>
                  <button 
                    onClick={() => setShowNewContactModal(true)}
                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    title="Novo Contato"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {contacts.map(contact => (
                    <button 
                      key={contact.id} 
                      onClick={() => { setSelectedContact(contact); setMobileChatView('chat'); }}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-white transition-colors border-b border-gray-50 ${selectedContact?.id === contact.id ? 'bg-white border-l-4 border-l-indigo-500' : ''}`}
                    >
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold shrink-0">
                        {contact.name[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{contact.name}</p>
                        <p className="text-xs text-gray-500 truncate">{contact.last_message}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className={`${mobileChatView === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col bg-white`}>
                {selectedContact ? (
                  <>
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setMobileChatView('list')} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg">
                          <ChevronRight className="rotate-180" size={20} />
                        </button>
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold shrink-0">{selectedContact.name[0]}</div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 truncate">{selectedContact.name}</p>
                          <p className="text-xs text-indigo-500 font-medium">Online</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                          <Bot size={16} className={iaActive ? "text-indigo-500" : "text-gray-400"} />
                          <span className="text-[10px] sm:text-xs font-bold text-gray-600">IA {iaActive ? 'Ativa' : 'Inativa'}</span>
                          <button onClick={toggleIa} className={`w-8 h-4 rounded-full transition-colors relative ${iaActive ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${iaActive ? 'left-4.5' : 'left-0.5'}`}></div>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 custom-scrollbar">
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${msg.sender === 'user' ? 'bg-white text-gray-800 rounded-tl-none' : msg.sender === 'ia' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-indigo-600 text-white rounded-tr-none'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {msg.sender === 'ia' && <Bot size={12} />}
                              <span className="text-[10px] font-bold uppercase opacity-70">{msg.sender}</span>
                            </div>
                            <p>{msg.content}</p>
                            <p className="text-[10px] opacity-50 mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t border-gray-100 flex items-center gap-3">
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Digite sua mensagem..." 
                        className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition"
                      />
                      <button onClick={sendMessage} className="bg-indigo-500 text-white p-3 rounded-xl hover:bg-indigo-600 transition shadow-lg shadow-indigo-500/20">
                        <Send size={20} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                      <MessageSquare size={40} className="text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Selecione uma conversa</h3>
                    <p className="text-sm text-gray-500 max-w-xs">Escolha um contato na lista ao lado para começar a conversar.</p>
                    
                    <div className="mt-12 w-full max-w-md">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-gray-700">Primeiros Passos</h4>
                        <span className="text-xs font-bold text-indigo-500">{onboardingStep}/4</span>
                      </div>
                      <div className="space-y-3">
                        {onboardingSteps.map((step, i) => (
                          <div key={i} className={`p-4 rounded-xl border flex items-center justify-between ${step.active ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step.active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{step.number}</div>
                              <span className={`text-sm font-bold ${step.active ? 'text-indigo-700' : 'text-gray-600'}`}>{step.title}</span>
                            </div>
                            <button onClick={step.onClick} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${step.active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{step.action}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeSection === 'ia' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Base de Conhecimento</h2>
                    <p className="text-sm text-gray-500">Adicione informações para que a IA possa aprender sobre seu negócio.</p>
                  </div>
                  <button onClick={() => setShowKnowledgeModal(true)} className="flex items-center justify-center gap-2 bg-indigo-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-600 transition shadow-lg shadow-indigo-500/20 w-full sm:w-auto">
                    <Plus size={20} />
                    Adicionar Informação
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {knowledge.map((k, i) => (
                    <div key={i} className="p-6 bg-gray-50 rounded-xl border border-gray-100 relative group">
                      <p className="text-sm text-gray-600 line-clamp-4">{k.content}</p>
                      <p className="text-[10px] text-gray-400 mt-4">{new Date(k.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {knowledge.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <Database size={48} className="text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400">Nenhuma informação cadastrada.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* New Contact Modal */}
      <AnimatePresence>
        {showNewContactModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="font-bold text-lg">Novo Contato</h3>
                <button onClick={() => setShowNewContactModal(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateContact} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                  <input 
                    type="text" 
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="Ex: 5511999999999"
                    required
                  />
                </div>
                <div className="pt-2">
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Criar Contato
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Knowledge Modal */}
      <AnimatePresence>
        {showKnowledgeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowKnowledgeModal(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Adicionar à Base de Conhecimento</h3>
                <button onClick={() => setShowKnowledgeModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">Descreva detalhes sobre seus produtos, serviços, preços ou políticas. A IA usará isso para responder aos clientes.</p>
                <textarea 
                  value={newKnowledge}
                  onChange={(e) => setNewKnowledge(e.target.value)}
                  className="w-full h-40 bg-gray-50 border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 transition resize-none"
                  placeholder="Ex: Nossa empresa funciona de segunda a sexta das 08h às 18h. O plano básico custa R$ 99/mês..."
                />
              </div>
              <div className="p-6 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowKnowledgeModal(false)} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition">Cancelar</button>
                <button onClick={() => { addKnowledge(); if (onboardingStep === 1) updateOnboarding(2); }} className="bg-indigo-500 text-white px-8 py-2 rounded-lg font-bold hover:bg-indigo-600 transition shadow-lg shadow-indigo-500/20">Salvar Informação</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.1); }
      `}</style>
    </div>
  );
}
