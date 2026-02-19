import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Scan, Wrench, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Image, FileText, Tag, ChevronLeft, ChevronRight,
  Zap, RotateCcw, Shield, DollarSign, TrendingUp, TrendingDown,
  Camera, Sparkles, BarChart3, Wallet, MessageCircle, Send,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';

// ===== Types =====
interface ProductIssue {
  offerId: string; nmID?: number; subjectID?: number; name: string;
  category: string; score: number; issueCount: number; issues: string[];
  issueDetails?: { type: string; field: string; msg: string }[];
  imageCount: number; descriptionLength?: number; hasDescription: boolean;
  hasVendor: boolean; asyncErrors?: number; apiErrors?: number; apiWarnings?: number;
}

interface ScanResult {
  marketplace: string; totalProducts: number; avgScore: number;
  criticalCount: number; warningCount: number; goodCount: number;
  products: ProductIssue[]; error?: string;
}

interface FixResult {
  offerId: string; name: string; success: boolean; message: string;
  rounds?: number; newScore?: number; fix?: { name: string; summary: string };
}

interface PriceProduct {
  offerId: string; nmID?: number; name: string; price: number; costPrice: number;
  margin: number | null; currency: string; marketplace: string; category: string;
  isPriceHigh?: boolean; isPriceLow?: boolean; isPriceRisky?: boolean;
  optimalPrice?: number; minPrice?: number; maxPrice?: number;
  priceAction?: string; commissionPercent?: number; logisticsCost?: number;
  originalPrice?: number; discount?: number;
}

