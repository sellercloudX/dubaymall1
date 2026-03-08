import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Crown, Globe, Package, ShoppingCart, BarChart3, Scan, ArrowRight, ArrowLeft,
  CheckCircle2, Shield, Copy, Calculator, DollarSign, Bell, Zap, TrendingUp,
  MessageCircle, FileSpreadsheet, Sparkles, Target, Rocket, Star, Award,
  LayoutDashboard, RefreshCw, Eye, Megaphone, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';

interface OnboardingWizardProps {
  onActivate: () => void;
  onGoHome?: () => void;
}

const content = {
  uz: {
    welcome: "SellerCloudX ga xush kelibsiz!",
    subtitle: "O'zbekistonning #1 marketplace avtomatizatsiya platformasi",
    startGuide: "Qo'llanmani boshlash",
    skipToActivate: "To'g'ridan-to'g'ri aktivlashtirish",
    next: "Keyingi",
    prev: "Oldingi",
    activateNow: "Hoziroq boshlash",
    payAndActivate: "Bepul boshlash (1 kun sinov)",
    step: "qadam",
    of: "/",
    finalTitle: "Tayyor! Keling boshlaymiz 🚀",
    finalDesc: "1 kunlik bepul sinov — hech qanday to'lov talab etilmaydi",
    activateOption1Title: "🚀 Hoziroq bepul boshlang",
    activateOption1Desc: "1 kunlik bepul sinov davri. Barcha asosiy funksiyalar ochiq. Sinov tugagandan so'ng oylik 99,000 so'm aktivatsiya to'lovi.",
    telegramLink: "@sellercloudx_support",
    features: [
      {
        icon: "globe",
        title: "4 ta marketplace — 1 ta dashboard",
        desc: "Uzum, WB, Yandex va Ozon — hammasi bitta ekrandan boshqariladi.",
        benefit: "Har bir marketplace uchun alohida kirish shart emas. Barchasini bir joyda ko'ring.",
        example: "🏪 500 ta tovaringizni bir joyda ko'ring, narxini o'zgartiring, qoldiqni tekshiring.",
        stats: "⏱ Kuniga 3-4 soat tejash"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro — sun'iy intellekt",
        desc: "Tovar rasmini suratga oling yoki yuklang — AI tovarni taniydi va kartochkasini yaratadi.",
        benefit: "Yangi tovar qo'shish endi 30 daqiqa emas, 30 soniya.",
        example: "📸 Telefon qutisini suratga oling — AI kartochkani to'liq yaratib beradi.",
        stats: "🤖 95% aniqlik"
      },
      {
        icon: "copy",
        title: "Kartochka klonlash",
        desc: "Uzumdagi tovar kartochkasini WB va Yandex'ga avtomatik ko'chiring.",
        benefit: "Bir marta yarating — qolganlarga AI ko'chirib beradi.",
        example: "📋 200 ta tovarni 1 tugma bilan WB ga ko'chiring.",
        stats: "⚡ 5 daqiqada 200 ta tovar"
      },
      {
        icon: "chart",
        title: "Moliyaviy tahlil",
        desc: "Har bir tovar bo'yicha daromad, xarajat, foyda va komissiyani ko'ring — so'mda!",
        benefit: "Qaysi tovar foyda, qaysi zarar — aniq raqamlar bilan ishlang.",
        example: "💰 WB'dagi kofta: sotish 120K, foyda atigi 8K so'm ekan.",
        stats: "📊 CBU.uz kursida"
      },
      {
        icon: "shield",
        title: "Min narx himoyasi",
        desc: "Narx minimal chegaradan pastga tushsa, tizim ogohlantiriladi.",
        benefit: "Aksiya vaqtida zarar ko'rmasligingiz kafolatlanadi.",
        example: "🛡 Tannarx + komissiya + logistika = Min narx avtomatik hisoblanadi.",
        stats: "🔒 Individual hisob"
      },
      {
        icon: "trending",
        title: "ABC-analiz va WB analitika",
        desc: "Qaysi tovarlar bestseller? Qaysilari kapital band qilmoqda?",
        benefit: "Zarar keltiruvchi tovarlarni toping, foydalilarni ko'paytiring.",
        example: "📈 300 ta tovardan 40 tasi 80% daromad keltirmoqda.",
        stats: "📊 Pareto 20/80"
      },
      {
        icon: "inventory",
        title: "Qoldiq sinxronizatsiya",
        desc: "Barcha marketplace'lardagi zaxirani real vaqtda sinxronlashtiring.",
        benefit: "Overselling muammosi hal bo'ladi.",
        example: "📦 WB'da 3 dona qoldi — Uzumda ham avtomatik 3 ga yangilanadi.",
        stats: "🔄 Real vaqtda"
      },
      {
        icon: "rocket",
        title: "WB reklama va boshqa asboblar",
        desc: "Reklama, sharhlar, MXIK kodlari, hisobotlar — barchasi bitta joyda.",
        benefit: "Alohida xizmatlar sotib olish shart emas.",
        example: "💬 Salbiy sharhga 1 daqiqada javob bering. MXIK kodni 5 soniyada toping.",
        stats: "🧰 20+ asbob"
      },
    ],
    pricing: {
      title: "Tariflar",
      pro: "Asosiy tarif",
      proPrice: "99,000 so'm/oy",
      proDesc: "Aktivatsiya + bepul funksiyalar. AI xizmatlar balansdan.",
      proCommission: "Komissiya 0%",
      enterprise: "Premium",
      enterprisePrice: "1,270,000 so'm/oy",
      enterpriseDesc: "Bepul aktivatsiya + AI xizmatlariga 40% chegirma",
      enterpriseCommission: "Komissiya 0%",
      whyWorth: "Nima uchun arziydi?",
      savings: [
        "1 kunlik bepul sinov — hech narsa to'lamaysiz",
        "Kuniga 3-4 soat tejash = oyiga $1,500+",
        "AI kartochka — 10x tezroq tovar qo'shish",
        "20+ asbob bitta platformada",
      ]
    }
  },
  ru: {
    welcome: "Добро пожаловать в SellerCloudX!",
    subtitle: "Платформа #1 для автоматизации маркетплейсов",
    startGuide: "Начать обзор",
    skipToActivate: "Сразу активировать",
    next: "Далее",
    prev: "Назад",
    activateNow: "Начать сейчас",
    payAndActivate: "Начать бесплатно (1 день)",
    step: "шаг",
    of: "/",
    finalTitle: "Готово! Давайте начнём 🚀",
    finalDesc: "1 день бесплатного пробного периода — оплата не требуется",
    activateOption1Title: "🚀 Начните бесплатно прямо сейчас",
    activateOption1Desc: "1 день бесплатного пробного периода. Все основные функции открыты. После — 99,000 сум/мес активация.",
    features: [
      {
        icon: "globe",
        title: "4 маркетплейса — 1 дашборд",
        desc: "Uzum, WB, Yandex и Ozon — всё с одного экрана.",
        benefit: "Забудьте о входе в каждый маркетплейс отдельно.",
        example: "🏪 500 товаров — просматривайте, меняйте цены, проверяйте остатки.",
        stats: "⏱ Экономия 3-4 часа/день"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro",
        desc: "Сфотографируйте товар — ИИ создаст карточку автоматически.",
        benefit: "30 секунд вместо 30 минут.",
        example: "📸 Фото коробки → карточка 'Samsung Galaxy A54, 128GB' готова.",
        stats: "🤖 Точность 95%"
      },
      {
        icon: "copy",
        title: "Клонирование карточек",
        desc: "Скопируйте карточку с Uzum на WB и Yandex автоматически.",
        benefit: "Создайте один раз — ИИ перенесёт на все площадки.",
        example: "📋 200 товаров на WB одной кнопкой.",
        stats: "⚡ 200 товаров за 5 минут"
      },
      {
        icon: "chart",
        title: "Финансовый анализ",
        desc: "Доход, расход, прибыль по каждому товару — в сумах!",
        benefit: "Точные цифры вместо догадок.",
        example: "💰 Кофта на WB: продажа 120K, прибыль всего 8K сум.",
        stats: "📊 Курс ЦБ РУз"
      },
      {
        icon: "shield",
        title: "Защита мин. цены",
        desc: "Если цена упадёт ниже минимума — вы будете предупреждены.",
        benefit: "Гарантия от убытков при акциях и демпинге.",
        example: "🛡 Себестоимость + комиссия + логистика = мин. цена.",
        stats: "🔒 Индивидуальный расчёт"
      },
      {
        icon: "trending",
        title: "ABC-анализ и аналитика WB",
        desc: "Бестселлеры vs замороженный капитал.",
        benefit: "Оптимизируйте ассортимент.",
        example: "📈 40 из 300 товаров = 80% дохода.",
        stats: "📊 Правило Парето"
      },
      {
        icon: "inventory",
        title: "Синхронизация остатков",
        desc: "Запасы на всех площадках в реальном времени.",
        benefit: "Проблема оверселлинга решена.",
        example: "📦 3 шт на WB → автоматически 3 на Uzum и Yandex.",
        stats: "🔄 Реальное время"
      },
      {
        icon: "rocket",
        title: "Реклама WB и инструменты",
        desc: "Реклама, отзывы, МХИК коды, отчёты — всё в одном месте.",
        benefit: "Не нужно покупать отдельные сервисы.",
        example: "💬 Ответ на отзыв за 1 мин. МХИК код за 5 сек.",
        stats: "🧰 20+ инструментов"
      },
    ],
    pricing: {
      title: "Тарифы",
      pro: "Базовый тариф",
      proPrice: "99,000 сум/мес",
      proDesc: "Активация + бесплатные функции. AI услуги с баланса.",
      proCommission: "Комиссия 0%",
      enterprise: "Premium",
      enterprisePrice: "1,270,000 сум/мес",
      enterpriseDesc: "Бесплатная активация + скидка 40% на AI услуги",
      enterpriseCommission: "Комиссия 0%",
      whyWorth: "Почему это выгодно?",
      savings: [
        "1 день бесплатного пробного периода",
        "Экономия 3-4 часа в день = $1,500+/мес",
        "AI карточки — товары в 10x быстрее",
        "20+ инструментов в одной платформе",
      ]
    }
  },
  en: {
    welcome: "Welcome to SellerCloudX!",
    subtitle: "#1 marketplace automation platform",
    startGuide: "Start guide",
    skipToActivate: "Skip to activation",
    next: "Next",
    prev: "Back",
    activateNow: "Start now",
    payAndActivate: "Start free (1-day trial)",
    step: "step",
    of: "/",
    finalTitle: "Ready! Let's go 🚀",
    finalDesc: "1-day free trial — no payment required",
    activateOption1Title: "🚀 Start free right now",
    activateOption1Desc: "1-day free trial. All basic features unlocked. After trial: 99,000 UZS/month activation.",
    features: [
      {
        icon: "globe",
        title: "4 marketplaces — 1 dashboard",
        desc: "Uzum, WB, Yandex, Ozon — all from one screen.",
        benefit: "No more logging into each marketplace separately.",
        example: "🏪 500 products — view, price, stock check in one place.",
        stats: "⏱ Save 3-4 hours daily"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro",
        desc: "Photo a product — AI creates the full card automatically.",
        benefit: "30 seconds instead of 30 minutes.",
        example: "📸 Photo a phone box → 'Samsung Galaxy A54, 128GB' card ready.",
        stats: "🤖 95% accuracy"
      },
      {
        icon: "copy",
        title: "Card cloning",
        desc: "Copy cards from Uzum to WB and Yandex automatically.",
        benefit: "Create once — AI copies to all platforms.",
        example: "📋 200 products to WB with 1 button.",
        stats: "⚡ 200 products in 5 min"
      },
      {
        icon: "chart",
        title: "Financial analysis",
        desc: "Revenue, costs, profit per product — in UZS!",
        benefit: "Real numbers, not guesses.",
        example: "💰 Hoodie on WB: sells 120K, profit only 8K UZS.",
        stats: "📊 Real-time CBU.uz rate"
      },
      {
        icon: "shield",
        title: "Min price protection",
        desc: "If price drops below minimum — you'll be warned.",
        benefit: "Loss prevention during promos and price wars.",
        example: "🛡 Cost + commission + logistics = auto min price.",
        stats: "🔒 Per-product calculation"
      },
      {
        icon: "trending",
        title: "ABC analysis & WB analytics",
        desc: "Bestsellers vs frozen capital.",
        benefit: "Optimize your assortment.",
        example: "📈 40 of 300 products = 80% revenue.",
        stats: "📊 Pareto 20/80"
      },
      {
        icon: "inventory",
        title: "Stock sync",
        desc: "Inventory across all marketplaces in real time.",
        benefit: "Overselling problem solved.",
        example: "📦 3 left on WB → auto 3 on Uzum & Yandex.",
        stats: "🔄 Real-time sync"
      },
      {
        icon: "rocket",
        title: "WB ads & more tools",
        desc: "Ads, reviews, MXIK codes, reports — all in one place.",
        benefit: "No need for separate services.",
        example: "💬 Reply to review in 1 min. MXIK code in 5 sec.",
        stats: "🧰 20+ tools"
      },
    ],
    pricing: {
      title: "Pricing",
      pro: "Pro plan",
      proPrice: "$499/mo",
      proDesc: "For small & medium businesses",
      proCommission: "+ 4% of sales",
      enterprise: "Enterprise",
      enterprisePrice: "Custom",
      enterpriseDesc: "For large companies",
      enterpriseCommission: "+ 2% of sales",
      whyWorth: "Why it's worth it?",
      savings: [
        "Save 3-4 hours daily = $1,500+/month",
        "Find loss-making products = $2,000+/month",
        "Solve overselling — fewer returns",
        "AI cards — 10x faster product listing",
      ]
    }
  }
};

