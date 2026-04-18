import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Rss, 
  Send, 
  Settings, 
  BarChart3, 
  LogOut, 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  RefreshCcw,
  Bot as BotIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Globe,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { db, auth, login, logout } from './lib/firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'overview' | 'donors' | 'targets' | 'curation' | 'ai' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  // Data State
  const [settings, setSettings] = useState<any>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    });

    // Listen to Donors
    const unsubDonors = onSnapshot(collection(db, 'donor_channels'), (snap) => {
      setDonors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Targets
    const unsubTargets = onSnapshot(collection(db, 'target_channels'), (snap) => {
      setTargets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Logs
    const unsubLogs = onSnapshot(
      query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50)),
      (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Listen to Posts
    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubSettings();
      unsubDonors();
      unsubTargets();
      unsubLogs();
      unsubPosts();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel shadow-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-[#00d2ff] rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <BotIcon className="w-10 h-10 text-[#1e3c72]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">TG Content Manager</h1>
          <p className="text-white/60 mb-8">
            Войдите, чтобы управлять автоматизацией ваших Telegram каналов
          </p>
          <button 
            onClick={login}
            className="w-full bg-[#00d2ff] text-[#1e3c72] py-4 rounded-xl font-bold hover:bg-[#00b8e6] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#00d2ff]/20"
          >
            Войти через Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col md:flex-row p-4 gap-4">
      {/* Sidebar - Navigation */}
      <aside className="w-full md:w-64 glass-panel p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-[#00d2ff] rounded-lg flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-[#1e3c72]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-[#00d2ff] bg-clip-text text-transparent">TeleFlow</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard size={20} />}
            label="Обзор"
          />
          <NavItem 
            active={activeTab === 'donors'} 
            onClick={() => setActiveTab('donors')}
            icon={<Rss size={20} />}
            label="Доноры"
          />
          <NavItem 
            active={activeTab === 'targets'} 
            onClick={() => setActiveTab('targets')}
            icon={<Send size={20} />}
            label="Ресипиенты"
          />
          <NavItem 
            active={activeTab === 'curation'} 
            onClick={() => setActiveTab('curation')}
            icon={<Globe size={20} />}
            label="Куратор новостей"
          />
          <NavItem 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')}
            icon={<Sparkles size={20} />}
            label="AI Лаборатория"
          />
          <NavItem 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings size={20} />}
            label="Настройки"
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-3 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm">Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pt-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight capitalize">
              {activeTab === 'overview' && 'Панель управления'}
              {activeTab === 'donors' && 'Каналы доноры'}
              {activeTab === 'targets' && 'Каналы для публикации'}
              {activeTab === 'curation' && 'Куратор Google News'}
              {activeTab === 'ai' && 'AI Уникализация'}
              {activeTab === 'settings' && 'Настройки системы'}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {user.email} • {settings?.isActive ? 'Система активна' : 'Система остановлена'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                const docRef = doc(db, 'settings', 'config');
                await setDoc(docRef, { ...settings, isActive: !settings?.isActive }, { merge: true });
              }}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg",
                settings?.isActive 
                  ? "bg-red-500/20 text-red-100 hover:bg-red-500/30 border border-red-500/30" 
                  : "bg-green-500/20 text-green-100 hover:bg-green-500/30 border border-green-500/30"
              )}
            >
              {settings?.isActive ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              {settings?.isActive ? "Остановить" : "Запустить"}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <OverviewView donors={donors} targets={targets} posts={posts} logs={logs} />
            )}
            {activeTab === 'donors' && (
              <ChannelsView type="donor" items={donors} />
            )}
            {activeTab === 'targets' && (
              <ChannelsView type="target" items={targets} />
            )}
            {activeTab === 'curation' && (
              <CurationView settings={settings} targets={targets} />
            )}
            {activeTab === 'ai' && (
              <AILabView settings={settings} />
            )}
            {activeTab === 'settings' && (
              <SettingsView settings={settings} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Component Parts ---

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300",
        active 
          ? "bg-white/10 text-white shadow-xl border border-white/20" 
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "text-[#00d2ff]" : "")}>{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="ml-auto w-1.5 h-1.5 bg-[#00d2ff] rounded-full shadow-[0_0_8px_#00d2ff]" />}
    </button>
  );
}

