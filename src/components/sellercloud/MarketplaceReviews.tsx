import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkBillingAccess, handleEdgeFunctionBillingError } from '@/lib/billingCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, MessageCircle, HelpCircle, Send, CheckCircle2, Clock, RefreshCw, Sparkles, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';

interface ReviewItem {
  id: string;
  nmID?: number;
  offerId?: string;
  productName: string;
  userName?: string;
  text: string;
  answer: string | null;
  rating?: number;
  createdAt: string;
  isAnswered: boolean;
  supplierArticle?: string;
  photos?: string[];
}

interface MarketplaceReviewsProps {
  connectedMarketplaces: string[];
}

type ReviewType = 'feedbacks' | 'questions';

const SUPPORTED_REVIEW_MARKETPLACES = ['wildberries', 'yandex', 'uzum'];
const MARKETPLACES_WITH_QUESTIONS = ['wildberries', 'yandex'];

export function MarketplaceReviews({ connectedMarketplaces }: MarketplaceReviewsProps) {
  const [reviewType, setReviewType] = useState<ReviewType>('feedbacks');
  const [showAnswered, setShowAnswered] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [selectedMp, setSelectedMp] = useState<string>('');

  // AI Auto-Reply settings
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<'uz' | 'ru'>('uz');
  const [aiTone, setAiTone] = useState<'friendly' | 'formal' | 'brief'>('friendly');
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const supportedMps = connectedMarketplaces.filter(mp => SUPPORTED_REVIEW_MARKETPLACES.includes(mp));

  useEffect(() => {
    if (supportedMps.length > 0 && !supportedMps.includes(selectedMp)) {
      setSelectedMp(supportedMps[0]);
    }
  }, [supportedMps.join(',')]);

  const fetchReviews = useCallback(async () => {
    if (!selectedMp) return;
    setIsLoading(true);
    try {
      let dataType: string = reviewType;
      if (selectedMp === 'yandex') {
        dataType = reviewType === 'questions' ? 'questions' : 'reviews';
      }
      if (selectedMp === 'uzum') {
        dataType = 'reviews';
      }

      const body: Record<string, any> = {
        marketplace: selectedMp,
        dataType,
        take: 100,
      };

      if (selectedMp === 'wildberries') {
        body.isAnswered = showAnswered;
      }

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', { body });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.error || 'Sharhlarni yuklashda xato');
        setItems([]);
      } else {
        let results: ReviewItem[] = data?.data || [];
        if (selectedMp !== 'wildberries') {
          results = results.filter(item => item.isAnswered === showAnswered);
        }
        setItems(results);
      }
    } catch (e: any) {
      console.error('Fetch reviews error:', e);
      toast.error('Sharhlarni yuklashda xato: ' + (e.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, [selectedMp, reviewType, showAnswered]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Filtered items by rating
  const filteredItems = ratingFilter
    ? items.filter(item => item.rating === ratingFilter)
    : items;

  const handleAnswer = async (itemId: string) => {
    if (!answerText.trim()) return;
    setSendingAnswer(true);
    try {
      const body: any = {
        marketplace: selectedMp,
        dataType: 'answer-feedback',
        text: answerText,
        feedbackId: itemId,
      };
      if (reviewType === 'questions') {
        body.dataType = 'answer-question';
        body.questionId = itemId;
        delete body.feedbackId;
      }

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', { body });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success('Javob yuborildi!');
      setAnsweringId(null);
      setAnswerText('');
      fetchReviews();
    } catch (e: any) {
      toast.error(`Javob yuborishda xato: ${e.message || 'Noma\'lum xato'}`);
    } finally {
      setSendingAnswer(false);
    }
  };

  // AI Generate Reply
  const handleAIReply = async (item: ReviewItem) => {
    // Pre-flight billing check
    if (!(await checkBillingAccess('ai-review-reply'))) return;
    
    setAiGenerating(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('ai-review-reply', {
        body: {
          reviewText: item.text,
          productName: item.productName || item.supplierArticle || '',
          rating: item.rating,
          userName: item.userName,
          language: aiLanguage,
          tone: aiTone,
          marketplace: selectedMp,
        },
      });

      if (error) {
        if (handleEdgeFunctionBillingError(error, data)) return;
        throw error;
      }
      if (!data?.success) throw new Error(data?.error || 'AI xato');

      setAnsweringId(item.id);
      setAnswerText(data.reply);
      toast.success('AI javob tayyorladi — tekshirib yuboring');
    } catch (e: any) {
      console.error('AI reply error:', e);
      toast.error(`AI javob yaratishda xato: ${e.message}`);
    } finally {
      setAiGenerating(null);
    }
  };

  // Auto-reply all unanswered
  const handleAutoReplyAll = async () => {
    const unanswered = filteredItems.filter(i => !i.isAnswered);
    if (unanswered.length === 0) return toast.info('Javob kutayotgan sharhlar yo\'q');
    
    toast.info(`${unanswered.length} ta sharhga AI javob tayyorlanmoqda...`);
    let successCount = 0;

    for (const item of unanswered) {
      try {
        const { data, error } = await supabase.functions.invoke('ai-review-reply', {
          body: {
            reviewText: item.text,
            productName: item.productName || item.supplierArticle || '',
            rating: item.rating,
            userName: item.userName,
            language: aiLanguage,
            tone: aiTone,
            marketplace: selectedMp,
          },
        });

        if (error || !data?.success) continue;

        // Auto-send
        const body: any = {
          marketplace: selectedMp,
          dataType: reviewType === 'questions' ? 'answer-question' : 'answer-feedback',
          text: data.reply,
          ...(reviewType === 'questions' ? { questionId: item.id } : { feedbackId: item.id }),
        };

        const { error: sendError } = await supabase.functions.invoke('fetch-marketplace-data', { body });
        if (!sendError) successCount++;

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }

    toast.success(`${successCount}/${unanswered.length} ta sharhga javob yuborildi`);
    fetchReviews();
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
    </div>
  );

  if (supportedMps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p>Marketplace ulanmagan. Avval marketplace ulang.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Marketplace selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <MarketplaceFilterBar
          connectedMarketplaces={supportedMps}
          selectedMp={selectedMp}
          onSelect={setSelectedMp}
          showAll={false}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowSettings(s => !s)} className="h-7 gap-1">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">AI sozlama</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchReviews} disabled={isLoading} className="h-7">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* AI Settings Panel */}
      {showSettings && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Auto-Javob</span>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
            {aiEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">Til</label>
                  <Select value={aiLanguage} onValueChange={v => setAiLanguage(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uz">🇺🇿 O'zbek</SelectItem>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">Ohang</label>
                  <Select value={aiTone} onValueChange={v => setAiTone(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">😊 Do'stona</SelectItem>
                      <SelectItem value="formal">🏢 Rasmiy</SelectItem>
                      <SelectItem value="brief">⚡ Qisqa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Button size="sm" onClick={handleAutoReplyAll} className="w-full gap-1.5" variant="default">
                    <Sparkles className="h-3.5 w-3.5" />
                    Barchasiga AI javob yuborish
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Type tabs */}
      {MARKETPLACES_WITH_QUESTIONS.includes(selectedMp) && (
        <Tabs value={reviewType} onValueChange={v => setReviewType(v as ReviewType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feedbacks" className="gap-1.5">
              <MessageCircle className="h-4 w-4" />Sharhlar
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5">
              <HelpCircle className="h-4 w-4" />Savollar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filter row: answered + rating */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={!showAnswered ? 'default' : 'outline'} onClick={() => setShowAnswered(false)} className="h-7 text-xs">
          <Clock className="h-3.5 w-3.5 mr-1" />Javobsiz
        </Button>
        <Button size="sm" variant={showAnswered ? 'default' : 'outline'} onClick={() => setShowAnswered(true)} className="h-7 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Javob berilgan
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {[null, 5, 4, 3, 2, 1].map(r => (
            <Button key={String(r)} size="sm" variant={ratingFilter === r ? 'default' : 'ghost'} className="h-7 px-2 text-xs"
              onClick={() => setRatingFilter(r)}>
              {r === null ? 'Hammasi' : <>{r} <Star className="h-3 w-3 fill-amber-400 text-amber-400 ml-0.5" /></>}
            </Button>
          ))}
        </div>
        <Badge variant="secondary" className="ml-1">{filteredItems.length} ta</Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {showAnswered ? 'Javob berilgan sharhlar yo\'q' : 'Javob kutayotgan sharhlar yo\'q 🎉'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.productName || item.supplierArticle || item.offerId || 'Nomsiz'}</p>
                    {item.userName && <p className="text-xs text-muted-foreground">{item.userName}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.rating != null && item.rating > 0 && renderStars(item.rating)}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('uz')}
                    </span>
                  </div>
                </div>

                {/* Text */}
                <p className="text-sm whitespace-pre-line leading-relaxed">{item.text}</p>

                {/* Photos */}
                {item.photos && item.photos.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {item.photos.filter(Boolean).slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt="" className="h-16 w-16 rounded object-cover shrink-0" />
                    ))}
                  </div>
                )}

                {/* Answer */}
                {item.answer && (
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Sizning javobingiz:</p>
                    <p className="text-sm">{item.answer}</p>
                  </div>
                )}

                {/* Answer form */}
                {!item.isAnswered && (
                  <>
                    {answeringId === item.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Javob yozing..."
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAnswer(item.id)} disabled={sendingAnswer || !answerText.trim()}>
                            <Send className="h-3.5 w-3.5 mr-1" />{sendingAnswer ? 'Yuborilmoqda...' : 'Yuborish'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAnsweringId(null); setAnswerText(''); }}>
                            Bekor
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAnsweringId(item.id)}>
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />Javob berish
                        </Button>
                        {aiEnabled && (
                          <Button size="sm" variant="secondary" onClick={() => handleAIReply(item)}
                            disabled={aiGenerating === item.id}>
                            {aiGenerating === item.id
                              ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                            AI javob
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
