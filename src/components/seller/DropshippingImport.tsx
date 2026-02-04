import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { 
  Link, Loader2, Package, DollarSign, Percent, 
  Truck, Image, Video, Box, Calculator, Info,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface ShippingOption {
  logisticName: string;
  logisticPrice: number;
  logisticPriceUZS: number;
  deliveryDays: string;
  logisticId: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  priceUSD: number;
  image?: string;
  inventory?: number;
  properties?: string; // Color: Red, Size: XL
}

interface ImportedProductData {
  name: string;
  description: string;
  price: number;
  priceUSD: number;
  images: string[];
  video?: string;
  source_url: string;
  sku?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  variants?: Variant[];
  shippingOptions?: ShippingOption[];
  estimatedShippingCost?: number;
  estimatedShippingCostUSD?: number;
  source: string;
  category?: string;
  material?: string;
}

interface DropshippingImportProps {
  shopId: string;
  onProductImported: () => void;
}

export function DropshippingImport({ shopId, onProductImported }: DropshippingImportProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { categories } = useCategories();
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importedData, setImportedData] = useState<ImportedProductData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [supplierCost, setSupplierCost] = useState<number>(0);
  const [supplierCostUSD, setSupplierCostUSD] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [shippingCostUSD, setShippingCostUSD] = useState<number>(0);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [markupType, setMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [markupValue, setMarkupValue] = useState<number>(50);
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const USD_TO_UZS = 12800;

  // Calculate pricing breakdown
  const totalCost = supplierCost + shippingCost;
  const totalCostUSD = supplierCostUSD + shippingCostUSD;
  const markupAmount = markupType === 'percent' 
    ? totalCost * (markupValue / 100)
    : markupValue;
  const finalPrice = totalCost + markupAmount;
  const profit = finalPrice - totalCost;
  const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) {
      toast({
        title: t.error,
        description: 'URL kiritish shart',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setCurrentImageIndex(0);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-dropshipping-url', {
        body: { url: url.trim() },
      });

      if (error) throw error;

      const productData: ImportedProductData = {
        name: data.name || 'Imported Product',
        description: data.description || '',
        price: data.price || 0,
        priceUSD: data.priceUSD || 0,
        images: data.images || ['/placeholder.svg'],
        video: data.video,
        source_url: url.trim(),
        sku: data.sku,
        weight: data.weight,
        dimensions: data.dimensions,
        variants: data.variants || [],
        shippingOptions: data.shippingOptions || [],
        estimatedShippingCost: data.estimatedShippingCost || 64000,
        estimatedShippingCostUSD: data.estimatedShippingCostUSD || 5,
        source: data.source || 'other',
        category: data.category,
        material: data.material,
      };

      setImportedData(productData);
      setName(productData.name);
      setDescription(productData.description);
      setSupplierCost(productData.price);
      setSupplierCostUSD(productData.priceUSD);
      setShippingCost(productData.estimatedShippingCost || 64000);
      setShippingCostUSD(productData.estimatedShippingCostUSD || 5);

      // Auto-select cheapest shipping if available
      if (productData.shippingOptions && productData.shippingOptions.length > 0) {
        const cheapest = productData.shippingOptions.reduce((min, opt) => 
          opt.logisticPrice < min.logisticPrice ? opt : min
        );
        setSelectedShipping(cheapest.logisticId);
        setShippingCost(cheapest.logisticPriceUZS);
        setShippingCostUSD(cheapest.logisticPrice);
      }

      toast({
        title: t.success,
        description: `Mahsulot topildi: ${productData.images.length} ta rasm`,
      });
    } catch (err) {
      console.error('Error analyzing URL:', err);
      toast({
        title: 'Xatolik',
        description: 'Ma\'lumotlarni avtomatik olishda xatolik. Qo\'lda kiriting.',
        variant: 'destructive',
      });
      
      // Set fallback data for manual entry
      const fallbackData: ImportedProductData = {
        name: 'Imported Product',
        description: '',
        price: 128000,
        priceUSD: 10,
        images: ['/placeholder.svg'],
        source_url: url.trim(),
        estimatedShippingCost: 64000,
        estimatedShippingCostUSD: 5,
        source: 'manual',
      };
      setImportedData(fallbackData);
      setName(fallbackData.name);
      setSupplierCost(fallbackData.price);
      setSupplierCostUSD(fallbackData.priceUSD);
      setShippingCost(fallbackData.estimatedShippingCost!);
      setShippingCostUSD(fallbackData.estimatedShippingCostUSD!);
    } finally {
      setLoading(false);
    }
  };

  const handleShippingChange = (logisticId: string) => {
    setSelectedShipping(logisticId);
    const option = importedData?.shippingOptions?.find(o => o.logisticId === logisticId);
    if (option) {
      setShippingCost(option.logisticPriceUZS);
      setShippingCostUSD(option.logisticPrice);
    }
  };

  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);
    const variant = importedData?.variants?.find(v => v.id === variantId);
    if (variant) {
      setSupplierCost(variant.price);
      setSupplierCostUSD(variant.priceUSD);
      if (variant.image) {
        const imgIndex = importedData?.images?.indexOf(variant.image);
        if (imgIndex !== undefined && imgIndex >= 0) {
          setCurrentImageIndex(imgIndex);
        }
      }
    }
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      toast({
        title: t.error,
        description: t.productNameRequired,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const variant = importedData?.variants?.find(v => v.id === selectedVariant);
      
      const { error } = await supabase.from('products').insert({
        shop_id: shopId,
        name: name.trim(),
        description: description.trim(),
        price: Math.round(finalPrice),
        original_price: supplierCost,
        images: importedData?.images || [],
        source: 'dropshipping',
        source_url: importedData?.source_url || url,
        category_id: categoryId || null,
        status: 'draft',
        stock_quantity: variant?.inventory || 100,
        specifications: {
          supplier_cost: supplierCost,
          supplier_cost_usd: supplierCostUSD,
          shipping_cost: shippingCost,
          shipping_cost_usd: shippingCostUSD,
          markup_type: markupType,
          markup_value: markupValue,
          profit_margin: profitMargin,
          sku: variant?.sku || importedData?.sku,
          weight: importedData?.weight,
          dimensions: importedData?.dimensions,
          selected_variant_id: selectedVariant || null,
          shipping_method_id: selectedShipping || null,
          source_platform: importedData?.source,
        },
      });

      if (error) throw error;

      toast({
        title: t.success,
        description: `Mahsulot import qilindi. Foyda: ${profit.toLocaleString()} so'm (${profitMargin.toFixed(0)}%)`,
      });

      // Reset form
      setUrl('');
      setImportedData(null);
      setName('');
      setDescription('');
      setSupplierCost(0);
      setShippingCost(0);
      setCategoryId('');
      setSelectedVariant('');
      setSelectedShipping('');
      setCurrentImageIndex(0);
      
      onProductImported();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const nextImage = () => {
    if (importedData?.images && currentImageIndex < importedData.images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* URL Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Dropshipping Import
          </CardTitle>
          <CardDescription>
            CJDropshipping, AliExpress yoki 1688 dan mahsulot havolasini kiriting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://cjdropshipping.com/product/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAnalyzeUrl} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Tahlil...
                </>
              ) : (
                'Tahlil qilish'
              )}
            </Button>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">CJDropshipping</Badge>
            <Badge variant="outline">AliExpress</Badge>
            <Badge variant="outline">1688</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Imported Product Editor */}
      {importedData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Images & Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Mahsulot ma'lumotlari
                {importedData.source !== 'manual' && (
                  <Badge variant="secondary" className="ml-auto">
                    {importedData.source.toUpperCase()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Gallery */}
              <div className="relative">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={importedData.images[currentImageIndex] || '/placeholder.svg'}
                    alt={`Product ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </div>
                
                {importedData.images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      onClick={prevImage}
                      disabled={currentImageIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={nextImage}
                      disabled={currentImageIndex === importedData.images.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-xs">
                      {currentImageIndex + 1} / {importedData.images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {importedData.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {importedData.images.slice(0, 8).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                        idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumb ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Media badges */}
              <div className="flex gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  {importedData.images.length} rasm
                </Badge>
                {importedData.video && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    Video mavjud
                  </Badge>
                )}
                {importedData.weight && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Box className="h-3 w-3" />
                    {importedData.weight} kg
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Variants with Visual Display */}
              {importedData.variants && importedData.variants.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Variantlar (Rang / Razmer)</Label>
                    <Badge variant="secondary">{importedData.variants.length} ta</Badge>
                  </div>
                  
                  {/* Variants Grid - with images */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {importedData.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => handleVariantChange(variant.id)}
                        className={`relative flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                          selectedVariant === variant.id 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {variant.image && (
                          <img
                            src={variant.image}
                            alt={variant.name}
                            className="w-12 h-12 rounded object-cover mb-1"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="text-xs font-medium text-center line-clamp-2">
                          {variant.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ${variant.priceUSD.toFixed(2)}
                        </span>
                        {variant.inventory !== undefined && variant.inventory > 0 && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {variant.inventory} dona
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Selected variant info */}
                  {selectedVariant && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>Tanlangan:</strong>{' '}
                      {importedData.variants.find(v => v.id === selectedVariant)?.name}
                      {importedData.variants.find(v => v.id === selectedVariant)?.properties && (
                        <span className="ml-2">
                          ({importedData.variants.find(v => v.id === selectedVariant)?.properties})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Product Name */}
              <div className="space-y-2">
                <Label>{t.productName}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.productName}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>{t.productCategory}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.productCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name_uz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t.productDescription}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.productDescription}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Right: Pricing Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Narx kalkulyatori
              </CardTitle>
              <CardDescription>
                Aniq foyda hisoblash uchun barcha xarajatlarni kiriting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Supplier Cost */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Supplier narxi (tannarx)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">USD</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={supplierCostUSD}
                        onChange={(e) => {
                          const usd = Number(e.target.value);
                          setSupplierCostUSD(usd);
                          setSupplierCost(Math.round(usd * USD_TO_UZS));
                        }}
                        min={0}
                        step={0.01}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">UZS</Label>
                    <Input
                      type="number"
                      value={supplierCost}
                      onChange={(e) => {
                        const uzs = Number(e.target.value);
                        setSupplierCost(uzs);
                        setSupplierCostUSD(Math.round((uzs / USD_TO_UZS) * 100) / 100);
                      }}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Cost */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  Yetkazib berish narxi
                </div>
                
                {importedData.shippingOptions && importedData.shippingOptions.length > 0 && (
                  <Select value={selectedShipping} onValueChange={handleShippingChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Yetkazib berish usuli" />
                    </SelectTrigger>
                    <SelectContent>
                      {importedData.shippingOptions.map((option) => (
                        <SelectItem key={option.logisticId} value={option.logisticId}>
                          <div className="flex items-center justify-between gap-4">
                            <span>{option.logisticName}</span>
                            <span className="text-muted-foreground">
                              ${option.logisticPrice} ({option.deliveryDays} kun)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">USD</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={shippingCostUSD}
                        onChange={(e) => {
                          const usd = Number(e.target.value);
                          setShippingCostUSD(usd);
                          setShippingCost(Math.round(usd * USD_TO_UZS));
                        }}
                        min={0}
                        step={0.01}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">UZS</Label>
                    <Input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => {
                        const uzs = Number(e.target.value);
                        setShippingCost(uzs);
                        setShippingCostUSD(Math.round((uzs / USD_TO_UZS) * 100) / 100);
                      }}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Markup */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <DollarSign className="h-4 w-4" />
                  Ustama (markup)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={markupType} onValueChange={(v) => setMarkupType(v as 'percent' | 'fixed')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">
                        <span className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Foiz
                        </span>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Qat'iy summa
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={markupValue}
                    onChange={(e) => setMarkupValue(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {markupType === 'percent' 
                    ? `Jami tannarxning ${markupValue}% ustama = ${markupAmount.toLocaleString()} so'm`
                    : `Qat'iy ustama = ${markupValue.toLocaleString()} so'm`
                  }
                </p>
              </div>

              <Separator />

              {/* Price Summary */}
              <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supplier narxi:</span>
                  <span>{supplierCost.toLocaleString()} so'm (${supplierCostUSD})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Yetkazib berish:</span>
                  <span>{shippingCost.toLocaleString()} so'm (${shippingCostUSD})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jami tannarx:</span>
                  <span className="font-medium">{totalCost.toLocaleString()} so'm (${totalCostUSD.toFixed(2)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ustama:</span>
                  <span className="text-emerald-600">+{markupAmount.toLocaleString()} so'm</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Sotish narxi:</span>
                  <span className="text-2xl font-bold text-primary">
                    {finalPrice.toLocaleString()} so'm
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sof foyda:</span>
                  <Badge variant="secondary" className="font-semibold">
                    +{profit.toLocaleString()} so'm ({profitMargin.toFixed(0)}%)
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setImportedData(null);
                    setUrl('');
                  }}
                >
                  {t.cancel}
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSaveProduct} 
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.loading}
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Import qilish
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
