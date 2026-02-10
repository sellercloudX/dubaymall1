import { useState, useCallback, useRef } from 'react';
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
  Camera, Sparkles, Loader2, ImageIcon, Wand2, Check,
  Globe, Package, ArrowRight, RefreshCw, Zap, Upload, X
} from 'lucide-react';
import { backgroundTaskManager } from '@/lib/backgroundTaskManager';
import { InlineCamera } from './InlineCamera';
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

type ProcessingStep = 'idle' | 'analyzing' | 'searching' | 'generating' | 'uploading' | 'done';

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

// Upload image to Supabase Storage (handles base64, external URLs)
async function uploadImageToStorage(imageUrl: string, shopId: string): Promise<string | null> {
  try {
    // Already in our storage - skip
    if (imageUrl.includes('supabase') && imageUrl.includes('product-images')) {
      return imageUrl;
    }

    let blob: Blob;
    let contentType = 'image/jpeg';
    
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      const mimeMatch = imageUrl.match(/data:([^;]+);/);
      contentType = mimeMatch?.[1] || 'image/jpeg';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
    } else if (imageUrl.startsWith('http')) {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error('Failed to download image:', response.status);
          return null;
        }
        blob = await response.blob();
        contentType = blob.type || 'image/webp';
      } catch (fetchError) {
        console.error('Image download error:', fetchError);
        return null;
      }
    } else {
      return imageUrl;
    }

    const ext = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `${shopId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, blob, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to storage:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    return null;
  }
}

// Background image generation - runs after product is created, tracked via backgroundTaskManager
async function generateAndAttachImages(
  productId: string, 
  shopId: string, 
  productName: string, 
  category: string,
  existingImages: string[],
  sourceImageBase64?: string | null
) {
  const taskId = backgroundTaskManager.createTask(
    'ai-image-generation',
    `"${productName}" uchun kartochka yaratilmoqda`,
    { productId, productName },
  );

  try {
    await backgroundTaskManager.runTask(taskId, async (updateProgress) => {
      updateProgress(10, `"${productName}" uchun kartochka yaratilmoqda`);
      backgroundTaskManager.updateTask(taskId, { currentItem: 'Mavjud rasmlar yuklanmoqda...' });

      // Upload existing external images to storage
      const uploadedExisting: string[] = [];
      for (const img of existingImages) {
        const url = await uploadImageToStorage(img, shopId);
        if (url) uploadedExisting.push(url);
      }

      if (uploadedExisting.length > 0) {
        await supabase
          .from('products')
          .update({ images: uploadedExisting })
          .eq('id', productId);
      }

      updateProgress(30, `"${productName}" uchun kartochka yaratilmoqda`);
      backgroundTaskManager.updateTask(taskId, { currentItem: 'AI bilan professional rasm yaratilmoqda...' });

      // Generate new image - pass source image if available for accurate generation
      const { data, error } = await supabase.functions.invoke('generate-product-image', {
        body: { 
          productName, 
          category, 
          style: 'marketplace',
          sourceImage: sourceImageBase64 || null
        },
      });

      if (error) {
        console.error('Background image generation error:', error);
        throw new Error('Rasm yaratib bo\'lmadi');
      }

      updateProgress(70, `"${productName}" uchun kartochka yaratilmoqda`);
      backgroundTaskManager.updateTask(taskId, { currentItem: 'Rasm saqlanmoqda...' });

      if (data?.imageUrl) {
        const storedUrl = await uploadImageToStorage(data.imageUrl, shopId);
        
        if (storedUrl) {
          const allImages = [storedUrl, ...uploadedExisting];
          await supabase
            .from('products')
            .update({ images: allImages })
            .eq('id', productId);
          
          console.log('✅ Background: Product images updated!', allImages.length);
        }
      }

      updateProgress(100, `"${productName}" uchun kartochka yaratilmoqda`);
    });
  } catch (err) {
    console.error('Background image task error:', err);
  }
}

export function AIProductForm({ shopId, onSubmit, onCancel, isLoading }: AIProductFormProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  
  // Camera/Gallery input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  
  // Processing state
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [analysisResult, setAnalysisResult] = useState<{
    productName: string;
    category: string;
    description: string;
    suggestedPrice: number;
  } | null>(null);
  
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
      case 'analyzing': return 20;
      case 'searching': return 50;
      case 'generating': return 75;
      case 'uploading': return 90;
      case 'done': return 100;
      default: return 0;
    }
  };

  const getStepText = () => {
    switch (processingStep) {
      case 'analyzing': return '🔍 AI Vision mahsulotni taniyapti...';
      case 'searching': return '🌐 Web\'dan o\'xshash mahsulotlar qidirilmoqda...';
      case 'generating': return '🎨 Flux Pro bilan professional rasm yaratilmoqda...';
      case 'uploading': return '📤 Rasmlar yuklanmoqda...';
      case 'done': return '✅ Tayyor!';
      default: return '';
    }
  };

  // Compress image to reduce memory pressure on mobile (prevents browser from killing tab)
  const compressImage = (file: File, maxSize = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
          } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG at 80% quality (~200-400KB instead of 5-10MB)
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        canvas.width = 0; canvas.height = 0; // Free memory
        resolve(compressed);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  };

  // Handle image capture from camera or gallery
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress immediately to prevent mobile browser from running out of memory
      const compressed = await compressImage(file);
      setCapturedImage(compressed);
      await analyzeProductImage(compressed);
    } catch (err) {
      console.error('Image capture error:', err);
      toast.error('Rasmni yuklashda xatolik');
      setProcessingStep('idle');
    }
  };

  // AI Vision - Analyze image to identify product
  const analyzeProductImage = async (imageBase64: string) => {
    setProcessingStep('analyzing');
    setWebProducts([]);
    setSelectedProduct(null);
    setProductImages([]);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-product-image', {
        body: { imageBase64, mode: 'identify' },
      });

      if (error) throw error;

      if (data?.productName) {
        setAnalysisResult({
          productName: data.productName,
          category: data.category || '',
          description: data.description || '',
          suggestedPrice: data.suggestedPrice || 0
        });

        setFormData(prev => ({
          ...prev,
          name: data.productName,
          description: data.description || '',
          price: data.suggestedPrice || 0,
        }));

        if (data.category) {
          const matchedCategory = categories.find(
            cat => cat.name_uz?.toLowerCase().includes(data.category.toLowerCase()) ||
                   cat.name_ru?.toLowerCase().includes(data.category.toLowerCase()) ||
                   cat.name_en?.toLowerCase().includes(data.category.toLowerCase())
          );
          if (matchedCategory) {
            setFormData(prev => ({ ...prev, category_id: matchedCategory.id }));
          }
        }

        toast.success(`Mahsulot aniqlandi: ${data.productName}`);
        await searchSimilarProducts(data.productName, data.category, imageBase64);
      } else {
        toast.error('Mahsulotni aniqlab bo\'lmadi. Iltimos, aniqroq rasm oling.');
        setProcessingStep('idle');
      }
    } catch (error: any) {
      console.error('Vision analysis error:', error);
      toast.error('Tahlil xatosi: ' + (error.message || 'Noma\'lum xato'));
      setProcessingStep('idle');
    }
  };

  // Search for similar products across web
  const searchSimilarProducts = async (productName: string, category: string, imageBase64?: string) => {
    setProcessingStep('searching');

    try {
      const { data, error } = await supabase.functions.invoke('search-similar-products', {
        body: { productName, category, description: analysisResult?.description || '', imageBase64 },
      });

      if (error) throw error;

      const products = data?.products || [];
      setWebProducts(products);

      if (products.length > 0) {
        toast.success(`${products.length} ta o'xshash mahsulot topildi!`);
        
        const goodImages = products
          .filter((p: WebProduct) => p.image && p.image.startsWith('http'))
          .map((p: WebProduct) => p.image)
          .slice(0, 4);
        
        if (goodImages.length > 0) {
          setProductImages(goodImages);
        }
      } else {
        toast.info('Web\'da o\'xshash mahsulot topilmadi.');
      }
      
      setProcessingStep('done');
    } catch (error: any) {
      console.error('Search error:', error);
      setProcessingStep('done');
    }
  };

  // Select a product from search results
  const selectProduct = (product: WebProduct) => {
    setSelectedProduct(product);
    
    const priceMatch = product.price.match(/[\d\s,]+/);
    const priceValue = priceMatch 
      ? parseInt(priceMatch[0].replace(/\s/g, '').replace(',', '')) 
      : formData.price || 0;
    
    setFormData(prev => ({
      ...prev,
      name: product.title || prev.name,
      description: product.description || prev.description,
      price: priceValue,
    }));

    if (product.image && product.image.startsWith('http')) {
      setProductImages(prev => {
        if (!prev.includes(product.image)) {
          return [product.image, ...prev].slice(0, 5);
        }
        return prev;
      });
    }
  };

  // Generate professional product image with Flux Pro (preview only)
  const generateProductImage = useCallback(async (productName?: string) => {
    setIsGeneratingImages(true);
    setProcessingStep('generating');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-image', {
        body: { 
          productName: productName || formData.name || analysisResult?.productName,
          category: analysisResult?.category || categories.find(c => c.id === formData.category_id)?.name_uz || '',
          style: 'marketplace',
          sourceImage: capturedImage || null, // Kamera rasmini uzatish — AI aynan shu mahsulotni professional qiladi
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setProductImages(prev => [data.imageUrl, ...prev].slice(0, 5));
        toast.success('Professional rasm yaratildi!');
      }
      
      setProcessingStep('done');
    } catch (error: any) {
      console.error('Image generation error:', error);
      toast.error('Rasm yaratishda xatolik');
      setProcessingStep('done');
    } finally {
      setIsGeneratingImages(false);
    }
  }, [formData.name, formData.category_id, categories, analysisResult, capturedImage]);

  // Clear captured image and reset
  const clearCapture = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setWebProducts([]);
    setSelectedProduct(null);
    setProductImages([]);
    setProcessingStep('idle');
    setFormData({
      name: '',
      description: '',
      price: 0,
      stock_quantity: 10,
      category_id: null,
      status: 'active',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard against duplicate submissions
    if (isSubmitting || isLoading) return;
    
    if (!formData.name) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Immediately upload any already-available images (base64 camera capture)
      const quickImages: string[] = [];
      if (capturedImage) {
        const url = await uploadImageToStorage(capturedImage, shopId);
        if (url) quickImages.push(url);
      }

      // Create product right away with camera image (or empty images)
      const productData: ProductInsert = {
        shop_id: shopId,
        name: formData.name || '',
        description: formData.description,
        price: formData.price || 0,
        stock_quantity: formData.stock_quantity || 0,
        category_id: formData.category_id,
        status: 'active',
        source: 'ai' as const,
        images: quickImages,
      };

      await onSubmit(productData);

      // Get the created product ID to attach images later
      const { data: createdProducts } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', shopId)
        .eq('name', formData.name || '')
        .order('created_at', { ascending: false })
        .limit(1);

      const productId = createdProducts?.[0]?.id;

      if (productId) {
        const categoryName = analysisResult?.category || 
          categories.find(c => c.id === formData.category_id)?.name_uz || '';
        
        generateAndAttachImages(
          productId,
          shopId,
          formData.name || '',
          categoryName,
          productImages.filter(img => img !== capturedImage),
          capturedImage
        );
      }
      
      setProcessingStep('idle');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Mahsulot qo\'shishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = processingStep !== 'idle' && processingStep !== 'done';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Camera Input - Google Lens Style */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Google Lens - Rasmdan tanish
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!capturedImage ? (
            <>
              {showInlineCamera ? (
                <InlineCamera
                  onCapture={async (base64) => {
                    setShowInlineCamera(false);
                    setCapturedImage(base64);
                    await analyzeProductImage(base64);
                  }}
                  onClose={() => setShowInlineCamera(false)}
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-32 flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                      onClick={() => setShowInlineCamera(true)}
                    >
                      <Camera className="h-8 w-8 text-primary" />
                      <span className="font-medium">Kamera</span>
                      <span className="text-xs text-muted-foreground">Rasmga oling</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="h-32 flex-col gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <Upload className="h-8 w-8 text-primary" />
                      <span className="font-medium">Galereya</span>
                      <span className="text-xs text-muted-foreground">Rasmni tanlang</span>
                    </Button>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                  
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      📸 Mahsulotni rasmga oling yoki galereyadan tanlang
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI mahsulotni <strong>ko'rinishidan</strong> tanib oladi va web'dan topadi
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="relative">
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearCapture}
              >
                <X className="h-4 w-4" />
              </Button>
              
              {analysisResult && (
                <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur p-2 rounded-lg">
                  <p className="font-medium text-sm truncate">{analysisResult.productName}</p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {analysisResult.category || 'Kategoriya aniqlanmoqda...'}
                  </Badge>
                </div>
              )}
            </div>
          )}
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

      {/* Search Results from Web */}
      {webProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Web'dan topilgan o'xshash mahsulotlar
              <Badge variant="secondary" className="ml-auto">{webProducts.length} ta</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {webProducts.map((product, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedProduct === product 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-accent/50'
                    }`}
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
                    {selectedProduct === product && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Product Form - After Analysis */}
      {(analysisResult || processingStep === 'done') && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Mahsulot ma'lumotlari</span>
              {processingStep === 'done' && (
                <Check className="h-4 w-4 text-green-500 ml-auto" />
              )}
            </div>
            
            {/* Product Images Preview */}
            {productImages.length > 0 && (
              <div className="mb-4">
                <Label className="mb-2 block">Rasmlar ({productImages.length})</Label>
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-primary/20">
                      <ProductImage
                        src={img}
                        alt={`Product ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <Badge className="absolute bottom-0 left-0 right-0 rounded-none text-xs justify-center">
                          Asosiy
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Professional rasm mahsulot saqlanganidan keyin fonda yaratiladi
                </p>
              </div>
            )}
            
            {/* No images info */}
            {productImages.length === 0 && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Mahsulot saqlanganida Flux Pro bilan professional rasm fonda yaratiladi
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <Label>{t.productName}</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mahsulot nomi"
                />
              </div>
              
              <div>
                <Label>Tavsif</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mahsulot tavsifi"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Narx (so'm)</Label>
                  <Input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Miqdor</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: Number(e.target.value) }))}
                    placeholder="10"
                  />
                </div>
              </div>
              
              <div>
                <Label>Kategoriya</Label>
                <Select
                  value={formData.category_id || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategoriyani tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name_uz || cat.name_ru || cat.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Bekor qilish
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading || isSubmitting || isProcessing || !formData.name}
        >
          {(isLoading || isSubmitting) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Package className="h-4 w-4 mr-2" />
          )}
          {isSubmitting ? 'Saqlanmoqda...' : 'Mahsulotni qo\'shish'}
        </Button>
      </div>
    </form>
  );
}
