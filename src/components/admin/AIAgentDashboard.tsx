import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Scan, Wrench, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Image, FileText, Tag, ChevronDown, ChevronRight,
  Zap, RotateCcw, Shield
} from 'lucide-react';

interface ProductIssue {
  offerId: string;
  nmID?: number;
  subjectID?: number;
  name: string;
  category: string;
  score: number;
  issueCount: number;
  issues: string[];
  issueDetails?: { type: string; field: string; msg: string }[];
  imageCount: number;
  descriptionLength?: number;
  hasDescription: boolean;
  hasVendor: boolean;
  asyncErrors?: number;
  apiErrors?: number;
  apiWarnings?: number;
}

interface ScanResult {
  marketplace: string;
  totalProducts: number;
  avgScore: number;
  criticalCount: number;
  warningCount: number;
  goodCount: number;
  products: ProductIssue[];
  error?: string;
}

interface FixResult {
  offerId: string;
  name: string;
  success: boolean;
  message: string;
  rounds?: number;
  newScore?: number;
  fix?: { name: string; summary: string };
}

export function AIAgentDashboard() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [fixHistory, setFixHistory] = useState<FixResult[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<{ current: number; total: number; marketplace: string } | null>(null);

  const { data: partners } = useQuery({
    queryKey: ['ai-agent-partners'],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from('sellercloud_subscriptions')
        .select('user_id, is_active, plan_type')
        .eq('is_active', true);
      if (!subs?.length) return [];

      const userIds = subs.map(s => s.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
      const { data: connections } = await supabase.from('marketplace_connections').select('user_id, marketplace, is_active').in('user_id', userIds).eq('is_active', true);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      const connMap = new Map<string, string[]>();
      for (const c of connections || []) {
        if (!connMap.has(c.user_id)) connMap.set(c.user_id, []);
        connMap.get(c.user_id)!.push(c.marketplace);
      }

      return subs.filter(s => connMap.has(s.user_id)).map(s => ({
        userId: s.user_id,
        name: profileMap[s.user_id]?.full_name || 'Noma\'lum',
        phone: profileMap[s.user_id]?.phone || '',
        plan: s.plan_type,
        marketplaces: connMap.get(s.user_id) || [],
      }));
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-scan', { body: { partnerId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.results as ScanResult[];
    },
    onSuccess: (results) => {
      setScanResults(results);
      setSelectedProducts(new Set());
      setFixHistory([]);
      const total = results.reduce((s, r) => s + r.totalProducts, 0);
      const critical = results.reduce((s, r) => s + r.criticalCount, 0);
      toast.success(`${total} ta mahsulot skanerlandi. ${critical} ta kritik muammo.`);
    },
    onError: (err: any) => toast.error(`Skanerlash xatosi: ${err.message}`),
  });

  const fixMutation = useMutation({
    mutationFn: async ({ partnerId, marketplace, products }: { partnerId: string; marketplace: string; products: ProductIssue[] }) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-fix', { body: { partnerId, marketplace, products, maxRetries: 2 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setFixHistory(prev => [...prev, ...(data.results || [])]);
      toast.success(`${data.totalFixed} ta tuzatildi, ${data.totalFailed} ta xato.`);
      if (selectedPartnerId) scanMutation.mutate(selectedPartnerId);
    },
    onError: (err: any) => toast.error(`Tuzatish xatosi: ${err.message}`),
  });

  // Auto-fix all critical products across all marketplaces
  const autoFixAll = async () => {
    if (!selectedPartnerId) return;
    const allCriticals: { marketplace: string; products: ProductIssue[] }[] = [];
    
    for (const result of scanResults) {
      const criticals = result.products.filter(p => p.score < 80 && p.issueCount > 0);
      if (criticals.length > 0) {
        allCriticals.push({ marketplace: result.marketplace, products: criticals });
      }
    }

    if (allCriticals.length === 0) {
      toast.info('Tuzatish kerak bo\'lgan mahsulot topilmadi');
      return;
    }

    const totalProducts = allCriticals.reduce((s, c) => s + c.products.length, 0);
    setAutoFixProgress({ current: 0, total: totalProducts, marketplace: '' });

    let processed = 0;
    for (const group of allCriticals) {
      // Process in batches of 10
      for (let i = 0; i < group.products.length; i += 10) {
        const batch = group.products.slice(i, i + 10);
        setAutoFixProgress({ current: processed, total: totalProducts, marketplace: group.marketplace });
        
        try {
          const { data } = await supabase.functions.invoke('ai-agent-fix', {
            body: { partnerId: selectedPartnerId, marketplace: group.marketplace, products: batch, maxRetries: 2 },
          });
          if (data?.results) {
            setFixHistory(prev => [...prev, ...data.results]);
          }
        } catch (e: any) {
          console.error('Auto-fix batch error:', e);
        }
        processed += batch.length;
      }
    }

    setAutoFixProgress(null);
    toast.success(`Avtomatik tuzatish yakunlandi! ${totalProducts} ta mahsulot qayta ishlandi.`);
    scanMutation.mutate(selectedPartnerId);
  };

  const toggleProduct = (offerId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(offerId) ? next.delete(offerId) : next.add(offerId);
      return next;
    });
  };

  const selectAllInMarketplace = (marketplace: string) => {
    const result = scanResults.find(r => r.marketplace === marketplace);
    if (!result) return;
    const allIds = result.products.filter(p => p.issueCount > 0).map(p => p.offerId);
    setSelectedProducts(prev => {
      const next = new Set(prev);
      const allSelected = allIds.every(id => next.has(id));
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const fixSelected = (marketplace: string) => {
    const result = scanResults.find(r => r.marketplace === marketplace);
    if (!result) return;
    const products = result.products.filter(p => selectedProducts.has(p.offerId));
    if (products.length === 0) { toast.error('Mahsulotlarni tanlang'); return; }
    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace, products });
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500 text-white font-bold">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500 text-white font-bold">{score}</Badge>;
    return <Badge variant="destructive" className="font-bold">{score}</Badge>;
  };

  const getFixResultForProduct = (offerId: string) => fixHistory.find(r => r.offerId === offerId);
  const selectedPartner = partners?.find(p => p.userId === selectedPartnerId);
  const totalCritical = scanResults.reduce((s, r) => s + r.criticalCount, 0);
  const totalProducts = scanResults.reduce((s, r) => s + r.totalProducts, 0);
  const isFixing = fixMutation.isPending || !!autoFixProgress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Agent — Marketplace Manager
            <Badge variant="outline" className="ml-2 text-xs">Self-Healing v2</Badge>
          </CardTitle>
          <CardDescription>
            Hamkorlarning marketplace akkauntlarini avtonom tahlil qilish, muammolarni aniqlash va o'z-o'zini tuzatish
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Hamkorni tanlang</label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Hamkor tanlash..." />
                </SelectTrigger>
                <SelectContent>
                  {partners?.map(p => (
                    <SelectItem key={p.userId} value={p.userId}>
                      {p.name} ({p.marketplaces.join(', ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => selectedPartnerId && scanMutation.mutate(selectedPartnerId)}
                disabled={!selectedPartnerId || scanMutation.isPending}
                className="gap-2"
              >
                {scanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                {scanMutation.isPending ? 'Skanerlanmoqda...' : 'Skanerlash'}
              </Button>
              {scanResults.length > 0 && totalCritical > 0 && (
                <Button
                  onClick={autoFixAll}
                  disabled={isFixing}
                  variant="destructive"
                  className="gap-2"
                >
                  {autoFixProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Hammasini tuzat ({totalCritical + scanResults.reduce((s, r) => s + r.warningCount, 0)})
                </Button>
              )}
            </div>
          </div>

          {selectedPartner && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {selectedPartner.marketplaces.map(mp => (
                <Badge key={mp} variant="outline" className="text-xs">
                  {mp === 'yandex' ? '🟡 Yandex Market' : mp === 'wildberries' ? '🟣 Wildberries' : mp}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs">{selectedPartner.plan}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-fix progress */}
      {autoFixProgress && (
        <Card className="border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Avtomatik tuzatish jarayonida...</span>
              <Badge variant="outline">{autoFixProgress.marketplace}</Badge>
            </div>
            <Progress value={(autoFixProgress.current / autoFixProgress.total) * 100} className="h-2" />
            <p className="text-sm text-muted-foreground mt-1">
              {autoFixProgress.current} / {autoFixProgress.total} mahsulot qayta ishlandi
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fix History */}
      {fixHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Tuzatish tarixi ({fixHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {fixHistory.map((r, i) => (
                  <div key={`${r.offerId}-${i}`} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    {r.success ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{r.name || r.offerId}</span>
                    {r.rounds && r.rounds > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" />{r.rounds} round
                      </Badge>
                    )}
                    {r.newScore && <Badge className="bg-green-500 text-white text-[10px]">{r.newScore}</Badge>}
                    {r.fix?.summary && <span className="text-muted-foreground text-xs truncate max-w-[200px]">{r.fix.summary}</span>}
                    {!r.success && <span className="text-destructive text-xs truncate max-w-[200px]">{r.message}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanResults.map(result => (
        <Card key={result.marketplace}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.marketplace === 'yandex' ? '🟡' : '🟣'}
                {result.marketplace === 'yandex' ? 'Yandex Market' : 'Wildberries'}
                {result.error && <Badge variant="destructive">Xatolik</Badge>}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => selectAllInMarketplace(result.marketplace)} disabled={result.products.length === 0}>
                  Hammasini tanlash
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={() => {
                    const criticals = result.products.filter(p => p.score < 50);
                    if (criticals.length === 0) { toast.info('Kritik muammo yo\'q'); return; }
                    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: criticals });
                  }}
                  disabled={result.criticalCount === 0 || isFixing}
                  className="gap-1"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Kritik ({result.criticalCount})
                </Button>
                <Button
                  size="sm"
                  onClick={() => fixSelected(result.marketplace)}
                  disabled={selectedProducts.size === 0 || isFixing}
                  className="gap-1"
                >
                  {fixMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                  Tanlanganni tuzat ({result.products.filter(p => selectedProducts.has(p.offerId)).length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {result.error ? (
              <div className="text-center py-8 text-destructive">
                <XCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{result.error}</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <Card className="bg-muted/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{result.totalProducts}</p><p className="text-xs text-muted-foreground">Jami</p></CardContent></Card>
                  <Card className="bg-muted/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{result.avgScore}</p><p className="text-xs text-muted-foreground">O'rtacha ball</p></CardContent></Card>
                  <Card className="bg-red-50 dark:bg-red-950/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-red-600">{result.criticalCount}</p><p className="text-xs text-muted-foreground">Kritik</p></CardContent></Card>
                  <Card className="bg-yellow-50 dark:bg-yellow-950/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-yellow-600">{result.warningCount}</p><p className="text-xs text-muted-foreground">Ogohlantirish</p></CardContent></Card>
                  <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-green-600">{result.goodCount}</p><p className="text-xs text-muted-foreground">Yaxshi</p></CardContent></Card>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Umumiy salomatlik</span>
                    <span className="font-medium">{result.avgScore}%</span>
                  </div>
                  <Progress value={result.avgScore} className="h-2" />
                </div>

                {/* Products Table */}
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-6"></TableHead>
                        <TableHead>Mahsulot</TableHead>
                        <TableHead>Kategoriya</TableHead>
                        <TableHead className="text-center">Ball</TableHead>
                        <TableHead className="text-center"><Image className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><FileText className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><Tag className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead>Holat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.products.map(product => {
                        const fixResult = getFixResultForProduct(product.offerId);
                        const isExpanded = expandedProduct === product.offerId;
                        return (
                          <>
                            <TableRow
                              key={product.offerId}
                              className={`cursor-pointer ${product.score < 50 ? 'bg-red-50/50 dark:bg-red-950/10' : ''} ${fixResult?.success ? 'bg-green-50/50 dark:bg-green-950/10' : ''}`}
                              onClick={() => setExpandedProduct(isExpanded ? null : product.offerId)}
                            >
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedProducts.has(product.offerId)}
                                  onCheckedChange={() => toggleProduct(product.offerId)}
                                  disabled={product.issueCount === 0}
                                />
                              </TableCell>
                              <TableCell>
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate font-medium" title={product.name}>
                                {product.name}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{product.category || '-'}</TableCell>
                              <TableCell className="text-center">{getScoreBadge(product.score)}</TableCell>
                              <TableCell className="text-center">
                                {product.imageCount >= 3 ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}
                                <span className="text-[10px] ml-0.5">{product.imageCount}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                {product.hasDescription ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}
                              </TableCell>
                              <TableCell className="text-center">
                                {product.hasVendor ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}
                              </TableCell>
                              <TableCell>
                                {fixResult ? (
                                  fixResult.success ? (
                                    <Badge className="bg-green-500 text-white text-[10px]">
                                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Tuzatildi
                                      {fixResult.rounds && fixResult.rounds > 1 && ` (${fixResult.rounds}x)`}
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[10px]">
                                      <XCircle className="h-2.5 w-2.5 mr-0.5" />Xato
                                    </Badge>
                                  )
                                ) : product.issueCount > 0 ? (
                                  <Badge variant="outline" className="text-[10px]">{product.issueCount} muammo</Badge>
                                ) : (
                                  <Badge className="bg-green-500/20 text-green-700 text-[10px]">
                                    <Shield className="h-2.5 w-2.5 mr-0.5" />OK
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {/* Expanded row with details */}
                            {isExpanded && (
                              <TableRow key={`${product.offerId}-details`}>
                                <TableCell colSpan={9} className="bg-muted/30 p-4">
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                      <div><span className="text-muted-foreground">Tavsif:</span> {product.descriptionLength || 0} belgi</div>
                                      <div><span className="text-muted-foreground">Rasmlar:</span> {product.imageCount} ta</div>
                                      {product.asyncErrors !== undefined && product.asyncErrors > 0 && (
                                        <div className="text-red-600"><span className="text-muted-foreground">WB xatolar:</span> {product.asyncErrors}</div>
                                      )}
                                      {product.apiErrors !== undefined && product.apiErrors > 0 && (
                                        <div className="text-red-600"><span className="text-muted-foreground">API xatolar:</span> {product.apiErrors}</div>
                                      )}
                                    </div>
                                    {product.issueDetails && product.issueDetails.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium">Batafsil muammolar:</p>
                                        {product.issueDetails.map((detail, i) => (
                                          <div key={i} className="flex items-center gap-2 text-sm">
                                            {detail.type === 'critical' ? (
                                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                            ) : (
                                              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                                            )}
                                            <Badge variant="outline" className="text-[10px] px-1">{detail.field}</Badge>
                                            <span>{detail.msg}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {!product.issueDetails && product.issues.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {product.issues.map((issue, i) => (
                                          <Badge key={i} variant="outline" className="text-[10px] px-1">{issue}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {fixResult && (
                                      <div className={`p-2 rounded text-sm ${fixResult.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                                        <p className="font-medium">{fixResult.success ? '✅ Tuzatish natijasi:' : '❌ Xato:'}</p>
                                        <p>{fixResult.message}</p>
                                        {fixResult.fix?.summary && <p className="text-muted-foreground mt-1">{fixResult.fix.summary}</p>}
                                      </div>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: [product] });
                                      }}
                                      disabled={product.issueCount === 0 || isFixing}
                                      className="gap-1"
                                    >
                                      <Wrench className="h-3 w-3" />
                                      {fixResult ? 'Qayta tuzatish' : 'Tuzatish'}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Empty / Loading States */}
      {scanResults.length === 0 && !scanMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">AI Agent tayyor</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Hamkorni tanlang va "Skanerlash" tugmasini bosing. AI agent barcha marketplace akkauntlarini chuqur tahlil qiladi, muammolarni aniqlaydi va o'z-o'zini tuzatish (self-healing) imkoniyati bilan avtomatik tuzatadi.
            </p>
          </CardContent>
        </Card>
      )}

      {scanMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-1">Chuqur skanerlash...</h3>
            <p className="text-muted-foreground text-center">
              AI agent barcha mahsulotlarni, WB xatoliklar ro'yxatini va sifat ko'rsatkichlarini tahlil qilmoqda.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
