import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBalance, useFeaturePricing } from '@/hooks/useFeaturePricing';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, Image, Sparkles, Download, ChevronLeft,
  ChevronRight, Loader2, Wallet, X,
  Wand2, History, Eye,
} from 'lucide-react';

const MARKETPLACES = [
  { value: 'wildberries', label: 'Wildberries (3:4)' },
  { value: 'uzum', label: 'Uzum (3:4)' },
  { value: 'ozon', label: 'Ozon (1:1)' },
  { value: 'yandex', label: 'Yandex (4:3)' },
  { value: 'all', label: 'Barchasi (3:4)' },
];

const STYLES = [
  { value: 'both', label: 'Infografika + Lifestyle' },
  { value: 'infographic', label: 'Faqat Infografika' },
  { value: 'lifestyle', label: 'Faqat Lifestyle' },
];

interface GeneratedImage {
  style: string;
  label: string;
  url: string | null;
  error?: string;
  format?: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  sourceImage: string;
  results: GeneratedImage[];
  marketplace: string;
  style: string;
}

export function SellZenStudio() {
  const { user } = useAuth();
  const { balance, deductBalance } = useUserBalance();
  const { getFeaturePrice } = useFeaturePricing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [marketplace, setMarketplace] = useState('wildberries');
  const [imageStyle, setImageStyle] = useState('commercial');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const imagePrice = getFeaturePrice('sellzen-image-generate')?.base_price_uzs || 8000;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Rasm hajmi 10MB dan oshmasligi kerak');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setGeneratedImages([]);
    };
    reader.readAsDataURL(file);
  }, []);

  const addToHistory = (results: GeneratedImage[]) => {
    if (!uploadedImage) return;
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      sourceImage: uploadedImage,
      results,
      marketplace,
      style: imageStyle,
    };
    setHistory(prev => [item, ...prev].slice(0, 20));
  };

  const handleGenerateImages = async () => {
    if (!uploadedImage) {
      toast.error('Rasm yuklang');
      return;
    }

    const totalCost = imagePrice;
    if (balance && (balance.balance_uzs || 0) < totalCost) {
      toast.error(`Balans yetarli emas. Kerak: ${totalCost.toLocaleString()} so'm`);
      return;
    }

    setIsGeneratingImages(true);
    try {
      const result = await deductBalance('sellzen-image-generate', `SellZen Studio: ${marketplace} ${imageStyle}`);
      if (!result.success) {
        toast.error(result.error || 'Balans yechishda xatolik');
        setIsGeneratingImages(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('sellzen-studio', {
        body: {
          action: 'generate_images',
          imageBase64: uploadedImage,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
          marketplace,
          variants: imageStyle === 'all' ? ['infographic', 'lifestyle'] 
            : imageStyle === 'infographic' ? ['infographic'] 
            : imageStyle === 'lifestyle' ? ['lifestyle']
            : ['infographic', 'lifestyle'],
        },
      });

      if (error) throw error;
      if (data?.results) {
        setGeneratedImages(data.results);
        setCarouselIndex(0);
        addToHistory(data.results);
        const successCount = data.results.filter((r: GeneratedImage) => r.url).length;
        if (successCount > 0) toast.success(`${successCount} ta rasm generatsiya qilindi!`);
        else toast.error('Rasm generatsiya qilinmadi');
      }
    } catch (e: any) {
      console.error('Generate images error:', e);
      toast.error(e.message || 'Rasm generatsiya xatosi');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      toast.info('Yuklab olinmoqda...');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Yuklab olindi!');
    } catch {
      window.open(url, '_blank');
      toast.info('Yangi oynada ochildi');
    }
  };

  const successImages = generatedImages.filter(img => img.url);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
            <Wand2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">SellZen AI Studio</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Professional rasm generatsiya</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1 text-xs h-7 px-2"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Tarix</span>
          </Button>
          <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs">
            <Wallet className="h-3 w-3" />
            {(balance?.balance_uzs || 0).toLocaleString()} so'm
          </Badge>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Generatsiya tarixi ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Hali tarix yo'q</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setUploadedImage(item.sourceImage);
                      setGeneratedImages(item.results);
                      setShowHistory(false);
                    }}
                  >
                    <img src={item.sourceImage} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Image className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium truncate">
                          {item.marketplace} · {item.style}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString('uz')}
                      </p>
                    </div>
                    {item.results.filter(r => r.url).length > 0 && (
                      <div className="flex -space-x-2">
                        {item.results.filter(r => r.url).slice(0, 3).map((r, i) => (
                          <img key={i} src={r.url!} alt="" className="w-8 h-8 rounded border-2 border-background object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload + Settings */}
      <Card>
        <CardContent className="p-4">
          {/* Upload area */}
          <div
            className="relative w-full h-40 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center overflow-hidden group"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadedImage ? (
              <>
                <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-contain" />
                <button
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedImage(null);
                    setGeneratedImages([]);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="text-center p-4">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Mahsulot rasmini yuklang</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG · max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Settings */}
          <div className="mt-4 space-y-3">
            {/* Product name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mahsulot nomi (ixtiyoriy)</label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Masalan: Samsung 65W zaryadlovchi"
                className="text-sm"
              />
            </div>

            {/* Product description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tavsif (ixtiyoriy — sifatni oshiradi)</label>
              <Input
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Xususiyatlar, ranglar, o'lchamlar..."
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Marketplace</label>
                <Select value={marketplace} onValueChange={setMarketplace}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETPLACES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Uslub</label>
                <Select value={imageStyle} onValueChange={setImageStyle}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Generate button */}
          <div className="mt-4">
            <Button
              onClick={handleGenerateImages}
              disabled={!uploadedImage || isGeneratingImages}
              className="w-full gap-2 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white"
            >
              {isGeneratingImages ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generatsiya qilinmoqda...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Rasm generatsiya ({imagePrice.toLocaleString()} so'm)</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {successImages.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Natija
              <Badge variant="secondary" className="text-[10px] ml-auto">{successImages[carouselIndex]?.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* Side by side comparison */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Source */}
              <div className="rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                <div className="text-[9px] text-center py-0.5 bg-muted/50 text-muted-foreground font-medium">Asl rasm</div>
                {uploadedImage && (
                  <img src={uploadedImage} alt="Asl" className="w-full h-full object-contain p-1" />
                )}
              </div>
              {/* Generated */}
              <div className="relative rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                <div className="text-[9px] text-center py-0.5 bg-primary/10 text-primary font-medium">Natija</div>
                {successImages[carouselIndex]?.url && (
                  <img
                    src={successImages[carouselIndex].url!}
                    alt={successImages[carouselIndex].label}
                    className="w-full h-full object-contain p-1"
                  />
                )}
                {successImages.length > 1 && (
                  <>
                    <button
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center shadow"
                      onClick={() => setCarouselIndex(i => (i - 1 + successImages.length) % successImages.length)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center shadow"
                      onClick={() => setCarouselIndex(i => (i + 1) % successImages.length)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {successImages.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3">
                {successImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === carouselIndex ? 'border-primary shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url!} alt={img.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Download buttons */}
            <div className="flex flex-wrap gap-2">
              {successImages.map((img, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => downloadFile(img.url!, `sellzen-${img.style}-${Date.now()}.png`)}
                >
                  <Download className="h-3 w-3" />
                  {img.label}
                </Button>
              ))}
            </div>

            {/* Errors */}
            {generatedImages.filter(img => img.error).map((img, idx) => (
              <p key={idx} className="text-[11px] text-destructive mt-1">
                {img.label}: {img.error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pricing info */}
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Narxlar admin tomonidan boshqariladi · Balansdan avtomatik yechiladi</span>
          <Badge variant="secondary" className="text-[10px]">SellZen v2</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