// ===== Helpers =====
function PartnerSelector({ partners, selectedPartnerId, onSelect }: any) {
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
      {partners?.find((p: any) => p.userId === selectedPartnerId) && (
        <div className="flex gap-2 flex-wrap">
          {partners.find((p: any) => p.userId === selectedPartnerId).marketplaces.map((mp: string) => (
            <Badge key={mp} variant="outline" className="text-xs">
              {mp === 'yandex' ? '🟡 Yandex' : mp === 'wildberries' ? '🟣 WB' : mp}
            </Badge>
          ))}
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

// ===== Card Audit Tab with Pagination =====
function CardAuditTab({ selectedPartnerId, scanResults, setScanResults }: any) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [fixHistory, setFixHistory] = useState<FixResult[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<{ current: number; total: number; marketplace: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const PAGE_SIZE = 50;

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
      setCurrentPage({});
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
    if (allCriticals.length === 0) { toast.info('Tuzatish kerak emas'); return; }

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
        } catch (e: any) { console.error('Auto-fix error:', e); }
        processed += batch.length;
      }
    }
    setAutoFixProgress(null);
    toast.success('Avtomatik tuzatish yakunlandi!');
    scanMutation.mutate(selectedPartnerId);
  };

  const toggleProduct = (offerId: string) => {
    setSelectedProducts(prev => { const n = new Set(prev); n.has(offerId) ? n.delete(offerId) : n.add(offerId); return n; });
  };

  const totalCritical = scanResults.reduce((s: number, r: ScanResult) => s + r.criticalCount, 0);
  const isFixing = fixMutation.isPending || !!autoFixProgress;

  return (
    <div className="space-y-4">
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

      {autoFixProgress && (
        <Card className="border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Avtomatik tuzatish: {autoFixProgress.marketplace}</span>
            </div>
            <Progress value={(autoFixProgress.current / autoFixProgress.total) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">{autoFixProgress.current} / {autoFixProgress.total} ({Math.round((autoFixProgress.current / autoFixProgress.total) * 100)}%)</p>
          </CardContent>
        </Card>
      )}

      {fixHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4" />Tuzatish tarixi ({fixHistory.filter(r => r.success).length}✅ / {fixHistory.filter(r => !r.success).length}❌)</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {fixHistory.map((r, i) => (
                  <div key={`${r.offerId}-${i}`} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    {r.success ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{r.name || r.offerId}</span>
                    {r.rounds && r.rounds > 1 && <Badge variant="outline" className="text-[10px]">{r.rounds}x</Badge>}
                    {r.newScore && <ScoreBadge score={r.newScore} />}
                    <span className="text-muted-foreground text-xs truncate max-w-[200px]">{r.success ? r.fix?.summary : r.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {scanResults.map((result: ScanResult) => {
        const page = currentPage[result.marketplace] || 0;
        const totalPages = Math.ceil(result.products.length / PAGE_SIZE);
        const paginatedProducts = result.products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        return (
          <Card key={result.marketplace}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {result.marketplace === 'yandex' ? '🟡 Yandex Market' : '🟣 Wildberries'}
                  <Badge variant="outline">{result.totalProducts} ta</Badge>
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="destructive" onClick={() => {
                    const criticals = result.products.filter(p => p.score < 50);
                    if (criticals.length === 0) { toast.info('Kritik muammo yo\'q'); return; }
                    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: criticals });
                  }} disabled={result.criticalCount === 0 || isFixing} className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />Kritik ({result.criticalCount})
                  </Button>
                  <Button size="sm" onClick={() => {
                    const products = result.products.filter(p => selectedProducts.has(p.offerId));
                    if (products.length === 0) { toast.error('Tanlang'); return; }
                    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products });
                  }} disabled={selectedProducts.size === 0 || isFixing} className="gap-1">
                    <Wrench className="h-3.5 w-3.5" />Tuzat ({selectedProducts.size})
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

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Mahsulot</TableHead>
                        <TableHead className="text-center">Ball</TableHead>
                        <TableHead className="text-center"><Image className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><FileText className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead>Holat</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((product: ProductIssue) => {
                        const fixResult = fixHistory.find(r => r.offerId === product.offerId);
                        return (
                          <TableRow key={product.offerId} className={`${product.score < 50 ? 'bg-red-50/50 dark:bg-red-950/10' : ''} ${fixResult?.success ? 'bg-green-50/50 dark:bg-green-950/10' : ''}`}>
                            <TableCell>
                              <Checkbox checked={selectedProducts.has(product.offerId)} onCheckedChange={() => toggleProduct(product.offerId)} disabled={product.issueCount === 0} />
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium" title={product.name}>{product.name}</TableCell>
                            <TableCell className="text-center"><ScoreBadge score={product.score} /></TableCell>
                            <TableCell className="text-center">
                              {product.imageCount >= 3 ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}
                              <span className="text-[10px] ml-0.5">{product.imageCount}</span>
                            </TableCell>
                            <TableCell className="text-center">{product.hasDescription ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-500 inline" />}</TableCell>
                            <TableCell>
                              {fixResult ? (
                                fixResult.success ? <Badge className="bg-green-500 text-white text-[10px]">✅ Tuzatildi</Badge>
                                : <Badge variant="destructive" className="text-[10px]">❌ Xato</Badge>
                              ) : product.issueCount > 0 ? <Badge variant="outline" className="text-[10px]">{product.issueCount} muammo</Badge>
                              : <Badge className="bg-green-500/20 text-green-700 text-[10px]">OK</Badge>}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => fixMutation.mutate({ partnerId: selectedPartnerId, marketplace: result.marketplace, products: [product] })} disabled={product.issueCount === 0 || isFixing} className="h-7 px-2">
                                <Wrench className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <span className="text-sm text-muted-foreground">
                        {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, result.products.length)} / {result.products.length}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => ({ ...p, [result.marketplace]: page - 1 }))} disabled={page === 0}>
                          <ChevronLeft className="h-4 w-4" />Oldingi
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => ({ ...p, [result.marketplace]: page + 1 }))} disabled={page >= totalPages - 1}>
                          Keyingi<ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {scanResults.length === 0 && !scanMutation.isPending && (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
          <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">AI Agent tayyor</h3>
          <p className="text-muted-foreground text-center">Hamkorni tanlang va "Skanerlash" bosing.</p>
        </CardContent></Card>
      )}
      {scanMutation.isPending && (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold">Chuqur skanerlash...</h3>
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== Image Tab =====
function ImageAnalysisTab({ selectedPartnerId, scanResults }: any) {
  const [imageResults, setImageResults] = useState<any[]>([]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (scanResults.length === 0) throw new Error('Avval skanerlang');
      const allProducts = scanResults.flatMap((r: ScanResult) =>
        r.products.map((p: ProductIssue) => ({
          offerId: p.offerId, nmID: p.nmID, name: p.name,
          marketplace: r.marketplace, category: p.category, imageCount: p.imageCount,
        }))
      );
      const { data, error } = await supabase.functions.invoke('ai-agent-images', {
        body: { action: 'analyze', products: allProducts.slice(0, 20) },
      });
      if (error) throw error;
      const aiResults = data?.results || [];
      const aiIds = new Set(aiResults.map((r: any) => r.offerId));
      const remaining = allProducts.filter(p => !aiIds.has(p.offerId)).map(p => ({
        ...p, avgScore: p.imageCount >= 3 ? 65 : p.imageCount >= 1 ? 30 : 0,
        needsReplacement: p.imageCount < 1 || p.imageCount < 3,
        issues: p.imageCount === 0 ? ['Rasmlar yo\'q'] : p.imageCount < 3 ? [`Kam rasm`] : [],
      }));
      return [...aiResults, ...remaining];
    },
    onSuccess: (results) => { setImageResults(results); toast.success(`${results.length} ta tahlil qilindi`); },
    onError: (err: any) => toast.error(err.message),
  });

  const generateImage = async (product: any) => {
    setGeneratingFor(product.offerId);
    try {
      const { data, error } = await supabase.functions.invoke('ai-agent-images', {
        body: { action: 'generate-and-upload', partnerId: selectedPartnerId, productName: product.name, category: product.category || '', offerId: product.offerId, nmID: product.nmID, marketplace: product.marketplace },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`✅ ${product.name} — rasm yaratildi va 1-chi o'ringa qo'yildi`);
        setImageResults(prev => prev.map(r => r.offerId === product.offerId ? { ...r, generatedImage: data.imageUrl, avgScore: 85, needsReplacement: false } : r));
      } else toast.error(data?.error || 'Xato');
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingFor(null); }
  };

  const generateAll = async () => {
    const toGen = imageResults.filter(r => r.needsReplacement && !r.generatedImage);
    if (toGen.length === 0) { toast.info('Rasm kerak emas'); return; }
    setGenProgress({ current: 0, total: toGen.length });
    for (let i = 0; i < toGen.length; i++) {
      setGenProgress({ current: i, total: toGen.length });
      await generateImage(toGen[i]);
    }
    setGenProgress(null);
    toast.success('Barcha rasmlar yaratildi!');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || scanResults.length === 0} className="gap-2">
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Rasmlarni tahlil qilish
        </Button>
        {imageResults.filter(r => r.needsReplacement && !r.generatedImage).length > 0 && (
          <Button onClick={generateAll} disabled={!!generatingFor || !!genProgress} variant="destructive" className="gap-2">
            {genProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Hammasi uchun rasm yaratish ({imageResults.filter(r => r.needsReplacement && !r.generatedImage).length})
          </Button>
        )}
      </div>

      {genProgress && (
        <Card className="border-primary/30"><CardContent className="py-4">
          <div className="flex items-center gap-3 mb-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>Rasm yaratilmoqda...</span></div>
          <Progress value={(genProgress.current / genProgress.total) * 100} className="h-3" />
          <p className="text-sm text-muted-foreground mt-1">{genProgress.current} / {genProgress.total}</p>
        </CardContent></Card>
      )}

      {imageResults.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value={imageResults.length} label="Jami" />
            <StatCard value={Math.round(imageResults.reduce((s: number, r: any) => s + r.avgScore, 0) / imageResults.length)} label="O'rtacha sifat" />
            <StatCard value={imageResults.filter(r => r.needsReplacement).length} label="Rasm kerak" color="text-red-600" />
            <StatCard value={imageResults.filter(r => r.generatedImage).length} label="Yaratilgan" color="text-green-600" />
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Mahsulot</TableHead><TableHead>MP</TableHead>
              <TableHead className="text-center">Rasm</TableHead><TableHead className="text-center">Sifat</TableHead>
              <TableHead>Holat</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {imageResults.map((p: any) => (
                <TableRow key={p.offerId} className={p.needsReplacement && !p.generatedImage ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.marketplace === 'yandex' ? '🟡' : '🟣'}</Badge></TableCell>
                  <TableCell className="text-center"><Badge variant={p.imageCount >= 3 ? 'default' : 'destructive'} className="text-[10px]">{p.imageCount}</Badge></TableCell>
                  <TableCell className="text-center"><ScoreBadge score={p.avgScore} /></TableCell>
                  <TableCell>
                    {p.generatedImage ? <Badge className="bg-green-500 text-white text-[10px]">✅ Yaratildi</Badge>
                    : p.needsReplacement ? <Badge variant="destructive" className="text-[10px]">Kerak</Badge>
                    : <Badge className="bg-green-500/20 text-green-700 text-[10px]">OK</Badge>}
                  </TableCell>
                  <TableCell>
                    {p.needsReplacement && !p.generatedImage && (
                      <Button size="sm" variant="outline" onClick={() => generateImage(p)} disabled={!!generatingFor} className="gap-1 text-xs">
                        {generatingFor === p.offerId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Yaratish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {imageResults.length === 0 && <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
        <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Avval kartochka audit tabidan skanerlang</p>
      </CardContent></Card>}
    </div>
  );
}

// ===== Price Optimization Tab =====
function PriceOptimizationTab({ selectedPartnerId }: any) {
  const [priceData, setPriceData] = useState<{ products: PriceProduct[]; summary: any } | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [targetMargin, setTargetMargin] = useState(12);

  const priceScanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-agent-price', { body: { partnerId: selectedPartnerId, action: 'scan', targetMargin } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => { setPriceData(data); setRecommendations([]); toast.success(`${data.products.length} ta narx tahlil qilindi`); },
    onError: (err: any) => toast.error(err.message),
  });

  const recommendMutation = useMutation({
    mutationFn: async (products: PriceProduct[]) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-price', {
        body: { partnerId: selectedPartnerId, action: 'recommend', products, targetMargin },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => { setRecommendations(data.recommendations || []); toast.success('Tavsiyalar tayyor'); },
    onError: (err: any) => toast.error(err.message),
  });

  const applyPricesMutation = useMutation({
    mutationFn: async () => {
      const toApply = recommendations
        .filter(r => r.recommendation?.priceAction !== 'keep' && r.recommendation?.priceAction !== 'no_cost' && r.recommendation?.recommendedPrice)
        .map(r => ({
          offerId: r.offerId, marketplace: r.marketplace,
          newPrice: r.recommendation.recommendedPrice,
          nmID: priceData?.products.find(p => p.offerId === r.offerId)?.nmID,
        }));
      if (toApply.length === 0) throw new Error('O\'zgartirish kerak emas');
      const { data, error } = await supabase.functions.invoke('ai-agent-price', {
        body: { partnerId: selectedPartnerId, action: 'apply', priceUpdates: toApply },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data?.applied || 0} ta yangilandi`);
      priceScanMutation.mutate();
      setRecommendations([]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const needsAdjust = priceData?.products.filter(p => p.priceAction === 'increase' || p.priceAction === 'decrease') || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label className="text-sm font-medium block mb-1">Maqsadli marja %</label>
          <Input type="number" value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value))} className="w-24" min={5} max={50} />
        </div>
        <Button onClick={() => priceScanMutation.mutate()} disabled={!selectedPartnerId || priceScanMutation.isPending} className="gap-2">
          {priceScanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          Skanerlash
        </Button>
        {needsAdjust.length > 0 && (
          <Button variant="outline" onClick={() => recommendMutation.mutate(needsAdjust.slice(0, 30))} disabled={recommendMutation.isPending} className="gap-2">
            {recommendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Tavsiya ({needsAdjust.length})
          </Button>
        )}
        {recommendations.filter(r => r.recommendation?.priceAction !== 'keep' && r.recommendation?.priceAction !== 'no_cost').length > 0 && (
          <Button variant="destructive" onClick={() => applyPricesMutation.mutate()} disabled={applyPricesMutation.isPending} className="gap-2">
            {applyPricesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Narxlarni qo'llash
          </Button>
        )}
      </div>

      {priceData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <StatCard value={priceData.summary.totalProducts} label="Jami" />
            <StatCard value={priceData.summary.withCostPrice} label="Tannarxi bor" />
            <StatCard value={`${priceData.summary.avgMargin}%`} label="O'rtacha marja" color={priceData.summary.avgMargin < 10 ? 'text-red-600' : 'text-green-600'} />
            <StatCard value={priceData.summary.needsAdjustment || 0} label="Tuzatish kerak" color="text-yellow-600" />
            <StatCard value={priceData.summary.highPriceCount || 0} label="Narx baland" color="text-orange-600" />
            <StatCard value={priceData.summary.lowMarginCount || 0} label="Zarar" color="text-red-600" />
          </div>

          {recommendations.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Narx tavsiyalari</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30 text-sm">
                      <span className="font-medium truncate flex-1">{rec.name}</span>
                      <span className="text-muted-foreground font-mono">{rec.currentPrice?.toLocaleString()}</span>
                      {rec.recommendation?.recommendedPrice ? <>
                        <span>→</span>
                        <span className={`font-bold font-mono ${rec.recommendation.priceAction === 'decrease' ? 'text-blue-600' : rec.recommendation.priceAction === 'increase' ? 'text-red-600' : ''}`}>
                          {rec.recommendation.recommendedPrice?.toLocaleString()}
                        </span>
                        {rec.recommendation.priceAction === 'increase' && <ArrowUp className="h-3.5 w-3.5 text-red-500" />}
                        {rec.recommendation.priceAction === 'decrease' && <ArrowDown className="h-3.5 w-3.5 text-blue-500" />}
                        {rec.recommendation.priceAction === 'keep' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      </> : <span className="text-muted-foreground text-xs">Tannarx yo'q</span>}
                      <span className="text-muted-foreground text-xs truncate max-w-[200px]">{rec.recommendation?.reasoning}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Table>
            <TableHeader><TableRow>
              <TableHead>Mahsulot</TableHead><TableHead>MP</TableHead>
              <TableHead className="text-right">Joriy narx</TableHead><TableHead className="text-right">Tannarx</TableHead>
              <TableHead className="text-right">Optimal</TableHead><TableHead className="text-right">Marja</TableHead>
              <TableHead>Holat</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {priceData.products.map((p: PriceProduct) => (
                <TableRow key={`${p.marketplace}-${p.offerId}`} className={p.isPriceLow ? 'bg-red-50/50 dark:bg-red-950/10' : p.isPriceHigh ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''}>
                  <TableCell className="font-medium max-w-[180px] truncate">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.marketplace === 'yandex' ? '🟡' : '🟣'}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm">{p.price?.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{p.costPrice > 0 ? p.costPrice.toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-primary">{p.optimalPrice ? p.optimalPrice.toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-right">
                    {p.margin !== null ? (
                      <Badge className={`font-bold text-[10px] ${p.margin! < 0 ? 'bg-red-600 text-white' : p.margin! < 5 ? 'bg-red-500 text-white' : p.margin! < 10 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}>
                        {p.margin}%
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {p.priceAction === 'increase' ? <Badge variant="destructive" className="text-[10px]"><ArrowUp className="h-2.5 w-2.5 mr-0.5" />Ko'tarish</Badge>
                    : p.priceAction === 'decrease' ? <Badge className="bg-blue-500 text-white text-[10px]"><ArrowDown className="h-2.5 w-2.5 mr-0.5" />Tushirish</Badge>
                    : p.priceAction === 'no_cost' ? <Badge variant="outline" className="text-[10px]">Tannarx yo'q</Badge>
                    : <Badge className="bg-green-500/20 text-green-700 text-[10px]">OK</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {!priceData && <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
        <DollarSign className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Narx optimallashtirish</h3>
        <p className="text-muted-foreground text-center max-w-md text-sm">
          Formula: OptimalNarx = (Tannarx + Logistika) / (1 - Komissiya% - Soliq4% - Marja%)
        </p>
      </CardContent></Card>}
    </div>
  );
}

// ===== Agent Chat Tab =====
function AgentChatTab({ selectedPartnerId, scanResults, priceData }: any) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-chat', {
        body: {
          message: msg,
          partnerId: selectedPartnerId,
          context: {
            scanResults: scanResults?.map((r: any) => ({ marketplace: r.marketplace, totalProducts: r.totalProducts, avgScore: r.avgScore, criticalCount: r.criticalCount, warningCount: r.warningCount })),
            priceData: priceData ? { summary: priceData.summary } : null,
            chatHistory: messages.slice(-10),
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.reply;
    },
    onSuccess: (reply) => {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendMessage = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    chatMutation.mutate(msg);
  };

  return (
    <div className="space-y-4">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />Agent Chat
            {selectedPartnerId && <Badge variant="outline" className="text-xs">Hamkor tanlangan</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pb-3">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">AI Agent bilan suhbat</p>
                <p className="text-sm mt-1">Marketplace topshiriqlarini bering: audit, tuzatish, narx tahlili...</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['Kartochkalarni skanerla', 'Past marjali mahsulotlarni ko\'rsat', 'Rasmlar sifatini tekshir', 'Narxni optimal qil'].map(q => (
                    <Button key={q} size="sm" variant="outline" className="text-xs" onClick={() => { setInput(q); }}>
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Javob yozilmoqda...</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Topshiriq yozing..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={chatMutation.isPending}
            />
            <Button onClick={sendMessage} disabled={!input.trim() || chatMutation.isPending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Financial Tab =====
function FinancialOverviewTab({ selectedPartnerId }: any) {
  const { data: fd, isLoading } = useQuery({
    queryKey: ['ai-agent-finance', selectedPartnerId],
    enabled: !!selectedPartnerId,
    queryFn: async () => {
      const [subsRes, connectionsRes, aiUsageRes] = await Promise.all([
        supabase.from('sellercloud_subscriptions').select('*').eq('user_id', selectedPartnerId).order('created_at', { ascending: false }).limit(1),
        supabase.from('marketplace_connections').select('marketplace, total_revenue, orders_count, products_count').eq('user_id', selectedPartnerId).eq('is_active', true),
        supabase.from('ai_usage_log').select('*').eq('user_id', selectedPartnerId).order('created_at', { ascending: false }).limit(50),
      ]);
      const subscription = subsRes.data?.[0];
      const connections = connectionsRes.data || [];
      const aiUsage = aiUsageRes.data || [];
      return {
        subscription, connections, aiUsage,
        summary: {
          totalRevenue: connections.reduce((s: number, c: any) => s + (c.total_revenue || 0), 0),
          totalOrders: connections.reduce((s: number, c: any) => s + (c.orders_count || 0), 0),
          totalProducts: connections.reduce((s: number, c: any) => s + (c.products_count || 0), 0),
          totalAICost: aiUsage.reduce((s: number, u: any) => s + (u.estimated_cost_usd || 0), 0),
        },
      };
    },
  });

  if (!selectedPartnerId) return <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Hamkorni tanlang</CardContent></Card>;
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={`${(fd?.summary.totalRevenue || 0).toLocaleString()}`} label="Daromad (UZS)" />
        <StatCard value={fd?.summary.totalOrders || 0} label="Buyurtmalar" />
        <StatCard value={fd?.summary.totalProducts || 0} label="Mahsulotlar" />
        <StatCard value={`$${(fd?.summary.totalAICost || 0).toFixed(3)}`} label="AI xarajat" />
      </div>
      {fd?.subscription && (
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground">Reja</p><p className="font-medium">{fd.subscription.plan_type}</p></div>
            <div><p className="text-muted-foreground">Holat</p><Badge className={fd.subscription.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>{fd.subscription.is_active ? 'Faol' : 'Nofaol'}</Badge></div>
            <div><p className="text-muted-foreground">Muddati</p><p className="font-medium">{fd.subscription.activated_until ? new Date(fd.subscription.activated_until).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-muted-foreground">Komissiya</p><p className="font-medium">{fd.subscription.commission_percent || 0}%</p></div>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== Main Dashboard =====
export function AIAgentDashboard() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [priceData, setPriceData] = useState<any>(null);

  const { data: partners } = useQuery({
    queryKey: ['ai-agent-partners'],
    queryFn: async () => {
      // Fetch ALL marketplace connections (paginate to avoid 1000 row limit)
      let allConnections: any[] = [];
      let from = 0;
      const pageSize = 500;
      while (true) {
        const { data: batch } = await supabase
          .from('marketplace_connections')
          .select('user_id, marketplace, is_active')
          .eq('is_active', true)
          .range(from, from + pageSize - 1);
        if (!batch?.length) break;
        allConnections.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      if (allConnections.length === 0) return [];

      const connMap = new Map<string, string[]>();
      for (const c of allConnections) {
        if (!connMap.has(c.user_id)) connMap.set(c.user_id, []);
        if (!connMap.get(c.user_id)!.includes(c.marketplace)) connMap.get(c.user_id)!.push(c.marketplace);
      }

      const userIds = Array.from(connMap.keys());
      
      // Paginate profile fetches too (in case > 1000 users)
      const profileMap: Record<string, any> = {};
      const subMap: Record<string, any> = {};
      
      for (let i = 0; i < userIds.length; i += 500) {
        const batch = userIds.slice(i, i + 500);
        const [profilesRes, subsRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name, phone').in('user_id', batch),
          supabase.from('sellercloud_subscriptions').select('user_id, is_active, plan_type').in('user_id', batch),
        ]);
        for (const p of (profilesRes.data || [])) profileMap[p.user_id] = p;
        for (const s of (subsRes.data || [])) subMap[s.user_id] = s;
      }

      return userIds.map(uid => ({
        userId: uid,
        name: profileMap[uid]?.full_name || 'Noma\'lum',
        phone: profileMap[uid]?.phone || '',
        plan: subMap[uid]?.plan_type || 'free',
        isActive: subMap[uid]?.is_active || false,
        marketplaces: connMap.get(uid) || [],
      }));
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Agent — Marketplace Manager
            <Badge variant="outline" className="ml-2 text-xs">Self-Healing v3</Badge>
          </CardTitle>
          <CardDescription>
            Real API orqali kartochka audit, rasm generatsiya, narx optimallashtirish va agent chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerSelector partners={partners} selectedPartnerId={selectedPartnerId} onSelect={setSelectedPartnerId} />
        </CardContent>
      </Card>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="chat" className="gap-1.5 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />Agent Chat
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <Scan className="h-3.5 w-3.5" />Kartochka audit
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" />Rasmlar
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" />Narx
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />Moliya
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <AgentChatTab selectedPartnerId={selectedPartnerId} scanResults={scanResults} priceData={priceData} />
        </TabsContent>
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
