import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBalance, useFeaturePricing } from '@/hooks/useFeaturePricing';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Upload, Image, Video, Sparkles, Download, ChevronLeft,
  ChevronRight, Loader2, Wallet, X, ImagePlus, Film,
  Palette, LayoutTemplate, Wand2,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'home', label: 'Uy-ro\'zg\'or' },
  { value: 'electronics', label: 'Elektronika' },
  { value: 'clothing', label: 'Kiyim-kechak' },
  { value: 'cosmetics', label: 'Kosmetika' },
  { value: 'auto', label: 'Avto' },
];

const IMAGE_STYLES = [
  { key: 'infographic', label: 'Infografika', icon: LayoutTemplate, desc: 'Premium infografika uslubi' },
  { key: 'lifestyle', label: 'Lifestyle', icon: Image, desc: 'Hayotiy kontekst rasmi' },
  { key: 'minimalist', label: 'Minimalist', icon: Palette, desc: 'Toza, minimalist ko\'rinish' },
];

const VIDEO_TEMPLATES = [
  { value: 'product_showcase', label: 'Mahsulot ko\'rsatish' },
  { value: 'promo', label: 'Promo video' },
  { value: 'story', label: 'Instagram Story' },
  { value: 'review', label: 'Obzor formati' },
];

interface GeneratedImage {
  style: string;
  label: string;
  url: string | null;
  error?: string;
}

