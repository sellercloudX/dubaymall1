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
  Calculator, Store, Wand2, FileText, Image as ImageLucide, Zap, Hash,
  Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { InlineCamera } from './InlineCamera';

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
   sellingPrice: number;
   marketplaceCommission: number;
   marketplaceCommissionPercent: number;
   logisticsCost: number;
   logisticsType: string;
   taxAmount: number;
   taxPercent: number;
   netProfit: number;
   netProfitPercent: number;
   categoryType: string;
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

type Step = 'capture' | 'analyzing' | 'pricing';

interface AIScannerProProps {
  shopId: string;
  onSuccess?: () => void;
}

export function AIScannerPro({ shopId, onSuccess }: AIScannerProProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>('capture');
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzedProduct, setAnalyzedProduct] = useState<AnalyzedProduct | null>(null);
  const [webProducts, setWebProducts] = useState<WebProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WebProduct | null>(null);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [targetMargin, setTargetMargin] = useState<number>(20);
  const [commissionPercent, setCommissionPercent] = useState<number>(20);
  const [logisticsCost, setLogisticsCost] = useState<number>(4000);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isRealTariff, setIsRealTariff] = useState(false);
  const [generateInfographics, setGenerateInfographics] = useState(true);
  const [infographicCount, setInfographicCount] = useState(6);
  
  // Background processing state
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false);

 // Tax rate (% of selling price)
 const TAX_RATE = 4;

  const getStepNumber = () => {
    const steps: Step[] = ['capture', 'analyzing', 'pricing'];
    return steps.indexOf(currentStep) + 1;
  };

  const getProgress = () => {
    return (getStepNumber() / 3) * 100;
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
      
      // Mahsulot nomini normallashtirish
      const normalizedName = normalizeProductName(analysisData.name);
      
      // To'g'ridan-to'g'ri pricing bosqichiga o'tish (search/select olib tashlandi)
      setSelectedProduct({
        title: normalizedName,
        description: analysisData.description,
        price: analysisData.suggestedPrice?.toString() || '0',
        image: imageBase64,
        source: 'AI Analysis',
        url: '',
      });
      
      setCurrentStep('pricing');
      toast.success('Mahsulot tahlil qilindi!');
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error('Tahlil xatosi: ' + (error.message || 'Noma\'lum xato'));
      setCurrentStep('capture');
    }
  };

  // Mahsulot nomini o'zbek lotin harflariga o'tkazish
  const normalizeProductName = (name: string): string => {
    const cyrillicToLatin: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '',
      'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o\'', 'қ': 'q',
      'ғ': 'g\'', 'ҳ': 'h',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
      'Ж': 'J', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
      'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'X', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sh', 'Ъ': '',
      'Ы': 'I', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya', 'Ў': 'O\'', 'Қ': 'Q',
      'Ғ': 'G\'', 'Ҳ': 'H',
    };
    return name.split('').map(char => cyrillicToLatin[char] || char).join('');
  };



  const calculatePricing = () => {
    if (!costPrice || costPrice <= 0) {
      toast.error('Iltimos, tannarxni kiriting');
      return;
    }

    const taxRate = TAX_RATE;
    const totalDeductionRate = (commissionPercent + taxRate + targetMargin) / 100;
    
    if (totalDeductionRate >= 1) {
      toast.error('Marja + komissiya + soliq 100% dan oshib ketdi. Marjani kamaytiring.');
      return;
    }
    
    const sellingPrice = (costPrice + logisticsCost) / (1 - totalDeductionRate);
    const commissionAmount = sellingPrice * (commissionPercent / 100);
    const taxAmount = sellingPrice * (taxRate / 100);
    const netProfit = sellingPrice * (targetMargin / 100);
    const roundedSellingPrice = Math.ceil(sellingPrice / 100) * 100;

    setPricing({
      costPrice,
      sellingPrice: roundedSellingPrice,
      marketplaceCommission: Math.round(commissionAmount),
      marketplaceCommissionPercent: Math.round(commissionPercent * 10) / 10,
      logisticsCost: Math.round(logisticsCost),
      logisticsType: isRealTariff ? 'Yandex API (real)' : 'Qo\'lda kiritilgan',
      taxAmount: Math.round(taxAmount),
      taxPercent: taxRate,
      netProfit: Math.round(netProfit),
      netProfitPercent: targetMargin,
      categoryType: analyzedProduct?.category || 'Standart',
    });
  };

  // Fetch real tariffs from Yandex API
  const fetchRealTariffs = async () => {
    const categoryId = (analyzedProduct as any)?.marketCategoryId || 91491; // fallback to valid Yandex category
    // Use a realistic selling price estimate for tariff calculation
    const estimatedPrice = costPrice > 0 
      ? Math.ceil((costPrice + logisticsCost) / (1 - (targetMargin + TAX_RATE) / 100) / 100) * 100
      : 100000;
    
    setIsCalculating(true);
    try {
      // Always send a valid categoryId — Yandex API returns 500 for categoryId: 0
      const offers = [{ categoryId, price: Math.round(estimatedPrice) }];

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: {
          marketplace: 'yandex',
          dataType: 'tariffs',
          offers,
        },
      });

      if (!error && data?.success && data.data?.length > 0) {
        const t = data.data[0];
        // Use commissionPercent directly from API (extracted from tariff parameters)
        // This is the EXACT marketplace fee % (FEE + PAYMENT_TRANSFER), typically 7-25%
        if (t.commissionPercent && t.commissionPercent > 0) {
          setCommissionPercent(Math.round(t.commissionPercent * 10) / 10);
        } else if (t.agencyCommission && estimatedPrice > 0) {
          // Fallback: calculate from amounts
          setCommissionPercent(Math.round((t.agencyCommission / estimatedPrice) * 1000) / 10);
        }
        const logistics = (t.fulfillment || 0) + (t.delivery || 0) + (t.sorting || 0);
        if (logistics > 0) setLogisticsCost(logistics);
        setIsRealTariff(true);
        toast.success('Real tariflar API dan olindi!');
      } else {
        toast.error('Tarif ma\'lumotlari olinmadi. Qo\'lda kiriting.');
      }
    } catch (e) {
      console.warn('Tarif API xatosi:', e);
      toast.error('API xatosi');
    } finally {
      setIsCalculating(false);
    }
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
      
      // Auto-remove completed/failed tasks after 8 seconds
      if (status === 'completed' || status === 'failed') {
        setTimeout(() => {
          setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
        }, 8000);
      }
    };

    try {
      // Step 1: Already done - mark complete
      updateTaskProgress(0, 'completed');

      // Mahsulot nomini normallashtirish (lotin harflarga)
      const normalizedProductName = normalizeProductName(product.title);

      // Rasmni storage'ga yuklash (card creator o'zi professional rasmlar yaratadi)
      let imageUrl: string | undefined;
      const imagesToUpload: string[] = [];

      // Kamera yoki web rasmni yuklash
      const sourceImage = productImage || product.image || null;
      
      if (sourceImage) {
        if (sourceImage.startsWith('data:')) {
          const uploadedUrl = await uploadImageToStorage(sourceImage);
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
            imagesToUpload.push(uploadedUrl);
          }
        } else if (sourceImage.startsWith('http')) {
          imageUrl = sourceImage;
          imagesToUpload.push(sourceImage);
        }
      }

      // Step 2-3: Card creator handles SEO + description with category context
      updateTaskProgress(1, 'completed');
      updateTaskProgress(2, 'completed');

      // Step 4: MXIK code lookup from database + AI
      // Use ORIGINAL name (not normalized latin) for better DB matching since MXIK codes are in Uzbek/Russian
      updateTaskProgress(3, 'running');
      let mxikResult: any = null;
      try {
        const originalName = analyzed?.name || product.title;
        const { data: mxikData } = await supabase.functions.invoke('lookup-mxik-code', {
          body: {
            productName: originalName,
            category: analyzed?.category || '',
            description: analyzed?.description || product.description || '',
          },
        });
        if (mxikData?.mxik_code) {
          mxikResult = mxikData;
          console.log(`✅ MXIK: ${mxikData.mxik_code} (${mxikData.mxik_name}) confidence: ${mxikData.confidence}%`);
        }
      } catch (e) {
        console.warn('MXIK lookup failed:', e);
      }
      updateTaskProgress(3, 'completed');

      // Step 5: Pinterest design search + Infographic generation
      const generatedInfos: string[] = [];
      const bestImageForInfographic = imageUrl || productImage;
      
      if (shouldGenerateInfographics && bestImageForInfographic) {
        updateTaskProgress(4, 'running');
        
        // First: fetch Pinterest design inspiration for this category
        let pinterestDesignPrompts: any[] = [];
        try {
          console.log('📌 Fetching Pinterest design inspiration...');
          const { data: pinterestData } = await supabase.functions.invoke('pinterest-design-search', {
            body: {
              category: analyzed?.category || '',
              productName: normalizedProductName,
              count: infoCount,
            },
          });
          
          if (pinterestData?.success && pinterestData?.enhancedPrompts?.length > 0) {
            pinterestDesignPrompts = pinterestData.enhancedPrompts;
            console.log(`✅ Pinterest: ${pinterestDesignPrompts.length} design prompts received`);
          }
        } catch (e) {
          console.warn('Pinterest search failed, using standard prompts:', e);
        }

        // Styles: 1st = infographic, rest = angle shots on #efefef
        const styles = ['professional', 'minimalist', 'vibrant', 'luxury', 'tech'];

        // Parallel infographic generation (3 at a time) with Pinterest-enhanced prompts
        const batchSize = 3;
        for (let batch = 0; batch < Math.ceil(Math.min(infoCount, 6) / batchSize); batch++) {
          const promises = [];
          for (let i = batch * batchSize; i < Math.min((batch + 1) * batchSize, infoCount, 6); i++) {
            promises.push(
              supabase.functions.invoke('generate-infographic', {
                body: {
                  productImage: bestImageForInfographic,
                  productName: normalizedProductName,
                  category: analyzed?.category,
                  style: styles[i % styles.length],
                  count: 1,
                  usePinterestDesigns: pinterestDesignPrompts.length > 0,
                  pinterestDesignPrompts: pinterestDesignPrompts.length > 0 
                    ? pinterestDesignPrompts.slice(i, i + 1) 
                    : undefined,
                },
              }).then(({ data: infoData, error: infoError }) => {
                if (!infoError && infoData?.images?.length > 0) {
                  return infoData.images[0].url;
                }
                return null;
              }).catch(() => null)
            );
          }
          const results = await Promise.all(promises);
          for (const url of results) {
            if (url) {
              generatedInfos.push(url);
              setBackgroundTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, generatedImages: [...generatedInfos] } : task
              ));
            }
          }
        }

        if (generatedInfos.length > 0) {
          imagesToUpload.push(...generatedInfos);
          updateTaskProgress(4, 'completed');
        } else {
          updateTaskProgress(4, 'failed');
        }
      } else {
        updateTaskProgress(4, 'completed');
      }

      // Step 6: Create Yandex card — pass ALL data, let card creator do full AI optimization
      updateTaskProgress(5, 'running');
      
      const { data: cardResult, error } = await supabase.functions.invoke('yandex-market-create-card', {
        body: {
          shopId,
          product: {
            name: normalizedProductName,
            nameRu: analyzed?.name || normalizedProductName,
            description: product.description || analyzed?.description,
            descriptionRu: product.description || analyzed?.description,
            category: analyzed?.category,
            brand: analyzed?.brand,
            price: pricingData.sellingPrice,
            costPrice: pricingData.costPrice,
            image: imageUrl,
            images: imagesToUpload,
            sourceUrl: product.url,
            specifications: analyzed?.specifications,
            mxikCode: mxikResult?.mxik_code,
            mxikName: mxikResult?.mxik_name,
          },
          pricing: {
            costPrice: pricingData.costPrice,
            recommendedPrice: pricingData.sellingPrice,
            marketplaceCommission: pricingData.marketplaceCommission,
            logisticsCost: pricingData.logisticsCost,
            taxRate: pricingData.taxPercent,
            targetProfit: pricingData.netProfit,
            netProfit: pricingData.netProfit,
          },
        },
      });

      console.log('Card creation result:', cardResult);

      if (error) throw error;

      updateTaskProgress(5, 'completed');
      updateTaskStatus('completed', generatedInfos);
      toast.success(`"${normalizedProductName}" kartochkasi tayyor!`);
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Background card creation error:', error);
      updateTaskStatus('failed');
      toast.error(`"${normalizeProductName(product.title)}" yaratishda xato`);
    }
  }, [shopId, onSuccess]);

  const startBackgroundCardCreation = () => {
    // Endi capturedImage talab qilinmaydi - web rasmdan foydalanish mumkin
    if (!pricing || !selectedProduct) {
      toast.error('Ma\'lumotlar to\'liq emas');
      return;
    }

    // Web rasmni yoki captured rasmni tanlash
    const productImage = capturedImage || selectedProduct.image || null;
    
    // Create new background task
    const taskId = `task-${Date.now()}`;
    const newTask: BackgroundTask = {
      id: taskId,
      productName: selectedProduct.title,
      status: 'processing',
      progress: [
        { name: 'Rasm tahlili', status: 'pending', model: 'GPT-4o Vision', icon: <Camera className="h-4 w-4" /> },
        { name: 'SEO kontent', status: 'pending', model: 'Yandex AI', icon: <Search className="h-4 w-4" /> },
        { name: 'Tavsif yaratish', status: 'pending', model: 'Yandex AI', icon: <FileText className="h-4 w-4" /> },
        { name: 'MXIK aniqlash', status: 'pending', model: 'Gemini + AI', icon: <Hash className="h-4 w-4" /> },
        { name: 'Pinterest + Infografika', status: 'pending', model: 'Firecrawl + Gemini', icon: <ImageLucide className="h-4 w-4" /> },
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
    setShowInlineCamera(false);
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
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const completedTasks = backgroundTasks.filter(t => t.status === 'completed').length;
  const processingTasks = backgroundTasks.filter(t => t.status === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">AI Scanner Pro</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm truncate">
                Rasmdan mahsulot kartochkasini Yandex Market'ga yuklash
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {backgroundTasks.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowBackgroundPanel(!showBackgroundPanel)}
                  className="relative text-xs"
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Fon ishlari</span>
                  <span className="sm:hidden">Fon</span>
                  {processingTasks > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {processingTasks}
                    </Badge>
                  )}
                </Button>
              )}
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {getStepNumber()} / 3
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={getProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-muted-foreground">
            <span>Rasm</span>
            <span>Tahlil</span>
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
                      task.status === 'completed' ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20' :
                      task.status === 'failed' ? 'border-destructive bg-destructive/5' :
                      'border-primary/30 bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {task.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {task.status === 'completed' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
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
              Mahsulot rasmini oling
            </CardTitle>
            <CardDescription>
              Kamera orqali rasmga oling yoki galereyadan tanlang
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inline Camera */}
            {showInlineCamera && (
              <InlineCamera
                onCapture={(base64) => {
                  setShowInlineCamera(false);
                  setCapturedImage(base64);
                  analyzeImage(base64);
                }}
                onClose={() => setShowInlineCamera(false)}
              />
            )}

            {/* Side by side buttons */}
            {!showInlineCamera && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => setShowInlineCamera(true)}
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm">Kameradan</span>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm">Galereyadan</span>
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              className="hidden"
            />

            {/* Tips for mobile users */}
            {!showInlineCamera && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-sm text-foreground mb-1">💡 Maslahat:</p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  <li>• Yaxshi yoritilgan joyda rasmga oling</li>
                  <li>• Rasm tiniq bo'lishi kerak</li>
                </ul>
              </div>
            )}
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




      {/* Step 5: Pricing */}
      {currentStep === 'pricing' && selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Narx hisoblash
            </CardTitle>
            <CardDescription>
              Tannarxni kiriting va kartochka yarating
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selected Product Preview */}
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg border">
              <div className="w-16 h-16 flex-shrink-0">
                {capturedImage ? (
                  <img 
                    src={capturedImage} 
                    alt="Product" 
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2">{selectedProduct.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{selectedProduct.description}</p>
                <Badge variant="secondary" className="mt-1 text-xs">{analyzedProduct?.category}</Badge>
              </div>
            </div>

            {/* Cost Price, Margin, Commission, Logistics */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    Tannarx (so'm)
                  </Label>
                  <Input
                    type="number"
                    placeholder="8500"
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="text-base font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                    Marja (%)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Number(e.target.value) || 20)}
                    className="text-base font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                    Komissiya (%)
                    {isRealTariff && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-primary/30 text-primary">API</Badge>}
                  </Label>
                  <Input
                    type="number"
                    value={commissionPercent}
                    onChange={(e) => { setCommissionPercent(Number(e.target.value)); setIsRealTariff(false); }}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                    Logistika (so'm)
                    {isRealTariff && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-primary/30 text-primary">API</Badge>}
                  </Label>
                  <Input
                    type="number"
                    value={logisticsCost || ''}
                    onChange={(e) => { setLogisticsCost(Number(e.target.value)); setIsRealTariff(false); }}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={calculatePricing} disabled={!costPrice} className="flex-1">
                  <Calculator className="mr-2 h-4 w-4" />
                  Narx hisoblash
                </Button>
                <Button variant="secondary" size="default" onClick={fetchRealTariffs} disabled={isCalculating}>
                  {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                  API tarif
                </Button>
              </div>
            </div>

            {/* Pricing Breakdown */}
            {pricing && (
              <div className="border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-muted/50 px-4 py-3 border-b">
                  <h4 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                    Narx tuzilmasi (Yandex Market)
                </h4>
                </div>

                {/* Cost Section */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tannarx:</span>
                    <span className="font-medium whitespace-nowrap">{formatPrice(pricing.costPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">+ Logistika <span className="text-xs">({pricing.logisticsType})</span>:</span>
                    <span className="font-medium whitespace-nowrap">{formatPrice(pricing.logisticsCost)}</span>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="px-4 py-3 bg-red-50/50 dark:bg-red-950/20 border-y space-y-2">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                    Sotuv narxidan ushlanadi:
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600/80 dark:text-red-400/80">
                      − Komissiya ({pricing.marketplaceCommissionPercent}%):
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                      {formatPrice(pricing.marketplaceCommission)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600/80 dark:text-red-400/80">
                      − Soliq ({pricing.taxPercent}%):
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                      {formatPrice(pricing.taxAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1">
                    Kategoriya: {pricing.categoryType}
                  </div>
                </div>

                {/* Result Section */}
                <div className="px-4 py-4 bg-primary/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Tavsiya etilgan narx:</span>
                    <span className="text-xl font-bold text-primary whitespace-nowrap">{formatPrice(pricing.sellingPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-lg">
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      Sof foyda ({pricing.netProfitPercent}%):
                    </span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                      {formatPrice(pricing.netProfit)}
                    </span>
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
                    <span className="text-sm">Generatsiya</span>
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
                      <option value={6}>6 ta</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 pb-8">
              <Button variant="outline" onClick={() => setCurrentStep('capture')}>
                Orqaga
              </Button>
              <Button 
                onClick={startBackgroundCardCreation} 
                disabled={!pricing}
                size="default"
              >
                <Zap className="h-4 w-4 mr-2" />
                Yaratish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
