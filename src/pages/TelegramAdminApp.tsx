import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, BarChart3, MessageCircle, CreditCard, Send, ArrowLeft, RefreshCw, CheckCircle, XCircle, Megaphone } from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface Message {
  id: string;
  user_id: string;
  message: string;
  direction: string;
  created_at: string;
  is_read: boolean;
}

type View = 'home' | 'users' | 'user_detail' | 'chat' | 'stats' | 'broadcast';

export default function TelegramAdminApp() {
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Telegram WebApp SDK
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1a1a2e');
      tg.setBackgroundColor('#16213e');
    }
  }, []);

  const handleBack = () => {
    if (view === 'chat') setView('user_detail');
    else if (view === 'user_detail') setView('users');
    else setView('home');

    const tg = (window as any).Telegram?.WebApp;
    if (tg && view === 'home') tg.close();
  };

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, email, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setUsers(data || []);

    // Get unread counts
    const counts: Record<string, number> = {};
    for (const u of data || []) {
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.user_id)
        .eq('direction', 'partner_to_admin')
        .eq('is_read', false);
      if ((count || 0) > 0) counts[u.user_id] = count || 0;
    }
    setUnreadCounts(counts);
    setLoading(false);
  };

  // Fetch messages for user
  const fetchMessages = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);

    // Mark as read
    await supabase.from('support_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('direction', 'partner_to_admin')
      .eq('is_read', false);

    setLoading(false);
  };

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true);
    const [usersRes, subsRes, msgsRes, unreadRes, connsRes, todayRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('sellercloud_subscriptions').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('support_messages').select('*', { count: 'exact', head: true }),
      supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('direction', 'partner_to_admin').eq('is_read', false),
      supabase.from('marketplace_connections').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      activeSubs: subsRes.count || 0,
      totalMsgs: msgsRes.count || 0,
      unread: unreadRes.count || 0,
      connections: connsRes.count || 0,
      todayReg: todayRes.count || 0,
    });
    setLoading(false);
  };

  // Fetch subscription for user
  const fetchSubscription = async (userId: string) => {
    const { data } = await supabase
      .from('sellercloud_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription(data);
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    setLoading(true);

    await supabase.from('support_messages').insert({
      user_id: selectedUser.user_id,
      message: newMessage.trim(),
      direction: 'admin_to_partner',
    });

    setNewMessage('');
    await fetchMessages(selectedUser.user_id);
  };

  // Broadcast
  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setLoading(true);

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(500);

    for (const p of allProfiles || []) {
      await supabase.from('support_messages').insert({
        user_id: p.user_id,
        message: broadcastText.trim(),
        direction: 'broadcast',
      });
    }

    setBroadcastText('');
    setLoading(false);
    setView('home');
  };

  // Activate / Deactivate
  const toggleSubscription = async (userId: string, activate: boolean) => {
    if (activate) {
      await supabase.from('sellercloud_subscriptions')
        .update({ is_active: true, admin_override: true, activated_until: new Date(Date.now() + 30 * 86400000).toISOString() })
        .eq('user_id', userId);
    } else {
      await supabase.from('sellercloud_subscriptions')
        .update({ is_active: false, admin_override: false })
        .eq('user_id', userId);
    }
    await fetchSubscription(userId);
  };

  // Navigation
  const goToUsers = () => { setView('users'); fetchUsers(); };
  const goToStats = () => { setView('stats'); fetchStats(); };
  const goToUserDetail = (u: Profile) => { setSelectedUser(u); setView('user_detail'); fetchSubscription(u.user_id); };
  const goToChat = (u: Profile) => { setSelectedUser(u); setView('chat'); fetchMessages(u.user_id); };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#16213e] border-b border-white/10 px-4 py-3 flex items-center gap-3">
        {view !== 'home' && (
          <button onClick={handleBack} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold flex-1">
          {view === 'home' && '🛡️ SellerCloudX Admin'}
          {view === 'users' && '👥 Hamkorlar'}
          {view === 'user_detail' && `👤 ${selectedUser?.full_name || 'Hamkor'}`}
          {view === 'chat' && `💬 ${selectedUser?.full_name || 'Chat'}`}
          {view === 'stats' && '📊 Statistika'}
          {view === 'broadcast' && '📢 Ommaviy xabar'}
        </h1>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
      </div>

      <div className="p-4 pb-20">
        {/* HOME */}
        {view === 'home' && (
          <div className="grid grid-cols-2 gap-3">
            <MenuCard icon={<Users />} label="Hamkorlar" color="bg-blue-500/20 text-blue-400" onClick={goToUsers} />
            <MenuCard icon={<BarChart3 />} label="Statistika" color="bg-green-500/20 text-green-400" onClick={goToStats} />
            <MenuCard icon={<MessageCircle />} label="Xabarlar" color="bg-orange-500/20 text-orange-400" onClick={goToUsers} />
            <MenuCard icon={<CreditCard />} label="Obunalar" color="bg-purple-500/20 text-purple-400" onClick={goToUsers} />
            <MenuCard icon={<Megaphone />} label="Ommaviy xabar" color="bg-red-500/20 text-red-400" onClick={() => setView('broadcast')} />
            <MenuCard icon={<RefreshCw />} label="Yangilash" color="bg-cyan-500/20 text-cyan-400" onClick={() => window.location.reload()} />
          </div>
        )}

        {/* USERS */}
        {view === 'users' && (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.user_id}
                className="bg-white/5 rounded-xl p-3 flex items-center gap-3 active:bg-white/10 transition cursor-pointer"
                onClick={() => goToUserDetail(u)}
              >
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                  {(u.full_name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.full_name || 'Nomsiz'}</p>
                  <p className="text-xs text-white/50 truncate">{u.email || u.phone || 'N/A'}</p>
                </div>
                {unreadCounts[u.user_id] && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
                    {unreadCounts[u.user_id]}
                  </span>
                )}
              </div>
            ))}
            {!loading && users.length === 0 && <p className="text-center text-white/40 py-8">Hali hamkor yo'q</p>}
          </div>
        )}

        {/* USER DETAIL */}
        {view === 'user_detail' && selectedUser && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <p className="text-lg font-bold">{selectedUser.full_name || 'Nomsiz'}</p>
              <p className="text-sm text-white/60">📧 {selectedUser.email || 'N/A'}</p>
              <p className="text-sm text-white/60">📱 {selectedUser.phone || 'N/A'}</p>
              <p className="text-xs text-white/40">Ro'yxatdan: {new Date(selectedUser.created_at).toLocaleDateString('uz-UZ')}</p>
            </div>

            {/* Subscription */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="font-bold mb-2">📦 Obuna</p>
              {subscription ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {subscription.is_active ? <CheckCircle className="h-5 w-5 text-green-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
                    <span>{subscription.is_active ? 'Faol' : 'Faol emas'}</span>
                    <span className="text-white/40 text-sm ml-auto">{subscription.plan_type || 'Standard'}</span>
                  </div>
                  <p className="text-xs text-white/40">Muddat: {subscription.activated_until ? new Date(subscription.activated_until).toLocaleDateString('uz-UZ') : 'N/A'}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => toggleSubscription(selectedUser.user_id, true)}
                      className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 font-medium text-sm active:bg-green-500/30">
                      ✅ Aktivlashtirish
                    </button>
                    <button onClick={() => toggleSubscription(selectedUser.user_id, false)}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 font-medium text-sm active:bg-red-500/30">
                      ❌ To'xtatish
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-white/40 text-sm">Obuna mavjud emas</p>
              )}
            </div>

            {/* Actions */}
            <button onClick={() => goToChat(selectedUser)}
              className="w-full py-3 rounded-xl bg-blue-500/20 text-blue-400 font-medium flex items-center justify-center gap-2 active:bg-blue-500/30">
              <MessageCircle className="h-5 w-5" /> Chat ochish
            </button>
          </div>
        )}

        {/* CHAT */}
        {view === 'chat' && selectedUser && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'partner_to_admin' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.direction === 'partner_to_admin' ? 'bg-white/10 rounded-bl-md' :
                    m.direction === 'broadcast' ? 'bg-orange-500/20 rounded-br-md' :
                    m.direction === 'system' ? 'bg-yellow-500/10 rounded-br-md text-yellow-300' :
                    'bg-blue-500/30 rounded-br-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      {new Date(m.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && !loading && (
                <p className="text-center text-white/30 py-8">Hali xabar yo'q</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Xabar yozing..."
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-white/30"
              />
              <button onClick={sendMessage} disabled={!newMessage.trim()}
                className="bg-blue-500 rounded-xl px-4 py-3 disabled:opacity-30 active:bg-blue-600 transition">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* STATS */}
        {view === 'stats' && stats && (
          <div className="space-y-3">
            <StatCard label="Jami foydalanuvchilar" value={stats.totalUsers} icon="👥" />
            <StatCard label="Bugungi ro'yxat" value={stats.todayReg} icon="📱" />
            <StatCard label="Faol obunalar" value={stats.activeSubs} icon="✅" />
            <StatCard label="Jami xabarlar" value={stats.totalMsgs} icon="💬" />
            <StatCard label="Javobsiz xabarlar" value={stats.unread} icon="🔴" />
            <StatCard label="Marketplace ulanishlar" value={stats.connections} icon="🔌" />
            <button onClick={fetchStats} className="w-full py-3 rounded-xl bg-white/5 text-white/60 text-sm active:bg-white/10 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" /> Yangilash
            </button>
          </div>
        )}

        {/* BROADCAST */}
        {view === 'broadcast' && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">Barcha hamkorlarga ilovada ko'rinadigan ommaviy xabar yuboring:</p>
            <textarea
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Xabar matnini kiriting..."
              className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500/50 resize-none placeholder:text-white/30"
            />
            <button onClick={sendBroadcast} disabled={!broadcastText.trim() || loading}
              className="w-full py-3 rounded-xl bg-blue-500 font-medium flex items-center justify-center gap-2 disabled:opacity-30 active:bg-blue-600">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Megaphone className="h-5 w-5" />}
              Yuborish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function MenuCard({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`${color} rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-95 transition-transform`}>
      <div className="h-8 w-8">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-white/60">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
