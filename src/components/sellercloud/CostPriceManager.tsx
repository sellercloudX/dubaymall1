import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { DollarSign, Save, Search, Package, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
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

const UZS_TO_RUB = 140; // 1 RUB = 140 UZS

const isRubMarketplace = (mp: string) => mp === 'wildberries';
const getCurrencyLabel = (mp: string) => isRubMarketplace(mp) ? '₽' : "so'm";
const getCurrencyLabelFull = (mp: string) => isRubMarketplace(mp) ? 'руб' : "so'm";

export function CostPriceManager({ connectedMarketplaces, store }: CostPriceManagerProps) {
  const isMobile = useIsMobile();
  const { getCostPrice, setCostPrice, bulkSetCostPrices, loading: costLoading } = useCostPrices();
  const [selectedMp, setSelectedMp] = useState(connectedMarketplaces[0] || '');
  const [search, setSearch] = useState('');
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const isLoading = store.isLoadingProducts || costLoading;

  // Import cost prices from Yandex to WB (UZS → RUB)
  const handleImportFromYandex = useCallback(async () => {
    if (!connectedMarketplaces.includes('yandex')) {
      toast.error('Yandex Market ulanmagan');
      return;
    }
    setImporting(true);
    try {
      const yandexProducts = store.getProducts('yandex');
      const wbProducts = store.getProducts('wildberries');
      
      if (yandexProducts.length === 0) {
        toast.error('Yandex da mahsulotlar topilmadi');
        return;
      }

      // Build a map of Yandex cost prices
      const entries: { marketplace: string; offerId: string; costPrice: number }[] = [];
      let matched = 0;
      let skipped = 0;

      // Helper: normalize name for matching
      const normalizeName = (name: string) => 
        name.toLowerCase()
          .replace(/[^a-zа-яёўқғҳ0-9\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      
      const getWords = (name: string) => 
        normalizeName(name).split(' ').filter(w => w.length > 1);

      // Pre-index Yandex products by normalized words for faster lookup
      const yandexNormalized = yandexProducts.map(yp => ({
        product: yp,
        normalized: normalizeName(yp.name || ''),
        words: new Set(getWords(yp.name || '')),
      }));

      for (const wbProduct of wbProducts) {
        const wbName = wbProduct.name || '';
        const wbNorm = normalizeName(wbName);
        const wbWords = getWords(wbName);
        const wbSku = (wbProduct.shopSku || wbProduct.offerId || '').toLowerCase();
        
        // 1) Exact SKU match
        let yandexMatch = yandexProducts.find(yp => {
          const ySku = (yp.shopSku || yp.offerId || '').toLowerCase();
          return ySku && ySku === wbSku;
        });
        
        // 2) Exact normalized name match
        if (!yandexMatch && wbNorm.length > 3) {
          const found = yandexNormalized.find(y => y.normalized === wbNorm);
          if (found) yandexMatch = found.product;
        }

        // 3) Name containment
        if (!yandexMatch && wbNorm.length > 5) {
          const found = yandexNormalized.find(y => {
            if (y.normalized.length < 5) return false;
            return y.normalized.includes(wbNorm) || wbNorm.includes(y.normalized);
          });
          if (found) yandexMatch = found.product;
        }

        // 4) Fuzzy word matching (40%+ overlap from BOTH sides)
        if (!yandexMatch && wbWords.length >= 2) {
          const wbSet = new Set(wbWords);
          let bestScore = 0;
          let bestMatch: typeof yandexNormalized[0] | null = null;
          
          for (const y of yandexNormalized) {
            if (y.words.size < 2) continue;
            let common = 0;
            for (const w of wbSet) { if (y.words.has(w)) common++; }
            // Score = average of both coverage ratios
            const score = (common / wbSet.size + common / y.words.size) / 2;
            if (score > bestScore && score >= 0.4) {
              bestScore = score;
              bestMatch = y;
            }
          }
          if (bestMatch) yandexMatch = bestMatch.product;
        }

        // 5) Number-based matching (article numbers, sizes in name)
        if (!yandexMatch && wbWords.length >= 1) {
          const wbNums = wbWords.filter(w => /\d/.test(w));
          if (wbNums.length >= 1) {
            const found = yandexNormalized.find(y => {
              const yNums = [...y.words].filter(w => /\d/.test(w));
              if (yNums.length === 0) return false;
              const commonNums = wbNums.filter(n => yNums.includes(n));
              // All numeric parts match + at least one text word matches
              if (commonNums.length === wbNums.length && commonNums.length === yNums.length) {
                const wbText = wbWords.filter(w => !/\d/.test(w));
                return wbText.some(w => y.words.has(w));
              }
              return false;
            });
            if (found) yandexMatch = found.product;
          }
        }

        if (yandexMatch) {
          const yandexCost = getCostPrice('yandex', yandexMatch.offerId);
          if (yandexCost !== null && yandexCost > 0) {
            // Convert UZS → RUB
            const costInRub = Math.round(yandexCost / UZS_TO_RUB);
            if (costInRub > 0) {
              entries.push({ marketplace: 'wildberries', offerId: wbProduct.offerId, costPrice: costInRub });
              matched++;
            }
          } else {
            skipped++;
          }
        }
      }

      if (entries.length > 0) {
        await bulkSetCostPrices(entries);
        toast.success(`${matched} ta mahsulotga tannarx import qilindi (UZS → RUB)`);
      } else if (skipped > 0) {
        toast.warning(`Mos mahsulotlar topildi, lekin Yandex da tannarx kiritilmagan (${skipped} ta)`);
      } else {
        toast.warning('Mos mahsulotlar topilmadi — avval Yandex da tannarx kiriting');
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Import qilishda xatolik');
    } finally {
      setImporting(false);
    }
  }, [connectedMarketplaces, store, getCostPrice, bulkSetCostPrices]);

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

  const formatPrice = (price: number) => {
    if (isRubMarketplace(selectedMp)) {
      return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

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
          {selectedMp === 'wildberries' && connectedMarketplaces.includes('yandex') && (
            <Button size="sm" variant="outline" onClick={handleImportFromYandex} disabled={importing} className="shrink-0 text-xs">
              {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
              Yandex dan import (₽)
            </Button>
          )}
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
                    <TableHead className="w-40">Tannarx ({getCurrencyLabelFull(selectedMp)})</TableHead>
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
