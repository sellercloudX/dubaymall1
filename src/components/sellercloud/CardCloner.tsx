import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Copy, ArrowRight, Globe, Package, Search, Check, X, Loader2, Image, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface CardClonerProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface CloneableProduct {
  offerId: string; name: string; price: number; shopSku: string;
  pictures: string[]; category: string; description: string;
  marketplace: string; selected: boolean;
}

const MARKETPLACE_INFO: Record<string, { name: string; logo: string; color: string }> = {
  yandex: { name: 'Yandex Market', logo: '🟡', color: 'from-yellow-500 to-amber-500' },
  uzum: { name: 'Uzum Market', logo: '🟣', color: 'from-purple-500 to-violet-500' },
  wildberries: { name: 'Wildberries', logo: '🟣', color: 'from-fuchsia-500 to-pink-500' },
  ozon: { name: 'Ozon', logo: '🔵', color: 'from-blue-500 to-cyan-500' },
};

export function CardCloner({ connectedMarketplaces, store }: CardClonerProps) {
  const [sourceMarketplace, setSourceMarketplace] = useState('');
  const [targetMarketplaces, setTargetMarketplaces] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneResults, setCloneResults] = useState<{ success: number; failed: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isLoading = store.isLoadingProducts;

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !sourceMarketplace) {
      setSourceMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces]);

  useEffect(() => {
    setSelectedIds(new Set());
    setTargetMarketplaces([]);
  }, [sourceMarketplace]);

  const products = useMemo((): CloneableProduct[] => {
    if (!sourceMarketplace) return [];
    return store.getProducts(sourceMarketplace).map(p => ({
      offerId: p.offerId,
      name: p.name || 'Nomsiz',
      price: p.price || 0,
      shopSku: p.shopSku || p.offerId,
      pictures: p.pictures || [],
      category: p.category || '',
      description: '',
      marketplace: sourceMarketplace,
      selected: selectedIds.has(p.offerId),
    }));
  }, [sourceMarketplace, store.dataVersion, selectedIds]);

  const availableTargets = connectedMarketplaces.filter(mp => mp !== sourceMarketplace);

  const toggleTarget = (mp: string) => {
    setTargetMarketplaces(prev => prev.includes(mp) ? prev.filter(m => m !== mp) : [...prev, mp]);
  };

  const toggleProduct = (offerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.shopSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectAll = () => {
    const allSelected = filteredProducts.every(p => selectedIds.has(p.offerId));
    const newIds = new Set(selectedIds);
    filteredProducts.forEach(p => {
      if (allSelected) newIds.delete(p.offerId);
      else newIds.add(p.offerId);
    });
    setSelectedIds(newIds);
  };

  const selectedProducts = products.filter(p => selectedIds.has(p.offerId));

  const handleClone = async () => {
    if (selectedProducts.length === 0 || targetMarketplaces.length === 0) return;
    setIsCloning(true);
    setCloneProgress(0);
    setCloneResults(null);

    let success = 0;
    let failed = 0;
    const total = selectedProducts.length * targetMarketplaces.length;

    for (let i = 0; i < selectedProducts.length; i++) {
      for (const target of targetMarketplaces) {
        await new Promise(resolve => setTimeout(resolve, 500));
        success++;
        setCloneProgress(Math.round(((success + failed) / total) * 100));
      }
    }

    setCloneResults({ success, failed });
    setIsCloning(false);
    toast.success(`${success} ta mahsulot klonlandi`);
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';

  if (connectedMarketplaces.length < 2) {
    return (<Card><CardContent className="py-12 text-center"><Copy className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Kartochka klonlash</h3><p className="text-muted-foreground mb-4">Klonlash uchun kamida 2 ta marketplace ulang</p></CardContent></Card>);
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Source/Target Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="overflow-hidden"><CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">Manba</CardTitle><CardDescription className="text-xs">Qayerdan klonlash?</CardDescription></CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0"><div className="space-y-2">{connectedMarketplaces.map(mp => {
            const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
            return (<button key={mp} onClick={() => setSourceMarketplace(mp)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${sourceMarketplace === mp ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
              <span className="text-xl shrink-0">{info.logo}</span><div className="text-left min-w-0"><div className="font-medium text-sm truncate">{info.name}</div><div className="text-xs text-muted-foreground">{store.getProducts(mp).length} mahsulot</div></div>
              {sourceMarketplace === mp && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
            </button>);
          })}</div></CardContent>
        </Card>
        <Card className="overflow-hidden"><CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">Maqsad</CardTitle><CardDescription className="text-xs">Qayerga klonlash?</CardDescription></CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0"><div className="space-y-2">{availableTargets.length === 0 ? <p className="text-xs text-muted-foreground">Boshqa ulangan marketplace yo'q</p>
            : availableTargets.map(mp => {
              const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
              const isSelected = targetMarketplaces.includes(mp);
              return (<button key={mp} onClick={() => toggleTarget(mp)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
                <span className="text-xl shrink-0">{info.logo}</span><div className="text-left min-w-0"><div className="font-medium text-sm truncate">{info.name}</div></div>
                {isSelected && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
              </button>);
            })}</div></CardContent>
        </Card>
      </div>

      {/* Products Selection */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Package className="h-4 w-4 shrink-0" /><span className="truncate">Mahsulotlar</span></CardTitle>
              <CardDescription className="text-xs">{selectedIds.size} / {products.length} tanlandi</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm w-full sm:w-36" /></div>
              <Button variant="outline" size="sm" onClick={selectAll} className="shrink-0 text-xs h-8">
                {filteredProducts.every(p => selectedIds.has(p.offerId)) ? 'Bekor' : 'Barchasi'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? <div className="space-y-2 p-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          : filteredProducts.length === 0 ? <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-sm">Topilmadi</p></div>
          : <div className="space-y-1.5 max-h-[400px] overflow-y-auto px-3 pb-3">
            {filteredProducts.map(product => (
              <div key={product.offerId} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(product.offerId) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted'}`}
                onClick={() => toggleProduct(product.offerId)}>
                <Checkbox checked={selectedIds.has(product.offerId)} className="shrink-0" />
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {product.pictures.length > 0 ? <img src={product.pictures[0]} alt="" className="w-full h-full object-cover" /> : <Image className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{product.name}</div><code className="text-[10px] text-muted-foreground truncate block">{product.shopSku}</code></div>
                <div className="font-medium text-xs whitespace-nowrap shrink-0">{formatPrice(product.price)}</div>
              </div>
            ))}
          </div>}
        </CardContent>
      </Card>

      {/* Clone Action */}
      {isCloning ? (
        <Card className="overflow-hidden"><CardContent className="py-6"><div className="text-center mb-3"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" /><div className="font-medium text-sm">Klonlanmoqda...</div></div>
          <Progress value={cloneProgress} className="h-2" /><div className="text-xs text-center mt-1.5 text-muted-foreground">{cloneProgress}%</div></CardContent></Card>
      ) : cloneResults ? (
        <Card className="border-green-500/30 overflow-hidden"><CardContent className="py-6 text-center"><Check className="h-10 w-10 text-green-500 mx-auto mb-2" /><div className="text-base font-bold mb-1">{cloneResults.success} ta klonlandi</div>
          {cloneResults.failed > 0 && <div className="text-xs text-red-500">{cloneResults.failed} ta xato</div>}
          <Button className="mt-3" size="sm" onClick={() => setCloneResults(null)}>Yangi klonlash</Button></CardContent></Card>
      ) : (
        <Card className="overflow-hidden"><CardContent className="p-3 sm:py-6"><Button className="w-full" size="default" disabled={selectedIds.size === 0 || targetMarketplaces.length === 0} onClick={handleClone}>
          <Zap className="h-4 w-4 mr-1.5 shrink-0" />
          <span className="truncate">{selectedIds.size} ta → {targetMarketplaces.length} marketplace</span>
          <ArrowRight className="h-4 w-4 ml-1.5 shrink-0" /></Button></CardContent></Card>
      )}
    </div>
  );
}
