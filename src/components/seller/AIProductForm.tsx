import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { 
  Search, Sparkles, Loader2, ImageIcon, Wand2, Check,
  Globe, Package, ArrowRight, RefreshCw, Zap
} from 'lucide-react';
import type { TablesInsert } from '@/integrations/supabase/types';

type ProductInsert = TablesInsert<'products'>;

interface AIProductFormProps {
  shopId: string;
  onSubmit: (data: ProductInsert) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface WebProduct {
  title: string;
  price: string;
  image: string;
  source: string;
  url: string;
  description?: string;
}

type ProcessingStep = 'idle' | 'searching' | 'generating' | 'uploading' | 'done';

// Safe image component with fallback
function ProductImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (!src || hasError) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <img 
      src={src} 
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export function AIProductForm({ shopId, onSubmit, onCancel, isLoading }: AIProductFormProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  
  // Found products from web
  const [webProducts, setWebProducts] = useState<WebProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WebProduct | null>(null);
  
  // Generated/selected images
  const [productImages, setProductImages] = useState<string[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<Partial<ProductInsert>>({
    name: '',
    description: '',
    price: 0,
    stock_quantity: 10,
    category_id: null,
    status: 'active',
  });

  const getProgress = () => {
    switch (processingStep) {
      case 'searching': return 33;
      case 'generating': return 66;
      case 'uploading': return 90;
      case 'done': return 100;
      default: return 0;
    }
  };

  const getStepText = () => {
    switch (processingStep) {
      case 'searching': return '🔍 Web\'dan o\'xshash mahsulotlar qidirilmoqda...';
      case 'generating': return '🎨 Flux Pro bilan professional rasm yaratilmoqda...';
      case 'uploading': return '📤 Rasmlar yuklanmoqda...';
      case 'done': return '✅ Tayyor!';
      default: return '';
    }
  };

  // Google Lens-like search - find products from web
  const searchProducts = async () => {
    if (!searchQuery.trim()) {
      toast.error('Iltimos, mahsulot nomini kiriting');
      return;
    }

    setProcessingStep('searching');
    setWebProducts([]);
    setSelectedProduct(null);
    setProductImages([]);

    try {
      // Search for similar products across marketplaces
      const { data, error } = await supabase.functions.invoke('search-similar-products', {
        body: { 
          productName: searchQuery.trim(),
          category: '',
          description: ''
        },
      });

      if (error) throw error;

      const products = data?.products || [];
      setWebProducts(products);

      if (products.length === 0) {
        toast.info('Mahsulot topilmadi. Rasm generatsiya qilinadi...');
        // Auto-generate image if no products found
        await generateProductImage(searchQuery);
      } else {
        toast.success(`${products.length} ta o'xshash mahsulot topildi!`);
        setProcessingStep('idle');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error('Qidiruv xatosi: ' + (error.message || 'Noma\'lum xato'));
      setProcessingStep('idle');
    }
  };

  // Select a product from search results
  const selectProduct = (product: WebProduct) => {
    setSelectedProduct(product);
    
    // Parse price from string
    const priceMatch = product.price.match(/[\d\s,]+/);
    const priceValue = priceMatch 
      ? parseInt(priceMatch[0].replace(/\s/g, '').replace(',', '')) 
      : 0;
    
    setFormData(prev => ({
      ...prev,
      name: product.title,
      description: product.description || '',
      price: priceValue,
    }));

    // If product has good image, use it
    if (product.image && product.image.startsWith('http')) {
      setProductImages([product.image]);
    }
    
    // Match category
    const matchedCategory = categories.find(
      cat => product.title.toLowerCase().includes(cat.name.toLowerCase()) ||
             cat.name.toLowerCase().includes(product.title.toLowerCase().split(' ')[0])
    );
    if (matchedCategory) {
      setFormData(prev => ({ ...prev, category_id: matchedCategory.id }));
    }
  };

  // Generate professional product image with Flux Pro
  const generateProductImage = useCallback(async (productName: string) => {
    setIsGeneratingImages(true);
    setProcessingStep('generating');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-image', {
        body: { 
          productName: productName || formData.name || searchQuery,
          category: categories.find(c => c.id === formData.category_id)?.name || '',
          style: 'marketplace'
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setProductImages(prev => [...prev, data.imageUrl]);
        toast.success('Professional rasm yaratildi!');
      } else if (data?.images && data.images.length > 0) {
        setProductImages(prev => [...prev, ...data.images]);
        toast.success(`${data.images.length} ta rasm yaratildi!`);
      }
      
      setProcessingStep('done');
    } catch (error: any) {
      console.error('Image generation error:', error);
      toast.error('Rasm yaratishda xatolik: ' + (error.message || 'Noma\'lum xato'));
      setProcessingStep('idle');
    } finally {
      setIsGeneratingImages(false);
    }
  }, [formData.name, formData.category_id, categories, searchQuery]);

  // Use AI-analyzed product data
  const useAsProduct = () => {
    if (!selectedProduct && !searchQuery) return;
    
    const name = selectedProduct?.title || searchQuery;
    setFormData(prev => ({
      ...prev,
      name: name,
      description: selectedProduct?.description || `${name} - sifatli va ishonchli mahsulot`,
    }));
    
    setProcessingStep('done');
  };

  // Upload image to storage
  const uploadImageToStorage = async (imageUrl: string): Promise<string | null> => {
    try {
      // If already a public URL from our storage, return as is
      if (imageUrl.includes('supabase') && imageUrl.includes('product-images')) {
        return imageUrl;
      }
      
      // For external URLs, we'll use them directly (most marketplaces allow this)
      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }
      
      // For base64 images, upload to storage
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        const fileName = `${shopId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { error } = await supabase.storage
          .from('product-images')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) {
          console.error('Storage upload error:', error);
          return null;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        return publicUrl;
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }
    
    setProcessingStep('uploading');
    
    // Upload all images
    const uploadedImages: string[] = [];
    for (const img of productImages) {
      const url = await uploadImageToStorage(img);
      if (url) uploadedImages.push(url);
    }

    await onSubmit({
      shop_id: shopId,
      name: formData.name || '',
      description: formData.description,
      price: formData.price || 0,
      stock_quantity: formData.stock_quantity || 0,
      category_id: formData.category_id,
      status: 'active',
      source: 'ai',
      images: uploadedImages,
    });
    
    setProcessingStep('idle');
  };

  const isProcessing = processingStep !== 'idle' && processingStep !== 'done';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Search Input - Google Lens Style */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Mahsulotni qidiring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Mahsulot nomini kiriting... (masalan: iPhone 15 Pro)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchProducts())}
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={searchProducts}
              disabled={isProcessing || !searchQuery.trim()}
            >
              {processingStep === 'searching' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            🔍 Google Lens kabi - mahsulot nomini yozing, AI web'dan o'xshash mahsulotlarni topadi
          </p>
        </CardContent>
      </Card>

      {/* Progress indicator */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={getProgress()} className="h-2" />
          <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {getStepText()}
          </p>
        </div>
      )}

      {/* Search Results */}
      {webProducts.length > 0 && !selectedProduct && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Web'dan topilgan mahsulotlar
              <Badge variant="secondary" className="ml-auto">{webProducts.length} ta</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {webProducts.map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => selectProduct(product)}
                  >
                    <ProductImage
                      src={product.image}
                      alt={product.title}
                      className="w-14 h-14 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{product.source}</Badge>
                        <span className="text-sm font-semibold text-primary">{product.price}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {/* Option to generate custom image */}
            <div className="mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => generateProductImage(searchQuery)}
                disabled={isGeneratingImages}
              >
                {isGeneratingImages ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Flux Pro bilan yangi rasm yaratish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Product / Form */}
      {(selectedProduct || processingStep === 'done') && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Mahsulot ma'lumotlari</span>
              {processingStep === 'done' && (
                <Check className="h-4 w-4 text-green-500 ml-auto" />
              )}
            </div>
            
            {/* Product Images */}
            {productImages.length > 0 && (
              <div className="mb-4">
                <Label className="mb-2 block">Rasmlar</Label>
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                      <ProductImage
                        src={img}
                        alt={`Product ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="w-20 h-20"
                    onClick={() => generateProductImage(formData.name || searchQuery)}
                    disabled={isGeneratingImages}
                  >
                    {isGeneratingImages ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Wand2 className="h-6 w-6" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {/* No images yet - generate button */}
            {productImages.length === 0 && (
              <div className="mb-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => generateProductImage(formData.name || searchQuery)}
                  disabled={isGeneratingImages}
                >
                  {isGeneratingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Flux Pro ishlamoqda...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Flux Pro bilan professional rasm yaratish
                    </>
                  )}
                </Button>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <Label>{t.productName}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mahsulot nomi"
                />
              </div>
              <div>
                <Label>{t.productDescription}</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Mahsulot tavsifi"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.productPrice} (so'm)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>{t.productStock}</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t.productCategory}</Label>
                <Select
                  value={formData.category_id || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.productCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick create without search */}
      {!selectedProduct && webProducts.length === 0 && processingStep === 'idle' && searchQuery && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={useAsProduct}
        >
          <Package className="h-4 w-4 mr-2" />
          "{searchQuery}" nomli mahsulot yaratish
        </Button>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={isLoading || !formData.name || isProcessing}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