// --- VIEWS ---

function OverviewView({ donors, targets, posts, logs }: any) {
  const chartData = useMemo(() => {
    return [
      { name: 'Mon', posts: 12 },
      { name: 'Tue', posts: 19 },
      { name: 'Wed', posts: 15 },
      { name: 'Thu', posts: 27 },
      { name: 'Fri', posts: 22 },
      { name: 'Sat', posts: 10 },
      { name: 'Sun', posts: 8 },
    ];
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats */}
      <StatCard title="Активные доноры" value={donors.filter((d:any) => d.isActive).length} icon={<Rss />} color="blue" />
      <StatCard title="Целевые каналы" value={targets.filter((t:any) => t.isActive).length} icon={<Send />} color="purple" />
      <StatCard title="Постов сегодня" value={posts.filter((p:any) => true).length} icon={<CheckCircle2 />} color="green" />

      {/* Chart */}
      <div className="lg:col-span-2 glass-panel p-6 shadow-xl border border-white/10">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <BarChart3 className="text-[#00d2ff]" size={20} />
          Активность публикаций
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d2ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d2ff" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(30, 60, 114, 0.9)', 
                  borderRadius: '16px', 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  backdropFilter: 'blur(10px)',
                  color: 'white'
                }}
                itemStyle={{ color: '#00d2ff' }}
              />
              <Area type="monotone" dataKey="posts" stroke="#00d2ff" strokeWidth={3} fillOpacity={1} fill="url(#colorPosts)" dot={{ r: 4, fill: '#00d2ff', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-time Logs */}
      <div className="glass-panel p-6 shadow-xl border border-white/10 flex flex-col">
        <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="text-orange-400" size={20} />
            Лог событий
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded-full">Live</span>
        </h3>
        <div className="flex-1 overflow-y-auto max-h-[280px] space-y-3 pr-2 scrollbar-thin">
          {logs.map((log: any) => (
            <div key={log.id} className="flex gap-3 text-sm p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 shadow-[0_0_5px_currentColor]",
                log.level === 'error' ? 'text-red-500 bg-red-500' : 
                log.level === 'warning' ? 'text-orange-500 bg-orange-500' :
                log.level === 'success' ? 'text-green-500 bg-green-500' : 'text-[#00d2ff] bg-[#00d2ff]'
              )} />
              <div className="flex-1">
                <p className="text-white/90 leading-tight font-medium">{log.message}</p>
                <span className="text-[10px] text-white/40 font-mono">
                  {log.timestamp?.toDate().toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-white/30 text-center py-10 italic">Логов пока нет...</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-[#00d2ff]/20 text-[#00d2ff]",
    purple: "bg-purple-500/20 text-purple-300",
    green: "bg-[#2ecc71]/20 text-[#2ecc71]",
  };
  return (
    <div className="glass-card p-6 shadow-lg border border-white/10 flex items-center gap-5 group hover:scale-[1.02] transition-transform cursor-default">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:rotate-12", colors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-extrabold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}

function ChannelsView({ type, items }: { type: 'donor' | 'target', items: any[] }) {
  const [newChannel, setNewChannel] = useState({ title: '', channelId: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel.title || !newChannel.channelId) return;
    const col = type === 'donor' ? 'donor_channels' : 'target_channels';
    await addDoc(collection(db, col), {
      ...newChannel,
      isActive: true,
      addedAt: serverTimestamp()
    });
    setNewChannel({ title: '', channelId: '' });
  };

  const toggleActive = async (id: string, current: boolean) => {
    const col = type === 'donor' ? 'donor_channels' : 'target_channels';
    await updateDoc(doc(db, col, id), { isActive: !current });
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Вы уверены?')) return;
    const col = type === 'donor' ? 'donor_channels' : 'target_channels';
    await deleteDoc(doc(db, col, id));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="glass-panel p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <input 
            placeholder="Название (напр. Тех-Блог)" 
            className="w-full glass-input px-4 py-3 pl-10 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
            value={newChannel.title}
            onChange={e => setNewChannel({...newChannel, title: e.target.value})}
          />
          <Search className="absolute left-3 top-3.5 text-white/30" size={18} />
        </div>
        <input 
          placeholder="Username или ID (напр. @tech_news)" 
          className="glass-input px-4 py-3 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
          value={newChannel.channelId}
          onChange={e => setNewChannel({...newChannel, channelId: e.target.value})}
        />
        <button type="submit" className="bg-[#00d2ff] text-[#1e3c72] rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-[#00b8e6] transition-all shadow-lg shadow-[#00d2ff]/20">
          <Plus size={20} /> Добавить
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-5 shadow-lg flex items-center justify-between group hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-inner",
                  item.isActive ? "bg-[#2ecc71]/20 text-[#2ecc71]" : "bg-white/5 text-white/30"
                )}>
                  {type === 'donor' ? <Rss size={20} /> : <Send size={20} />}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{item.title}</h4>
                  <p className="text-[10px] text-white/40 font-mono tracking-tighter">{item.channelId}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => toggleActive(item.id, item.isActive)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    item.isActive ? "text-orange-400 hover:bg-orange-400/10" : "text-green-400 hover:bg-green-400/10"
                  )}
                >
                  {item.isActive ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>
                <button 
                  onClick={() => deleteItem(item.id)}
                  className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-3xl text-white/20 italic font-medium">
            Список пуст
          </div>
        )}
      </div>
    </div>
  );
}