export function SellZenStudio() {
  const { user } = useAuth();
  const { balance, deductBalance } = useUserBalance();
  const { getFeaturePrice } = useFeaturePricing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('home');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['infographic', 'lifestyle', 'minimalist']);
  const [videoTemplate, setVideoTemplate] = useState('product_showcase');

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'video'>('images');

  const imagePrice = getFeaturePrice('generate_infographic')?.base_price_uzs || 3000;
  const videoPrice = getFeaturePrice('ai_video_generation')?.base_price_uzs || 15000;

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
      setGeneratedVideo(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const toggleStyle = (key: string) => {
    setSelectedStyles(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleGenerateImages = async () => {
    if (!uploadedImage || selectedStyles.length === 0) {
      toast.error('Rasm yuklang va uslub tanlang');
      return;
    }

    // Deduct balance for each style
    const totalCost = imagePrice * selectedStyles.length;
    if (balance && (balance.balance_uzs || 0) < totalCost) {
      toast.error(`Balans yetarli emas. Kerak: ${totalCost.toLocaleString()} so'm`);
      return;
    }

    setIsGeneratingImages(true);
    try {
      // Deduct balance
      for (const style of selectedStyles) {
        const result = await deductBalance('generate_infographic', `SellZen Studio: ${style} rasm`);
        if (!result.success) {
          toast.error(result.error || 'Balans yechishda xatolik');
          setIsGeneratingImages(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('sellzen-studio', {
        body: {
          action: 'generate_images',
          imageBase64: uploadedImage,
          category,
          productName,
          styles: selectedStyles,
        },
      });

      if (error) throw error;
      if (data?.results) {
        setGeneratedImages(data.results);
        setCarouselIndex(0);
        const successCount = data.results.filter((r: GeneratedImage) => r.url).length;
        toast.success(`${successCount} ta rasm generatsiya qilindi!`);
      }
    } catch (e: any) {
      console.error('Generate images error:', e);
      toast.error(e.message || 'Rasm generatsiya xatosi');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!uploadedImage) {
      toast.error('Avval rasm yuklang');
      return;
    }

    if (balance && (balance.balance_uzs || 0) < videoPrice) {
      toast.error(`Balans yetarli emas. Kerak: ${videoPrice.toLocaleString()} so'm`);
      return;
    }

    setIsGeneratingVideo(true);
    try {
      const result = await deductBalance('ai_video_generation', 'SellZen Studio: video generatsiya');
      if (!result.success) {
        toast.error(result.error || 'Balans yechishda xatolik');
        setIsGeneratingVideo(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('sellzen-studio', {
        body: {
          action: 'generate_video',
          imageBase64: uploadedImage,
          productName,
          template: videoTemplate,
          category,
        },
      });

      if (error) throw error;
      if (data?.videoUrl) {
        setGeneratedVideo(data.videoUrl);
        toast.success('Video tayyor!');
      } else if (data?.taskId) {
        toast.info('Video generatsiya jarayonda. Biroz kuting...');
      } else {
        toast.error('Video generatsiya qilinmadi');
      }
    } catch (e: any) {
      console.error('Generate video error:', e);
      toast.error(e.message || 'Video generatsiya xatosi');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const downloadImage = async (url: string, name: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `sellzen-${name}-${Date.now()}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, '_blank');
    }
  };

  const successImages = generatedImages.filter(img => img.url);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">SellZen AI Studio</h2>
            <p className="text-xs text-muted-foreground">Rasm va video generatsiya</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Wallet className="h-3 w-3" />
          {(balance?.balance_uzs || 0).toLocaleString()} so'm
        </Badge>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'images' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('images')}
          className="gap-1.5"
        >
          <ImagePlus className="h-4 w-4" />
          Rasmlar ({imagePrice.toLocaleString()} so'm/dona)
        </Button>
        <Button
          variant={activeTab === 'video' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('video')}
          className="gap-1.5"
        >
          <Film className="h-4 w-4" />
          Video ({videoPrice.toLocaleString()} so'm)
        </Button>
      </div>

      {/* Upload section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Image upload */}
            <div
              className="relative w-full sm:w-48 h-48 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center overflow-hidden shrink-0 group"
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
                      setGeneratedVideo(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Rasm yuklang</p>
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

            {/* Product info */}
            <div className="flex-1 space-y-3">
              <Input
                placeholder="Mahsulot nomi (ixtiyoriy)"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="text-sm"
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Kategoriya" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeTab === 'images' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Uslublarni tanlang:</p>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_STYLES.map(s => {
                      const isSelected = selectedStyles.includes(s.key);
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleStyle(s.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'video' && (
                <Select value={videoTemplate} onValueChange={setVideoTemplate}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Video shablon" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_TEMPLATES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Generate button */}
          <div className="mt-4">
            {activeTab === 'images' ? (
              <Button
                onClick={handleGenerateImages}
                disabled={!uploadedImage || selectedStyles.length === 0 || isGeneratingImages}
                className="w-full gap-2 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white"
              >
                {isGeneratingImages ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generatsiya qilinmoqda...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> {selectedStyles.length} ta rasm generatsiya ({(imagePrice * selectedStyles.length).toLocaleString()} so'm)</>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleGenerateVideo}
                disabled={!uploadedImage || isGeneratingVideo}
                className="w-full gap-2 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white"
              >
                {isGeneratingVideo ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Video generatsiya qilinmoqda...</>
                ) : (
                  <><Film className="h-4 w-4" /> Video generatsiya ({videoPrice.toLocaleString()} so'm)</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results - Image carousel */}
      {generatedImages.length > 0 && activeTab === 'images' && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Natijalar ({successImages.length}/{generatedImages.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {successImages.length > 0 ? (
              <div className="space-y-3">
                {/* Carousel */}
                <div className="relative rounded-xl overflow-hidden bg-muted/30 aspect-square sm:aspect-[4/3]">
                  {successImages[carouselIndex]?.url && (
                    <img
                      src={successImages[carouselIndex].url!}
                      alt={successImages[carouselIndex].label}
                      className="w-full h-full object-contain"
                    />
                  )}
                  {/* Nav arrows */}
                  {successImages.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md hover:bg-background transition-colors"
                        onClick={() => setCarouselIndex(i => (i - 1 + successImages.length) % successImages.length)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md hover:bg-background transition-colors"
                        onClick={() => setCarouselIndex(i => (i + 1) % successImages.length)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {/* Style label */}
                  <Badge className="absolute top-2 left-2 text-[10px]">
                    {successImages[carouselIndex]?.label}
                  </Badge>
                </div>

                {/* Thumbnail dots */}
                <div className="flex items-center justify-center gap-2">
                  {successImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCarouselIndex(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === carouselIndex ? 'border-primary shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url!} alt={img.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {/* Download buttons */}
                <div className="flex flex-wrap gap-2">
                  {successImages.map((img, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => downloadImage(img.url!, img.style)}
                    >
                      <Download className="h-3 w-3" />
                      {img.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Rasmlar generatsiya qilinmadi. Boshqa uslub bilan urinib ko'ring.
              </div>
            )}

            {/* Show errors */}
            {generatedImages.filter(img => img.error).map((img, idx) => (
              <p key={idx} className="text-[11px] text-destructive mt-1">
                {img.label}: {img.error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results - Video */}
      {generatedVideo && activeTab === 'video' && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Video natija
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="rounded-xl overflow-hidden bg-muted/30 aspect-video">
              <video
                src={generatedVideo}
                controls
                className="w-full h-full"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => {
                const a = document.createElement('a');
                a.href = generatedVideo;
                a.download = `sellzen-video-${Date.now()}.mp4`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <Download className="h-3 w-3" />
              Yuklab olish
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pricing info */}
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Narxlar admin tomonidan boshqariladi · Balansdan avtomatik yechiladi</span>
          <Badge variant="secondary" className="text-[10px]">SellZen API</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
