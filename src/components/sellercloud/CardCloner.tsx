import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Copy, ArrowRight, Globe, Package, Search,
  Check, X, Loader2, Image, RefreshCw, Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface CardClonerProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

interface CloneableProduct {
  offerId: string;
  name: string;
  price: number;
  shopSku: string;
  pictures: string[];
  category: string;
  description: string;
  marketplace: string;
  selected: boolean;
}

const MARKETPLACE_INFO: Record<string, { name: string; logo: string; color: string }> = {
  yandex: { name: 'Yandex Market', logo: '🟡', color: 'from-yellow-500 to-amber-500' },
  uzum: { name: 'Uzum Market', logo: '🟣', color: 'from-purple-500 to-violet-500' },
  wildberries: { name: 'Wildberries', logo: '🟣', color: 'from-fuchsia-500 to-pink-500' },
  ozon: { name: 'Ozon', logo: '🔵', color: 'from-blue-500 to-cyan-500' },
};

export function CardCloner({ connectedMarketplaces, fetchMarketplaceData }: CardClonerProps) {
  const [sourceMarketplace, setSourceMarketplace] = useState('');
  const [targetMarketplaces, setTargetMarketplaces] = useState<string[]>([]);
  const [products, setProducts] = useState<CloneableProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneResults, setCloneResults] = useState<{ success: number; failed: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !sourceMarketplace) {
      setSourceMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces]);

  useEffect(() => {
    if (sourceMarketplace) {
      loadSourceProducts();
      // Set available targets (exclude source)
      setTargetMarketplaces([]);
    }
  }, [sourceMarketplace]);

  const loadSourceProducts = async () => {
    setIsLoading(true);
    try {
      const result = await fetchMarketplaceData(sourceMarketplace, 'products', {
        limit: 200,
        fetchAll: true,
      });

      if (result.success && result.data) {
        setProducts(result.data.map((p: any) => ({
          offerId: p.offerId,
          name: p.name || 'Nomsiz',
          price: p.price || 0,
          shopSku: p.shopSku || p.offerId,
          pictures: p.pictures || [],
          category: p.category || '',
          description: p.description || '',
          marketplace: sourceMarketplace,
          selected: false,
        })));
      }
    } catch (err) {
      console.error('Load source products error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const availableTargets = connectedMarketplaces.filter(mp => mp !== sourceMarketplace);

  const toggleTarget = (mp: string) => {
    setTargetMarketplaces(prev =>
      prev.includes(mp) ? prev.filter(m => m !== mp) : [...prev, mp]
    );
  };

  const toggleProduct = (offerId: string) => {
    setProducts(prev => prev.map(p =>
      p.offerId === offerId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    const allSelected = filteredProducts.every(p => p.selected);
    const ids = new Set(filteredProducts.map(p => p.offerId));
    setProducts(prev => prev.map(p =>
      ids.has(p.offerId) ? { ...p, selected: !allSelected } : p
    ));
  };

  const selectedProducts = products.filter(p => p.selected);
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.shopSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClone = async () => {
    if (selectedProducts.length === 0 || targetMarketplaces.length === 0) return;

    setIsCloning(true);
    setCloneProgress(0);
    setCloneResults(null);

    const total = selectedProducts.length * targetMarketplaces.length;
    let completed = 0;
    let success = 0;
    let failed = 0;

    for (const product of selectedProducts) {
      for (const targetMp of targetMarketplaces) {
        try {
          // Simulate clone via marketplace API
          await fetchMarketplaceData(targetMp, 'create-card', {
            name: product.name,
            price: product.price,
            shopSku: product.shopSku,
            pictures: product.pictures,
            category: product.category,
            description: product.description,
            sourceMarketplace: sourceMarketplace,
          });
          success++;
        } catch {
          failed++;
        }
        completed++;
        setCloneProgress((completed / total) * 100);
      }
    }

    setCloneResults({ success, failed });
    setIsCloning(false);

    if (success > 0) {
      toast.success(`${success} ta kartochka muvaffaqiyatli klonlandi!`);
    }
    if (failed > 0) {
      toast.error(`${failed} ta kartochka klonlanmadi`);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Copy className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Kartochka klonlash (PIM)</h3>
          <p className="text-muted-foreground mb-4">
            Klonlash uchun kamida 2 ta marketplace ulangan bo'lishi kerak
          </p>
          <Badge variant="outline">
            {connectedMarketplaces.length} / 2 marketplace ulangan
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Manba marketplace
          </CardTitle>
          <CardDescription>Kartochkalar qayerdan ko'chirilsin?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {connectedMarketplaces.map(mp => {
              const info = MARKETPLACE_INFO[mp];
              const isSelected = sourceMarketplace === mp;
              return (
                <Button
                  key={mp}
                  variant={isSelected ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setSourceMarketplace(mp)}
                >
                  <span className="text-lg">{info?.logo}</span>
                  {info?.name || mp}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Target Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Maqsad marketplace(lar)
          </CardTitle>
          <CardDescription>Kartochkalar qayerga ko'chirilsin?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {availableTargets.map(mp => {
              const info = MARKETPLACE_INFO[mp];
              const isSelected = targetMarketplaces.includes(mp);
              return (
                <div
                  key={mp}
                  onClick={() => toggleTarget(mp)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info?.color} flex items-center justify-center text-xl`}>
                      {info?.logo}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{info?.name}</div>
                    </div>
                    <Checkbox checked={isSelected} />
                  </div>
                </div>
              );
            })}
          </div>
          {availableTargets.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Boshqa marketplace ulanmagan
            </p>
          )}
        </CardContent>
      </Card>

      {/* Products to Clone */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Klonlanadigan mahsulotlar
                {selectedProducts.length > 0 && (
                  <Badge variant="secondary">{selectedProducts.length} tanlangan</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {MARKETPLACE_INFO[sourceMarketplace]?.name} dagi {products.length} ta mahsulot
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-48 h-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {filteredProducts.every(p => p.selected) ? 'Bekor qilish' : 'Barchasini tanlash'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadSourceProducts} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.offerId}
                  onClick={() => toggleProduct(product.offerId)}
                  className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                    product.selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <Checkbox checked={product.selected} />
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {product.pictures.length > 0 ? (
                      <img
                        src={product.pictures[0]}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Image className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                    <code className="text-xs text-muted-foreground">{product.shopSku}</code>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatPrice(product.price)}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.pictures.length} rasm
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clone Action */}
      <Card className="border-primary/20">
        <CardContent className="py-6">
          {isCloning ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">Klonlanmoqda...</span>
              </div>
              <Progress value={cloneProgress} />
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} mahsulot × {targetMarketplaces.length} marketplace = {selectedProducts.length * targetMarketplaces.length} ta kartochka
              </p>
            </div>
          ) : cloneResults ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {cloneResults.success > 0 && (
                  <Badge variant="default" className="bg-green-500 gap-1">
                    <Check className="h-3 w-3" />
                    {cloneResults.success} muvaffaqiyatli
                  </Badge>
                )}
                {cloneResults.failed > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" />
                    {cloneResults.failed} xato
                  </Badge>
                )}
              </div>
              <Button variant="outline" onClick={() => setCloneResults(null)}>
                Yangi klonlash
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span className="text-lg">{MARKETPLACE_INFO[sourceMarketplace]?.logo}</span>
                  {MARKETPLACE_INFO[sourceMarketplace]?.name}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {targetMarketplaces.map(mp => (
                    <span key={mp} className="text-lg">{MARKETPLACE_INFO[mp]?.logo}</span>
                  ))}
                  {targetMarketplaces.length === 0 && (
                    <span className="text-sm text-muted-foreground">Maqsad tanlang</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedProducts.length > 0
                    ? `${selectedProducts.length} mahsulot → ${targetMarketplaces.length} marketplace`
                    : 'Mahsulotlarni tanlang'}
                </p>
              </div>
              <Button
                size="lg"
                disabled={selectedProducts.length === 0 || targetMarketplaces.length === 0}
                onClick={handleClone}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Klonlash
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
