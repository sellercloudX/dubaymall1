import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEOHead } from '@/components/SEOHead';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, ArrowRight, CheckCircle, BarChart3, Zap, 
  Bot, DollarSign, LineChart, Clock, Users, Star, 
  ChevronRight, Crown, TrendingUp, AlertTriangle,
  Play, Sparkles, Shield, Rocket, Send
} from 'lucide-react';
import { useState, useEffect, useRef, ReactNode } from 'react';
import heroDashboard from '@/assets/hero-dashboard.png';
import abstractShapes from '@/assets/abstract-shapes.png';

// ─── Animation hooks ───
function useCountUp(end: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); } 
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, trigger]);
  return count;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function FadeInSection({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div 
      ref={ref} 
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Floating particle component ───
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div 
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30 animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Translations ───
const T = {
  uz: {
    badge: '🚀 O\'zbekistonning #1 marketplace platformasi',
    heroTitle1: 'Sotuvlaringizni',
    heroTitle2: 'avtomatlashtiramiz',
    heroTitle3: 'siz foyda olasiz.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — barchasini yagona AI-quvvatli dashboard orqali boshqaring. Kartochka yaratishdan tortib, sof foydani real-vaqtda kuzatishgacha.',
    cta: 'Bepul sinab ko\'rish',
    ctaSecondary: 'Demo ko\'rish',
    loginCta: 'Kirish',
    trusted: 'Ishonchli hamkorlar',
    statsMarketplaces: 'Marketplace',
    statsProducts: 'Sinxron mahsulot',
    statsOrders: 'Avtomatik buyurtma',
    statsTime: 'Vaqt tejash',
    featuresTitle: 'Sotuvchi uchun barcha vositalar',
    featuresSubtitle: 'bitta platformada',
    featuresDesc: 'Bozordagi eng kuchli avtomatizatsiya vositalarini birlashtirdik',
    feat1: 'Multi-marketplace',
    feat1d: 'Uzum, Yandex, WB, Ozon — bitta OAuth bilan ulang va barchani markazdan boshqaring',
    feat2: 'AI kartochka yaratish',
    feat2d: 'Rasm yuklang — AI nom, tavsif, kategoriya va SEO matnlarni avtomatik yaratadi',
    feat3: 'Real-vaqt moliya',
    feat3d: 'Har bir SKU bo\'yicha sof foyda, marja, komissiya va logistika xarajatlarini kuzating',
    feat4: 'ABC-analiz',
    feat4d: 'Mahsulotlaringizni A/B/C toifalariga ajratib, zarar keltiruvchilarni aniqlang',
    feat5: 'Smart narxlash',
    feat5d: 'Real tariflarga asoslangan avtomatik narx hisoblash va minimal narx himoyasi',
    feat6: 'Inventarizatsiya auditi',
    feat6d: 'Omborlardagi yo\'qolgan tovarlarni aniqlang va kompensatsiya talab qiling',
    howTitle: 'Qanday ishlaydi?',
    howDesc: 'Uch qadam bilan sotuvlarni avtomatlashtirishni boshlang',
    step1: 'Ro\'yxatdan o\'ting',
    step1d: '7 kunlik bepul sinov davri — bank kartasi talab qilinmaydi',
    step2: 'Marketplacelarni ulang',
    step2d: 'API kalitingizni kiriting — tizim avtomatik sinxronlashadi',
    step3: 'Foydani kuzating',
    step3d: 'Analitika, buyurtmalar va narxlarni yagona paneldan kuzating',
    pricingTitle: 'Oddiy va shaffof narxlar',
    pricingDesc: 'Yashirin to\'lovlar yo\'q. Har qanday paytda bekor qilish mumkin.',
    proPlan: 'Pro',
    proPrice: '$499',
    proFeatures: ['4 ta marketplace', 'AI kartochka yaratish', 'ABC-analiz va PnL', 'Narx optimallashtirish', 'Inventarizatsiya auditi', 'Telegram bildirishnomalar', '24/7 texnik yordam'],
    entPlan: 'Enterprise',
    entPrice: 'Kelishuv',
    entFeatures: ['Barcha Pro imkoniyatlar', 'Individual komissiya', 'API integratsiya', 'Shaxsiy menejer', 'WMS integratsiya', 'Maxsus hisobotlar'],
    perMonth: '/oyiga',
    commission: '+ 4% komissiya',
    commissionEnt: '+ 2% komissiya',
    freeTrial: '7 kunlik bepul sinov',
    startPro: 'Pro ni boshlash',
    contactSales: 'Bog\'lanish',
    testimonialsTitle: 'Sotuvchilar nima deydi?',
    t1: '"SellerCloudX bilan Uzum va Yandex\'ni bitta joydan boshqaraman. Oyiga 15+ soat tejayman."',
    t1n: 'Sardor M.', t1r: 'Elektronika sotuvchisi',
    t2: '"ABC-analiz orqali 30% zarar keltiruvchi mahsulotlarni aniqladim va assortimentni optimallashtirdim."',
    t2n: 'Nilufar R.', t2r: 'Kiyim-kechak do\'koni',
    t3: '"Inventarizatsiya auditi yordamida yo\'qolgan 47 dona mahsulot uchun kompensatsiya oldim."',
    t3n: 'Jasur T.', t3r: 'Gadget sotuvchisi',
    ctaTitle: 'Raqobatchilaringiz allaqachon avtomatlashtirilgan.',
    ctaSubtitle: 'Siz-chi?',
    ctaDesc: 'Minglab professional sotuvchilar SellerCloudX bilan sotuv samaradorligini oshirmoqda',
    ctaButton: 'Hoziroq boshlang',
    footer: 'SellerCloudX',
    footerDesc: 'Marketplace avtomatizatsiya platformasi',
    rights: 'Barcha huquqlar himoyalangan',
    privacy: 'Maxfiylik siyosati',
    terms: 'Foydalanish shartlari',
    support: 'Yordam',
    resultTitle: 'Aniq natijalar',
    resultDesc: 'Foydalanuvchilarimiz erishgan ko\'rsatkichlar',
    r1: 'Vaqt tejash', r1v: '15+ soat/oy',
    r2: 'Foyda o\'sishi', r2v: '+23%',
    r3: 'Xarajat kamaytirish', r3v: '-34%',
  },
  ru: {
    badge: '🚀 Платформа #1 для маркетплейсов Узбекистана',
    heroTitle1: 'Автоматизируем',
    heroTitle2: 'ваши продажи,',
    heroTitle3: 'вы получаете прибыль.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — управляйте всем через единый AI-дашборд. От создания карточек до отслеживания чистой прибыли в реальном времени.',
    cta: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    loginCta: 'Войти',
    trusted: 'Доверенные партнёры',
    statsMarketplaces: 'Маркетплейсов',
    statsProducts: 'Синхр. товаров',
    statsOrders: 'Авто-заказов',
    statsTime: 'Экономия времени',
    featuresTitle: 'Все инструменты для продавца',
    featuresSubtitle: 'в одной платформе',
    featuresDesc: 'Мы объединили самые мощные инструменты автоматизации на рынке',
    feat1: 'Мульти-маркетплейс',
    feat1d: 'Uzum, Yandex, WB, Ozon — подключите одним OAuth и управляйте централизованно',
    feat2: 'AI-генерация карточек',
    feat2d: 'Загрузите фото — AI создаст название, описание, категорию и SEO-тексты',
    feat3: 'Финансы реального времени',
    feat3d: 'Отслеживайте чистую прибыль, маржу, комиссии и логистику по каждому SKU',
    feat4: 'ABC-анализ',
    feat4d: 'Разделите товары на A/B/C категории и выявите убыточные позиции',
    feat5: 'Smart-ценообразование',
    feat5d: 'Автоматический расчёт цен на основе реальных тарифов и защита минимальной цены',
    feat6: 'Аудит инвентаризации',
    feat6d: 'Выявляйте потерянные товары на складах и требуйте компенсацию',
    howTitle: 'Как это работает?',
    howDesc: 'Три шага для начала автоматизации продаж',
    step1: 'Зарегистрируйтесь',
    step1d: '7 дней бесплатно — банковская карта не требуется',
    step2: 'Подключите маркетплейсы',
    step2d: 'Введите API-ключ — система синхронизируется автоматически',
    step3: 'Отслеживайте прибыль',
    step3d: 'Аналитика, заказы и цены в едином интерфейсе',
    pricingTitle: 'Простые и прозрачные цены',
    pricingDesc: 'Никаких скрытых платежей. Отмена в любое время.',
    proPlan: 'Pro',
    proPrice: '$499',
    proFeatures: ['4 маркетплейса', 'AI-генерация карточек', 'ABC-анализ и PnL', 'Оптимизация цен', 'Аудит инвентаризации', 'Telegram-уведомления', 'Поддержка 24/7'],
    entPlan: 'Enterprise',
    entPrice: 'По запросу',
    entFeatures: ['Все возможности Pro', 'Индивидуальная комиссия', 'API-интеграция', 'Персональный менеджер', 'WMS-интеграция', 'Кастомные отчёты'],
    perMonth: '/мес',
    commission: '+ 4% комиссия',
    commissionEnt: '+ 2% комиссия',
    freeTrial: '7 дней бесплатно',
    startPro: 'Начать Pro',
    contactSales: 'Связаться',
    testimonialsTitle: 'Что говорят продавцы?',
    t1: '"С SellerCloudX управляю Uzum и Yandex из одного места. Экономлю 15+ часов в месяц."',
    t1n: 'Сардор М.', t1r: 'Продавец электроники',
    t2: '"Через ABC-анализ выявил 30% убыточных товаров и оптимизировал ассортимент."',
    t2n: 'Нилуфар Р.', t2r: 'Магазин одежды',
    t3: '"Аудит инвентаризации помог получить компенсацию за 47 потерянных единиц товара."',
    t3n: 'Жасур Т.', t3r: 'Продавец гаджетов',
    ctaTitle: 'Ваши конкуренты уже автоматизированы.',
    ctaSubtitle: 'А вы?',
    ctaDesc: 'Тысячи профессиональных продавцов повышают эффективность с SellerCloudX',
    ctaButton: 'Начать сейчас',
    footer: 'SellerCloudX',
    footerDesc: 'Платформа автоматизации маркетплейсов',
    rights: 'Все права защищены',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    support: 'Поддержка',
    resultTitle: 'Реальные результаты',
    resultDesc: 'Показатели, которых достигают наши пользователи',
    r1: 'Экономия времени', r1v: '15+ ч/мес',
    r2: 'Рост прибыли', r2v: '+23%',
    r3: 'Снижение расходов', r3v: '-34%',
  },
  en: {
    badge: '🚀 #1 Marketplace Automation Platform',
    heroTitle1: 'We automate',
    heroTitle2: 'your sales,',
    heroTitle3: 'you earn profit.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — manage everything through a single AI-powered dashboard. From product card creation to real-time profit tracking.',
    cta: 'Start Free Trial',
    ctaSecondary: 'Watch Demo',
    loginCta: 'Sign In',
    trusted: 'Trusted Partners',
    statsMarketplaces: 'Marketplaces',
    statsProducts: 'Synced Products',
    statsOrders: 'Auto Orders',
    statsTime: 'Time Saved',
    featuresTitle: 'All seller tools',
    featuresSubtitle: 'in one platform',
    featuresDesc: 'We\'ve combined the most powerful automation tools on the market',
    feat1: 'Multi-Marketplace',
    feat1d: 'Uzum, Yandex, WB, Ozon — connect via OAuth and manage centrally',
    feat2: 'AI Card Generation',
    feat2d: 'Upload a photo — AI generates title, description, category, and SEO texts',
    feat3: 'Real-time Finance',
    feat3d: 'Track net profit, margin, commissions, and logistics per SKU',
    feat4: 'ABC Analysis',
    feat4d: 'Categorize products into A/B/C tiers and identify underperformers',
    feat5: 'Smart Pricing',
    feat5d: 'Auto-calculate prices based on real tariffs with minimum price protection',
    feat6: 'Inventory Audit',
    feat6d: 'Detect lost items in warehouses and claim compensation',
    howTitle: 'How It Works',
    howDesc: 'Three steps to start automating your sales',
    step1: 'Sign Up',
    step1d: '7-day free trial — no credit card required',
    step2: 'Connect Marketplaces',
    step2d: 'Enter your API key — system syncs automatically',
    step3: 'Track Profits',
    step3d: 'Analytics, orders, and pricing in one unified panel',
    pricingTitle: 'Simple, Transparent Pricing',
    pricingDesc: 'No hidden fees. Cancel anytime.',
    proPlan: 'Pro',
    proPrice: '$499',
    proFeatures: ['4 marketplaces', 'AI card generation', 'ABC Analysis & PnL', 'Price optimization', 'Inventory audit', 'Telegram notifications', '24/7 support'],
    entPlan: 'Enterprise',
    entPrice: 'Custom',
    entFeatures: ['All Pro features', 'Custom commission', 'API integration', 'Dedicated manager', 'WMS integration', 'Custom reports'],
    perMonth: '/mo',
    commission: '+ 4% commission',
    commissionEnt: '+ 2% commission',
    freeTrial: '7-day free trial',
    startPro: 'Start Pro',
    contactSales: 'Contact Sales',
    testimonialsTitle: 'What Sellers Say',
    t1: '"With SellerCloudX I manage Uzum and Yandex from one place. Saving 15+ hours monthly."',
    t1n: 'Sardor M.', t1r: 'Electronics Seller',
    t2: '"ABC analysis revealed 30% of unprofitable products. I optimized my assortment."',
    t2n: 'Nilufar R.', t2r: 'Clothing Store',
    t3: '"Inventory audit helped me claim compensation for 47 lost units."',
    t3n: 'Jasur T.', t3r: 'Gadget Seller',
    ctaTitle: 'Your competitors are already automated.',
    ctaSubtitle: 'Are you?',
    ctaDesc: 'Thousands of professional sellers boost efficiency with SellerCloudX',
    ctaButton: 'Get Started Now',
    footer: 'SellerCloudX',
    footerDesc: 'Marketplace automation platform',
    rights: 'All rights reserved',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    support: 'Support',
    resultTitle: 'Real Results',
    resultDesc: 'Metrics our users achieve',
    r1: 'Time Saved', r1v: '15+ hrs/mo',
    r2: 'Profit Growth', r2v: '+23%',
    r3: 'Cost Reduction', r3v: '-34%',
  },
};

export default function Index() {
  const { language } = useLanguage();
  const txt = T[language] || T.en;
  
  const stats = useInView();
  const c1 = useCountUp(4, 1500, stats.inView);
  const c2 = useCountUp(50000, 2000, stats.inView);
  const c3 = useCountUp(10000, 2000, stats.inView);

  const features = [
    { icon: Globe, title: txt.feat1, desc: txt.feat1d, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Bot, title: txt.feat2, desc: txt.feat2d, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10' },
    { icon: DollarSign, title: txt.feat3, desc: txt.feat3d, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: BarChart3, title: txt.feat4, desc: txt.feat4d, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { icon: TrendingUp, title: txt.feat5, desc: txt.feat5d, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10' },
    { icon: AlertTriangle, title: txt.feat6, desc: txt.feat6d, color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  const steps = [
    { num: '01', icon: Users, title: txt.step1, desc: txt.step1d },
    { num: '02', icon: Globe, title: txt.step2, desc: txt.step2d },
    { num: '03', icon: LineChart, title: txt.step3, desc: txt.step3d },
  ];

  const testimonials = [
    { text: txt.t1, name: txt.t1n, role: txt.t1r },
    { text: txt.t2, name: txt.t2n, role: txt.t2r },
    { text: txt.t3, name: txt.t3n, role: txt.t3r },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SEOHead 
        title="SellerCloudX — Marketplace Automation Platform"
        description="Manage Uzum, Yandex Market, Wildberries, Ozon from one dashboard. AI card generation, PnL analytics, price optimization."
      />

      {/* ━━━ Navigation ━━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Crown className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold font-display tracking-tight">SellerCloudX</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {language === 'uz' ? 'Imkoniyatlar' : language === 'ru' ? 'Возможности' : 'Features'}
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {txt.howTitle}
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {language === 'uz' ? 'Narxlar' : language === 'ru' ? 'Цены' : 'Pricing'}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="font-medium" asChild>
              <Link to="/auth">{txt.loginCta}</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex shadow-lg shadow-primary/20">
              <Link to="/auth?mode=register">{txt.cta}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-[100vh] flex items-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/6 rounded-full blur-[100px]" />
        <FloatingParticles />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <div className="max-w-2xl">
              <div className="animate-fade-up">
                <Badge className="mb-6 px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
                  {txt.badge}
                </Badge>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-bold tracking-tight mb-6 font-display leading-[1.1] animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <span className="text-foreground">{txt.heroTitle1}</span>
                <br />
                <span className="text-gradient">{txt.heroTitle2}</span>
                <br />
                <span className="text-foreground">{txt.heroTitle3}</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed animate-fade-up max-w-xl" style={{ animationDelay: '0.2s' }}>
                {txt.heroDesc}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
                <Button size="lg" className="text-base px-8 py-6 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all group" asChild>
                  <Link to="/auth?mode=register">
                    <Rocket className="mr-2 h-5 w-5" />
                    {txt.cta}
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8 py-6 glass" asChild>
                  <a href="#features">
                    <Play className="mr-2 h-4 w-4" />
                    {txt.ctaSecondary}
                  </a>
                </Button>
              </div>

              {/* Marketplace logos */}
              <div className="mt-12 animate-fade-up" style={{ animationDelay: '0.5s' }}>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest font-medium">{txt.trusted}</p>
                <div className="flex items-center gap-6 md:gap-8">
                  {[
                    { name: 'Uzum', color: 'text-purple-500' },
                    { name: 'Yandex', color: 'text-yellow-500' },
                    { name: 'Wildberries', color: 'text-pink-500' },
                    { name: 'Ozon', color: 'text-blue-500' },
                  ].map((mp) => (
                    <div key={mp.name} className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                      <div className={`w-2 h-2 rounded-full ${mp.color} bg-current`} />
                      <span className="text-sm font-medium text-muted-foreground">{mp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Dashboard Image */}
            <div className="relative animate-fade-up hidden lg:block" style={{ animationDelay: '0.4s' }}>
              <div className="relative">
                {/* Glow behind image */}
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
                <img 
                  src={heroDashboard} 
                  alt="SellerCloudX Dashboard" 
                  className="relative rounded-2xl shadow-2xl border border-border/30 w-full"
                  loading="eager"
                />
                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 bg-card border shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 animate-bounce-subtle">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">+23%</div>
                    <div className="text-xs text-muted-foreground">{txt.r2}</div>
                  </div>
                </div>
                {/* Floating badge 2 */}
                <div className="absolute -top-3 -right-3 bg-card border shadow-xl rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">AI</div>
                    <div className="text-xs text-muted-foreground">Powered</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile hero image */}
            <div className="relative lg:hidden animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-br from-primary/15 to-accent/15 rounded-2xl blur-xl" />
                <img 
                  src={heroDashboard} 
                  alt="SellerCloudX Dashboard" 
                  className="relative rounded-xl shadow-xl border border-border/30 w-full"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle hidden md:block">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-primary/50 animate-pulse" />
          </div>
        </div>
      </section>

      {/* ━━━ Stats Bar ━━━ */}
      <section ref={stats.ref} className="py-16 bg-muted/30 border-y relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { value: `${c1}+`, label: txt.statsMarketplaces, icon: Globe, color: 'text-primary' },
              { value: c2 >= 1000 ? `${(c2/1000).toFixed(0)}K+` : `${c2}+`, label: txt.statsProducts, icon: BarChart3, color: 'text-accent' },
              { value: c3 >= 1000 ? `${(c3/1000).toFixed(0)}K+` : `${c3}+`, label: txt.statsOrders, icon: TrendingUp, color: 'text-success' },
              { value: '15h+', label: txt.statsTime, icon: Clock, color: 'text-warning' },
            ].map((stat, i) => (
              <div key={i} className="text-center group cursor-default">
                <div className={`w-14 h-14 rounded-2xl bg-card border shadow-sm mx-auto mb-4 flex items-center justify-center group-hover:shadow-lg group-hover:scale-105 transition-all`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-foreground font-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Features ━━━ */}
      <section id="features" className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-[0.03]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px]">
          <img src={abstractShapes} alt="" className="w-full h-full object-contain opacity-20 dark:opacity-10" loading="lazy" />
        </div>
        
        <div className="container mx-auto px-4 relative">
          <FadeInSection className="text-center mb-16 md:mb-20">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              <Sparkles className="h-3 w-3 mr-1.5" />
              Features
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-3 font-display">
              {txt.featuresTitle} <span className="text-gradient">{txt.featuresSubtitle}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{txt.featuresDesc}</p>
          </FadeInSection>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {features.map((feat, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <Card className="group border shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden hover:-translate-y-2 h-full">
                  <CardContent className="p-6 md:p-8">
                    <div className={`w-14 h-14 rounded-2xl ${feat.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      <feat.icon className={`h-7 w-7 ${feat.color}`} />
                    </div>
                    <h3 className="text-lg font-bold mb-2 font-display">{feat.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feat.desc}</p>
                  </CardContent>
                </Card>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Results Banner ━━━ */}
      <section className="py-20 bg-muted/30 border-y relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
        <div className="container mx-auto px-4 relative">
          <FadeInSection className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-2">{txt.resultTitle}</h2>
            <p className="text-muted-foreground">{txt.resultDesc}</p>
          </FadeInSection>
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { label: txt.r1, value: txt.r1v, icon: Clock, color: 'text-primary' },
              { label: txt.r2, value: txt.r2v, icon: TrendingUp, color: 'text-success' },
              { label: txt.r3, value: txt.r3v, icon: Shield, color: 'text-accent' },
            ].map((r, i) => (
              <FadeInSection key={i} delay={i * 150} className="text-center">
                <r.icon className={`h-8 w-8 mx-auto mb-3 ${r.color}`} />
                <div className="text-3xl md:text-5xl font-bold font-display mb-1">{r.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{r.label}</div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ How It Works ━━━ */}
      <section id="how-it-works" className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <FadeInSection className="text-center mb-16 md:mb-20">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Process</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 font-display">{txt.howTitle}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{txt.howDesc}</p>
          </FadeInSection>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            
            {steps.map((step, i) => (
              <FadeInSection key={i} delay={i * 200} className="relative text-center group">
                <div className="relative z-10 w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-card border-2 border-primary/10 flex flex-col items-center justify-center mx-auto mb-8 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-primary/10 transition-all duration-300">
                  <span className="text-xs font-bold text-primary/60 mb-1 tracking-wider">{step.num}</span>
                  <step.icon className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">{step.title}</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{step.desc}</p>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Pricing ━━━ */}
      <section id="pricing" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeInSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Pricing</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 font-display">{txt.pricingTitle}</h2>
            <p className="text-muted-foreground text-lg">{txt.pricingDesc}</p>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pro */}
            <FadeInSection>
              <Card className="relative border-2 border-primary/30 shadow-xl overflow-hidden h-full hover:shadow-2xl transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="p-8 md:p-10">
                  <Badge className="mb-5 bg-primary/10 text-primary border-primary/20">
                    <Star className="h-3 w-3 mr-1" />
                    {txt.freeTrial}
                  </Badge>
                  <h3 className="text-2xl font-bold mb-1 font-display">{txt.proPlan}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-5xl md:text-6xl font-bold text-primary font-display">{txt.proPrice}</span>
                    <span className="text-muted-foreground text-lg">{txt.perMonth}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-8">{txt.commission}</p>
                  <ul className="space-y-4 mb-10">
                    {txt.proFeatures.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full shadow-lg shadow-primary/20" size="lg" asChild>
                    <Link to="/auth?mode=register">
                      {txt.startPro}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeInSection>

            {/* Enterprise */}
            <FadeInSection delay={150}>
              <Card className="border shadow-sm h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-8 md:p-10">
                  <Badge variant="outline" className="mb-5">Enterprise</Badge>
                  <h3 className="text-2xl font-bold mb-1 font-display">{txt.entPlan}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-5xl md:text-6xl font-bold font-display">{txt.entPrice}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-8">{txt.commissionEnt}</p>
                  <ul className="space-y-4 mb-10">
                    {txt.entFeatures.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full" size="lg" asChild>
                    <a href="https://t.me/sellercloudx">
                      {txt.contactSales}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ━━━ Testimonials ━━━ */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <FadeInSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Testimonials</Badge>
            <h2 className="text-3xl md:text-5xl font-bold font-display">{txt.testimonialsTitle}</h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <FadeInSection key={i} delay={i * 150}>
                <Card className="border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <CardContent className="p-6 md:p-8 flex flex-col h-full">
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-foreground mb-6 text-sm leading-relaxed flex-1">{t.text}</p>
                    <div className="flex items-center gap-3 pt-4 border-t">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-primary font-bold text-sm">{t.name[0]}</span>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Final CTA ━━━ */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
        <div className="absolute inset-0 bg-dot-pattern opacity-10" />
        <FloatingParticles />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-3 font-display">
              {txt.ctaTitle}
            </h2>
            <p className="text-4xl md:text-6xl font-bold text-primary-foreground/90 mb-8 font-display">
              {txt.ctaSubtitle}
            </p>
            <p className="text-primary-foreground/70 mb-12 max-w-2xl mx-auto text-lg">
              {txt.ctaDesc}
            </p>
            <Button size="lg" variant="secondary" className="text-lg px-10 py-7 shadow-2xl font-bold group" asChild>
              <Link to="/auth?mode=register">
                <Rocket className="mr-2 h-5 w-5" />
                {txt.ctaButton}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </FadeInSection>
        </div>
      </section>

      {/* ━━━ Footer ━━━ */}
      <footer className="border-t bg-card py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="font-bold font-display text-lg">{txt.footer}</span>
                <p className="text-xs text-muted-foreground">{txt.footerDesc}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="https://t.me/sellercloudx" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" /> Telegram
              </a>
              <span className="hover:text-foreground transition-colors cursor-pointer">{txt.privacy}</span>
              <span className="hover:text-foreground transition-colors cursor-pointer">{txt.terms}</span>
              <span className="hover:text-foreground transition-colors cursor-pointer">{txt.support}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SellerCloudX. {txt.rights}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
