import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Camera, Search, Sparkles, Loader2, X, ImageIcon, 
  Check, Package, DollarSign, Globe, ArrowRight,
  Calculator, Store, Wand2, FileText, Image as ImageLucide, Zap, 
  Clock, CheckCircle, AlertCircle
} from 'lucide-react';

// Safe image component with fallback - no innerHTML
function ProductImageWithFallback({ src, alt }: { src?: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (!src || hasError) {
    return (
      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
      <img 
        src={src} 
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

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

interface BackgroundTask {
  id: string;
  productName: string;
  status: 'processing' | 'completed' | 'failed';
  progress: AIStep[];
  generatedImages: string[];
  startedAt: Date;
  completedAt?: Date;
}

type Step = 'capture' | 'analyzing' | 'search' | 'select' | 'pricing';

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
  const [generateInfographics, setGenerateInfographics] = useState(true);
  const [infographicCount, setInfographicCount] = useState(6);
  
  // Background processing state
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false);

  // Marketplace config (Yandex Market defaults)
  const [marketplaceConfig] = useState({
    commission: 8,
    logistics: 15,
    tax: 12,
    targetProfit: 20,
  });

  const getStepNumber = () => {
    const steps: Step[] = ['capture', 'analyzing', 'search', 'select', 'pricing'];
    return steps.indexOf(currentStep) + 1;
  };

  const getProgress = () => {
    return (getStepNumber() / 5) * 100;
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
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-product-image', {
        body: { imageBase64 },
      });

      if (analysisError) throw analysisError;

      setAnalyzedProduct(analysisData);
      
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
        setWebProducts([]);
      } else {
        setWebProducts(searchData?.products || []);
      }

      setCurrentStep('select');
      toast.success('Mahsulot tahlil qilindi!');
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
      recommendedPrice: Math.ceil(recommendedPrice / 100) * 100,
      netProfit,
    });
  };

  const uploadImageToStorage = async (base64Image: string): Promise<string | null> => {
    try {
      const base64Data = base64Image.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `scanner/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

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
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  };

  // Background card creation process
  const processCardInBackground = useCallback(async (
    taskId: string,
    product: WebProduct,
    productImage: string | null,
    analyzed: AnalyzedProduct | null,
    pricingData: PricingCalculation,
    shouldGenerateInfographics: boolean,
    infoCount: number
  ) => {
    const updateTaskProgress = (stepIndex: number, status: AIStep['status']) => {
      setBackgroundTasks(prev => prev.map(task => {
        if (task.id !== taskId) return task;
        const newProgress = [...task.progress];
        newProgress[stepIndex] = { ...newProgress[stepIndex], status };
        return { ...task, progress: newProgress };
      }));
    };

    const updateTaskStatus = (status: BackgroundTask['status'], images?: string[]) => {
      setBackgroundTasks(prev => prev.map(task => {
        if (task.id !== taskId) return task;
        return { 
          ...task, 
          status,
          generatedImages: images || task.generatedImages,
          completedAt: status !== 'processing' ? new Date() : undefined
        };
      }));
    };

    try {
      // Step 1: Already done - mark complete
      updateTaskProgress(0, 'completed');

      // Upload image
      let imageUrl: string | undefined;
      const imagesToUpload: string[] = [];

      if (productImage && productImage.startsWith('data:')) {
        const uploadedUrl = await uploadImageToStorage(productImage);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
          imagesToUpload.push(uploadedUrl);
        }
      } else if (productImage && productImage.startsWith('http')) {
        imageUrl = productImage;
        imagesToUpload.push(productImage);
      }

      if (product.image && product.image.startsWith('http')) {
        imagesToUpload.push(product.image);
      }

      // Step 2: SEO content
      updateTaskProgress(1, 'running');
      let seoContent = null;
      try {
        const { data: seoData, error: seoError } = await supabase.functions.invoke('generate-product-content', {
          body: {
            productName: product.title,
            productDescription: product.description || analyzed?.description,
            category: analyzed?.category,
            brand: analyzed?.brand,
            specifications: analyzed?.specifications,
            targetMarketplace: 'yandex',
            contentType: 'seo',
            languages: ['uz', 'ru']
          },
        });
        if (!seoError && seoData) {
          seoContent = seoData;
          updateTaskProgress(1, 'completed');
        } else {
          updateTaskProgress(1, 'failed');
        }
      } catch {
        updateTaskProgress(1, 'failed');
      }

      // Step 3: Description generation
      updateTaskProgress(2, 'running');
      let descriptions = null;
      try {
        const { data: descData, error: descError } = await supabase.functions.invoke('generate-product-content', {
          body: {
            productName: product.title,
            productDescription: product.description || analyzed?.description,
            category: analyzed?.category,
            brand: analyzed?.brand,
            specifications: analyzed?.specifications,
            targetMarketplace: 'yandex',
            contentType: 'description',
            languages: ['uz', 'ru']
          },
        });
        if (!descError && descData) {
          descriptions = descData;
          updateTaskProgress(2, 'completed');
        } else {
          updateTaskProgress(2, 'failed');
        }
      } catch {
        updateTaskProgress(2, 'failed');
      }

      // Step 4: Infographic generation
      const generatedInfos: string[] = [];
      if (shouldGenerateInfographics && productImage) {
        updateTaskProgress(3, 'running');
        const styles = ['professional', 'minimalist', 'vibrant', 'luxury', 'tech', 'professional'];

        for (let i = 0; i < Math.min(infoCount, 6); i++) {
          try {
            const { data: infoData, error: infoError } = await supabase.functions.invoke('generate-infographic', {
              body: {
                productImage: productImage,
                productName: product.title,
                category: analyzed?.category,
                style: styles[i % styles.length],
                count: 1
              },
            });

            if (!infoError && infoData?.images?.length > 0) {
              generatedInfos.push(infoData.images[0].url);
              // Update task with new images as they come in
              setBackgroundTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, generatedImages: [...generatedInfos] } : task
              ));
            }
          } catch (e) {
            console.error(`Infographic ${i + 1} failed:`, e);
          }
        }

        if (generatedInfos.length > 0) {
          imagesToUpload.push(...generatedInfos);
          updateTaskProgress(3, 'completed');
        } else {
          updateTaskProgress(3, 'failed');
        }
      } else {
        updateTaskProgress(3, 'completed');
      }

      // Step 5: Create Yandex card
      updateTaskProgress(4, 'running');
      
      const { error } = await supabase.functions.invoke('yandex-market-create-card', {
        body: {
          shopId,
          product: {
            name: product.title,
            nameRu: seoContent?.seoTitle?.ru || product.title,
            description: descriptions?.fullDescription?.uz || product.description || analyzed?.description,
            descriptionRu: descriptions?.fullDescription?.ru || product.description,
            category: analyzed?.category,
            price: pricingData.recommendedPrice,
            costPrice: pricingData.costPrice,
            image: imageUrl,
            images: imagesToUpload,
            sourceUrl: product.url,
            keywords: seoContent?.keywords,
            bulletPoints: seoContent?.bulletPoints || descriptions?.sellingPoints,
          },
          pricing: pricingData,
        },
      });

      if (error) throw error;

      updateTaskProgress(4, 'completed');
      updateTaskStatus('completed', generatedInfos);
      toast.success(`"${product.title}" kartochkasi tayyor!`);
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Background card creation error:', error);
      updateTaskStatus('failed');
      toast.error(`"${product.title}" yaratishda xato`);
    }
  }, [shopId, onSuccess]);

  const startBackgroundCardCreation = () => {
    if (!pricing || !selectedProduct || !capturedImage) {
      toast.error('Ma\'lumotlar to\'liq emas');
      return;
    }

    // Create new background task
    const taskId = `task-${Date.now()}`;
    const newTask: BackgroundTask = {
      id: taskId,
      productName: selectedProduct.title,
      status: 'processing',
      progress: [
        { name: 'Rasm tahlili', status: 'pending', model: 'GPT-4o Vision', icon: <Camera className="h-4 w-4" /> },
        { name: 'SEO kontent', status: 'pending', model: 'Claude Haiku', icon: <Search className="h-4 w-4" /> },
        { name: 'Tavsif yaratish', status: 'pending', model: 'Claude Sonnet', icon: <FileText className="h-4 w-4" /> },
        { name: 'Infografikalar', status: 'pending', model: 'Gemini Image', icon: <ImageLucide className="h-4 w-4" /> },
        { name: 'Kartochka yaratish', status: 'pending', model: 'Yandex API', icon: <Store className="h-4 w-4" /> },
      ],
      generatedImages: [],
      startedAt: new Date(),
    };

    setBackgroundTasks(prev => [newTask, ...prev]);
    setShowBackgroundPanel(true);

    // Start background processing
    processCardInBackground(
      taskId,
      selectedProduct,
      capturedImage,
      analyzedProduct,
      pricing,
      generateInfographics,
      infographicCount
    );

    // Reset scanner for next product
    toast.success('Kartochka fonda yaratilmoqda. Keyingi mahsulotni skanerlashingiz mumkin!');
    resetScanner();
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setAnalyzedProduct(null);
    setWebProducts([]);
    setSelectedProduct(null);
    setCostPrice(0);
    setPricing(null);
    setCurrentStep('capture');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const completedTasks = backgroundTasks.filter(t => t.status === 'completed').length;
  const processingTasks = backgroundTasks.filter(t => t.status === 'processing').length;

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
            <div className="flex items-center gap-2">
              {backgroundTasks.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowBackgroundPanel(!showBackgroundPanel)}
                  className="relative"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Fon ishlari
                  {processingTasks > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {processingTasks}
                    </Badge>
                  )}
                </Button>
              )}
              <Badge variant="outline">
                {getStepNumber()} / 5 qadam
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={getProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Rasm</span>
            <span>Tahlil</span>
            <span>Qidiruv</span>
            <span>Tanlash</span>
            <span>Narx</span>
          </div>
        </CardContent>
      </Card>

      {/* Background Tasks Panel */}
      {showBackgroundPanel && backgroundTasks.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Fonda ishlanayotgan kartochkalar
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                {processingTasks > 0 && (
                  <Badge variant="secondary">{processingTasks} ta ishlanmoqda</Badge>
                )}
                {completedTasks > 0 && (
                  <Badge variant="default">{completedTasks} ta tayyor</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {backgroundTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-3 rounded-lg border ${
                      task.status === 'completed' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                      task.status === 'failed' ? 'border-destructive bg-destructive/5' :
                      'border-primary/30 bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {task.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {task.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {task.status === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        <span className="font-medium text-sm line-clamp-1">{task.productName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.status === 'processing' ? 'Ishlanmoqda...' : 
                         task.status === 'completed' ? 'Tayyor' : 'Xato'}
                      </span>
                    </div>
                    
                    {/* Mini progress */}
                    <div className="flex items-center gap-1">
                      {task.progress.map((step, i) => (
                        <div 
                          key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                            step.status === 'completed' ? 'bg-emerald-500 dark:bg-emerald-400' :
                            step.status === 'running' ? 'bg-primary animate-pulse' :
                            step.status === 'failed' ? 'bg-destructive' :
                            'bg-muted'
                          }`}
                          title={step.name}
                        />
                      ))}
                    </div>

                    {/* Generated images preview */}
                    {task.generatedImages.length > 0 && (
                      <div className="flex gap-1 mt-2 overflow-x-auto">
                        {task.generatedImages.slice(0, 4).map((img, i) => (
                          <img 
                            key={i}
                            src={img} 
                            alt={`Img ${i + 1}`}
                            className="w-10 h-10 object-cover rounded border flex-shrink-0"
                          />
                        ))}
                        {task.generatedImages.length > 4 && (
                          <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-xs">
                            +{task.generatedImages.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Image Capture */}
      {currentStep === 'capture' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              1-qadam: Mahsulot rasmini oling
            </CardTitle>
            <CardDescription>
              Telefon kamerasi orqali mahsulotni rasmga oling yoki galereyadan tanlang
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Camera Button - Full width for mobile */}
            <Button
              size="lg"
              className="w-full h-32 text-lg flex flex-col gap-2"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = (e: any) => handleImageCapture(e);
                input.click();
              }}
            >
              <Camera className="h-12 w-12" />
              <span>📸 Kamera orqali rasmga olish</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">yoki</span>
              </div>
            </div>

            {/* Gallery Upload Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5 mr-2" />
              Galereyadan tanlash
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              className="hidden"
            />

            {/* Tips for mobile users */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">💡 Maslahat:</p>
              <ul className="space-y-1 text-xs">
                <li>• Mahsulotni yaxshi yoritilgan joyda rasmga oling</li>
                <li>• Rasm tiniq va aniq bo'lishi kerak</li>
                <li>• Faqat bitta mahsulotni rasmga oling</li>
              </ul>
            </div>
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
                        <ProductImageWithFallback 
                          src={product.image} 
                          alt={product.title} 
                        />
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
              Tannarxni kiriting - kartochka fonda yaratiladi, siz keyingi mahsulotga o'tasiz
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
                    <Badge variant="secondary" className="text-xs">Gemini Image</Badge>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Turli burchak va kompozitsiyalarda professional infografikalar (1080×1440)
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('select')}>
                Orqaga
              </Button>
              <Button 
                onClick={startBackgroundCardCreation} 
                disabled={!pricing}
              >
                <Zap className="mr-2 h-4 w-4" />
                Fonda yaratish & Keyingisiga
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
