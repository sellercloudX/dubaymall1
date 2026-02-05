import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Send, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface SellerChatProps {
  isOpen: boolean;
  onClose: () => void;
  shop: {
    id: string;
    name: string;
    logo_url?: string | null;
    user_id: string;
  };
  productId?: string;
  productName?: string;
}

export function SellerChat({ isOpen, onClose, shop, productId, productName }: SellerChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      initializeConversation();
    }
  }, [isOpen, user, shop.id]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const initializeConversation = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Check for existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', user.id)
        .eq('shop_id', shop.id)
        .single();

      if (existing) {
        setConversationId(existing.id);
        await fetchMessages(existing.id);
      } else {
        // Create new conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            customer_id: user.id,
            shop_id: shop.id,
            product_id: productId,
          })
          .select('id')
          .single();

        if (error) throw error;
        setConversationId(newConv.id);

        // Send initial message about the product if provided
        if (productName) {
          setNewMessage(`Salom! "${productName}" mahsuloti haqida savol bor.`);
        }
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
      toast.error("Chat ochishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      scrollToBottom();
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;
    setSending(true);

    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: newMessage.trim(),
      });

      if (error) throw error;

      // Update last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Xabar yuborishda xatolik");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Sotuvchi bilan chat</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <p className="text-muted-foreground mb-4">Chat uchun tizimga kiring</p>
            <Button onClick={onClose}>Yopish</Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={shop.logo_url || undefined} />
            <AvatarFallback>{shop.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold">{shop.name}</p>
            <p className="text-xs text-muted-foreground">Sotuvchi</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p>Chat boshlang!</p>
                  <p className="text-sm">Sotuvchiga savol bering</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Xabar yozing..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending || loading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || loading}
              size="icon"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
