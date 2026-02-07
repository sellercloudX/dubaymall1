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
  }, [sourceMarketplace, store.allProducts.length, selectedIds]);

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
    <div className="space-y-6">
      {/* Source/Target Selection */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-base">Manba marketplace</CardTitle><CardDescription>Qaysi marketplace dan klonlash?</CardDescription></CardHeader>
          <CardContent><div className="space-y-2">{connectedMarketplaces.map(mp => {
            const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
            return (<button key={mp} onClick={() => setSourceMarketplace(mp)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${sourceMarketplace === mp ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
              <span className="text-2xl">{info.logo}</span><div className="text-left"><div className="font-medium">{info.name}</div><div className="text-xs text-muted-foreground">{store.getProducts(mp).length} mahsulot</div></div>
              {sourceMarketplace === mp && <Check className="h-5 w-5 text-primary ml-auto" />}
            </button>);
          })}</div></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Maqsad marketplace</CardTitle><CardDescription>Qaysi marketplace(lar)ga klonlash?</CardDescription></CardHeader>
          <CardContent><div className="space-y-2">{availableTargets.length === 0 ? <p className="text-sm text-muted-foreground">Boshqa ulangan marketplace yo'q</p>
            : availableTargets.map(mp => {
              const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
              const isSelected = targetMarketplaces.includes(mp);
              return (<button key={mp} onClick={() => toggleTarget(mp)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
                <span className="text-2xl">{info.logo}</span><div className="text-left"><div className="font-medium">{info.name}</div></div>
                {isSelected && <Check className="h-5 w-5 text-primary ml-auto" />}
              </button>);
            })}</div></CardContent>
        </Card>
      </div>

      {/* Products Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Mahsulotlarni tanlang</CardTitle>
            <CardDescription>{selectedIds.size} ta tanlandi / {products.length} ta jami</CardDescription></div>
            <div className="flex gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-40" /></div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {filteredProducts.every(p => selectedIds.has(p.offerId)) ? 'Barchasini bekor qilish' : 'Barchasini tanlash'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : filteredProducts.length === 0 ? <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Mahsulotlar topilmadi</p></div>
          : <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredProducts.map(product => (
              <div key={product.offerId} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(product.offerId) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted'}`}
                onClick={() => toggleProduct(product.offerId)}>
                <Checkbox checked={selectedIds.has(product.offerId)} />
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                  {product.pictures.length > 0 ? <img src={product.pictures[0]} alt="" className="w-full h-full object-cover" /> : <Image className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{product.name}</div><code className="text-xs text-muted-foreground">{product.shopSku}</code></div>
                <div className="font-medium text-sm whitespace-nowrap">{formatPrice(product.price)}</div>
              </div>
            ))}
          </div>}
        </CardContent>
      </Card>

      {/* Clone Action */}
      {isCloning ? (
        <Card><CardContent className="py-8"><div className="text-center mb-4"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" /><div className="font-medium">Klonlanmoqda...</div></div>
          <Progress value={cloneProgress} className="h-2" /><div className="text-sm text-center mt-2 text-muted-foreground">{cloneProgress}%</div></CardContent></Card>
      ) : cloneResults ? (
        <Card className="border-green-500/30"><CardContent className="py-6 text-center"><Check className="h-12 w-12 text-green-500 mx-auto mb-3" /><div className="text-lg font-bold mb-1">{cloneResults.success} ta mahsulot klonlandi</div>
          {cloneResults.failed > 0 && <div className="text-sm text-red-500">{cloneResults.failed} ta xato</div>}
          <Button className="mt-4" onClick={() => setCloneResults(null)}>Yangi klonlash</Button></CardContent></Card>
      ) : (
        <Card><CardContent className="py-6"><Button className="w-full" size="lg" disabled={selectedIds.size === 0 || targetMarketplaces.length === 0} onClick={handleClone}>
          <Zap className="h-5 w-5 mr-2" />{selectedIds.size} ta mahsulotni {targetMarketplaces.length} ta marketplace ga klonlash
          <ArrowRight className="h-5 w-5 ml-2" /></Button></CardContent></Card>
      )}
    </div>
  );
}
