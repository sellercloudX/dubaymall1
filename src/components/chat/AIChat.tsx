import React, { useState, useRef, useEffect } from 'react';
 import { Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
 
 // Lazy load react-markdown to reduce initial bundle size
 const ReactMarkdown = lazy(() => import('react-markdown'));

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  context?: {
    userRole?: string;
    shopName?: string;
  };
}

export function AIChat({ context }: AIChatProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          context 
        },
      });

      if (error) throw error;

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.message || 'Kechirasiz, javob olishda xatolik yuz berdi.' 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Kechirasiz, hozir javob bera olmayapman. Keyinroq urinib ko\'ring.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-[380px] h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              AI Yordamchi
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Salom! Men AI yordamchiman.</p>
                  <p className="text-sm mt-2">Savol bering, yordam beraman!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                             <Suspense fallback={<span className="text-sm">{message.content}</span>}>
                               <ReactMarkdown>{message.content}</ReactMarkdown>
                             </Suspense>
                          </div>
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Savol yozing..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