const featureIcons: Record<string, any> = {
  globe: Globe,
  scan: Scan,
  copy: Copy,
  chart: BarChart3,
  shield: Shield,
  trending: TrendingUp,
  inventory: RefreshCw,
  rocket: Rocket,
};

const marketplaceKeys = ['uzum', 'wildberries', 'yandex', 'ozon'];

export function OnboardingWizard({ onActivate, onContactAdmin, onGoHome }: OnboardingWizardProps) {
  const { language } = useLanguage();
  const lang = (language || 'uz') as 'uz' | 'ru' | 'en';
  const t = content[lang] || content.uz;
  const [step, setStep] = useState(0);
  
  const totalSteps = t.features.length + 2;

  const renderWelcome = () => (
    <div className="text-center flex flex-col justify-between" style={{ height: 'calc(100dvh - 6rem)' }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-xl shadow-primary/30">
            <Crown className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-primary via-primary/80 to-amber-500 bg-clip-text text-transparent">
            {t.welcome}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
          {marketplaceKeys.map((mp) => (
            <div key={mp} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-muted/50 border border-border/50">
              <MarketplaceLogo marketplace={mp} size={28} />
              <span className="text-[10px] font-medium">{MARKETPLACE_CONFIG[mp]?.name || mp}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        <Button size="lg" className="w-full gap-2" onClick={() => setStep(1)}>
          {t.startGuide} <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep(totalSteps)}>
          {t.skipToActivate} →
        </Button>
        {onGoHome && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onGoHome}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {lang === 'uz' ? 'Bosh sahifaga qaytish' : lang === 'ru' ? 'На главную' : 'Back to home'}
          </Button>
        )}
      </div>
    </div>
  );

  const renderFeature = (featureIndex: number) => {
    const feature = t.features[featureIndex];
    if (!feature) return null;
    const IconComponent = featureIcons[feature.icon] || Sparkles;

    return (
      <div className="flex flex-col justify-between" style={{ height: 'calc(100dvh - 6rem)' }}>
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Progress */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{step} {t.of} {totalSteps}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} className={cn(
                  "h-1 rounded-full transition-all",
                  i + 1 === step ? "w-5 bg-primary" : i + 1 < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
                )} />
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-base font-bold leading-tight">{feature.title}</h2>
          </div>
          
          <p className="text-sm text-muted-foreground leading-snug">{feature.desc}</p>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 space-y-2">
              <div>
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Star className="h-3 w-3" /> {lang === 'uz' ? 'Foyda' : lang === 'ru' ? 'Выгода' : 'Benefit'}
                </p>
                <p className="text-xs mt-0.5">{feature.benefit}</p>
              </div>
              <div className="border-t border-primary/10 pt-2">
                <p className="text-xs">{feature.example}</p>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {feature.stats}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 pt-2 pb-2">
          <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> {t.prev}
          </Button>
          <Button size="sm" className="flex-1 gap-1" onClick={() => setStep(step + 1)}>
            {t.next} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderPricing = () => (
    <div className="flex flex-col justify-between" style={{ height: 'calc(100dvh - 6rem)' }}>
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Progress */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{totalSteps - 1} {t.of} {totalSteps}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={cn(
                "h-1 rounded-full transition-all",
                i + 1 === totalSteps - 1 ? "w-5 bg-primary" : i + 1 < totalSteps - 1 ? "w-2 bg-primary/50" : "w-2 bg-muted"
              )} />
            ))}
          </div>
        </div>

        <h2 className="text-lg font-bold text-center">{t.pricing.title}</h2>

        <div className="grid gap-2">
          <Card className="border-2 border-primary/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-bl-lg">
              ⭐ {lang === 'uz' ? 'Tavsiya' : lang === 'ru' ? 'Рекомендуем' : 'Recommended'}
            </div>
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold">{t.pricing.pro}</h3>
                  <p className="text-[10px] text-muted-foreground">{t.pricing.proDesc}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-primary">{t.pricing.proPrice}</div>
                  <div className="text-[10px] text-muted-foreground">{t.pricing.proCommission}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold">{t.pricing.enterprise}</h3>
                  <p className="text-[10px] text-muted-foreground">{t.pricing.enterpriseDesc}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold">{t.pricing.enterprisePrice}</div>
                  <div className="text-[10px] text-muted-foreground">{t.pricing.enterpriseCommission}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3">
            <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4" /> {t.pricing.whyWorth}
            </h4>
            <ul className="space-y-1">
              {t.pricing.savings.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 pt-2 pb-2">
        <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> {t.prev}
        </Button>
        <Button size="sm" className="flex-1 gap-1" onClick={() => setStep(step + 1)}>
          {t.activateNow} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const renderActivation = () => (
    <div className="flex flex-col justify-between text-center" style={{ height: 'calc(100dvh - 6rem)' }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center shadow-lg">
          <Rocket className="h-7 w-7 text-white" />
        </div>
        
        <div>
          <h2 className="text-xl font-extrabold">{t.finalTitle}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t.finalDesc}</p>
        </div>

        <div className="space-y-2 w-full text-left">
          <Card className="border-2 border-primary/30 active:scale-[0.98] transition-transform cursor-pointer" onClick={onActivate}>
            <CardContent className="p-3">
              <h3 className="font-bold text-sm">{t.activateOption1Title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.activateOption1Desc}</p>
              <Button className="w-full mt-2 gap-1" size="sm">
                {t.payAndActivate} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="active:scale-[0.98] transition-transform cursor-pointer" onClick={onContactAdmin}>
            <CardContent className="p-3">
              <h3 className="font-bold text-sm">{t.activateOption2Title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.activateOption2Desc}</p>
              <Button variant="outline" className="w-full mt-2 gap-1" size="sm" asChild>
                <a href="https://t.me/sellercloudx_support" target="_blank" rel="noopener">
                  {t.contactAdmin} <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Button variant="ghost" size="sm" className="mb-2" onClick={() => setStep(0)}>
        ← {lang === 'uz' ? "Qo'llanmaga qaytish" : lang === 'ru' ? 'Вернуться к обзору' : 'Back to guide'}
      </Button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-2">
      {step === 0 && renderWelcome()}
      {step >= 1 && step <= t.features.length && renderFeature(step - 1)}
      {step === t.features.length + 1 && renderPricing()}
      {step >= totalSteps && renderActivation()}
    </div>
  );
}
