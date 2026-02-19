import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Scan, Wrench, AlertTriangle, CheckCircle2, XCircle,
  Loader2, ShieldCheck, Image, FileText, Tag, BarChart3,
  RefreshCw
} from 'lucide-react';

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

interface ProductIssue {
  offerId: string;
  nmID?: number;
  name: string;
  category: string;
  score: number;
  issueCount: number;
  issues: string[];
  imageCount: number;
  hasDescription: boolean;
  hasVendor: boolean;
}

export function AIAgentDashboard() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [fixingMarketplace, setFixingMarketplace] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch partners with marketplace connections
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ['ai-agent-partners'],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from('sellercloud_subscriptions')
        .select('user_id, is_active, plan_type')
        .eq('is_active', true);

      if (!subs?.length) return [];

      const userIds = subs.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', userIds);

      const { data: connections } = await supabase
        .from('marketplace_connections')
        .select('user_id, marketplace, is_active')
        .in('user_id', userIds)
        .eq('is_active', true);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      const connMap = new Map<string, string[]>();
      for (const c of connections || []) {
        if (!connMap.has(c.user_id)) connMap.set(c.user_id, []);
        connMap.get(c.user_id)!.push(c.marketplace);
      }

      return subs
        .filter(s => connMap.has(s.user_id))
        .map(s => ({
          userId: s.user_id,
          name: profileMap[s.user_id]?.full_name || 'Noma\'lum',
          phone: profileMap[s.user_id]?.phone || '',
          plan: s.plan_type,
          marketplaces: connMap.get(s.user_id) || [],
        }));
    },
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-scan', {
        body: { partnerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.results as ScanResult[];
    },
    onSuccess: (results) => {
      setScanResults(results);
      setSelectedProducts(new Set());
      const total = results.reduce((s, r) => s + r.totalProducts, 0);
      const critical = results.reduce((s, r) => s + r.criticalCount, 0);
      toast.success(`${total} ta mahsulot skanerlandi. ${critical} ta kritik muammo topildi.`);
    },
    onError: (err: any) => {
      toast.error(`Skanerlash xatosi: ${err.message}`);
    },
  });

  // Fix mutation
  const fixMutation = useMutation({
    mutationFn: async ({ partnerId, marketplace, products }: { partnerId: string; marketplace: string; products: ProductIssue[] }) => {
      setFixingMarketplace(marketplace);
      const { data, error } = await supabase.functions.invoke('ai-agent-fix', {
        body: { partnerId, marketplace, products },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setFixingMarketplace(null);
      toast.success(`${data.totalFixed} ta mahsulot tuzatildi, ${data.totalFailed} ta xato.`);
      // Re-scan after fix
      if (selectedPartnerId) scanMutation.mutate(selectedPartnerId);
    },
    onError: (err: any) => {
      setFixingMarketplace(null);
      toast.error(`Tuzatish xatosi: ${err.message}`);
    },
  });

  const toggleProduct = (offerId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
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
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const fixSelected = (marketplace: string) => {
    const result = scanResults.find(r => r.marketplace === marketplace);
    if (!result) return;
    const products = result.products.filter(p => selectedProducts.has(p.offerId));
    if (products.length === 0) {
      toast.error('Tuzatish uchun mahsulotlarni tanlang');
      return;
    }
    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace, products });
  };

  const fixAllCritical = (marketplace: string) => {
    const result = scanResults.find(r => r.marketplace === marketplace);
    if (!result) return;
    const criticals = result.products.filter(p => p.score < 50);
    if (criticals.length === 0) {
      toast.info('Kritik muammo topilmadi');
      return;
    }
    fixMutation.mutate({ partnerId: selectedPartnerId, marketplace, products: criticals });
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500 text-white">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500 text-white">{score}</Badge>;
    return <Badge variant="destructive">{score}</Badge>;
  };

  const selectedPartner = partners?.find(p => p.userId === selectedPartnerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Agent — Marketplace Manager
          </CardTitle>
          <CardDescription>
            Hamkorlarning marketplace akkauntlarini avtomatik tahlil qilish va muammolarni tuzatish
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
            <Button
              onClick={() => selectedPartnerId && scanMutation.mutate(selectedPartnerId)}
              disabled={!selectedPartnerId || scanMutation.isPending}
              className="gap-2"
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scan className="h-4 w-4" />
              )}
              {scanMutation.isPending ? 'Skanerlanmoqda...' : 'Skanerlash'}
            </Button>
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectAllInMarketplace(result.marketplace)}
                  disabled={result.products.length === 0}
                >
                  Hammasini tanlash
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => fixAllCritical(result.marketplace)}
                  disabled={result.criticalCount === 0 || fixMutation.isPending}
                  className="gap-1"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Kritikalarni tuzat ({result.criticalCount})
                </Button>
                <Button
                  size="sm"
                  onClick={() => fixSelected(result.marketplace)}
                  disabled={selectedProducts.size === 0 || fixMutation.isPending}
                  className="gap-1"
                >
                  {fixingMarketplace === result.marketplace ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5" />
                  )}
                  Tanlanganni tuzat ({
                    result.products.filter(p => selectedProducts.has(p.offerId)).length
                  })
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
                {/* Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{result.totalProducts}</p>
                      <p className="text-xs text-muted-foreground">Jami</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{result.avgScore}</p>
                      <p className="text-xs text-muted-foreground">O'rtacha ball</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{result.criticalCount}</p>
                      <p className="text-xs text-muted-foreground">Kritik</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{result.warningCount}</p>
                      <p className="text-xs text-muted-foreground">Ogohlantirish</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-950/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{result.goodCount}</p>
                      <p className="text-xs text-muted-foreground">Yaxshi</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Health Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Umumiy salomatlik</span>
                    <span className="font-medium">{result.avgScore}%</span>
                  </div>
                  <Progress value={result.avgScore} className="h-2" />
                </div>

                {/* Products Table */}
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Mahsulot</TableHead>
                        <TableHead>Kategoriya</TableHead>
                        <TableHead className="text-center">Ball</TableHead>
                        <TableHead className="text-center"><Image className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><FileText className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead className="text-center"><Tag className="h-3.5 w-3.5 inline" /></TableHead>
                        <TableHead>Muammolar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.products.map(product => (
                        <TableRow key={product.offerId} className={product.score < 50 ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedProducts.has(product.offerId)}
                              onCheckedChange={() => toggleProduct(product.offerId)}
                              disabled={product.issueCount === 0}
                            />
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate font-medium" title={product.name}>
                            {product.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                            {product.category || '-'}
                          </TableCell>
                          <TableCell className="text-center">{getScoreBadge(product.score)}</TableCell>
                          <TableCell className="text-center">
                            {product.imageCount >= 3 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 inline" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {product.hasDescription ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 inline" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {product.hasVendor ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 inline" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {product.issues.slice(0, 3).map((issue, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1">
                                  {issue}
                                </Badge>
                              ))}
                              {product.issues.length > 3 && (
                                <Badge variant="outline" className="text-[10px] px-1">
                                  +{product.issues.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Empty State */}
      {scanResults.length === 0 && !scanMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">AI Agent tayyor</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Hamkorni tanlang va "Skanerlash" tugmasini bosing. AI agent hamkorning barcha marketplace akkauntlarini tahlil qiladi va muammolarni aniqlaydi.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scanning Loading */}
      {scanMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-1">Skanerlanmoqda...</h3>
            <p className="text-muted-foreground text-center">
              AI agent hamkorning marketplace akkauntlarini tahlil qilmoqda. Bu 30-60 soniya davom etishi mumkin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
