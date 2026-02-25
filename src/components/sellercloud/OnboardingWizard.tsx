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

interface OnboardingWizardProps {
  onActivate: () => void;
  onContactAdmin: () => void;
}

const content = {
  uz: {
    welcome: "SellerCloudX ga xush kelibsiz!",
    subtitle: "O'zbekistonning #1 marketplace avtomatizatsiya platformasi",
    startGuide: "Qo'llanmani boshlash",
    skipToActivate: "To'g'ridan-to'g'ri aktivlashtirish",
    next: "Keyingi",
    prev: "Oldingi",
    activateNow: "Hoziroq aktivlashtirish",
    contactAdmin: "Admin bilan bog'lanish",
    payAndActivate: "To'lab aktivlashtirish",
    step: "qadam",
    of: "/",
    finalTitle: "Tayyor! Keling boshlaymiz 🚀",
    finalDesc: "Akkauntingizni aktivlashtiring va barcha imkoniyatlardan foydalaning",
    activateOption1Title: "💳 To'lov qilib aktivlashtirish",
    activateOption1Desc: "Click yoki Uzum Bank orqali to'lov qiling — akkaunt avtomatik aktivlashadi. Daqiqalar ichida ishlay boshlaysiz!",
    activateOption2Title: "📞 Admin bilan bog'lanish",
    activateOption2Desc: "Telegram orqali admin bilan bog'laning — u akkauntingizni aktivlashtiradi va barcha savollaringizga javob beradi.",
    telegramLink: "@sellercloudx_support",
    features: [
      {
        icon: "globe",
        title: "4 ta marketplace — 1 ta dashboard",
        desc: "Uzum Market, Wildberries, Yandex Market va Ozon — hammasi bitta ekrandan boshqariladi.",
        benefit: "Har bir marketplace uchun alohida kirish, parol eslab qolish, alohida-alohida tekshirish — bularning barchasi ortda qoldi.",
        example: "🏪 Misol: 500 ta tovaringiz bor. Barchasini bir joyda ko'ring, narxini o'zgartiring, qoldiqni tekshiring — har bir marketplace'ga alohida kirmay.",
        stats: "⏱ Kuniga 3-4 soat vaqtingizni tejaysiz"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro — sun'iy intellekt yordamchisi",
        desc: "Tovar rasmini surating yoki yuklang — AI tovarni taniydi, nom, tavsif, kategoriya va narxni avtomatik tayyorlaydi.",
        benefit: "Yangi tovar qo'shish endi 30 daqiqa emas, 30 soniya. AI siz uchun hamma narsani yozib beradi.",
        example: "📸 Misol: Telefon qutisini suratga oling — AI 'Samsung Galaxy A54, 128GB, Qora' deb tovarni to'liq kartochkasini yaratib beradi.",
        stats: "🤖 95% aniqlik bilan tovar tanish"
      },
      {
        icon: "copy",
        title: "Kartochka klonlash — bir marta yozib, hammaga tarqating",
        desc: "Uzumdagi tovar kartochkasini Wildberries va Yandex'ga avtomatik ko'chiring. Yoki aksincha.",
        benefit: "Har bir marketplace uchun qayta-qayta yozmasdan, bir marta yarating — qolganlarga AI ko'chirib beradi.",
        example: "📋 Misol: Uzumda 200 ta tovar bor. Barchasini 1 tugma bilan WB ga ko'chiring — tavsif, rasm, kategoriya barchasi tayyor.",
        stats: "⚡ 200 ta tovarni 5 daqiqada klonlang"
      },
      {
        icon: "chart",
        title: "Moliyaviy tahlil — har bir tiyin nazoratda",
        desc: "Har bir tovar bo'yicha daromad, xarajat, foyda, komissiya va logistika narxini ko'ring. Rublda emas — so'mda!",
        benefit: "Qaysi tovar foyda keltirmoqda, qaysi zarar? Endi taxmin emas, aniq raqamlar bilan ishlaysiz.",
        example: "💰 Misol: WB'dagi kofta 120,000 so'mga sotilmoqda, lekin logistika + komissiyadan keyin foyda atigi 8,000 so'm ekan. Siz buni faqat bizda ko'rasiz.",
        stats: "📊 Real vaqtda CBU.uz kursida"
      },
      {
        icon: "shield",
        title: "Min narx himoyasi — zarar qilmaslik kafolati",
        desc: "Tizim avtomatik hisoblaydi: agar narx belgilangan minimal chegaradan pastga tushsa, sizni ogohlantiriladi.",
        benefit: "Aksiya vaqtida yoki raqobatchilar narx tushirganda zarar ko'rmasligingiz kafolatlanadi.",
        example: "🛡 Misol: Tannarx 50,000 + WB komissiya 15% + logistika 8,000 = Min narx 66,500 so'm. Bundan past narx qo'yib bo'lmaydi.",
        stats: "🔒 Har bir tovar uchun individual hisob"
      },
      {
        icon: "trending",
        title: "ABC-analiz va WB analitikasi",
        desc: "Qaysi tovarlar A-toifadagi eng ko'p sotuvchilar? Qaysilari C-toifaga tushib, kapital band qilmoqda? WB'dan to'liq analitika.",
        benefit: "Assortimentni optimallashtiring — zarar keltiruvchi tovarlarni olib tashlang, foydali tovarlarni ko'paytiring.",
        example: "📈 Misol: 300 ta tovardan 40 tasi 80% daromad keltirmoqda. Qolgan 260 tasini optimallashtiring yoki olib tashlang.",
        stats: "📊 Pareto qoidasi — 20/80 analizi"
      },
      {
        icon: "inventory",
        title: "Qoldiq sinxronizatsiya va narx boshqarish",
        desc: "Barcha marketplace'lardagi zaxirani real vaqtda sinxronlashtiring. Narxni bir joydan barchaga o'zgartiring.",
        benefit: "Tovar tugab qolgan marketplace'da buyurtma qabul qilmaslik — overselling muammosi hal bo'ladi.",
        example: "📦 Misol: WB'da telefon 3 dona qoldi. Uzum va Yandex'da ham avtomatik 3 ga yangilanadi.",
        stats: "🔄 Real vaqtda sinxronizatsiya"
      },
      {
        icon: "rocket",
        title: "WB reklama, sharhlar va boshqa asboblar",
        desc: "WB reklama kampaniyalarini boshqaring, mijozlar sharhlariga javob bering, MXIK kodlarini toping, hisobotlar eksport qiling.",
        benefit: "Barcha asboblar bitta joyda — alohida-alohida xizmatlar sotib olishingiz shart emas.",
        example: "💬 Misol: Salbiy sharhga 1 daqiqada javob bering. Reklama byudjetini optimallashtiring. MXIK kodni 5 soniyada toping.",
        stats: "🧰 20+ professional asbob"
      },
    ],
    pricing: {
      title: "Narxlar — investitsiya, xarajat emas",
      pro: "Pro tarif",
      proPrice: "$499/oy",
      proDesc: "Kichik va o'rta biznes uchun ideal",
      proCommission: "+ savdodan 4%",
      enterprise: "Enterprise",
      enterprisePrice: "Individual",
      enterpriseDesc: "Yirik kompaniyalar uchun",
      enterpriseCommission: "+ savdodan 2%",
      whyWorth: "Nima uchun arziydi?",
      savings: [
        "Kuniga 3-4 soat ish vaqtini tejaysiz = oyiga $1,500+ tejash",
        "Zarar keltiruvchi tovarlarni topib, oyiga $2,000+ saqlaysiz",
        "Overselling muammosi hal bo'lib, qaytarishlar kamayadi",
        "AI kartochka yaratish — 10x tezroq yangi tovar qo'shish",
      ]
    }
  },
  ru: {
    welcome: "Добро пожаловать в SellerCloudX!",
    subtitle: "Платформа #1 для автоматизации маркетплейсов в Узбекистане",
    startGuide: "Начать обзор",
    skipToActivate: "Сразу активировать",
    next: "Далее",
    prev: "Назад",
    activateNow: "Активировать сейчас",
    contactAdmin: "Связаться с админом",
    payAndActivate: "Оплатить и активировать",
    step: "шаг",
    of: "/",
    finalTitle: "Готово! Давайте начнём 🚀",
    finalDesc: "Активируйте аккаунт и пользуйтесь всеми возможностями",
    activateOption1Title: "💳 Активация через оплату",
    activateOption1Desc: "Оплатите через Click или Uzum Bank — аккаунт активируется автоматически. Начнёте работать за минуты!",
    activateOption2Title: "📞 Связаться с админом",
    activateOption2Desc: "Свяжитесь с админом в Telegram — он активирует ваш аккаунт и ответит на все вопросы.",
    telegramLink: "@sellercloudx_support",
    features: [
      {
        icon: "globe",
        title: "4 маркетплейса — 1 дашборд",
        desc: "Uzum Market, Wildberries, Yandex Market и Ozon — всё управляется с одного экрана.",
        benefit: "Забудьте о входе в каждый маркетплейс отдельно, запоминании паролей и ручной проверке.",
        example: "🏪 Пример: У вас 500 товаров. Просматривайте все, меняйте цены, проверяйте остатки — без входа в каждый маркетплейс.",
        stats: "⏱ Экономия 3-4 часа в день"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro — помощник на основе ИИ",
        desc: "Сфотографируйте товар — ИИ распознает его, создаст название, описание, категорию и цену.",
        benefit: "Добавление нового товара теперь не 30 минут, а 30 секунд.",
        example: "📸 Пример: Сфотографируйте коробку телефона — ИИ создаст карточку 'Samsung Galaxy A54, 128GB, Чёрный'.",
        stats: "🤖 Точность распознавания 95%"
      },
      {
        icon: "copy",
        title: "Клонирование карточек — создай один раз, распространи везде",
        desc: "Скопируйте карточку товара с Uzum на WB и Yandex автоматически. Или наоборот.",
        benefit: "Не пишите заново для каждого маркетплейса — ИИ перенесёт всё автоматически.",
        example: "📋 Пример: 200 товаров на Uzum. Скопируйте все на WB одной кнопкой — описание, фото, категории готовы.",
        stats: "⚡ 200 товаров за 5 минут"
      },
      {
        icon: "chart",
        title: "Финансовый анализ — каждый тийин под контролем",
        desc: "Доход, расход, прибыль, комиссия и логистика по каждому товару. Не в рублях — в сумах!",
        benefit: "Какой товар приносит прибыль, а какой убыток? Теперь не догадки, а точные цифры.",
        example: "💰 Пример: Кофта на WB продаётся за 120,000 сум, но после логистики + комиссии прибыль всего 8,000 сум.",
        stats: "📊 Курс ЦБ РУз в реальном времени"
      },
      {
        icon: "shield",
        title: "Защита минимальной цены — гарантия от убытков",
        desc: "Система автоматически рассчитает: если цена упадёт ниже минимума — вы будете предупреждены.",
        benefit: "Во время акций или при демпинге конкурентов вы не уйдёте в убыток.",
        example: "🛡 Пример: Себестоимость 50,000 + комиссия WB 15% + логистика 8,000 = Мин. цена 66,500 сум.",
        stats: "🔒 Индивидуальный расчёт для каждого товара"
      },
      {
        icon: "trending",
        title: "ABC-анализ и аналитика WB",
        desc: "Какие товары в группе A — бестселлеры? Какие в C — замораживают капитал? Полная аналитика WB.",
        benefit: "Оптимизируйте ассортимент — уберите убыточные товары, увеличьте прибыльные.",
        example: "📈 Пример: Из 300 товаров 40 приносят 80% дохода. Оптимизируйте остальные 260.",
        stats: "📊 Анализ по правилу Парето 20/80"
      },
      {
        icon: "inventory",
        title: "Синхронизация остатков и управление ценами",
        desc: "Синхронизируйте запасы на всех маркетплейсах в реальном времени. Меняйте цену из одного места.",
        benefit: "Проблема оверселлинга решена — больше не принимаете заказы на товар, которого нет.",
        example: "📦 Пример: На WB осталось 3 телефона. На Uzum и Yandex тоже автоматически станет 3.",
        stats: "🔄 Синхронизация в реальном времени"
      },
      {
        icon: "rocket",
        title: "Реклама WB, отзывы и другие инструменты",
        desc: "Управляйте рекламой на WB, отвечайте на отзывы, находите МХИК коды, экспортируйте отчёты.",
        benefit: "Все инструменты в одном месте — не нужно покупать отдельные сервисы.",
        example: "💬 Пример: Ответьте на негативный отзыв за 1 минуту. Оптимизируйте рекламный бюджет. Найдите МХИК код за 5 секунд.",
        stats: "🧰 20+ профессиональных инструментов"
      },
    ],
    pricing: {
      title: "Цены — это инвестиция, не расход",
      pro: "Тариф Pro",
      proPrice: "$499/мес",
      proDesc: "Идеален для малого и среднего бизнеса",
      proCommission: "+ 4% от продаж",
      enterprise: "Enterprise",
      enterprisePrice: "Индивидуально",
      enterpriseDesc: "Для крупных компаний",
      enterpriseCommission: "+ 2% от продаж",
      whyWorth: "Почему это выгодно?",
      savings: [
        "Экономия 3-4 часа рабочего времени в день = $1,500+/мес",
        "Выявление убыточных товаров = экономия $2,000+/мес",
        "Решение проблемы оверселлинга — меньше возвратов",
        "ИИ карточки — добавление товаров в 10x быстрее",
      ]
    }
  },
  en: {
    welcome: "Welcome to SellerCloudX!",
    subtitle: "Uzbekistan's #1 marketplace automation platform",
    startGuide: "Start guide",
    skipToActivate: "Skip to activation",
    next: "Next",
    prev: "Previous",
    activateNow: "Activate now",
    contactAdmin: "Contact admin",
    payAndActivate: "Pay & activate",
    step: "step",
    of: "/",
    finalTitle: "Ready! Let's get started 🚀",
    finalDesc: "Activate your account and unlock all features",
    activateOption1Title: "💳 Pay to activate",
    activateOption1Desc: "Pay via Click or Uzum Bank — your account activates automatically. Start working in minutes!",
    activateOption2Title: "📞 Contact admin",
    activateOption2Desc: "Reach out to admin via Telegram — they'll activate your account and answer all your questions.",
    telegramLink: "@sellercloudx_support",
    features: [
      {
        icon: "globe",
        title: "4 marketplaces — 1 dashboard",
        desc: "Uzum Market, Wildberries, Yandex Market, and Ozon — all managed from one screen.",
        benefit: "No more logging into each marketplace separately, remembering passwords, or manual checking.",
        example: "🏪 Example: You have 500 products. View all, change prices, check stock — without entering each marketplace.",
        stats: "⏱ Save 3-4 hours daily"
      },
      {
        icon: "scan",
        title: "AI Scanner Pro — your AI assistant",
        desc: "Take a photo of any product — AI recognizes it, creates title, description, category and price.",
        benefit: "Adding a new product is now 30 seconds, not 30 minutes. AI writes everything for you.",
        example: "📸 Example: Photo a phone box — AI creates 'Samsung Galaxy A54, 128GB, Black' complete card.",
        stats: "🤖 95% recognition accuracy"
      },
      {
        icon: "copy",
        title: "Card cloning — create once, distribute everywhere",
        desc: "Copy product cards from Uzum to WB and Yandex automatically. Or vice versa.",
        benefit: "Don't rewrite for each marketplace — AI copies everything automatically.",
        example: "📋 Example: 200 products on Uzum. Copy all to WB with 1 button — descriptions, images, categories ready.",
        stats: "⚡ Clone 200 products in 5 minutes"
      },
      {
        icon: "chart",
        title: "Financial analysis — every tiyin tracked",
        desc: "Revenue, costs, profit, commission and logistics per product. Not in rubles — in UZS!",
        benefit: "Which products are profitable? Which are losing money? Real numbers, not guesses.",
        example: "💰 Example: A hoodie on WB sells for 120,000 UZS, but after logistics + commission profit is only 8,000 UZS.",
        stats: "📊 Real-time CBU.uz exchange rate"
      },
      {
        icon: "shield",
        title: "Min price protection — loss prevention guarantee",
        desc: "System auto-calculates: if price drops below minimum — you'll be warned.",
        benefit: "During promotions or competitor price wars, you won't go into loss.",
        example: "🛡 Example: Cost 50,000 + WB commission 15% + logistics 8,000 = Min price 66,500 UZS.",
        stats: "🔒 Individual calculation per product"
      },
      {
        icon: "trending",
        title: "ABC analysis and WB analytics",
        desc: "Which products are A-group bestsellers? Which C-group items freeze capital? Full WB analytics.",
        benefit: "Optimize assortment — remove loss-making products, scale profitable ones.",
        example: "📈 Example: Of 300 products, 40 generate 80% of revenue. Optimize the other 260.",
        stats: "📊 Pareto principle 20/80 analysis"
      },
      {
        icon: "inventory",
        title: "Stock sync and price management",
        desc: "Sync inventory across all marketplaces in real time. Change prices from one place.",
        benefit: "Overselling problem solved — no more accepting orders for out-of-stock items.",
        example: "📦 Example: 3 phones left on WB. Uzum and Yandex auto-update to 3 as well.",
        stats: "🔄 Real-time synchronization"
      },
      {
        icon: "rocket",
        title: "WB ads, reviews and more tools",
        desc: "Manage WB ad campaigns, reply to reviews, find MXIK codes, export reports.",
        benefit: "All tools in one place — no need to buy separate services.",
        example: "💬 Example: Reply to a negative review in 1 minute. Optimize ad budget. Find MXIK code in 5 seconds.",
        stats: "🧰 20+ professional tools"
      },
    ],
    pricing: {
      title: "Pricing — an investment, not an expense",
      pro: "Pro plan",
      proPrice: "$499/mo",
      proDesc: "Perfect for small and medium businesses",
      proCommission: "+ 4% of sales",
      enterprise: "Enterprise",
      enterprisePrice: "Custom",
      enterpriseDesc: "For large companies",
      enterpriseCommission: "+ 2% of sales",
      whyWorth: "Why it's worth it?",
      savings: [
        "Save 3-4 hours daily = $1,500+/month savings",
        "Find loss-making products = save $2,000+/month",
        "Solve overselling — fewer returns",
        "AI cards — add products 10x faster",
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

export function OnboardingWizard({ onActivate, onContactAdmin }: OnboardingWizardProps) {
  const { language } = useLanguage();
  const lang = (language || 'uz') as 'uz' | 'ru' | 'en';
  const t = content[lang] || content.uz;
  const [step, setStep] = useState(0); // 0 = welcome, 1-8 = features, 9 = pricing, 10 = activate
  
  const totalSteps = t.features.length + 2; // features + pricing + activate

  const renderWelcome = () => (
    <div className="text-center space-y-8 py-6">
      <div className="relative">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/30 animate-pulse">
          <Crown className="h-12 w-12 text-primary-foreground" />
        </div>
        <div className="absolute -top-2 -right-2 left-1/2 ml-8">
          <Badge className="bg-amber-500 text-white text-xs animate-bounce">NEW</Badge>
        </div>
      </div>
      
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary via-primary/80 to-amber-500 bg-clip-text text-transparent">
          {t.welcome}
        </h1>
        <p className="text-lg text-muted-foreground mt-3 max-w-md mx-auto">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
        {[
          { icon: Globe, label: "Uzum" },
          { icon: Globe, label: "Wildberries" },
          { icon: Globe, label: "Yandex" },
          { icon: Globe, label: "Ozon" },
        ].map((mp, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <mp.icon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-medium">{mp.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <Button size="lg" className="w-full text-base gap-2" onClick={() => setStep(1)}>
          {t.startGuide}
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep(totalSteps)}>
          {t.skipToActivate} →
        </Button>
      </div>
    </div>
  );

  const renderFeature = (featureIndex: number) => {
    const feature = t.features[featureIndex];
    if (!feature) return null;
    const IconComponent = featureIcons[feature.icon] || Sparkles;

    return (
      <div className="space-y-6 py-4">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{step} {t.of} {totalSteps} {t.step}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={cn(
                "h-1.5 rounded-full transition-all",
                i + 1 === step ? "w-6 bg-primary" : i + 1 < step ? "w-3 bg-primary/50" : "w-3 bg-muted"
              )} />
            ))}
          </div>
        </div>

        {/* Feature card */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <IconComponent className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold leading-tight">{feature.title}</h2>
            </div>
          </div>
          
          <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>

          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Star className="h-4 w-4" /> {lang === 'uz' ? 'Foyda' : lang === 'ru' ? 'Выгода' : 'Benefit'}
                </p>
                <p className="text-sm mt-1">{feature.benefit}</p>
              </div>
              <div className="border-t border-primary/10 pt-3">
                <p className="text-sm">{feature.example}</p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {feature.stats}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> {t.prev}
          </Button>
          <Button className="flex-1 gap-1" onClick={() => setStep(step + 1)}>
            {t.next} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderPricing = () => (
    <div className="space-y-6 py-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalSteps - 1} {t.of} {totalSteps} {t.step}</span>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all",
              i + 1 === totalSteps - 1 ? "w-6 bg-primary" : i + 1 < totalSteps - 1 ? "w-3 bg-primary/50" : "w-3 bg-muted"
            )} />
          ))}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center">{t.pricing.title}</h2>

      <div className="grid gap-4">
        <Card className="border-2 border-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-bl-xl">
            ⭐ {lang === 'uz' ? 'Tavsiya' : lang === 'ru' ? 'Рекомендуем' : 'Recommended'}
          </div>
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{t.pricing.pro}</h3>
                <p className="text-xs text-muted-foreground">{t.pricing.proDesc}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-primary">{t.pricing.proPrice}</div>
                <div className="text-xs text-muted-foreground">{t.pricing.proCommission}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{t.pricing.enterprise}</h3>
                <p className="text-xs text-muted-foreground">{t.pricing.enterpriseDesc}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold">{t.pricing.enterprisePrice}</div>
                <div className="text-xs text-muted-foreground">{t.pricing.enterpriseCommission}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-5">
          <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
            <Award className="h-5 w-5" /> {t.pricing.whyWorth}
          </h4>
          <ul className="space-y-2">
            {t.pricing.savings.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> {t.prev}
        </Button>
        <Button className="flex-1 gap-1" onClick={() => setStep(step + 1)}>
          {t.activateNow} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderActivation = () => (
    <div className="space-y-6 py-4 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center shadow-xl">
        <Rocket className="h-10 w-10 text-white" />
      </div>
      
      <div>
        <h2 className="text-2xl font-extrabold">{t.finalTitle}</h2>
        <p className="text-muted-foreground mt-2">{t.finalDesc}</p>
      </div>

      <div className="space-y-4 max-w-sm mx-auto text-left">
        <Card className="border-2 border-primary/30 hover:border-primary/60 transition-colors cursor-pointer" onClick={onActivate}>
          <CardContent className="p-5">
            <h3 className="font-bold text-lg">{t.activateOption1Title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.activateOption1Desc}</p>
            <Button className="w-full mt-4 gap-2" size="lg">
              {t.payAndActivate} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={onContactAdmin}>
          <CardContent className="p-5">
            <h3 className="font-bold text-lg">{t.activateOption2Title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.activateOption2Desc}</p>
            <Button variant="outline" className="w-full mt-4 gap-2" size="lg" asChild>
              <a href="https://t.me/sellercloudx_support" target="_blank" rel="noopener">
                {t.contactAdmin} <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
        ← {lang === 'uz' ? "Qo'llanmaga qaytish" : lang === 'ru' ? 'Вернуться к обзору' : 'Back to guide'}
      </Button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      {step === 0 && renderWelcome()}
      {step >= 1 && step <= t.features.length && renderFeature(step - 1)}
      {step === t.features.length + 1 && renderPricing()}
      {step >= totalSteps && renderActivation()}
    </div>
  );
}