function CurationView({ settings, targets }: any) {
  const [topic, setTopic] = useState('');
  const [timeframe, setTimeframe] = useState('за последние 24 часа');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [targetId, setTargetId] = useState('');

  const handleSearch = async () => {
    if (!topic) return;
    setSearching(true);
    setResults([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `Найди ТОП-10 последних новостей по теме "${topic}" ${timeframe}. 
      Для каждой новости предоставь:
      1. Заголовок (на русском)
      2. Краткий пересказ (1-2 предложения)
      3. Прямую ссылку на источник.
      
      Верни результат СТРОГО в формате JSON массива объектов с полями: title, summary, url.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                url: { type: Type.STRING }
              },
              required: ["title", "summary", "url"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setResults(data);
    } catch (e) {
      console.error(e);
      alert('Ошибка при поиске новостей');
    } finally {
      setSearching(false);
    }
  };

  const publish = async (news: any) => {
    if (!targetId) {
      alert('Выберите канал для публикации');
      return;
    }
    
    try {
      // Step 2: Uniqueize in bot style
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const uniquePrompt = `Ниже представлена новость. Твоя задача — переписать её в стиле "${settings?.aiPrompt || 'информативного и захватывающего блога'}". 
      Добавь header: "${settings?.globalHeader || ''}" и footer: "${settings?.globalFooter || ''}".
      
      Заголовок: ${news.title}
      Суть: ${news.summary}
      Источник: ${news.url}
      
      Верни только готовый текст для поста в формате HTML. Используй <b> для заголовков.`;

      const uniqueResp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: uniquePrompt
      });
      
      const finalText = uniqueResp.text;
      
      // Step 3: Publish to backend
      const res = await fetch('/api/post-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: finalText, 
          channelId: targetId 
        })
      });
      
      if (res.ok) {
        alert('Опубликовано!');
      } else {
        const error = await res.json();
        alert('Ошибка публикации: ' + (error.error || 'Неизвестная ошибка'));
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка при уникализации/публикации');
    }
  };

  return (
    <div className="space-y-6 mb-20">
      {/* Search Controls */}
      <div className="glass-panel p-8 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Тематика новостей</label>
            <div className="relative">
              <input 
                className="w-full glass-input px-5 py-4 pl-12 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
                placeholder="Напр: Искусственный интеллект, Криптовалюты..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
              <Search className="absolute left-4 top-4 text-white/30" size={20} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Период времени</label>
            <div className="relative">
              <select 
                className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none appearance-none cursor-pointer"
                value={timeframe}
                onChange={e => setTimeframe(e.target.value)}
              >
                <option value="за последние 24 часа">За последние 24 часа</option>
                <option value="за последние 7 дней">За последние 7 дней</option>
                <option value="за последний месяц">За последний месяц</option>
              </select>
              <ChevronRight className="absolute right-4 top-4 text-white/30 rotate-90" size={18} />
            </div>
          </div>
        </div>

        <button 
          onClick={handleSearch}
          disabled={searching || !topic}
          className="w-full bg-[#00d2ff] text-[#1e3c72] py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#00b8e6] transition-all shadow-2xl shadow-[#00d2ff]/30 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
        >
          {searching ? <Loader2 className="animate-spin" /> : <Globe />}
          {searching ? "Ищем лучшие новости..." : "Найти ТОП-10 новостей"}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Globe className="text-[#00d2ff]" size={20} />
              Найдено в Google News
            </h3>
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest pl-2">Постить в:</span>
              <select 
                className="bg-transparent text-xs font-bold text-[#00d2ff] px-3 py-1.5 focus:outline-none cursor-pointer min-w-[150px]"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
              >
                <option value="" className="bg-[#1e3c72]">Выберите канал</option>
                {targets.map((t: any) => (
                  <option key={t.id} value={t.channelId} className="bg-[#1e3c72]">{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {results.map((news, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-6 shadow-xl border border-white/10 flex flex-col md:flex-row gap-6 items-start md:items-center group hover:border-[#00d2ff]/30 transition-all"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#00d2ff]/10 text-[#00d2ff] flex items-center justify-center font-bold text-xs border border-[#00d2ff]/20">
                      {i + 1}
                    </span>
                    <h4 className="font-bold text-lg text-white group-hover:text-[#00d2ff] transition-colors">{news.title}</h4>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{news.summary}</p>
                  <a 
                    href={news.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#00d2ff] hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} /> Читать оригинал
                  </a>
                </div>
                <button 
                  onClick={() => publish(news)}
                  className="shrink-0 w-full md:w-auto bg-white/5 hover:bg-[#00d2ff] hover:text-[#1e3c72] text-[#00d2ff] px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all border border-[#00d2ff]/20 flex items-center justify-center gap-2 active:scale-[0.95]"
                >
                  <Send size={16} />
                  Уникализировать и Постить
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AILabView({ settings }: any) {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/uniquize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, prompt: settings?.aiPrompt })
      });
      const data = await resp.json();
      setResult(data.text);
    } catch (e) {
      alert('Ошибка AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="glass-panel p-8 shadow-xl">
        <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
          <Search size={22} className="text-[#00d2ff]" />
          Оригинальный текст
        </h3>
        <textarea 
          className="w-full h-64 glass-input p-6 focus:ring-2 focus:ring-[#00d2ff] transition-all font-sans text-white/90 resize-none shadow-inner"
          placeholder="Вставьте сюда текст для проверки..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button 
          onClick={handleTest}
          disabled={loading || !text}
          className="w-full mt-6 bg-[#00d2ff] text-[#1e3c72] py-4 rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-[#00b8e6] transition-all disabled:opacity-50 shadow-lg shadow-[#00d2ff]/20"
        >
          {loading ? <RefreshCcw className="animate-spin" /> : <Sparkles />}
          {loading ? "Анализируем..." : "Уникализировать"}
        </button>
      </div>

      <div className="glass-panel p-8 shadow-xl">
        <h3 className="font-bold text-xl mb-6 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles size={22} className="text-yellow-400" />
            Результат
          </span>
          {result && (
            <button 
              onClick={() => { navigator.clipboard.writeText(result); alert('Скопировано!'); }}
              className="text-xs font-bold text-[#00d2ff] hover:text-white uppercase tracking-widest bg-[#00d2ff]/10 px-3 py-1 rounded-full border border-[#00d2ff]/20"
            >
              Копировать
            </button>
          )}
        </h3>
        <div className="w-full h-64 bg-white/5 p-6 rounded-2xl border border-white/10 overflow-y-auto whitespace-pre-wrap text-white/80 italic font-medium leading-relaxed">
          {result || "Здесь появится уникальный текст после обработки..."}
        </div>
        <div className="mt-6 p-4 bg-[#00d2ff]/5 rounded-xl border border-[#00d2ff]/10 flex gap-3 text-white/60 text-xs">
          <AlertCircle size={18} className="shrink-0 text-[#00d2ff]" />
          <p>Интеллектуальная система переработки текста на базе Gemini. Учитывает контекст и тональность донора.</p>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings }: any) {
  const [local, setLocal] = useState<any>(settings || {});

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const save = async () => {
    try {
      await setDoc(doc(db, 'settings', 'config'), local, { merge: true });
      alert('Конфигурация обновлена!');
    } catch (e) {
      alert('Ошибка сохранения');
    }
  };

  return (
    <div className="max-w-4xl mx-auto glass-panel shadow-2xl p-8 space-y-10 mb-20">
      <section>
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#00d2ff] mb-8 flex items-center gap-2">
          <BotIcon size={16} /> Telegram Bot API
        </h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Токен бота</label>
            <input 
              type="password"
              className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none font-mono text-sm tracking-widest"
              value={local.telegramBotToken || ''}
              onChange={e => setLocal({...local, telegramBotToken: e.target.value})}
              placeholder="1234567890:ABCdef..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Интервал проверки (минуты)</label>
            <input 
              type="number"
              className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
              value={local.checkInterval || 5}
              onChange={e => setLocal({...local, checkInterval: parseInt(e.target.value)})}
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#00d2ff] mb-8 flex items-center gap-2">
          <Sparkles size={16} /> AI & Контент
        </h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Промпт для AI</label>
            <textarea 
              className="w-full h-32 glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none resize-none text-sm leading-relaxed"
              value={local.aiPrompt || ''}
              onChange={e => setLocal({...local, aiPrompt: e.target.value})}
              placeholder="Укажите инструкции для Gemini..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Задержка (сек)</label>
              <input 
                type="number"
                className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
                value={local.postDelay || 5}
                onChange={e => setLocal({...local, postDelay: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Стоп-слова</label>
              <input 
                className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none text-sm"
                value={local.blockedKeywords || ''}
                onChange={e => setLocal({...local, blockedKeywords: e.target.value})}
                placeholder="реклама, подпишись, акция..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Header</label>
              <input 
                className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
                value={local.globalHeader || ''}
                onChange={e => setLocal({...local, globalHeader: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Footer</label>
              <input 
                className="w-full glass-input px-5 py-4 focus:ring-2 focus:ring-[#00d2ff] transition-all outline-none"
                value={local.globalFooter || ''}
                onChange={e => setLocal({...local, globalFooter: e.target.value})}
              />
            </div>
          </div>
        </div>
      </section>

      <button 
        onClick={save}
        className="w-full bg-[#00d2ff] text-[#1e3c72] py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#00b8e6] transition-all shadow-2xl shadow-[#00d2ff]/30 active:scale-[0.98]"
      >
        Применить конфигурацию
      </button>
    </div>
  );
}
