import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageCircle, Send, Loader2, Users, User, Megaphone, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ChatUser {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  user_id: string;
  message: string;
  direction: string;
  created_at: string;
  is_read: boolean;
}

export function AdminSupportChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch chat users list with last messages
  const { data: chatUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-chat-users'],
    queryFn: async () => {
      // Get all unique users who have messages
      const { data: msgs, error } = await supabase
        .from('support_messages')
        .select('user_id, message, direction, created_at, is_read')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, ChatUser>();
      for (const msg of msgs || []) {
        if (!userMap.has(msg.user_id)) {
          userMap.set(msg.user_id, {
            user_id: msg.user_id,
            full_name: null,
            phone: null,
            email: null,
            last_message: msg.message,
            last_message_at: msg.created_at,
            unread_count: 0,
          });
        }
        const u = userMap.get(msg.user_id)!;
        if (msg.direction === 'partner_to_admin' && !msg.is_read) {
          u.unread_count++;
        }
      }

      // Fetch profiles
      const userIds = [...userMap.keys()];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone, email')
          .in('user_id', userIds);

        for (const p of profiles || []) {
          const u = userMap.get(p.user_id);
          if (u) {
            u.full_name = p.full_name;
            u.phone = p.phone;
            u.email = p.email;
          }
        }
      }

      return [...userMap.values()].sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
    refetchInterval: 15000,
  });

  // Fetch messages for selected user
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['admin-chat-messages', selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', selectedUser.user_id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;

      // Mark partner messages as read
      const unreadIds = (data || [])
        .filter((m: any) => m.direction === 'partner_to_admin' && !m.is_read)
        .map((m: any) => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('support_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
        queryClient.invalidateQueries({ queryKey: ['admin-chat-users'] });
      }

      return data as Message[];
    },
    enabled: !!selectedUser,
    refetchInterval: 5000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-chat-users'] });
        if (selectedUser) {
          queryClient.invalidateQueries({ queryKey: ['admin-chat-messages', selectedUser.user_id] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, selectedUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('telegram-send', {
        body: {
          action: 'send_to_partner',
          target_user_id: selectedUser.user_id,
          message: newMessage.trim(),
        },
      });
      if (error) throw error;
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['admin-chat-messages', selectedUser.user_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-users'] });
    } catch (err) {
      toast.error('Xabar yuborishda xatolik');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() || broadcasting) return;
    setBroadcasting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: {
          action: 'broadcast',
          message: broadcastMsg.trim(),
        },
      });
      if (error) throw error;
      toast.success(`Xabar ${data?.sent_count || 0} ta hamkorga yuborildi`);
      setBroadcastMsg('');
      queryClient.invalidateQueries({ queryKey: ['admin-chat-users'] });
    } catch (err) {
      toast.error('Broadcast xatolik');
    } finally {
      setBroadcasting(false);
    }
  };

  const filteredUsers = chatUsers.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (u.full_name?.toLowerCase().includes(s) ||
            u.phone?.includes(s) ||
            u.email?.toLowerCase().includes(s));
  });

  const totalUnread = chatUsers.reduce((sum, u) => sum + u.unread_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Hamkorlar chati
          {totalUnread > 0 && <Badge variant="destructive">{totalUnread} yangi</Badge>}
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Megaphone className="h-4 w-4" />
              Ommaviy xabar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Ommaviy xabar yuborish
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Barcha Telegram bog'langan hamkorlarga xabar yuboriladi.</p>
              <Textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Xabar matnini kiriting..."
                className="min-h-[120px]"
              />
              <Button onClick={handleBroadcast} disabled={!broadcastMsg.trim() || broadcasting} className="w-full gap-2">
                {broadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Yuborish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Users list */}
        <Card className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col`}>
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Qidirish..."
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Hali chatlar yo'q</div>
              ) : (
                filteredUsers.map((cu) => (
                  <button
                    key={cu.user_id}
                    onClick={() => setSelectedUser(cu)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b ${
                      selectedUser?.user_id === cu.user_id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{cu.full_name || 'Nomsiz'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{cu.phone || cu.email || ''}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{cu.last_message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(cu.last_message_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}
                        </span>
                        {cu.unread_count > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-5 min-w-5 px-1">{cu.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className={`md:col-span-2 ${!selectedUser ? 'hidden md:flex' : 'flex'} flex-col`}>
          {selectedUser ? (
            <>
              <CardHeader className="pb-3 flex-shrink-0 border-b">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedUser(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selectedUser.full_name || 'Nomsiz'}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.phone} · {selectedUser.email}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 p-0">
                <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
                  <div className="space-y-3 py-4">
                    {msgsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === 'admin_to_partner' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            msg.direction === 'admin_to_partner'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : msg.direction === 'broadcast'
                              ? 'bg-accent border rounded-bl-md'
                              : 'bg-muted rounded-bl-md'
                          }`}>
                            {msg.direction === 'broadcast' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 mb-1">📢 Ommaviy</Badge>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <p className={`text-[10px] mt-1 ${
                              msg.direction === 'admin_to_partner' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}>
                              {new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 p-4 border-t">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Javob yozing..."
                    className="min-h-[44px] max-h-[100px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="shrink-0 h-[44px] w-[44px]">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Chatni tanlang</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
