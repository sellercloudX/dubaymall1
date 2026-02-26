import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Loader2, Bot, User, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Message {
  id: string;
  message: string;
  direction: string;
  created_at: string;
  is_read: boolean;
}

export function SupportChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['support-messages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('support-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['support-messages', user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'send_to_admin', message: newMessage.trim() },
      });
      if (error) throw error;
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['support-messages', user?.id] });
    } catch (err: any) {
      toast.error('Xabar yuborishda xatolik');
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter(m => m.direction !== 'partner_to_admin' && !m.is_read).length;

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Admin bilan chat
            {unreadCount > 0 && <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://t.me/sellercloudx_support" target="_blank" rel="noopener noreferrer" className="gap-1 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />@sellercloudx_support
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Savol yoki muammolaringizni adminga yozing — tez javob olasiz!</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef as any}>
          <div className="space-y-3 pb-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Hali xabar yo'q</p>
                <p className="text-xs mt-1">Adminga savol yozing yoki Telegram orqali bog'laning</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'partner_to_admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.direction === 'partner_to_admin'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : msg.direction === 'broadcast'
                      ? 'bg-accent border rounded-bl-md'
                      : 'bg-muted rounded-bl-md'
                  }`}>
                    {msg.direction !== 'partner_to_admin' && (
                      <div className="flex items-center gap-1 mb-1">
                        {msg.direction === 'broadcast' ? (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">📢 Ommaviy</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Admin</Badge>
                        )}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${
                      msg.direction === 'partner_to_admin' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-3 border-t mt-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Xabar yozing..."
            className="min-h-[44px] max-h-[100px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
