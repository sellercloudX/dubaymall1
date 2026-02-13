import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { DollarSign, Save, Search, Package, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCostPrices } from '@/hooks/useCostPrices';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface CostPriceManagerProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

export function CostPriceManager({ connectedMarketplaces, store }: CostPriceManagerProps) {
  const isMobile = useIsMobile();
  const { getCostPrice, setCostPrice, bulkSetCostPrices, loading: costLoading } = useCostPrices();
  const [selectedMp, setSelectedMp] = useState(connectedMarketplaces[0] || '');
  const [search, setSearch] = useState('');
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isLoading = store.isLoadingProducts || costLoading;

  const products = useMemo(() => {
    if (!selectedMp) return [];
    const all = store.getProducts(selectedMp);
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.offerId?.toLowerCase().includes(q) ||
      p.shopSku?.toLowerCase().includes(q)
    );
  }, [selectedMp, store.dataVersion, search]);

  const stats = useMemo(() => {
    if (!selectedMp) return { total: 0, withCost: 0, withoutCost: 0 };
    const all = store.getProducts(selectedMp);
    let withCost = 0;
    all.forEach(p => {
      if (getCostPrice(selectedMp, p.offerId) !== null) withCost++;
    });
    return { total: all.length, withCost, withoutCost: all.length - withCost };
  }, [selectedMp, store.dataVersion, getCostPrice]);

  const handlePriceChange = (offerId: string, value: string) => {
    setEditingPrices(prev => ({ ...prev, [offerId]: value }));
  };

  const handleSaveSingle = async (offerId: string) => {
    const value = editingPrices[offerId];
    if (!value || isNaN(Number(value))) {
      toast.error('Raqam kiriting');
      return;
    }
    await setCostPrice(selectedMp, offerId, Number(value));
    setEditingPrices(prev => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });
    toast.success('Tannarx saqlandi');
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(editingPrices)
      .filter(([_, v]) => v && !isNaN(Number(v)))
      .map(([offerId, v]) => ({ marketplace: selectedMp, offerId, costPrice: Number(v) }));
    if (entries.length === 0) {
      toast.error('Saqlash uchun tannarx kiriting');
      return;
    }
    setSaving(true);
    await bulkSetCostPrices(entries);
    setEditingPrices({});
    setSaving(false);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const changedCount = Object.keys(editingPrices).filter(k => editingPrices[k] && !isNaN(Number(editingPrices[k]))).length;

  const formatPrice = (price: number) => new Intl.NumberFormat('uz-UZ').format(price);

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Tannarx boshqaruvi</h3>
        <p className="text-muted-foreground">Avval marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Jami</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-primary mb-1"><CheckCircle2 className="h-3 w-3" />Kiritilgan</div>
            <div className="text-xl font-bold text-primary">{stats.withCost}</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-destructive mb-1"><AlertCircle className="h-3 w-3" />Kiritilmagan</div>
            <div className="text-xl font-bold text-destructive">{stats.withoutCost}</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {connectedMarketplaces.map(mp => (
            <Button key={mp} variant={selectedMp === mp ? 'default' : 'outline'} size="sm"
              onClick={() => { setSelectedMp(mp); setSearch(''); setEditingPrices({}); setCurrentPage(1); }}
              className="shrink-0 text-xs">
              {mp === 'yandex' ? '🟡' : mp === 'uzum' ? '🟣' : mp === 'wildberries' ? '🔵' : '🟢'} {MARKETPLACE_NAMES[mp]}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Mahsulot qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {changedCount > 0 && (
            <Button size="sm" onClick={handleSaveAll} disabled={saving} className="shrink-0">
              <Save className="h-4 w-4 mr-1" />
              {changedCount} ta saqlash
            </Button>
          )}
        </div>
      </div>

      {/* Products */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span className="truncate">Mahsulot tannarxlari</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Har bir mahsulotning olish narxini kiriting — hisobotlar aniq bo'ladi
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : isMobile ? (
            /* Mobile card layout */
            <div className="space-y-2 px-3 pb-3 max-h-[60vh] overflow-y-auto">
              {(() => {
                const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
                const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                const pageProducts = products.slice(startIdx, startIdx + ITEMS_PER_PAGE);
                return (
                  <>
                    {pageProducts.map(product => {
                      const existingCost = getCostPrice(selectedMp, product.offerId);
                      const editValue = editingPrices[product.offerId];
                      const displayValue = editValue !== undefined ? editValue : (existingCost !== null ? String(existingCost) : '');
                      const hasCost = existingCost !== null;
                      return (
                        <div key={product.offerId} className="p-3 rounded-lg border space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-10 h-10 rounded-lg border bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                              {product.pictures?.[0] ? (
                                <img src={product.pictures[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium line-clamp-1">{product.name || 'Nomsiz'}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-[10px] text-muted-foreground">{product.offerId}</code>
                                {hasCost && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">✓</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground shrink-0">Sotish: <span className="font-medium text-foreground">{formatPrice(product.price || 0)}</span></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input type="number" placeholder="Tannarx kiriting..." value={displayValue}
                              onChange={e => handlePriceChange(product.offerId, e.target.value)} className="h-9 text-sm flex-1" />
                            {editValue !== undefined && editValue !== '' && (
                              <Button size="sm" variant="outline" onClick={() => handleSaveSingle(product.offerId)} className="shrink-0 h-9">
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3">
                        <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4 mr-1" />Oldingi
                        </Button>
                        <span className="text-sm text-muted-foreground">{currentPage} / {totalPages} ({products.length} ta)</span>
                        <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                          Keyingi<ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* Desktop table */
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Mahsulot</TableHead>
                    <TableHead className="w-24">SKU</TableHead>
                    <TableHead className="w-32 text-right">Sotish narxi</TableHead>
                    <TableHead className="w-40">Tannarx (so'm)</TableHead>
                    <TableHead className="w-24 text-right">Marja</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {(() => {
                  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
                  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                  const pageProducts = products.slice(startIdx, startIdx + ITEMS_PER_PAGE);
                  return pageProducts.map(product => {
                    const existingCost = getCostPrice(selectedMp, product.offerId);
                    const editValue = editingPrices[product.offerId];
                    const displayValue = editValue !== undefined ? editValue : (existingCost !== null ? String(existingCost) : '');
                    const costNum = Number(displayValue) || 0;
                    const margin = product.price && costNum > 0 ? ((product.price - costNum) / product.price * 100) : null;
                    const hasCost = existingCost !== null;
                    return (
                      <TableRow key={product.offerId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg border bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                              {product.pictures?.[0] ? (
                                <img src={product.pictures[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </div>
                            {hasCost ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                            <div className="min-w-0">
                              <div className="font-medium text-sm line-clamp-1">{product.name || 'Nomsiz'}</div>
                              <code className="text-xs text-muted-foreground">{product.offerId}</code>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><code className="text-xs">{product.shopSku || '—'}</code></TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatPrice(product.price || 0)}</TableCell>
                        <TableCell>
                          <Input type="number" placeholder="Tannarx..." value={displayValue}
                            onChange={e => handlePriceChange(product.offerId, e.target.value)} className="h-8 text-sm w-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          {margin !== null ? (
                            <span className={`font-medium text-sm ${margin >= 0 ? 'text-primary' : 'text-destructive'}`}>{margin.toFixed(0)}%</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {editValue !== undefined && editValue !== '' && (
                            <Button size="icon" variant="ghost" onClick={() => handleSaveSingle(product.offerId)} className="h-8 w-8">
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
              {products.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between p-4">
                  <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />Oldingi
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, products.length)} / {products.length} ta
                  </span>
                  <Button size="sm" variant="outline" disabled={currentPage >= Math.ceil(products.length / ITEMS_PER_PAGE)} onClick={() => setCurrentPage(p => p + 1)}>
                    Keyingi<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
