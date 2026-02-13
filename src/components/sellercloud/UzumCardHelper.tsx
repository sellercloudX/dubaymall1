import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, Sparkles, ExternalLink, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface UzumCardHelperProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface UzumCardData {
  name_uz: string;
  name_ru: string;
  short_description_uz: string;
  short_description_ru: string;
  full_description_uz: string;
  full_description_ru: string;
  brand?: string;
  properties: Array<{
    name_uz: string;
    name_ru: string;
    value_uz: string;
    value_ru: string;
  }>;
  seo_keywords?: string[];
}

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} nusxalandi`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </Button>
      </div>
      {multiline ? (
        <div className="bg-muted/50 rounded-md p-2.5 text-sm whitespace-pre-wrap border">{value}</div>
      ) : (
        <div className="bg-muted/50 rounded-md px-2.5 py-1.5 text-sm border truncate">{value}</div>
      )}
    </div>
  );
}

export function UzumCardHelper({ connectedMarketplaces, store }: UzumCardHelperProps) {
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardData, setCardData] = useState<UzumCardData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('name');

  // Get products from all connected marketplaces (except uzum itself)
  const sourceProducts = useMemo(() => {
    const products: Array<{ id: string; name: string; price: number; description: string; category: string; marketplace: string }> = [];
    for (const mp of connectedMarketplaces) {
      if (mp === 'uzum') continue;
      const mpProducts = store.getProducts(mp);
      for (const p of mpProducts) {
        products.push({
          id: `${mp}-${p.offerId}`,
          name: p.name || 'Nomsiz',
          price: p.price || 0,
          description: p.description || '',
          category: p.category || '',
          marketplace: mp,
        });
      }
    }
    return products;
  }, [connectedMarketplaces, store.dataVersion]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return sourceProducts.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return sourceProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [sourceProducts, searchQuery]);

  const selectedProduct = sourceProducts.find(p => p.id === selectedProductId);

  const handleGenerate = async () => {
    const productName = mode === 'select' ? selectedProduct?.name : manualName;
    if (!productName) {
      toast.error("Mahsulot nomini kiriting");
      return;
    }

    setIsGenerating(true);
    setCardData(null);

    try {
      const body: Record<string, any> = {
        productName,
        description: mode === 'select' ? selectedProduct?.description : manualDescription,
        category: mode === 'select' ? selectedProduct?.category : manualCategory,
        brand: mode === 'manual' ? manualBrand : undefined,
        price: mode === 'select' ? selectedProduct?.price : manualPrice ? Number(manualPrice) : undefined,
      };

      const { data, error } = await supabase.functions.invoke('prepare-uzum-card', { body });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.card) {
        setCardData(data.card);
        toast.success("Uzum kartochka ma'lumotlari tayyor!");
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      toast.error(err?.message || "Xatolik yuz berdi");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAll = async () => {
    if (!cardData) return;
    const allText = `
=== NOM (UZ) ===
${cardData.name_uz}

=== NOM (RU) ===
${cardData.name_ru}

=== QISQA TAVSIF (UZ) ===
${cardData.short_description_uz}

=== QISQA TAVSIF (RU) ===
${cardData.short_description_ru}

=== TO'LIQ TAVSIF (UZ) ===
${cardData.full_description_uz}

=== TO'LIQ TAVSIF (RU) ===
${cardData.full_description_ru}

