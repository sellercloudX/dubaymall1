import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBalance, useFeaturePricing } from '@/hooks/useFeaturePricing';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, Image, Video, Sparkles, Download, ChevronLeft,
  ChevronRight, Loader2, Wallet, X, ImagePlus, Film,
  Wand2, History, Eye,
} from 'lucide-react';

const MODES = [
  { value: 'modelli', label: 'Modelli' },
  { value: 'modelsiz', label: 'Modelsiz' },
];

const STYLE_TYPES = [
  { key: 'infographic', label: 'Infografika' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'minimalist', label: 'Minimalist' },
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

interface HistoryItem {
  id: string;
  timestamp: number;
  sourceImage: string;
  type: 'images' | 'video';
  results: GeneratedImage[];
  videoUrl?: string;
  mode: string;
  styleType: string;
}

export function SellZenStudio() {
  const { user } = useAuth();
  const { balance, deductBalance } = useUserBalance();
  const { getFeaturePrice } = useFeaturePricing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [mode, setMode] = useState('modelsiz');
  const [styleType, setStyleType] = useState('infographic');
  const [videoTemplate, setVideoTemplate] = useState('product_showcase');

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'video'>('images');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const imagePrice = getFeaturePrice('sellzen-image-generate')?.base_price_uzs || 8000;
  const videoPrice = getFeaturePrice('ai_video_generation')?.base_price_uzs || 18000;

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

  const addToHistory = (type: 'images' | 'video', results: GeneratedImage[], videoUrl?: string) => {
    if (!uploadedImage) return;
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      sourceImage: uploadedImage,
      type,
      results,
      videoUrl,
      mode,
      styleType,
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
      const result = await deductBalance('generate_infographic', `SellZen Studio: ${mode} ${styleType}`);
      if (!result.success) {
        toast.error(result.error || 'Balans yechishda xatolik');
        setIsGeneratingImages(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('sellzen-studio', {
        body: {
          action: 'generate_images',
          imageBase64: uploadedImage,
          styles: [styleType],
          mode,
        },
      });

      if (error) throw error;
      if (data?.results) {
        setGeneratedImages(data.results);
        setCarouselIndex(0);
        addToHistory('images', data.results);
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
          template: videoTemplate,
        },
      });

      if (error) throw error;
      if (data?.videoUrl) {
        setGeneratedVideo(data.videoUrl);
        addToHistory('video', [], data.videoUrl);
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
      // Fallback: open in new tab
      window.open(url, '_blank');
      toast.info('Yangi oynada ochildi');
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1.5 text-xs"
          >
            <History className="h-3.5 w-3.5" />
            Tarix
          </Button>
          <Badge variant="outline" className="gap-1.5">
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
                      if (item.type === 'images') {
                        setGeneratedImages(item.results);
                        setActiveTab('images');
                      } else if (item.videoUrl) {
                        setGeneratedVideo(item.videoUrl);
                        setActiveTab('video');
                      }
                      setShowHistory(false);
                    }}
                  >
                    <img src={item.sourceImage} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {item.type === 'images' ? <Image className="h-3 w-3 text-primary" /> : <Video className="h-3 w-3 text-primary" />}
                        <span className="text-xs font-medium truncate">
                          {item.mode} · {item.styleType}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString('uz')}
                      </p>
                    </div>
                    {item.type === 'images' && item.results.filter(r => r.url).length > 0 && (
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

      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'images' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('images')}
          className="gap-1.5"
        >
          <ImagePlus className="h-4 w-4" />
          Rasmlar ({imagePrice.toLocaleString()} so'm)
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
                    setGeneratedVideo(null);
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

          {/* Style options */}
          <div className="mt-4 space-y-3">
            {activeTab === 'images' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rejim</label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Uslub</label>
                  <Select value={styleType} onValueChange={setStyleType}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_TYPES.map(s => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Shablon</label>
                <Select value={videoTemplate} onValueChange={setVideoTemplate}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_TEMPLATES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="mt-4">
            {activeTab === 'images' ? (
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

      {/* Results - Side by side: Source + Generated */}
      {successImages.length > 0 && activeTab === 'images' && (
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
            {/* Side by side: source + video */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                <div className="text-[9px] text-center py-0.5 bg-muted/50 text-muted-foreground font-medium">Asl rasm</div>
                {uploadedImage && (
                  <img src={uploadedImage} alt="Asl" className="w-full h-full object-contain p-1" />
                )}
              </div>
              <div className="rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                <div className="text-[9px] text-center py-0.5 bg-primary/10 text-primary font-medium">Video</div>
                <video
                  src={generatedVideo}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => downloadFile(generatedVideo!, `sellzen-video-${Date.now()}.mp4`)}
            >
              <Download className="h-3 w-3" />
              Videoni yuklab olish
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
