import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Search, Loader2, Hash, CheckCircle, Copy, Sparkles,
  AlertCircle, Package, Percent, ChevronRight, Zap
} from 'lucide-react';

interface MxikResult {
  mxik_code: string;
  mxik_name: string;
  name_ru?: string;
  vat_rate: number;
  confidence: number;
  group_name?: string;
  alternatives?: Array<{
    code: string;
    name_uz: string;
    name_ru?: string;
    vat_rate: number;
    relevance: number;
  }>;
}

interface MxikLookupProps {
  /** If provided, auto-fills the search field */
  initialProductName?: string;
  /** Callback when user selects a code */
  onSelect?: (code: string, name: string, vatRate: number) => void;
  /** Compact mode for embedding in forms */
  compact?: boolean;
}

export function MxikLookup({ initialProductName, onSelect, compact = false }: MxikLookupProps) {
  const [productName, setProductName] = useState(initialProductName || '');
  const [category, setCategory] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<MxikResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [showLocal, setShowLocal] = useState(false);

  const searchMxik = useCallback(async () => {
    if (!productName.trim()) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }

    setIsSearching(true);
    setResult(null);
    setLocalResults([]);
    setShowLocal(false);

    try {
      // Try edge function first (AI-powered)
      const { data, error } = await supabase.functions.invoke('lookup-mxik-code', {
        body: {
          productName: productName.trim(),
          category: category.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.mxik_code) {
        setResult({
          mxik_code: data.mxik_code,
          mxik_name: data.mxik_name || data.name_uz || '',
          name_ru: data.name_ru,
          vat_rate: data.vat_rate ?? 12,
          confidence: data.confidence ?? 80,
          group_name: data.group_name,
          alternatives: data.alternatives || [],
        });
        toast.success('MXIK kod topildi!');
      } else {
        toast.warning('MXIK kod topilmadi. Qo\'lda qidiring.');
        setShowLocal(true);
        await searchLocal(productName.trim());
      }
    } catch (err: any) {
      console.error('MXIK lookup error:', err);
      toast.error('Xatolik yuz berdi. Qo\'lda qidiring.');
      setShowLocal(true);
      await searchLocal(productName.trim());
    } finally {
      setIsSearching(false);
    }
  }, [productName, category]);

  const searchLocal = async (term: string) => {
    try {
      const { data } = await supabase.rpc('search_mxik_fuzzy', {
        p_search_term: term.slice(0, 200),
        p_limit: 15,
      });
      if (data && data.length > 0) {
        setLocalResults(data);
      }
    } catch (e) {
      console.error('Local MXIK search error:', e);
    }
  };

  const handleSelect = (code: string, name: string, vatRate: number) => {
    onSelect?.(code, name, vatRate);
    toast.success(`MXIK: ${code} tanlandi`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kod nusxalandi');
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 85) return 'text-green-600 dark:text-green-400';
    if (conf >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-500 dark:text-red-400';
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 85) return 'default';
    if (conf >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Search Form */}
      <Card>
        <CardHeader className={compact ? 'pb-2 pt-3 px-4' : undefined}>
          <CardTitle className={compact ? 'text-base flex items-center gap-2' : 'flex items-center gap-2'}>
            <Hash className="h-5 w-5 text-primary" />
            MXIK (IKPU) Kod Aniqlash
          </CardTitle>
          {!compact && (
            <CardDescription>
              Mahsulot nomini kiriting — AI avtomatik ravishda eng mos MXIK kodini topadi
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3 space-y-2' : 'space-y-3'}>
          <div className="space-y-2">
            <Label>Mahsulot nomi</Label>
            <div className="flex gap-2">
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Masalan: iPhone 15 Pro Max 256GB"
                onKeyDown={(e) => e.key === 'Enter' && searchMxik()}
              />
              <Button
                onClick={searchMxik}
                disabled={isSearching || !productName.trim()}
                className="shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Topish
                  </>
                )}
              </Button>
            </div>
          </div>
          {!compact && (
            <div className="space-y-2">
              <Label>Kategoriya (ixtiyoriy)</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Masalan: Elektronika, Kiyim-kechak"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Result */}
      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="font-semibold text-sm">AI natijasi</span>
                  <Badge variant={getConfidenceBadge(result.confidence) as any}>
                    {result.confidence}% ishonch
                  </Badge>
                </div>
                <p className="text-lg font-mono font-bold text-primary tracking-wide">
                  {result.mxik_code}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.mxik_name}
                  {result.name_ru && <span className="text-xs ml-1 opacity-70">({result.name_ru})</span>}
                </p>
                {result.group_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Guruh: {result.group_name}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="gap-1">
                  <Percent className="h-3 w-3" />
                  QQS {result.vat_rate}%
                </Badge>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCode(result.mxik_code)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {onSelect && (
                    <Button
                      size="sm"
                      onClick={() => handleSelect(result.mxik_code, result.mxik_name, result.vat_rate)}
                      className="h-7 px-3"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Tanlash
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Alternatives */}
            {result.alternatives && result.alternatives.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Boshqa variantlar:
                  </p>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1.5">
                      {result.alternatives.map((alt, i) => (
                        <div
                          key={alt.code}
                          className="flex items-center justify-between p-2 rounded-md bg-background hover:bg-accent/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setResult({
                              ...result,
                              mxik_code: alt.code,
                              mxik_name: alt.name_uz,
                              name_ru: alt.name_ru,
                              vat_rate: alt.vat_rate ?? 12,
                              confidence: Math.round(alt.relevance * 100),
                            });
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground">{alt.code}</span>
                            <p className="text-sm truncate">{alt.name_uz}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Local Search Fallback */}
      {showLocal && localResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Bazadan topilgan natijalar ({localResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-60">
              <div className="space-y-1.5">
                {localResults.map((item: any) => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between p-2.5 rounded-md bg-muted/50 hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      setResult({
                        mxik_code: item.code,
                        mxik_name: item.name_uz,
                        name_ru: item.name_ru,
                        vat_rate: item.vat_rate ?? 12,
                        confidence: Math.round((item.relevance || 0.5) * 100),
                        group_name: item.group_name,
                        alternatives: [],
                      });
                      setShowLocal(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-primary">{item.code}</span>
                        {item.relevance && (
                          <Badge variant="outline" className="text-xs h-4 px-1">
                            {Math.round(item.relevance * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm truncate mt-0.5">{item.name_uz}</p>
                      {item.name_ru && (
                        <p className="text-xs text-muted-foreground truncate">{item.name_ru}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Manual Input */}
      {!compact && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowManual(!showManual)}
            className="text-xs text-muted-foreground"
          >
            {showManual ? 'Yopish' : 'Qo\'lda kiritish'}
          </Button>
        </div>
      )}

      {showManual && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-2">
            <Label className="text-xs">MXIK kodni qo'lda kiriting (17 raqam)</Label>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 17))}
                placeholder="26301100001000000"
                className="font-mono"
                maxLength={17}
              />
              {onSelect && (
                <Button
                  size="sm"
                  disabled={manualCode.length !== 17}
                  onClick={() => handleSelect(manualCode, 'Qo\'lda kiritilgan', 12)}
                >
                  Tasdiqlash
                </Button>
              )}
            </div>
            {manualCode.length > 0 && manualCode.length !== 17 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {manualCode.length}/17 raqam kiritildi
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
