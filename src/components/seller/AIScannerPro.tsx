import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Camera, Search, Sparkles, Loader2, X, ImageIcon, 
  Check, Package, DollarSign, Globe, ArrowRight,
  Calculator, Store, ExternalLink, Wand2, FileText, Image as ImageLucide, Zap
} from 'lucide-react';

interface WebProduct {
  title: string;
  price: string;
  image: string;
  source: string;
  url: string;
  description?: string;
}

interface AnalyzedProduct {
  name: string;
  description: string;
  category: string;
  suggestedPrice: number;
  features?: string[];
  brand?: string;
  specifications?: Record<string, string>;
  aiModel?: string;
  confidence?: number;
}

interface PricingCalculation {
  costPrice: number;
  marketplaceCommission: number;
  logisticsCost: number;
  taxRate: number;
  targetProfit: number;
  recommendedPrice: number;
  netProfit: number;
}

interface AIStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  model?: string;
  icon: React.ReactNode;
}

type Step = 'capture' | 'analyzing' | 'search' | 'select' | 'pricing' | 'creating' | 'done';

interface AIScannerProProps {
  shopId: string;
  onSuccess?: () => void;
}

export function AIScannerPro({ shopId, onSuccess }: AIScannerProProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzedProduct, setAnalyzedProduct] = useState<AnalyzedProduct | null>(null);
  const [webProducts, setWebProducts] = useState<WebProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WebProduct | null>(null);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [createdCardUrl, setCreatedCardUrl] = useState<string | null>(null);
  const [generateInfographics, setGenerateInfographics] = useState(true);
  const [infographicCount, setInfographicCount] = useState(6);
  const [creationProgress, setCreationProgress] = useState<AIStep[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Marketplace config (Yandex Market defaults)
  const [marketplaceConfig] = useState({
    commission: 8, // 8% default commission
    logistics: 15, // 15% logistics cost
    tax: 12, // 12% tax rate
    targetProfit: 20, // 20% target profit margin
  });

  const getStepNumber = () => {
    const steps: Step[] = ['capture', 'analyzing', 'search', 'select', 'pricing', 'creating', 'done'];
    return steps.indexOf(currentStep) + 1;
  };

  const getProgress = () => {
    return (getStepNumber() / 7) * 100;
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        analyzeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (imageBase64: string) => {
    setCurrentStep('analyzing');
    try {
      // Step 1: Analyze the product image
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-product-image', {
        body: { imageBase64 },
      });

      if (analysisError) throw analysisError;

      setAnalyzedProduct(analysisData);
      
      // Step 2: Search for similar products on the web
      setCurrentStep('search');
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-similar-products', {
        body: { 
          productName: analysisData.name,
          category: analysisData.category,
          description: analysisData.description
        },
      });

      if (searchError) {
        console.error('Search error:', searchError);
        // Continue with just the analyzed data
        setWebProducts([]);
      } else {
        setWebProducts(searchData?.products || []);
      }

      setCurrentStep('select');
      toast.success('Mahsulot tahlil qilindi va o\'xshash mahsulotlar topildi!');
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error('Tahlil xatosi: ' + (error.message || 'Noma\'lum xato'));
      setCurrentStep('capture');
    }
  };

  const handleProductSelect = (product: WebProduct | null) => {
    setSelectedProduct(product);
    setCurrentStep('pricing');
  };

  const useAnalyzedProduct = () => {
    if (analyzedProduct) {
      setSelectedProduct({
        title: analyzedProduct.name,
        description: analyzedProduct.description,
        price: analyzedProduct.suggestedPrice.toString(),
        image: capturedImage || '',
        source: 'AI Analysis',
        url: '',
      });
      setCurrentStep('pricing');
    }
  };

  const calculatePricing = () => {
    if (!costPrice || costPrice <= 0) {
      toast.error('Iltimos, tannarxni kiriting');
      return;
    }

    const commission = costPrice * (marketplaceConfig.commission / 100);
    const logistics = costPrice * (marketplaceConfig.logistics / 100);
    const tax = costPrice * (marketplaceConfig.tax / 100);
    const targetProfitAmount = costPrice * (marketplaceConfig.targetProfit / 100);
    
    const totalCosts = costPrice + commission + logistics + tax;
    const recommendedPrice = totalCosts + targetProfitAmount;
    const netProfit = recommendedPrice - totalCosts;

    setPricing({
      costPrice,
      marketplaceCommission: commission,
      logisticsCost: logistics,
      taxRate: tax,
      targetProfit: targetProfitAmount,
      recommendedPrice: Math.ceil(recommendedPrice / 100) * 100, // Round up to nearest 100
      netProfit,
    });
  };

  // Base64 rasmni Supabase Storage'ga yuklash
  const uploadImageToStorage = async (base64Image: string): Promise<string | null> => {
    try {
      // Base64 dan Blob yaratish
      const base64Data = base64Image.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      // Unique fayl nomi
      const fileName = `scanner/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      // Supabase Storage'ga yuklash
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      // Public URL olish
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  };

  const createYandexCard = async () => {
    if (!pricing || !selectedProduct) {
      toast.error('Ma\'lumotlar to\'liq emas');
      return;
    }

    setIsCreatingCard(true);
    setCurrentStep('creating');
    
    // Initialize AI steps for progress tracking
    const steps: AIStep[] = [
      { name: 'Rasm tahlili', status: 'pending', model: 'GPT-4o Vision', icon: <Camera className="h-4 w-4" /> },
      { name: 'SEO kontent', status: 'pending', model: 'Claude Haiku', icon: <Search className="h-4 w-4" /> },
      { name: 'Tavsif yaratish', status: 'pending', model: 'Claude Sonnet', icon: <FileText className="h-4 w-4" /> },
      { name: 'Infografikalar', status: 'pending', model: 'Flux Pro', icon: <ImageLucide className="h-4 w-4" /> },
      { name: 'Kartochka yaratish', status: 'pending', model: 'Yandex API', icon: <Store className="h-4 w-4" /> },
    ];
    setCreationProgress(steps);

    try {
      // Use the comprehensive card creation pipeline
      const updateStep = (index: number, status: AIStep['status']) => {
        setCreationProgress(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
      };

      // Step 1: Start - rasm tahlili already done
      updateStep(0, 'completed');

      // Rasmni Storage'ga yuklash
      let imageUrl: string | undefined;
      const imagesToUpload: string[] = [];

      if (capturedImage && capturedImage.startsWith('data:')) {
        toast.info('Rasm yuklanmoqda...');
        const uploadedUrl = await uploadImageToStorage(capturedImage);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
          imagesToUpload.push(uploadedUrl);
        }
      } else if (capturedImage && capturedImage.startsWith('http')) {
        imageUrl = capturedImage;
        imagesToUpload.push(capturedImage);
      }

      if (selectedProduct.image && selectedProduct.image.startsWith('http')) {
        imagesToUpload.push(selectedProduct.image);
      }

      if (imagesToUpload.length === 0) {
        toast.error('Kamida bitta rasm kerak. Iltimos, rasmni qayta yuklang.');
        setCurrentStep('pricing');
        setIsCreatingCard(false);
        return;
      }

      // Step 2: SEO content generation
      updateStep(1, 'running');
      let seoContent = null;
      try {
        const { data: seoData, error: seoError } = await supabase.functions.invoke('generate-product-content', {
          body: {
            productName: selectedProduct.title,
            productDescription: selectedProduct.description || analyzedProduct?.description,
            category: analyzedProduct?.category,
            brand: analyzedProduct?.brand,
            specifications: analyzedProduct?.specifications,
            targetMarketplace: 'yandex',
            contentType: 'seo',
            languages: ['uz', 'ru']
          },
        });
        if (!seoError && seoData) {
          seoContent = seoData;
          updateStep(1, 'completed');
        } else {
          updateStep(1, 'failed');
        }
      } catch {
        updateStep(1, 'failed');
      }

      // Step 3: Description generation
      updateStep(2, 'running');
      let descriptions = null;
      try {
        const { data: descData, error: descError } = await supabase.functions.invoke('generate-product-content', {
          body: {
            productName: selectedProduct.title,
            productDescription: selectedProduct.description || analyzedProduct?.description,
            category: analyzedProduct?.category,
            brand: analyzedProduct?.brand,
            specifications: analyzedProduct?.specifications,
            targetMarketplace: 'yandex',
            contentType: 'description',
            languages: ['uz', 'ru']
          },
        });
        if (!descError && descData) {
          descriptions = descData;
          updateStep(2, 'completed');
        } else {
          updateStep(2, 'failed');
        }
      } catch {
        updateStep(2, 'failed');
      }

      // Step 4: Infographic generation (if enabled)
      if (generateInfographics && capturedImage) {
        updateStep(3, 'running');
        const styles = ['professional', 'minimalist', 'vibrant', 'luxury', 'tech', 'professional'];
        const generatedInfos: string[] = [];

        for (let i = 0; i < Math.min(infographicCount, 6); i++) {
          try {
            const { data: infoData, error: infoError } = await supabase.functions.invoke('generate-infographic', {
              body: {
                productImage: capturedImage,
                productName: selectedProduct.title,
                category: analyzedProduct?.category,
                style: styles[i % styles.length],
                count: 1
              },
            });

            if (!infoError && infoData?.images?.length > 0) {
              generatedInfos.push(infoData.images[0].url);
            }
          } catch (e) {
            console.error(`Infographic ${i + 1} failed:`, e);
          }
        }

        if (generatedInfos.length > 0) {
          setGeneratedImages(generatedInfos);
          imagesToUpload.push(...generatedInfos);
          updateStep(3, 'completed');
        } else {
          updateStep(3, 'failed');
        }
      } else {
        updateStep(3, 'completed'); // Skip
      }

      // Step 5: Create Yandex card
      updateStep(4, 'running');
      
      const { data, error } = await supabase.functions.invoke('yandex-market-create-card', {
        body: {
          shopId,
          product: {
            name: selectedProduct.title,
            nameRu: seoContent?.seoTitle?.ru || selectedProduct.title,
            description: descriptions?.fullDescription?.uz || selectedProduct.description || analyzedProduct?.description,
            descriptionRu: descriptions?.fullDescription?.ru || selectedProduct.description,
            category: analyzedProduct?.category,
            price: pricing.recommendedPrice,
            costPrice: pricing.costPrice,
            image: imageUrl,
            images: imagesToUpload,
            sourceUrl: selectedProduct.url,
            keywords: seoContent?.keywords,
            bulletPoints: seoContent?.bulletPoints || descriptions?.sellingPoints,
          },
          pricing: pricing,
        },
      });

      if (error) throw error;

      updateStep(4, 'completed');
      setCreatedCardUrl(data?.cardUrl || null);
      setCurrentStep('done');
      toast.success('Yandex Market kartochkasi yaratildi!');
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Card creation error:', error);
      toast.error('Kartochka yaratishda xato: ' + (error.message || 'Noma\'lum xato'));
      setCurrentStep('pricing');
    } finally {
      setIsCreatingCard(false);
    }
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setAnalyzedProduct(null);
    setWebProducts([]);
    setSelectedProduct(null);
    setCostPrice(0);
    setPricing(null);
    setCreatedCardUrl(null);
    setCreationProgress([]);
    setGeneratedImages([]);
    setCurrentStep('capture');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Scanner Pro
              </CardTitle>
              <CardDescription>
                Rasmdan mahsulot kartochkasini Yandex Market'ga yuklash
              </CardDescription>
            </div>
            <Badge variant="outline">
              {getStepNumber()} / 7 qadam
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={getProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Rasm olish</span>
            <span>Tahlil</span>
            <span>Qidiruv</span>
            <span>Tanlash</span>
            <span>Narx</span>
            <span>Yaratish</span>
            <span>Tayyor</span>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Image Capture */}
      {currentStep === 'capture' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              1-qadam: Mahsulot rasmini oling
            </CardTitle>
            <CardDescription>
              Telefon kamerasi orqali mahsulotni rasmga oling yoki rasm yuklang
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Rasm yuklash uchun bosing</p>
              <p className="text-sm text-muted-foreground mt-1">
                yoki kamera orqali rasmga oling
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Analyzing */}
      {currentStep === 'analyzing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium">Mahsulot tahlil qilinmoqda...</p>
            <p className="text-sm text-muted-foreground">AI rasm orqali mahsulotni aniqlayapti</p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Searching */}
      {currentStep === 'search' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 animate-pulse mx-auto text-primary mb-4" />
            <p className="text-lg font-medium">O'xshash mahsulotlar qidirilmoqda...</p>
            <p className="text-sm text-muted-foreground">Internetda shu mahsulotga o'xshashlar topilmoqda</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Select Product */}
      {currentStep === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              4-qadam: Mahsulotni tanlang
            </CardTitle>
            <CardDescription>
              O'xshash mahsulotlardan birini tanlang yoki AI tahlilidan foydalaning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Captured Image Preview */}
            {capturedImage && (
              <div className="flex gap-4 items-start">
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-24 h-24 object-cover rounded-lg border"
                />
                <div className="flex-1">
                  <h4 className="font-medium">{analyzedProduct?.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {analyzedProduct?.description}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {analyzedProduct?.category}
                  </Badge>
                </div>
                <Button variant="outline" onClick={useAnalyzedProduct}>
                  AI tahlilidan foydalanish
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Web Search Results */}
            {webProducts.length > 0 ? (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Internetdan topilgan o'xshash mahsulotlar:
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {webProducts.map((product, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = '<svg class="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                              }}
                            />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium line-clamp-1">{product.title}</h5>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {product.source}
                            </Badge>
                            {product.price && (
                              <span className="text-sm font-medium text-primary">
                                {product.price}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>O'xshash mahsulotlar topilmadi</p>
                <Button className="mt-4" onClick={useAnalyzedProduct}>
                  AI tahlilidan foydalanish
                </Button>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetScanner}>
                <X className="mr-2 h-4 w-4" />
                Bekor qilish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Pricing */}
      {currentStep === 'pricing' && selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              5-qadam: Narx hisoblash
            </CardTitle>
            <CardDescription>
              Tannarxni kiriting - AI raqobatbardosh narxni hisoblab beradi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selected Product Preview */}
            <div className="flex gap-4 p-4 bg-muted rounded-lg">
              {capturedImage && (
                <img 
                  src={capturedImage} 
                  alt="Product" 
                  className="w-20 h-20 object-cover rounded"
                />
              )}
              <div>
                <h4 className="font-medium">{selectedProduct.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {selectedProduct.description}
                </p>
              </div>
            </div>

            {/* Cost Price Input */}
            <div className="space-y-2">
              <Label htmlFor="costPrice" className="text-base font-medium">
                Tannarx (so'm)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="costPrice"
                  type="number"
                  placeholder="Masalan: 50000"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="text-lg"
                />
                <Button onClick={calculatePricing} disabled={!costPrice}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Hisoblash
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mahsulotni sotib olish narxini kiriting (supplier narxi)
              </p>
            </div>

            {/* Pricing Breakdown */}
            {pricing && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Narx tuzilmasi (Yandex Market):
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tannarx:</span>
                    <span>{formatPrice(pricing.costPrice)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Marketplace komissiyasi ({marketplaceConfig.commission}%):</span>
                    <span>{formatPrice(pricing.marketplaceCommission)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Logistika ({marketplaceConfig.logistics}%):</span>
                    <span>{formatPrice(pricing.logisticsCost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Soliq ({marketplaceConfig.tax}%):</span>
                    <span>{formatPrice(pricing.taxRate)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Maqsadli foyda ({marketplaceConfig.targetProfit}%):</span>
                    <span>{formatPrice(pricing.targetProfit)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Tavsiya etilgan narx:</span>
                    <span className="text-primary">{formatPrice(pricing.recommendedPrice)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Sof foyda:</span>
                    <span>{formatPrice(pricing.netProfit)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Infographic Options */}
            {pricing && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">AI Infografikalar</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generateInfographics}
                      onChange={(e) => setGenerateInfographics(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Yaratish</span>
                  </label>
                </div>
                {generateInfographics && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Soni:</span>
                    <select
                      value={infographicCount}
                      onChange={(e) => setInfographicCount(Number(e.target.value))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value={1}>1 ta</option>
                      <option value={3}>3 ta</option>
                      <option value={6}>6 ta (tavsiya)</option>
                    </select>
                    <Badge variant="secondary" className="text-xs">Flux Pro</Badge>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Professional marketplace infografikalari Flux Pro AI orqali yaratiladi
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('select')}>
                Orqaga
              </Button>
              <Button 
                onClick={createYandexCard} 
                disabled={!pricing || isCreatingCard}
              >
                {isCreatingCard ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Yaratilmoqda...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    AI bilan yaratish
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Creating with AI Progress */}
      {currentStep === 'creating' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              AI kartochka yaratmoqda
            </CardTitle>
            <CardDescription>
              5 ta AI model bir vaqtda ishlayapti
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {creationProgress.map((step, index) => (
              <div 
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  step.status === 'running' ? 'border-primary bg-primary/5' :
                  step.status === 'completed' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                  step.status === 'failed' ? 'border-destructive bg-destructive/5' :
                  'border-muted'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  step.status === 'running' ? 'bg-primary text-primary-foreground' :
                  step.status === 'completed' ? 'bg-green-500 text-white' :
                  step.status === 'failed' ? 'bg-destructive text-destructive-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {step.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step.status === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : step.status === 'failed' ? (
                    <X className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{step.name}</p>
                  <p className="text-xs text-muted-foreground">{step.model}</p>
                </div>
                <Badge variant={
                  step.status === 'completed' ? 'default' :
                  step.status === 'running' ? 'secondary' :
                  step.status === 'failed' ? 'destructive' : 'outline'
                }>
                  {step.status === 'running' ? 'Ishlanmoqda...' :
                   step.status === 'completed' ? 'Tayyor' :
                   step.status === 'failed' ? 'Xato' : 'Kutmoqda'}
                </Badge>
              </div>
            ))}
            
            {/* Generated infographics preview */}
            {generatedImages.length > 0 && (
              <div className="pt-4">
                <p className="text-sm font-medium mb-2">Yaratilgan infografikalar:</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {generatedImages.map((img, i) => (
                    <img 
                      key={i}
                      src={img} 
                      alt={`Infographic ${i + 1}`}
                      className="w-16 h-16 object-cover rounded border flex-shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 7: Done */}
      {currentStep === 'done' && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-medium text-green-600 dark:text-green-400">Kartochka muvaffaqiyatli yaratildi!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Mahsulot Yandex Market'ga yuklandi va ko'rib chiqilmoqda
            </p>
            
            {/* AI models used summary */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="outline">GPT-4o Vision</Badge>
              <Badge variant="outline">Claude Sonnet</Badge>
              <Badge variant="outline">Flux Pro</Badge>
            </div>
            
            {/* Generated images preview */}
            {generatedImages.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">AI infografikalar ({generatedImages.length} ta):</p>
                <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                  {generatedImages.map((img, i) => (
                    <img 
                      key={i}
                      src={img} 
                      alt={`Infographic ${i + 1}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}
            
            {createdCardUrl && (
              <Button variant="outline" className="mt-4" asChild>
                <a href={createdCardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Kartochkani ko'rish
                </a>
              </Button>
            )}

            <div className="flex gap-2 justify-center mt-6">
              <Button onClick={resetScanner}>
                <Camera className="mr-2 h-4 w-4" />
                Yangi mahsulot qo'shish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