=== XUSUSIYATLAR ===
${cardData.properties.map(p => `${p.name_uz} (${p.name_ru}): ${p.value_uz} (${p.value_ru})`).join('\n')}
${cardData.brand ? `\n=== BREND ===\n${cardData.brand}` : ''}
${cardData.seo_keywords?.length ? `\n=== SEO ===\n${cardData.seo_keywords.join(', ')}` : ''}
`.trim();
    
    await navigator.clipboard.writeText(allText);
    toast.success("Barcha ma'lumotlar nusxalandi!");
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Uzum Card Helper</CardTitle>
              <CardDescription className="text-xs">AI orqali kartochka ma'lumotlarini tayyorlash</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Input Mode */}
      {!cardData && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <Button variant={mode === 'select' ? 'default' : 'outline'} size="sm" onClick={() => setMode('select')} className="flex-1 text-xs">
                <Package className="h-3.5 w-3.5 mr-1" /> Mahsulotdan
              </Button>
              <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')} className="flex-1 text-xs">
                ✏️ Qo'lda kiritish
              </Button>
            </div>

            {mode === 'select' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Mahsulot qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Mahsulotlar topilmadi. Marketplace ulang (Uzumdan boshqa).</p>
                  ) : (
                    filteredProducts.map(p => (
                      <button key={p.id} onClick={() => setSelectedProductId(p.id)}
                        className={`w-full text-left p-2 rounded-md border text-xs transition-all ${selectedProductId === p.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{p.marketplace}</Badge>
                          {p.price > 0 && <span>{new Intl.NumberFormat('uz-UZ').format(p.price)} so'm</span>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Mahsulot nomi *" value={manualName} onChange={e => setManualName(e.target.value)} className="h-8 text-sm" />
                <Textarea placeholder="Tavsif" value={manualDescription} onChange={e => setManualDescription(e.target.value)} className="min-h-[60px] text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Kategoriya" value={manualCategory} onChange={e => setManualCategory(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Brend" value={manualBrand} onChange={e => setManualBrand(e.target.value)} className="h-8 text-sm" />
                </div>
                <Input placeholder="Narx (so'm)" type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} className="h-8 text-sm" />
              </div>
            )}

            <Button onClick={handleGenerate} disabled={isGenerating || (mode === 'select' && !selectedProductId) || (mode === 'manual' && !manualName)}
              className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700">
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  AI tayyorlamoqda...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Kartochka tayyorlash
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isGenerating && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {cardData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Tayyor ma'lumotlar</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCardData(null)} className="text-xs h-7">
                Qayta yaratish
              </Button>
              <Button size="sm" onClick={handleCopyAll} className="text-xs h-7">
                <Copy className="h-3 w-3 mr-1" /> Hammasini nusxalash
              </Button>
            </div>
          </div>

          {/* Name */}
          <Card>
            <button onClick={() => toggleSection('name')} className="w-full p-3 flex items-center justify-between">
              <span className="font-medium text-sm">📝 Nomi</span>
              {expandedSection === 'name' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSection === 'name' && (
              <CardContent className="px-3 pb-3 pt-0 space-y-2">
                <CopyField label="O'zbekcha (lotin)" value={cardData.name_uz} />
                <CopyField label="Ruscha (kirill)" value={cardData.name_ru} />
              </CardContent>
            )}
          </Card>

          {/* Short Description */}
          <Card>
            <button onClick={() => toggleSection('short')} className="w-full p-3 flex items-center justify-between">
              <span className="font-medium text-sm">📋 Qisqa tavsif</span>
              {expandedSection === 'short' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSection === 'short' && (
              <CardContent className="px-3 pb-3 pt-0 space-y-2">
                <CopyField label="O'zbekcha" value={cardData.short_description_uz} multiline />
                <CopyField label="Ruscha" value={cardData.short_description_ru} multiline />
              </CardContent>
            )}
          </Card>

          {/* Full Description */}
          <Card>
            <button onClick={() => toggleSection('full')} className="w-full p-3 flex items-center justify-between">
              <span className="font-medium text-sm">📖 To'liq tavsif</span>
              {expandedSection === 'full' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSection === 'full' && (
              <CardContent className="px-3 pb-3 pt-0 space-y-2">
                <CopyField label="O'zbekcha" value={cardData.full_description_uz} multiline />
                <CopyField label="Ruscha" value={cardData.full_description_ru} multiline />
              </CardContent>
            )}
          </Card>

          {/* Properties */}
          <Card>
            <button onClick={() => toggleSection('props')} className="w-full p-3 flex items-center justify-between">
              <span className="font-medium text-sm">⚙️ Xususiyatlar ({cardData.properties.length})</span>
              {expandedSection === 'props' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSection === 'props' && (
              <CardContent className="px-3 pb-3 pt-0">
                <div className="space-y-2">
                  {cardData.properties.map((prop, i) => (
                    <div key={i} className="bg-muted/50 rounded-md p-2 border text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{prop.name_uz} / {prop.name_ru}</span>
                        <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]"
                          onClick={() => {
                            navigator.clipboard.writeText(`${prop.value_uz}`);
                            toast.success('Nusxalandi');
                          }}>
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                      <div className="text-muted-foreground">{prop.value_uz} / {prop.value_ru}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* SEO Keywords */}
          {cardData.seo_keywords && cardData.seo_keywords.length > 0 && (
            <Card>
              <button onClick={() => toggleSection('seo')} className="w-full p-3 flex items-center justify-between">
                <span className="font-medium text-sm">🔍 SEO kalit so'zlar</span>
                {expandedSection === 'seo' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSection === 'seo' && (
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {cardData.seo_keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20"
                        onClick={() => { navigator.clipboard.writeText(kw); toast.success('Nusxalandi'); }}>
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Link to Uzum */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-purple-500/20">
            <CardContent className="p-3">
              <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between text-sm font-medium text-purple-700 dark:text-purple-300">
                <span>🟣 Uzum Seller Portal'da kartochka yaratish</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                Yuqoridagi ma'lumotlarni nusxalab, Uzum seller portal'ga o'ting va "Yangi tovar qo'shish" bo'limida joylashtiring.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
