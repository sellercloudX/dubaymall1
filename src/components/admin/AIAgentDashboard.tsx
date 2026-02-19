import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Scan, Wrench, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Image, FileText, Tag, ChevronDown, ChevronRight,
  Zap, RotateCcw, Shield, DollarSign, TrendingUp, TrendingDown,
  Camera, Sparkles, BarChart3, Wallet
} from 'lucide-react';

// ===== Types =====
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

interface PriceProduct {
  offerId: string;
  name: string;
  price: number;
  costPrice: number;
  margin: number | null;
  currency: string;
  marketplace: string;
  category: string;
  isPriceRisky: boolean;
  isPriceLow: boolean;
  originalPrice?: number;
  discount?: number;
}

// ===== Sub-components =====
function PartnerSelector({ partners, selectedPartnerId, onSelect }: any) {
  const selectedPartner = partners?.find((p: any) => p.userId === selectedPartnerId);
  return (
    <div className="space-y-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium mb-1 block">Hamkorni tanlang</label>
        <Select value={selectedPartnerId} onValueChange={onSelect}>
          <SelectTrigger><SelectValue placeholder="Hamkor tanlash..." /></SelectTrigger>
          <SelectContent>
            {partners?.map((p: any) => (
              <SelectItem key={p.userId} value={p.userId}>
                {p.name} ({p.marketplaces.join(', ')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedPartner && (
        <div className="flex gap-2 flex-wrap">
          {selectedPartner.marketplaces.map((mp: string) => (
            <Badge key={mp} variant="outline" className="text-xs">
              {mp === 'yandex' ? '🟡 Yandex Market' : mp === 'wildberries' ? '🟣 Wildberries' : mp}
            </Badge>
          ))}
          <Badge variant="outline" className="text-xs">{selectedPartner.plan}</Badge>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-green-500 text-white font-bold">{score}</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500 text-white font-bold">{score}</Badge>;
  return <Badge variant="destructive" className="font-bold">{score}</Badge>;
}

function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3 text-center">
        <p className={`text-2xl font-bold ${color || ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ===== Card Audit Tab =====
function CardAuditTab({ selectedPartnerId, scanResults, setScanResults }: any) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [fixHistory, setFixHistory] = useState<FixResult[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<{ current: number; total: number; marketplace: string } | null>(null);

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
      const total = results.reduce((s: number, r: ScanResult) => s + r.totalProducts, 0);
      const critical = results.reduce((s: number, r: ScanResult) => s + r.criticalCount, 0);
      toast.success(`${total} ta mahsulot skanerlandi. ${critical} ta kritik muammo.`);
    },
    onError: (err: any) => toast.error(`Skanerlash xatosi: ${err.message}`),
  });

  const fixMutation = useMutation({
    mutationFn: async ({ partnerId, marketplace, products }: any) => {
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

  const autoFixAll = async () => {
    if (!selectedPartnerId) return;
    const allCriticals: { marketplace: string; products: ProductIssue[] }[] = [];
    for (const result of scanResults) {
      const criticals = result.products.filter((p: ProductIssue) => p.score < 80 && p.issueCount > 0);
      if (criticals.length > 0) allCriticals.push({ marketplace: result.marketplace, products: criticals });
    }
    if (allCriticals.length === 0) { toast.info('Tuzatish kerak bo\'lgan mahsulot topilmadi'); return; }

    const totalProducts = allCriticals.reduce((s, c) => s + c.products.length, 0);
    setAutoFixProgress({ current: 0, total: totalProducts, marketplace: '' });
    let processed = 0;

    for (const group of allCriticals) {
      for (let i = 0; i < group.products.length; i += 10) {
        const batch = group.products.slice(i, i + 10);
        setAutoFixProgress({ current: processed, total: totalProducts, marketplace: group.marketplace });
        try {
          const { data } = await supabase.functions.invoke('ai-agent-fix', {
            body: { partnerId: selectedPartnerId, marketplace: group.marketplace, products: batch, maxRetries: 2 },
          });
          if (data?.results) setFixHistory(prev => [...prev, ...data.results]);
        } catch (e: any) { console.error('Auto-fix batch error:', e); }
        processed += batch.length;
      }
    }
    setAutoFixProgress(null);
    toast.success(`Avtomatik tuzatish yakunlandi!`);
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
    const result = scanResults.find((r: ScanResult) => r.marketplace === marketplace);
    if (!result) return;
    const allIds = result.products.filter((p: ProductIssue) => p.issueCount > 0).map((p: ProductIssue) => p.offerId);
    setSelectedProducts(prev => {
      const next = new Set(prev);
      const allSelected = allIds.every((id: string) => next.has(id));
      allIds.forEach((id: string) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const totalCritical = scanResults.reduce((s: number, r: ScanResult) => s + r.criticalCount, 0);
  const isFixing = fixMutation.isPending || !!autoFixProgress;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => selectedPartnerId && scanMutation.mutate(selectedPartnerId)} disabled={!selectedPartnerId || scanMutation.isPending} className="gap-2">
          {scanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
          {scanMutation.isPending ? 'Skanerlanmoqda...' : 'Skanerlash'}
        </Button>
        {scanResults.length > 0 && totalCritical > 0 && (
          <Button onClick={autoFixAll} disabled={isFixing} variant="destructive" className="gap-2">
            {autoFixProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Hammasini tuzat ({totalCritical + scanResults.reduce((s: number, r: ScanResult) => s + r.warningCount, 0)})
          </Button>
        )}
      </div>

      {/* Progress */}
      {autoFixProgress && (
        <Card className="border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Avtomatik tuzatish...</span>
              <Badge variant="outline">{autoFixProgress.marketplace}</Badge>
            </div>
            <Progress value={(autoFixProgress.current / autoFixProgress.total) * 100} className="h-2" />
            <p className="text-sm text-muted-foreground mt-1">{autoFixProgress.current} / {autoFixProgress.total}</p>
          </CardContent>
        </Card>
      )}

      {/* Fix History */}
      {fixHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4" />Tuzatish tarixi ({fixHistory.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {fixHistory.map((r, i) => (
                  <div key={`${r.offerId}-${i}`} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    {r.success ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{r.name || r.offerId}</span>
                    {r.rounds && r.rounds > 1 && <Badge variant="outline" className="text-[10px]"><RotateCcw className="h-2.5 w-2.5 mr-0.5" />{r.rounds}x</Badge>}
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

      {/* Results per marketplace */}
      {scanResults.map((result: ScanResult) => (
        <Card key={result.marketplace}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.marketplace === 'yandex' ? '🟡' : '🟣'}
                {result.marketplace === 'yandex' ? 'Yandex Market' : 'Wildberries'}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => selectAllInMarketplace(result.marketplace)}>Barchasini tanlash</Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  const criticals = result.products.filter((p: ProductIssue) => p.score < 50);
                  if (criticals.length === 0) { toast.info('Kritik muammo yo\'q'); return; }
                  fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: criticals });
                }} disabled={result.criticalCount === 0 || isFixing} className="gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />Kritik ({result.criticalCount})
                </Button>
                <Button size="sm" onClick={() => {
                  const products = result.products.filter((p: ProductIssue) => selectedProducts.has(p.offerId));
                  if (products.length === 0) { toast.error('Mahsulotlarni tanlang'); return; }
                  fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products });
                }} disabled={selectedProducts.size === 0 || isFixing} className="gap-1">
                  <Wrench className="h-3.5 w-3.5" />Tanlanganni tuzat
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {result.error ? (
              <div className="text-center py-8 text-destructive"><XCircle className="h-8 w-8 mx-auto mb-2" /><p>{result.error}</p></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                  <StatCard value={result.totalProducts} label="Jami" />
                  <StatCard value={result.avgScore} label="O'rtacha ball" />
                  <StatCard value={result.criticalCount} label="Kritik" color="text-red-600" />
                  <StatCard value={result.warningCount} label="Ogohlantirish" color="text-yellow-600" />
                  <StatCard value={result.goodCount} label="Yaxshi" color="text-green-600" />
                </div>

                <Progress value={result.avgScore} className="h-2 mb-4" />

                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Mahsulot</TableHead>
                        <TableHead className="text-center">Ball</TableHead>
                        <TableHead className="text-center"><Image className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><FileText className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><Tag className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead>Holat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.products.map((product: ProductIssue) => {
                        const fixResult = fixHistory.find(r => r.offerId === product.offerId);
                        const isExpanded = expandedProduct === product.offerId;
                        return (
                          <>
                            <TableRow key={product.offerId} className={`cursor-pointer ${product.score < 50 ? 'bg-red-50/50 dark:bg-red-950/10' : ''} ${fixResult?.success ? 'bg-green-50/50 dark:bg-green-950/10' : ''}`} onClick={() => setExpandedProduct(isExpanded ? null : product.offerId)}>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Checkbox checked={selectedProducts.has(product.offerId)} onCheckedChange={() => toggleProduct(product.offerId)} disabled={product.issueCount === 0} />
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate font-medium" title={product.name}>{product.name}</TableCell>
                              <TableCell className="text-center"><ScoreBadge score={product.score} /></TableCell>
                              <TableCell className="text-center">
                                {product.imageCount >= 3 ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}
                                <span className="text-[10px] ml-0.5">{product.imageCount}</span>
                              </TableCell>
                              <TableCell className="text-center">{product.hasDescription ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}</TableCell>
                              <TableCell className="text-center">{product.hasVendor ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}</TableCell>
                              <TableCell>
                                {fixResult ? (
                                  fixResult.success ? <Badge className="bg-green-500 text-white text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Tuzatildi</Badge>
                                  : <Badge variant="destructive" className="text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Xato</Badge>
                                ) : product.issueCount > 0 ? <Badge variant="outline" className="text-[10px]">{product.issueCount} muammo</Badge>
                                : <Badge className="bg-green-500/20 text-green-700 text-[10px]"><Shield className="h-2.5 w-2.5 mr-0.5" />OK</Badge>}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${product.offerId}-details`}>
                                <TableCell colSpan={7} className="bg-muted/30 p-4">
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                      <div><span className="text-muted-foreground">Tavsif:</span> {product.descriptionLength || 0} belgi</div>
                                      <div><span className="text-muted-foreground">Rasmlar:</span> {product.imageCount} ta</div>
                                      {(product.asyncErrors ?? 0) > 0 && <div className="text-red-600">WB xatolar: {product.asyncErrors}</div>}
                                      {(product.apiErrors ?? 0) > 0 && <div className="text-red-600">API xatolar: {product.apiErrors}</div>}
                                    </div>
                                    {product.issueDetails && product.issueDetails.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium">Muammolar:</p>
                                        {product.issueDetails.map((detail, i) => (
                                          <div key={i} className="flex items-center gap-2 text-sm">
                                            {detail.type === 'critical' ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                                            <Badge variant="outline" className="text-[10px] px-1">{detail.field}</Badge>
                                            <span>{detail.msg}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {fixResult && (
                                      <div className={`p-2 rounded text-sm ${fixResult.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                                        <p className="font-medium">{fixResult.success ? '✅ Tuzatildi:' : '❌ Xato:'}</p>
                                        <p>{fixResult.message}</p>
                                        {fixResult.fix?.summary && <p className="text-muted-foreground mt-1">{fixResult.fix.summary}</p>}
                                      </div>
                                    )}
                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: [product] }); }} disabled={product.issueCount === 0 || isFixing} className="gap-1">
                                      <Wrench className="h-3 w-3" />{fixResult ? 'Qayta tuzatish' : 'Tuzatish'}
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

      {/* Empty state */}
      {scanResults.length === 0 && !scanMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">AI Agent tayyor</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Hamkorni tanlang va "Skanerlash" tugmasini bosing.
            </p>
          </CardContent>
        </Card>
      )}
      {scanMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-1">Chuqur skanerlash...</h3>
            <p className="text-muted-foreground text-center">AI agent barcha mahsulotlarni tahlil qilmoqda.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Image Analysis Tab =====
function ImageAnalysisTab({ selectedPartnerId, scanResults }: any) {
  const [imageResults, setImageResults] = useState<any[]>([]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      // Get products with images from scan
      const allProducts = scanResults.flatMap((r: ScanResult) => 
        r.products.filter((p: ProductIssue) => p.imageCount > 0).slice(0, 5).map((p: ProductIssue) => ({
          offerId: p.offerId,
          name: p.name,
          images: [], // We'd need actual URLs - for now analyze based on count
        }))
      );
      
      if (allProducts.length === 0) {
        toast.error('Avval kartochka skanerlashni bajaring');
        throw new Error('No products');
      }

      // Analyze low-image products
      const results = scanResults.flatMap((r: ScanResult) =>
        r.products.map((p: ProductIssue) => ({
          offerId: p.offerId,
          name: p.name,
          marketplace: r.marketplace,
          imageCount: p.imageCount,
          avgScore: p.imageCount >= 5 ? 85 : p.imageCount >= 3 ? 65 : p.imageCount >= 1 ? 40 : 0,
          needsReplacement: p.imageCount < 3,
          issues: p.imageCount === 0 ? ['Rasmlar yo\'q'] : p.imageCount < 3 ? ['Kam rasm'] : [],
        }))
      );

      return results;
    },
    onSuccess: (results) => {
      setImageResults(results);
      const needsFix = results.filter((r: any) => r.needsReplacement).length;
      toast.success(`${results.length} ta mahsulot tahlil qilindi. ${needsFix} ta rasm kerak.`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateImage = async (product: any) => {
    setGeneratingFor(product.offerId);
    try {
      const { data, error } = await supabase.functions.invoke('ai-agent-images', {
        body: { action: 'generate', partnerId: selectedPartnerId, productName: product.name, category: product.category || '', offerId: product.offerId },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        toast.success(`Rasm yaratildi: ${product.name}`);
        setImageResults(prev => prev.map(r => r.offerId === product.offerId ? { ...r, generatedImage: data.imageUrl, avgScore: 85 } : r));
      } else {
        toast.error('Rasm yaratib bo\'lmadi');
      }
    } catch (e: any) {
      toast.error(`Xato: ${e.message}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const lowImageProducts = imageResults.filter((r: any) => r.needsReplacement);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || scanResults.length === 0} className="gap-2">
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Rasmlarni tahlil qilish
        </Button>
      </div>

      {imageResults.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value={imageResults.length} label="Jami mahsulotlar" />
            <StatCard value={Math.round(imageResults.reduce((s: number, r: any) => s + r.avgScore, 0) / imageResults.length)} label="O'rtacha sifat" />
            <StatCard value={lowImageProducts.length} label="Rasm kerak" color="text-red-600" />
            <StatCard value={imageResults.filter((r: any) => r.generatedImage).length} label="Yaratilgan" color="text-green-600" />
          </div>

          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead className="text-center">Rasmlar</TableHead>
                  <TableHead className="text-center">Sifat</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imageResults.map((product: any) => (
                  <TableRow key={product.offerId} className={product.needsReplacement ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                    <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {product.marketplace === 'yandex' ? '🟡 YM' : '🟣 WB'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.imageCount >= 3 ? 'default' : 'destructive'} className="text-[10px]">
                        {product.imageCount} ta
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center"><ScoreBadge score={product.avgScore} /></TableCell>
                    <TableCell>
                      {product.generatedImage ? (
                        <Badge className="bg-green-500 text-white text-[10px]"><Sparkles className="h-2.5 w-2.5 mr-0.5" />Yaratildi</Badge>
                      ) : product.needsReplacement ? (
                        <Badge variant="destructive" className="text-[10px]">Kerak</Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-700 text-[10px]">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.needsReplacement && !product.generatedImage && (
                        <Button size="sm" variant="outline" onClick={() => generateImage(product)} disabled={!!generatingFor} className="gap-1 text-xs">
                          {generatingFor === product.offerId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Rasm yaratish
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </>
      )}

      {imageResults.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Rasm tahlili</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Avval "Kartochka audit" tabidan skanerlang, keyin rasmlarni tahlil qiling.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Price Optimization Tab =====
function PriceOptimizationTab({ selectedPartnerId }: any) {
  const [priceData, setPriceData] = useState<{ products: PriceProduct[]; summary: any } | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const priceScanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-agent-price', { body: { partnerId: selectedPartnerId, action: 'scan' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setPriceData(data);
      setRecommendations([]);
      toast.success(`${data.products.length} ta mahsulot narxi tahlil qilindi`);
    },
    onError: (err: any) => toast.error(`Narx tahlili xatosi: ${err.message}`),
  });

  const recommendMutation = useMutation({
    mutationFn: async (products: PriceProduct[]) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-price', {
        body: { partnerId: selectedPartnerId, action: 'recommend', products },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRecommendations(data.recommendations || []);
      toast.success('AI narx tavsiyalari tayyor');
    },
    onError: (err: any) => toast.error(`Tavsiya xatosi: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => priceScanMutation.mutate()} disabled={!selectedPartnerId || priceScanMutation.isPending} className="gap-2">
          {priceScanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          Narxlarni skanerlash
        </Button>
        {priceData && priceData.summary.riskyCount > 0 && (
          <Button variant="outline" onClick={() => {
            const risky = priceData.products.filter(p => p.isPriceRisky).slice(0, 10);
            recommendMutation.mutate(risky);
          }} disabled={recommendMutation.isPending} className="gap-2">
            {recommendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI narx tavsiyasi ({priceData.summary.riskyCount})
          </Button>
        )}
      </div>

      {priceData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard value={priceData.summary.totalProducts} label="Jami" />
            <StatCard value={priceData.summary.withCostPrice} label="Tannarxi bor" />
            <StatCard value={`${priceData.summary.avgMargin}%`} label="O'rtacha marja" color={priceData.summary.avgMargin < 15 ? 'text-red-600' : 'text-green-600'} />
            <StatCard value={priceData.summary.riskyCount} label="Xavfli marja" color="text-yellow-600" />
            <StatCard value={priceData.summary.lowMarginCount} label="Past marja" color="text-red-600" />
          </div>

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Narx tavsiyalari</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30 text-sm">
                      <span className="font-medium truncate flex-1">{rec.name}</span>
                      <span className="text-muted-foreground">{rec.currentPrice?.toLocaleString()}</span>
                      {rec.recommendation && (
                        <>
                          <span>→</span>
                          <span className={rec.recommendation.priceAction === 'increase' ? 'text-green-600 font-bold' : rec.recommendation.priceAction === 'decrease' ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
                            {rec.recommendation.recommendedPrice?.toLocaleString()}
                          </span>
                          {rec.recommendation.priceAction === 'increase' && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                          {rec.recommendation.priceAction === 'decrease' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                          <span className="text-muted-foreground text-xs truncate max-w-[150px]">{rec.recommendation.reasoning}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>MP</TableHead>
                  <TableHead className="text-right">Narx</TableHead>
                  <TableHead className="text-right">Tannarx</TableHead>
                  <TableHead className="text-right">Marja</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceData.products.map((p: PriceProduct) => (
                  <TableRow key={`${p.marketplace}-${p.offerId}`} className={p.isPriceLow ? 'bg-red-50/50 dark:bg-red-950/10' : p.isPriceRisky ? 'bg-yellow-50/50 dark:bg-yellow-950/10' : ''}>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.marketplace === 'yandex' ? '🟡 YM' : '🟣 WB'}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.price?.toLocaleString()} {p.currency}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.costPrice > 0 ? `${p.costPrice.toLocaleString()} UZS` : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right">
                      {p.margin !== null ? (
                        <Badge className={`font-bold text-[10px] ${p.margin < 5 ? 'bg-red-500 text-white' : p.margin < 15 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}>
                          {p.margin}%
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {p.isPriceLow ? <Badge variant="destructive" className="text-[10px]">Xavfli</Badge>
                        : p.isPriceRisky ? <Badge className="bg-yellow-500 text-white text-[10px]">Past</Badge>
                        : p.costPrice > 0 ? <Badge className="bg-green-500/20 text-green-700 text-[10px]">OK</Badge>
                        : <Badge variant="outline" className="text-[10px]">Tannarx yo'q</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </>
      )}

      {!priceData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <DollarSign className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Narx optimallashtirish</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Hamkorni tanlang va narxlarni skanerlang. AI past marjali mahsulotlarni aniqlaydi va optimal narx tavsiya qiladi.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Financial Overview Tab =====
function FinancialOverviewTab({ selectedPartnerId }: any) {
  const { data: financialData, isLoading } = useQuery({
    queryKey: ['ai-agent-finance', selectedPartnerId],
    enabled: !!selectedPartnerId,
    queryFn: async () => {
      // Get partner subscription and billing info
      const [subsRes, billingRes, connectionsRes, aiUsageRes] = await Promise.all([
        supabase.from('sellercloud_subscriptions').select('*').eq('user_id', selectedPartnerId).order('created_at', { ascending: false }).limit(1),
        supabase.from('sellercloud_billing' as any).select('*').eq('user_id', selectedPartnerId).order('created_at', { ascending: false }).limit(10),
        supabase.from('marketplace_connections').select('marketplace, total_revenue, orders_count, products_count').eq('user_id', selectedPartnerId).eq('is_active', true),
        supabase.from('ai_usage_log').select('*').eq('user_id', selectedPartnerId).order('created_at', { ascending: false }).limit(50),
      ]);

      const subscription = subsRes.data?.[0];
      const billing = billingRes.data || [];
      const connections = connectionsRes.data || [];
      const aiUsage = aiUsageRes.data || [];

      const totalRevenue = connections.reduce((s: number, c: any) => s + (c.total_revenue || 0), 0);
      const totalOrders = connections.reduce((s: number, c: any) => s + (c.orders_count || 0), 0);
      const totalProducts = connections.reduce((s: number, c: any) => s + (c.products_count || 0), 0);
      const totalAICost = aiUsage.reduce((s: number, u: any) => s + (u.estimated_cost_usd || 0), 0);

      return {
        subscription,
        billing,
        connections,
        aiUsage,
        summary: { totalRevenue, totalOrders, totalProducts, totalAICost, aiUsageCount: aiUsage.length },
      };
    },
  });

  if (!selectedPartnerId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Wallet className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Moliya tahlili</h3>
          <p className="text-muted-foreground text-center max-w-md">Hamkorni tanlang.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fd = financialData;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard value={`${(fd?.summary.totalRevenue || 0).toLocaleString()}`} label="Jami daromad (UZS)" />
        <StatCard value={fd?.summary.totalOrders || 0} label="Buyurtmalar" />
        <StatCard value={fd?.summary.totalProducts || 0} label="Mahsulotlar" />
        <StatCard value={fd?.summary.aiUsageCount || 0} label="AI ishlatish" />
        <StatCard value={`$${(fd?.summary.totalAICost || 0).toFixed(3)}`} label="AI xarajat" />
      </div>

      {/* Subscription */}
      {fd?.subscription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Obuna holati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Reja</p>
                <p className="font-medium">{fd.subscription.plan_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Holat</p>
                <Badge className={fd.subscription.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                  {fd.subscription.is_active ? 'Faol' : 'Nofaol'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Muddati</p>
                <p className="font-medium">{fd.subscription.activated_until ? new Date(fd.subscription.activated_until).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Komissiya</p>
                <p className="font-medium">{fd.subscription.commission_percent || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marketplace breakdown */}
      {fd?.connections && fd.connections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Marketplace ko'rsatkichlari</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketplace</TableHead>
                  <TableHead className="text-right">Daromad</TableHead>
                  <TableHead className="text-right">Buyurtmalar</TableHead>
                  <TableHead className="text-right">Mahsulotlar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fd.connections.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{c.marketplace === 'yandex' ? '🟡 Yandex' : c.marketplace === 'wildberries' ? '🟣 WB' : c.marketplace}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{(c.total_revenue || 0).toLocaleString()} UZS</TableCell>
                    <TableCell className="text-right">{c.orders_count || 0}</TableCell>
                    <TableCell className="text-right">{c.products_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AI Usage */}
      {fd?.aiUsage && fd.aiUsage.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Oxirgi AI ishlatish</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {fd.aiUsage.slice(0, 15).map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    <Badge variant="outline" className="text-[10px]">{u.action_type}</Badge>
                    <span className="text-muted-foreground text-xs">{u.model_used}</span>
                    <span className="flex-1" />
                    <span className="text-xs font-mono">${(u.estimated_cost_usd || 0).toFixed(4)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Main Dashboard =====
export function AIAgentDashboard() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Agent — Full Marketplace Manager
            <Badge variant="outline" className="ml-2 text-xs">Self-Healing v3</Badge>
          </CardTitle>
          <CardDescription>
            Kartochka audit, rasm tahlili, narx optimallashtirish va moliyaviy tahlil — barchasi bir joyda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerSelector partners={partners} selectedPartnerId={selectedPartnerId} onSelect={setSelectedPartnerId} />
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <Scan className="h-3.5 w-3.5" />Kartochka audit
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" />Rasmlar
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" />Narx optimallashtirish
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />Moliya tahlili
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <CardAuditTab selectedPartnerId={selectedPartnerId} scanResults={scanResults} setScanResults={setScanResults} />
        </TabsContent>

        <TabsContent value="images">
          <ImageAnalysisTab selectedPartnerId={selectedPartnerId} scanResults={scanResults} />
        </TabsContent>

        <TabsContent value="pricing">
          <PriceOptimizationTab selectedPartnerId={selectedPartnerId} />
        </TabsContent>

        <TabsContent value="finance">
          <FinancialOverviewTab selectedPartnerId={selectedPartnerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
