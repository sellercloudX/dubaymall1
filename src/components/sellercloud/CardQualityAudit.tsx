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
    <div className="space-y-3">
      {/* Header - compact */}
      <Card className="overflow-hidden border-primary/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                Sifat Auditi
                <Badge variant="secondary" className="text-[9px] px-1 py-0">AI</Badge>
              </h3>
              <p className="text-[10px] text-muted-foreground truncate">Kartochkalarni tahlil va avtomatik tuzatish</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {connectedMarketplaces.map(mp => (
              <Button
                key={mp}
                variant={auditedMarketplace === mp ? "default" : "outline"}
                size="sm"
                onClick={() => runAudit(mp)}
                disabled={isAuditing}
                className="gap-1 h-8 text-xs px-2.5"
              >
                {isAuditing && auditedMarketplace === mp ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {MARKETPLACE_NAMES[mp] || mp}
              </Button>
            ))}
          </div>
          {isAuditing && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Tekshirilmoqda... (15-30 soniya)
              </div>
              <Progress value={30} className="h-1" />
            </div>
          )}
          {/* Real-time quality overview */}
          {summary && !isAuditing && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className={`text-xl font-bold ${SCORE_COLORS(summary.avgScore)}`}>{summary.avgScore}%</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground">O'rtacha sifat</div>
                <Progress value={summary.avgScore} className="h-1.5 mt-0.5" />
              </div>
              <div className="flex gap-1 text-[10px] shrink-0">
                <span className="text-destructive font-medium">{summary.critical}❌</span>
                <span className="text-amber-600 font-medium">{summary.warning}⚠️</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {[
            { icon: Package, label: 'Jami', value: summary.total, color: '' },
            { icon: XCircle, label: 'Xato', value: summary.critical, color: 'text-destructive' },
            { icon: AlertTriangle, label: 'Ogoh.', value: summary.warning, color: 'text-amber-600' },
            { icon: Star, label: 'Ball', value: `${summary.avgScore}%`, color: SCORE_COLORS(summary.avgScore) },
            { icon: CheckCircle2, label: 'OK', value: successCount, color: 'text-green-600' },
          ].map((kpi, idx) => (
            <Card key={idx} className="overflow-hidden"><CardContent className="p-2 text-center">
              <kpi.icon className={`h-3 w-3 mx-auto mb-0.5 ${kpi.color || 'text-muted-foreground'}`} />
              <div className={`text-base font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Batch Fix Button */}
      {summary && summary.fixable > 0 && (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <h4 className="font-semibold text-xs">Avtomatik tuzatish ({summary.fixable} ta)</h4>
                </div>
              </div>
              <Button
                onClick={batchFixAll}
                disabled={isBatchFixing || summary.fixable === 0}
                size="sm"
                className="gap-1.5 h-8 text-xs bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shrink-0"
              >
                {isBatchFixing ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />{batchProgress.current}/{batchProgress.total}</>
                ) : (
                  <><Zap className="h-3 w-3" />Tuzatish</>
                )}
              </Button>
            </div>
            {isBatchFixing && (
              <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5 mt-2" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Results List */}
      {filteredResults.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Natijalar
              </span>
              <Badge variant="outline" className="text-[10px]">{filteredResults.length} ta</Badge>
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredResults.map((result) => {
                const isExpanded = expandedCards.has(result.offerId);
                const fixResult = fixResults.get(result.offerId);
                const errorIssues = result.issues.filter(i => i.severity === 'error');
                const warningIssues = result.issues.filter(i => i.severity === 'warning');

                return (
                  <div
                    key={result.offerId}
                    className={`rounded-md border overflow-hidden transition-all ${
                      fixResult?.status === 'success' ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/10' :
                      fixResult?.status === 'error' ? 'border-destructive/30' : ''
                    }`}
                  >
                    <div
                      className="p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(result.offerId)}
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Score Badge - compact */}
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 ${SCORE_BG(result.qualityScore)}`}>
                          {result.qualityScore}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate">{result.productName || result.offerId}</div>
                          <div className="text-[9px] text-muted-foreground font-mono truncate">{result.offerId}</div>
                        </div>

                        {/* Issue counts inline */}
                        <div className="flex items-center gap-1 shrink-0 text-[10px]">
                          {errorIssues.length > 0 && (
                            <span className="text-destructive font-medium">{errorIssues.length}❌</span>
                          )}
                          {warningIssues.length > 0 && (
                            <span className="text-amber-600 font-medium">{warningIssues.length}⚠️</span>
                          )}
                          {fixResult?.status === 'success' && <span>✅</span>}
                        </div>

                        {/* Fix + Expand */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); fixCard(result.offerId); }}
                          disabled={fixResult?.status === 'fixing' || fixResult?.status === 'success'}
                        >
                          {fixResult?.status === 'fixing' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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

      {/* Empty State - no duplicate buttons, header already has them */}
      {!isAuditing && auditResults.length === 0 && !summary && (
        <Card><CardContent className="py-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Kartochkalarni tekshiring</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Yuqoridagi tugmalar orqali marketplace kartochkalaringizni AI yordamida tahlil qiling.
            Tizim xatoliklarni topadi va sifat indeksini ko'tarish uchun avtomatik tuzatishlar qiladi.
          </p>
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
