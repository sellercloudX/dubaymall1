import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sparkles, Shield, AlertTriangle, CheckCircle2, XCircle,
  Zap, RefreshCw, Play, Loader2, ChevronDown, ChevronUp,
  FileText, Image, BarChart3, Wrench, ArrowRight, Star,
  Package, Eye, Bot
} from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface CardQualityAuditProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface QualityIssue {
  offerId: string;
  productName: string;
  marketplace: string;
  qualityScore: number;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    currentValue?: string;
    suggestedFix?: string;
  }>;
  fixable: boolean;
  category?: string;
}

interface AuditSummary {
  total: number;
  critical: number;
  warning: number;
  avgScore: number;
  fixable: number;
}

interface FixResult {
  offerId: string;
  status: 'pending' | 'fixing' | 'success' | 'error';
  message?: string;
  fixes?: any;
}

const SEVERITY_CONFIG = {
  error: { label: 'Xatolik', color: 'bg-red-500', textColor: 'text-red-600', icon: XCircle },
  warning: { label: 'Ogohlantirish', color: 'bg-amber-500', textColor: 'text-amber-600', icon: AlertTriangle },
  info: { label: 'Tavsiya', color: 'bg-blue-500', textColor: 'text-blue-600', icon: Eye },
};

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'Wildberries', ozon: 'Ozon',
};

const SCORE_COLORS = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
};

const SCORE_BG = (score: number) => {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-amber-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
};

