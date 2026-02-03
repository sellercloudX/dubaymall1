import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { Link, Loader2, Package, DollarSign, Percent } from 'lucide-react';

interface ImportedProductData {
  name: string;
  description: string;
  price: number;
  images: string[];
  source_url: string;
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
  
  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [markupType, setMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [markupValue, setMarkupValue] = useState<number>(30);
  const [categoryId, setCategoryId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const calculateFinalPrice = () => {
    if (markupType === 'percent') {
      return originalPrice * (1 + markupValue / 100);
    }
    return originalPrice + markupValue;
  };

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
    try {
      const { data, error } = await supabase.functions.invoke('analyze-dropshipping-url', {
        body: { url: url.trim() },
      });

      if (error) throw error;

      const productData: ImportedProductData = {
        name: data.name || 'Imported Product',
        description: data.description || '',
        price: data.price || 0,
        images: data.images || [],
        source_url: url.trim(),
      };

      setImportedData(productData);
      setName(productData.name);
      setDescription(productData.description);
      setOriginalPrice(productData.price);

      toast({
        title: t.success,
        description: 'Mahsulot ma\'lumotlari olindi',
      });
    } catch (err) {
      console.error('Error analyzing URL:', err);
      // Fallback to manual entry with demo data
      const demoData: ImportedProductData = {
        name: 'Imported Product',
        description: 'Product imported from external source. Please edit the details.',
        price: 100000,
        images: ['/placeholder.svg'],
        source_url: url.trim(),
      };
      setImportedData(demoData);
      setName(demoData.name);
      setDescription(demoData.description);
      setOriginalPrice(demoData.price);

      toast({
        title: 'Qo\'lda kiritish talab etiladi',
        description: 'Ma\'lumotlarni avtomatik olishda xatolik',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
      const finalPrice = calculateFinalPrice();

      const { error } = await supabase.from('products').insert({
        shop_id: shopId,
        name: name.trim(),
        description: description.trim(),
        price: Math.round(finalPrice),
        original_price: originalPrice,
        images: importedData?.images || [],
        source: 'dropshipping',
        source_url: importedData?.source_url || url,
        category_id: categoryId || null,
        status: 'draft',
        stock_quantity: 100,
      });

      if (error) throw error;

      toast({
        title: t.success,
        description: 'Mahsulot import qilindi',
      });

      // Reset form
      setUrl('');
      setImportedData(null);
      setName('');
      setDescription('');
      setOriginalPrice(0);
      setCategoryId('');
      
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

  return (
    <div className="space-y-6">
      {/* URL Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            URL orqali import
          </CardTitle>
          <CardDescription>
            AliExpress, CJdropshipping yoki boshqa manbadan mahsulot havolasini kiriting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://aliexpress.com/item/..."
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
          <p className="text-sm text-muted-foreground">
            Qo'llab-quvvatlanadigan manbalar: AliExpress, CJdropshipping, 1688
          </p>
        </CardContent>
      </Card>

      {/* Imported Product Editor */}
      {importedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Import qilingan mahsulot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Images Preview */}
            {importedData.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {importedData.images.slice(0, 5).map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Product ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.productName}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.productName}
                />
              </div>

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
            </div>

            <div className="space-y-2">
              <Label>{t.productDescription}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.productDescription}
                rows={4}
              />
            </div>

            {/* Pricing Section */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Narx sozlamalari
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t.productOriginalPrice}</Label>
                    <Input
                      type="number"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(Number(e.target.value))}
                      min={0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Ustama turi</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {markupType === 'percent' ? 'Ustama (%)' : 'Ustama (so\'m)'}
                    </Label>
                    <Input
                      type="number"
                      value={markupValue}
                      onChange={(e) => setMarkupValue(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <span className="font-medium">Yakuniy narx:</span>
                  <span className="text-2xl font-bold text-primary">
                    {calculateFinalPrice().toLocaleString()} so'm
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportedData(null);
                  setUrl('');
                }}
              >
                {t.cancel}
              </Button>
              <Button onClick={handleSaveProduct} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t.loading}
                  </>
                ) : (
                  t.save
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
