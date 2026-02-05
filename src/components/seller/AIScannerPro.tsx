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

 // Yandex Market real tariffs (Uzbekistan)
 // Based on official Yandex Market documentation
 const YANDEX_TARIFFS = {
   // Commission by category (% of selling price)
   commissions: {
     largeAppliances: 8,  // Katta maishiy texnika
     default: 20,         // Boshqa kategoriyalar
   },
   // Tax rate (% of selling price)  
   taxRate: 4,
   // Logistics by gabarit (fixed so'm)
   logistics: {
     small: { maxVolume: 5, price: 2000, label: 'Kichik (5L gacha)' },
     medium: { maxVolume: 25, price: 4000, label: 'O\'rta (25L gacha)' },
     large: { maxVolume: 100, price: 8000, label: 'Katta (100L gacha)' },
     xlarge: { maxVolume: Infinity, price: 20000, label: 'Juda katta (100L+)' },
   },
   // Target net profit (% of selling price)
   targetNetProfit: 30,
 };
 
 // Determine logistics tier based on estimated product volume
 const getLogisticsTier = (category?: string): { price: number; label: string } => {
   // Default to medium size for most products
   const categoryLower = (category || '').toLowerCase();
   
   if (categoryLower.includes('telefon') || categoryLower.includes('aksessuar') || categoryLower.includes('phone')) {
     return { price: 2000, label: 'Kichik (5L gacha)' };
   }
   if (categoryLower.includes('kiyim') || categoryLower.includes('poyabzal') || categoryLower.includes('clothes')) {
     return { price: 4000, label: 'O\'rta (25L gacha)' };
   }
   if (categoryLower.includes('maishiy') || categoryLower.includes('texnika') || categoryLower.includes('appliance')) {
     return { price: 8000, label: 'Katta (100L gacha)' };
   }
   if (categoryLower.includes('mebel') || categoryLower.includes('furniture') || categoryLower.includes('shkaf')) {
     return { price: 20000, label: 'Juda katta (100L+)' };
   }
   return { price: 4000, label: 'O\'rta (25L gacha)' };
 };
 
 // Determine commission rate based on category
 const getCommissionRate = (category?: string): { rate: number; type: string } => {
   const categoryLower = (category || '').toLowerCase();
   if (categoryLower.includes('maishiy') || categoryLower.includes('katta texnika') || 
       categoryLower.includes('muzlatgich') || categoryLower.includes('kir yuvish')) {
     return { rate: 8, type: 'Katta maishiy texnika' };
   }
   return { rate: 20, type: 'Standart kategoriya' };
 };

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
    // MUHIM: Tanlangan mahsulotning sifatli rasmini saqlash
    // Kameradan olingan rasm o'rniga web'dan topilgan sifatli rasmni ishlatamiz
    if (product && product.image && product.image.startsWith('http')) {
      // Web rasmni asosiy rasm sifatida belgilash
      setCapturedImage(product.image);
    }
    setSelectedProduct(product);
    setCurrentStep('pricing');
  };

  // Mahsulot nomini o'zbek lotin harflariga o'tkazish
  const normalizeProductName = (name: string): string => {
    // Kirill harflarini lotin harflariga o'tkazish (transliteration)
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

  const useAnalyzedProduct = () => {
    if (analyzedProduct) {
      // Web'dan topilgan birinchi sifatli rasmni qo'llash
      const bestImage = webProducts.length > 0 && webProducts[0].image?.startsWith('http') 
        ? webProducts[0].image 
        : capturedImage || '';
      
      // Mahsulot nomini normallashtirish (lotin harflarga)
      const normalizedName = normalizeProductName(analyzedProduct.name);
      
      setSelectedProduct({
        title: normalizedName,
        description: analyzedProduct.description,
        price: analyzedProduct.suggestedPrice.toString(),
        image: bestImage,
        source: 'AI Analysis',
        url: '',
      });
      
      // Agar web'dan rasm topilgan bo'lsa, uni asosiy rasm sifatida belgilash
      if (bestImage.startsWith('http')) {
        setCapturedImage(bestImage);
      }
      
      setCurrentStep('pricing');
    }
  };

  const calculatePricing = () => {
    if (!costPrice || costPrice <= 0) {
      toast.error('Iltimos, tannarxni kiriting');
      return;
    }

     // Get category-based rates
     const category = analyzedProduct?.category;
     const { rate: commissionRate, type: categoryType } = getCommissionRate(category);
     const { price: logisticsCost, label: logisticsType } = getLogisticsTier(category);
     const taxRate = YANDEX_TARIFFS.taxRate;
     const targetProfitRate = YANDEX_TARIFFS.targetNetProfit;
 
     // Reverse calculation formula:
     // SellingPrice = CostPrice + Commission + Logistics + Tax + Profit
     // Where Commission, Tax, Profit are % of SellingPrice
     // SellingPrice = CostPrice + Logistics + SellingPrice × (commissionRate + taxRate + profitRate)
     // SellingPrice × (1 - totalDeductions) = CostPrice + Logistics
     // SellingPrice = (CostPrice + Logistics) / (1 - totalDeductions)
     
     const totalDeductionRate = (commissionRate + taxRate + targetProfitRate) / 100;
     const sellingPrice = (costPrice + logisticsCost) / (1 - totalDeductionRate);
     
     // Calculate actual amounts based on selling price
     const commissionAmount = sellingPrice * (commissionRate / 100);
     const taxAmount = sellingPrice * (taxRate / 100);
     const netProfit = sellingPrice * (targetProfitRate / 100);
     
     // Round to nearest 100 so'm
     const roundedSellingPrice = Math.ceil(sellingPrice / 100) * 100;
 
     setPricing({
       costPrice,
       sellingPrice: roundedSellingPrice,
       marketplaceCommission: Math.round(commissionAmount),
       marketplaceCommissionPercent: commissionRate,
       logisticsCost,
       logisticsType,
       taxAmount: Math.round(taxAmount),
       taxPercent: taxRate,
       netProfit: Math.round(netProfit),
       netProfitPercent: targetProfitRate,
       categoryType,
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

      // MUHIM: Web rasmlarni afzal ko'ramiz (sifatliroq)
      // Kameradan olingan rasmlar sifatsiz bo'lishi mumkin
      let imageUrl: string | undefined;
      const imagesToUpload: string[] = [];

      // 1. Avval web'dan topilgan rasmni tekshiramiz (eng sifatli)
      if (product.image && product.image.startsWith('http')) {
        imageUrl = product.image;
        imagesToUpload.push(product.image);
      }
      
      // 2. Agar productImage ham URL bo'lsa va farqli bo'lsa, qo'shamiz
      if (productImage && productImage.startsWith('http') && productImage !== product.image) {
        if (!imageUrl) imageUrl = productImage;
        imagesToUpload.push(productImage);
      }
      
      // 3. Agar faqat base64 rasm bo'lsa (kamera), uni oxirgi variant sifatida yuklaymiz
      if (!imageUrl && productImage && productImage.startsWith('data:')) {
        const uploadedUrl = await uploadImageToStorage(productImage);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
          imagesToUpload.push(uploadedUrl);
        }
      }

      // Mahsulot nomini normallashtirish (lotin harflarga)
      const normalizedProductName = normalizeProductName(product.title);

      // Step 2: SEO content
      updateTaskProgress(1, 'running');
      let seoContent = null;
      try {
        const { data: seoData, error: seoError } = await supabase.functions.invoke('generate-product-content', {
          body: {
            productName: normalizedProductName,
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
            productName: normalizedProductName,
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

      // Step 4: MXIK lookup
      updateTaskProgress(3, 'running');
      let mxikData = null;
      try {
        const { data: mxikResult, error: mxikError } = await supabase.functions.invoke('lookup-mxik-code', {
          body: {
            productName: normalizedProductName,
            category: analyzed?.category,
            description: product.description || analyzed?.description,
          },
        });
        if (!mxikError && mxikResult) {
          mxikData = mxikResult;
          updateTaskProgress(3, 'completed');
        } else {
          updateTaskProgress(3, 'failed');
        }
      } catch {
        updateTaskProgress(3, 'failed');
      }

      // Step 5: Infographic generation - web rasmdan foydalanish
      const generatedInfos: string[] = [];
      // Infografika uchun eng yaxshi sifatli rasmni tanlaymiz
      const bestImageForInfographic = imageUrl || productImage;
      
      if (shouldGenerateInfographics && bestImageForInfographic) {
        updateTaskProgress(4, 'running');
        const styles = ['professional', 'minimalist', 'vibrant', 'luxury', 'tech', 'professional'];

        for (let i = 0; i < Math.min(infoCount, 6); i++) {
          try {
            const { data: infoData, error: infoError } = await supabase.functions.invoke('generate-infographic', {
              body: {
                productImage: bestImageForInfographic,
                productName: normalizedProductName,
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
          updateTaskProgress(4, 'completed');
        } else {
          updateTaskProgress(4, 'failed');
        }
      } else {
        updateTaskProgress(4, 'completed');
      }

      // Step 6: Create Yandex card
      updateTaskProgress(5, 'running');
      
      const { error } = await supabase.functions.invoke('yandex-market-create-card', {
        body: {
          shopId,
          product: {
            name: normalizedProductName,
            nameRu: seoContent?.seoTitle?.ru || normalizedProductName,
            description: descriptions?.fullDescription?.uz || product.description || analyzed?.description,
            descriptionRu: descriptions?.fullDescription?.ru || product.description,
            category: analyzed?.category,
            price: pricingData.sellingPrice,
            costPrice: pricingData.costPrice,
            image: imageUrl,
            images: imagesToUpload,
            sourceUrl: product.url,
            keywords: seoContent?.keywords,
            bulletPoints: seoContent?.bulletPoints || descriptions?.sellingPoints,
            mxikCode: mxikData?.mxik_code,
            mxikName: mxikData?.mxik_name,
          },
          pricing: {
            ...pricingData,
            recommendedPrice: pricingData.sellingPrice,
          },
        },
      });

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
        { name: 'SEO kontent', status: 'pending', model: 'Claude Haiku', icon: <Search className="h-4 w-4" /> },
        { name: 'Tavsif yaratish', status: 'pending', model: 'Claude Sonnet', icon: <FileText className="h-4 w-4" /> },
        { name: 'MXIK aniqlash', status: 'pending', model: 'Gemini Flash', icon: <Hash className="h-4 w-4" /> },
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
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
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
            {/* Main Camera Button - Full width for mobile */}
            <Button
              size="lg"
              className="w-full h-20 text-base flex items-center justify-center gap-3"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = (e: any) => handleImageCapture(e);
                input.click();
              }}
            >
              <Camera className="h-6 w-6" />
              <span>Kamera orqali rasmga olish</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">yoki</span>
              </div>
            </div>

            {/* Gallery Upload Button */}
            <Button
              variant="outline"
              className="w-full h-12"
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
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium text-sm text-foreground mb-1">💡 Maslahat:</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                <li>• Yaxshi yoritilgan joyda rasmga oling</li>
                <li>• Rasm tiniq bo'lishi kerak</li>
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
              Mahsulotni tanlang
            </CardTitle>
            <CardDescription>
              Birini tanlang yoki AI tahlilidan foydalaning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Analyzed Product Card - Clean layout */}
            {capturedImage && (
              <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                <div className="flex gap-4 items-start">
                  <div className="relative">
                    <img 
                      src={capturedImage} 
                      alt="Captured" 
                      className="w-20 h-20 object-cover rounded-lg border-2 border-background shadow-md"
                    />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base line-clamp-2">{analyzedProduct?.name}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {analyzedProduct?.description}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {analyzedProduct?.category}
                    </Badge>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="default"
                  onClick={useAnalyzedProduct}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI tahlilidan foydalanish
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Similar Products Section */}
            {webProducts.length > 0 ? (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  O'xshash mahsulotlar ({webProducts.length} ta):
                </h4>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {webProducts.map((product, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 border rounded-lg hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                        onClick={() => handleProductSelect(product)}
                      >
                        <ProductImageWithFallback 
                          src={product.image} 
                          alt={product.title} 
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm line-clamp-2">{product.title}</h5>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {product.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs py-0">
                              {product.source}
                            </Badge>
                            {product.price && (
                              <span className="text-sm font-bold text-primary">
                                {product.price}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
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
                <p className="text-sm">Qidirilmoqda...</p>
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

            {/* Cost Price Input */}
            <div className="space-y-3">
              <Label htmlFor="costPrice" className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Tannarx (so'm)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="costPrice"
                  type="number"
                  placeholder="Masalan: 8500"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="text-base font-medium"
                />
                <Button onClick={calculatePricing} disabled={!costPrice}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Hisoblash
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

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('select')}>
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