export function CardQualityAudit({ connectedMarketplaces, store }: CardQualityAuditProps) {
  const [auditResults, setAuditResults] = useState<QualityIssue[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [fixResults, setFixResults] = useState<Map<string, FixResult>>(new Map());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [isBatchFixing, setIsBatchFixing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [auditedMarketplace, setAuditedMarketplace] = useState<string | null>(null);

  // Run audit
  const runAudit = useCallback(async (marketplace?: string) => {
    const mp = marketplace || (connectedMarketplaces.length === 1 ? connectedMarketplaces[0] : 'yandex');
    setIsAuditing(true);
    setAuditResults([]);
    setSummary(null);
    setFixResults(new Map());
    setAuditedMarketplace(mp);

    try {
      const { data, error } = await supabase.functions.invoke('audit-marketplace-cards', {
        body: { action: 'audit', marketplace: mp },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setAuditResults(data.data || []);
      setSummary(data.summary);
      toast.success(`Audit tugadi: ${data.summary.total} ta kartochka tekshirildi`);
    } catch (e: any) {
      console.error("Audit error:", e);
      toast.error(e.message || 'Audit xatolik');
    } finally {
      setIsAuditing(false);
    }
  }, [connectedMarketplaces]);

  // Fix single card
  const fixCard = useCallback(async (offerId: string) => {
    if (!auditedMarketplace) return;
    setFixResults(prev => new Map(prev).set(offerId, { offerId, status: 'fixing' }));

    try {
      const { data, error } = await supabase.functions.invoke('audit-marketplace-cards', {
        body: { action: 'auto-fix', marketplace: auditedMarketplace, offerId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const msg = data.data.message || 'Tuzatildi ✅';
      const details = data.data.details || '';
      setFixResults(prev => new Map(prev).set(offerId, {
        offerId, status: data.data.success === false ? 'error' : 'success',
        message: details ? `${msg}\n${details}` : msg,
        fixes: data.data.fixes,
      }));
      if (data.data.success !== false) {
        toast.success(`${offerId} kartochkasi tuzatildi`);
      } else {
        toast.warning(`${offerId}: qisman tuzatildi`);
      }
    } catch (e: any) {
      setFixResults(prev => new Map(prev).set(offerId, {
        offerId, status: 'error',
        message: e.message || 'Xatolik',
      }));
      toast.error(`${offerId}: ${e.message}`);
    }
  }, [auditedMarketplace]);

  // Batch fix all fixable cards
  const batchFixAll = useCallback(async () => {
    const fixable = auditResults.filter(r => r.fixable && !fixResults.get(r.offerId)?.status?.match(/success|fixing/));
    if (fixable.length === 0) { toast.info('Tuzatish kerak bo\'lgan kartochka yo\'q'); return; }

    setIsBatchFixing(true);
    setBatchProgress({ current: 0, total: fixable.length });

    for (let i = 0; i < fixable.length; i++) {
      setBatchProgress({ current: i + 1, total: fixable.length });
      await fixCard(fixable[i].offerId);
      // Delay between fixes to avoid rate limiting
      if (i < fixable.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setIsBatchFixing(false);
    toast.success(`Batch tuzatish tugadi: ${fixable.length} ta kartochka`);
  }, [auditResults, fixResults, fixCard]);

  const toggleExpand = (offerId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId); else next.add(offerId);
      return next;
    });
  };

  // Filter by marketplace
  const filteredResults = useMemo(() => {
    if (selectedMarketplace === 'all') return auditResults;
    return auditResults.filter(r => r.marketplace === selectedMarketplace);
  }, [auditResults, selectedMarketplace]);

  // Stats
  const successCount = Array.from(fixResults.values()).filter(f => f.status === 'success').length;
  const errorCount = filteredResults.filter(r => r.issues.some(i => i.severity === 'error')).length;
  const warningCount = filteredResults.filter(r => r.issues.some(i => i.severity === 'warning') && !r.issues.some(i => i.severity === 'error')).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Sparkles className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Kartochka Sifat Auditi</h3>
        <p className="text-muted-foreground">Avval kamida bitta marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Kartochka Sifat Auditi
                  <Badge variant="secondary" className="text-[10px]">AI</Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Mavjud kartochkalarni tahlil qilish, xatoliklarni topish va AI yordamida avtomatik tuzatish
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {connectedMarketplaces.map(mp => (
              <Button
                key={mp}
                variant={auditedMarketplace === mp ? "default" : "outline"}
                size="sm"
                onClick={() => runAudit(mp)}
                disabled={isAuditing}
                className="gap-1.5"
              >
                {isAuditing && auditedMarketplace === mp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {MARKETPLACE_NAMES[mp] || mp} audit
              </Button>
            ))}
          </div>
          {isAuditing && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Kartochkalar tekshirilmoqda... Bu 15-30 soniya davom etishi mumkin.
              </div>
              <Progress value={30} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="overflow-hidden"><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Package className="h-3.5 w-3.5" /><span className="text-xs">Jami</span>
            </div>
            <div className="text-xl font-bold">{summary.total}</div>
          </CardContent></Card>
          <Card className={`overflow-hidden ${summary.critical > 0 ? 'border-red-500/30' : ''}`}><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-red-600 mb-1">
              <XCircle className="h-3.5 w-3.5" /><span className="text-xs">Xatolik</span>
            </div>
            <div className="text-xl font-bold text-red-600">{summary.critical}</div>
          </CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-amber-600 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /><span className="text-xs">Ogohlant.</span>
            </div>
            <div className="text-xl font-bold text-amber-600">{summary.warning}</div>
          </CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Star className="h-3.5 w-3.5" /><span className="text-xs">O'rtacha sifat</span>
            </div>
            <div className={`text-xl font-bold ${SCORE_COLORS(summary.avgScore)}`}>{summary.avgScore}%</div>
          </CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-green-600 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" /><span className="text-xs">Tuzatildi</span>
            </div>
            <div className="text-xl font-bold text-green-600">{successCount}</div>
          </CardContent></Card>
        </div>
      )}

      {/* Batch Fix Button */}
      {summary && summary.fixable > 0 && (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Avtomatik tuzatish</h4>
                  <p className="text-xs text-muted-foreground">
                    {summary.fixable} ta kartochkani AI yordamida bir tugmada tuzatish
                  </p>
                </div>
              </div>
              <Button
                onClick={batchFixAll}
                disabled={isBatchFixing || summary.fixable === 0}
                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shrink-0"
              >
                {isBatchFixing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {batchProgress.current}/{batchProgress.total}
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Barchasini tuzatish
                  </>
                )}
              </Button>
            </div>
            {isBatchFixing && (
              <div className="mt-3">
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {batchProgress.current} / {batchProgress.total} kartochka qayta ishlanmoqda...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results List */}
      {filteredResults.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Audit natijalari
              </CardTitle>
              <Badge variant="outline" className="text-xs">{filteredResults.length} ta kartochka</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredResults.map((result) => {
                const isExpanded = expandedCards.has(result.offerId);
                const fixResult = fixResults.get(result.offerId);
                const errorIssues = result.issues.filter(i => i.severity === 'error');
                const warningIssues = result.issues.filter(i => i.severity === 'warning');

                return (
                  <div
                    key={result.offerId}
                    className={`rounded-lg border overflow-hidden transition-all ${
                      fixResult?.status === 'success' ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/10' :
                      fixResult?.status === 'error' ? 'border-red-500/30' : ''
                    }`}
                  >
                    {/* Card Header Row */}
                    <div
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(result.offerId)}
                    >
                      <div className="flex items-center gap-2">
                        {/* Score Badge */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${SCORE_BG(result.qualityScore)}`}>
                          {result.qualityScore}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{result.productName || result.offerId}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono">{result.offerId}</span>
                            {result.category && (
                              <Badge variant="outline" className="text-[10px] px-1">{result.category}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Issue Badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {errorIssues.length > 0 && (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5">{errorIssues.length} xato</Badge>
                          )}
                          {warningIssues.length > 0 && (
                            <Badge className="bg-amber-500 text-white text-[10px] px-1.5">{warningIssues.length} ogoh.</Badge>
                          )}
                          {fixResult?.status === 'success' && (
                            <Badge className="bg-green-500 text-white text-[10px] px-1.5">✅ Tuzatildi</Badge>
                          )}
                        </div>

                        {/* Fix Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-8 px-2"
                          onClick={(e) => { e.stopPropagation(); fixCard(result.offerId); }}
                          disabled={fixResult?.status === 'fixing' || fixResult?.status === 'success'}
                        >
                          {fixResult?.status === 'fixing' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : fixResult?.status === 'success' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Wrench className="h-3.5 w-3.5" />
                          )}
                        </Button>

                        {/* Expand Toggle */}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t">
                        <div className="mt-2 space-y-1.5">
                          {result.issues.map((issue, idx) => {
                            const config = SEVERITY_CONFIG[issue.severity];
                            const Icon = config.icon;
                            return (
                              <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.textColor}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium">{issue.message}</div>
                                  {issue.currentValue && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      Hozirgi: <span className="font-mono">{issue.currentValue}</span>
                                    </div>
                                  )}
                                  {issue.suggestedFix && (
                                    <div className="text-[10px] text-blue-600 mt-0.5">💡 {issue.suggestedFix}</div>
                                  )}
                                </div>
                                <Badge className={`${config.color} text-white text-[10px] px-1 shrink-0`}>
                                  {issue.field}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>

                        {/* Fix result message */}
                        {fixResult?.message && (
                          <div className={`mt-2 p-2 rounded text-xs whitespace-pre-line ${
                            fixResult.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                            fixResult.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : ''
                          }`}>
                            {fixResult.message}
                          </div>
                        )}

                        {/* Individual fix button */}
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => fixCard(result.offerId)}
                            disabled={fixResult?.status === 'fixing' || fixResult?.status === 'success'}
                            className="gap-1.5 text-xs"
                          >
                            {fixResult?.status === 'fixing' ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Tuzatilmoqda...</>
                            ) : fixResult?.status === 'success' ? (
                              <><CheckCircle2 className="h-3 w-3" /> Tuzatildi</>
                            ) : (
                              <><Zap className="h-3 w-3" /> AI bilan tuzatish</>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isAuditing && auditResults.length === 0 && !summary && (
        <Card><CardContent className="py-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Kartochkalarni tekshiring</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Mavjud kartochkalaringizni AI yordamida tahlil qiling. Tizim xatoliklarni topadi, 
            to'ldirilmagan maydonlarni aniqlaydi va sifat indeksini ko'tarish uchun avtomatik tuzatishlar qiladi.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {connectedMarketplaces.map(mp => (
              <Button key={mp} onClick={() => runAudit(mp)} className="gap-2">
                <Play className="h-4 w-4" />
                {MARKETPLACE_NAMES[mp] || mp} auditini boshlash
              </Button>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* All OK State */}
      {!isAuditing && summary && auditResults.length === 0 && (
        <Card className="border-green-500/30"><CardContent className="py-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Barcha kartochkalar mukammal! 🎉</h3>
          <p className="text-sm text-muted-foreground">Hech qanday xatolik topilmadi. Kartochkalaringiz sifati yuqori.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
