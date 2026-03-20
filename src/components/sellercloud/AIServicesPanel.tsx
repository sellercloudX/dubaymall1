import { useFeaturePricing } from '@/hooks/useFeaturePricing';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sparkles, Image, Wand2, FileText, Bot, Palette, 
  Layers, Camera, DollarSign, Zap 
} from 'lucide-react';

const AI_SERVICE_CATEGORIES = [
  {
    icon: Camera,
    titleKey: 'AI Scanner Pro',
    descKey: 'Rasm yuklang — AI nom, tavsif, kategoriya va narxni avtomatik aniqlaydi',
    featureKeys: ['ai_scan', 'analyze_product_image'],
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Image,
    titleKey: 'Rasm generatsiyasi (SellZen)',
    descKey: 'Professional infografika va mahsulot rasmlari — modelli/modelsiz, 10+ uslub',
    featureKeys: ['generate_infographic', 'ai_product_image'],
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    icon: Wand2,
    titleKey: 'Kartochka yaratish',
    descKey: 'Uzum, WB, Yandex uchun tayyor kartochka — AI barcha maydonlarni to\'ldiradi',
    featureKeys: ['card_creation', 'uzum_card_creation', 'wb_card_creation', 'yandex_card_creation'],
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Layers,
    titleKey: 'Karta klonlash',
    descKey: 'Bir marketplace\'dan boshqasiga kartochkani bir tugma bilan nusxalang',
    featureKeys: ['clone_card', 'card_cloning'],
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: FileText,
    titleKey: 'AI kontent yaratish',
    descKey: 'SEO-optimizatsiyalangan tavsiflar, sarlavhalar va kalit so\'zlar 3 tilda',
    featureKeys: ['generate_content', 'ai_review_reply'],
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Bot,
    titleKey: 'AI Chat yordamchi',
    descKey: 'Savollarga javob, marketplace maslahatlar, strategiya tahlili',
    featureKeys: ['ai_chat'],
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
];

export function AIServicesPanel() {
  const { features, isLoading } = useFeaturePricing();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">AI Xizmatlari</h2>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const getPrice = (keys: string[]) => {
    for (const key of keys) {
      const f = features?.find(fp => fp.feature_key === key);
      if (f) return f;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">AI Xizmatlari</h2>
          <p className="text-xs text-muted-foreground">SellZen AI va Gemini quvvatli vositalar</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {AI_SERVICE_CATEGORIES.map((svc, idx) => {
          const pricing = getPrice(svc.featureKeys);
          const Icon = svc.icon;

          return (
            <Card key={idx} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${svc.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4.5 w-4.5 ${svc.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold truncate">{svc.titleKey}</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{svc.descKey}</p>
                    <div className="flex items-center gap-2">
                      {pricing ? (
                        pricing.is_free ? (
                          <Badge variant="secondary" className="text-[10px]">Bepul</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                            {(pricing.base_price_uzs || 0).toLocaleString()} so'm
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          <Zap className="h-2.5 w-2.5 mr-0.5" />
                          Balans orqali
                        </Badge>
                      )}
                      {pricing?.elegant_limit && (
                        <Badge variant="outline" className="text-[10px]">
                          Oyiga {pricing.elegant_limit} bepul
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Narxlar admin tomonidan boshqariladi. Tarif rejangizga qarab chegirmalar amal qiladi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
