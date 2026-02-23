import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MessageCircle, HelpCircle, Send, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export function MarketplaceReviews({ connectedMarketplaces }: MarketplaceReviewsProps) {
  const [reviewType, setReviewType] = useState<ReviewType>('feedbacks');
  const [showAnswered, setShowAnswered] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [selectedMp, setSelectedMp] = useState<string>('');

  const hasWB = connectedMarketplaces.includes('wildberries');
  const hasYandex = connectedMarketplaces.includes('yandex');

  useEffect(() => {
    if (hasWB) setSelectedMp('wildberries');
    else if (hasYandex) setSelectedMp('yandex');
  }, [hasWB, hasYandex]);

  const fetchReviews = useCallback(async () => {
    if (!selectedMp) return;
    setIsLoading(true);
    try {
      let dataType = reviewType;
      if (selectedMp === 'yandex') dataType = 'reviews' as any;

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: {
          marketplace: selectedMp,
          dataType,
          isAnswered: showAnswered,
          take: 50,
        },
      });
      if (error) throw error;
      setItems(data?.data || []);
    } catch (e: any) {
      console.error('Fetch reviews error:', e);
      toast.error('Ma\'lumotlarni yuklashda xato');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMp, reviewType, showAnswered]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleAnswer = async (itemId: string) => {
    if (!answerText.trim()) return;
    setSendingAnswer(true);
    try {
      const answerDataType = reviewType === 'feedbacks' ? 'answer-feedback' : 'answer-question';
      const body: any = {
        marketplace: selectedMp,
        dataType: answerDataType,
        text: answerText,
      };
      if (reviewType === 'feedbacks') body.feedbackId = itemId;
      else body.questionId = itemId;

      const { error } = await supabase.functions.invoke('fetch-marketplace-data', { body });
      if (error) throw error;
      toast.success('Javob yuborildi!');
      setAnsweringId(null);
      setAnswerText('');
      fetchReviews();
    } catch (e: any) {
      toast.error('Javob yuborishda xato');
    } finally {
      setSendingAnswer(false);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
    </div>
  );

  if (!hasWB && !hasYandex) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Marketplace ulanmagan. Avval marketplace ulang.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Marketplace selector */}
      <div className="flex gap-2">
        {hasWB && (
          <Button size="sm" variant={selectedMp === 'wildberries' ? 'default' : 'outline'} onClick={() => setSelectedMp('wildberries')}>
            Wildberries
          </Button>
        )}
        {hasYandex && (
          <Button size="sm" variant={selectedMp === 'yandex' ? 'default' : 'outline'} onClick={() => setSelectedMp('yandex')}>
            Yandex Market
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={fetchReviews} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Type tabs (WB only has separate feedbacks/questions) */}
      {selectedMp === 'wildberries' && (
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

      {/* Filter */}
      <div className="flex gap-2">
        <Button size="sm" variant={!showAnswered ? 'default' : 'outline'} onClick={() => setShowAnswered(false)}>
          <Clock className="h-3.5 w-3.5 mr-1" />Javobsiz
        </Button>
        <Button size="sm" variant={showAnswered ? 'default' : 'outline'} onClick={() => setShowAnswered(true)}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Javob berilgan
        </Button>
        <Badge variant="secondary" className="ml-auto">{items.length} ta</Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {showAnswered ? 'Javob berilgan sharhlar yo\'q' : 'Javob kutayotgan sharhlar yo\'q 🎉'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.productName || item.supplierArticle || 'Nomsiz'}</p>
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
                <p className="text-sm">{item.text}</p>

                {/* Photos */}
                {item.photos && item.photos.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {item.photos.slice(0, 4).map((url, i) => (
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
                {!item.isAnswered && selectedMp === 'wildberries' && (
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
                            <Send className="h-3.5 w-3.5 mr-1" />Yuborish
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAnsweringId(null); setAnswerText(''); }}>
                            Bekor
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setAnsweringId(item.id)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />Javob berish
                      </Button>
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
