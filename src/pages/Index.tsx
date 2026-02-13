import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEOHead, StructuredData } from '@/components/SEOHead';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, ArrowRight, CheckCircle, BarChart3, Shield, Zap, 
  Package, ShoppingCart, TrendingUp, Layers, Bot, DollarSign,
  LineChart, Clock, Users, Star, ChevronRight, Crown, Lock,
  Repeat, AlertTriangle, Calculator, FileSpreadsheet
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// Animated counter hook
function useCountUp(end: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, trigger]);
  return count;
}

// Intersection observer hook
function useInView(threshold = 0.2) {
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

const LANDING_TEXT = {
  uz: {
    badge: 'Marketplace avtomatizatsiya platformasi',
    heroTitle1: 'Barcha marketplacelarni',
    heroTitle2: 'bitta joydan boshqaring',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — barchasini yagona dashboard orqali avtomatlashtiring. AI bilan kartochka yarating, narxlarni optimallashtiring va sof foydani real-vaqtda kuzating.',
    cta: 'Bepul boshlash',
    ctaSecondary: 'Batafsil',
    loginCta: 'Kirish',
    statsMarketplaces: 'Marketplace',
    statsProducts: 'Sinxron mahsulot',
    statsOrders: 'Avtomatik buyurtma',
    statsTime: 'Vaqt tejash',
    featuresTitle: 'Nima uchun SellerCloudX?',
    featuresDesc: 'Professional sotuvchilar uchun yaratilgan kuchli vositalar to\'plami',
    feat1: 'Multi-marketplace ulanish',
    feat1d: 'Uzum, Yandex, WB, Ozon — bitta OAuth bilan ulang va barchani markazdan boshqaring',
    feat2: 'AI kartochka yaratish',
    feat2d: 'Rasm yuklang — AI nom, tavsif, kategoriya va SEO matnlarni avtomatik yaratadi',
    feat3: 'Moliya va PnL',
    feat3d: 'Har bir SKU bo\'yicha sof foyda, marja, komissiya va logistika xarajatlarini kuzating',
    feat4: 'ABC-analiz',
    feat4d: 'Mahsulotlaringizni A/B/C toifalariga ajratib, qaysi biri daromad keltirmasligini bilib oling',
    feat5: 'Narxlarni optimallashtirish',
    feat5d: 'Real tariflarga asoslangan avtomatik narx hisoblash va minimal narx himoyasi',
    feat6: 'Inventarizatsiya auditi',
    feat6d: 'Omborlardagi yo\'qolgan tovarlarni aniqlang va kompensatsiya talab qiling',
    howTitle: 'Qanday ishlaydi?',
    howDesc: 'Uch qadam bilan sotuvlarni avtomatlashtirishni boshlang',
    step1: 'Ro\'yxatdan o\'ting',
    step1d: '7 kunlik bepul sinov davri — bank kartasi talab qilinmaydi',
    step2: 'Marketplacelarni ulang',
    step2d: 'API kalitingizni kiriting — tizim avtomatik sinxronlashadi',
    step3: 'Boshqarishni boshlang',
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
    t1n: 'Sardor M.',
    t1r: 'Elektronika sotuvchisi',
    t2: '"ABC-analiz orqali 30% zarar keltiruvchi mahsulotlarni aniqladim va assortimentni optimallashtirdim."',
    t2n: 'Nilufar R.',
    t2r: 'Kiyim-kechak do\'koni',
    t3: '"Inventarizatsiya auditi yordamida yo\'qolgan 47 dona mahsulot uchun kompensatsiya oldim."',
    t3n: 'Jasur T.',
    t3r: 'Gadget sotuvchisi',
    ctaTitle: 'Sotuvlaringizni avtomatlashtirishga tayyormisiz?',
    ctaDesc: 'Minglab professional sotuvchilar allaqachon SellerCloudX dan foydalanmoqda',
    ctaButton: 'Hoziroq boshlang',
    footer: 'SellerCloudX',
    footerDesc: 'Marketplace avtomatizatsiya platformasi',
    rights: 'Barcha huquqlar himoyalangan',
    privacy: 'Maxfiylik siyosati',
    terms: 'Foydalanish shartlari',
    support: 'Yordam',
  },
  ru: {
    badge: 'Платформа автоматизации маркетплейсов',
    heroTitle1: 'Управляйте всеми маркетплейсами',
    heroTitle2: 'из одного места',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — автоматизируйте всё через единый дашборд. Создавайте карточки с AI, оптимизируйте цены и отслеживайте чистую прибыль в реальном времени.',
    cta: 'Начать бесплатно',
    ctaSecondary: 'Подробнее',
    loginCta: 'Войти',
    statsMarketplaces: 'Маркетплейсов',
    statsProducts: 'Синхр. товаров',
    statsOrders: 'Авто-заказов',
    statsTime: 'Экономия времени',
    featuresTitle: 'Почему SellerCloudX?',
    featuresDesc: 'Мощный набор инструментов для профессиональных продавцов',
    feat1: 'Мульти-маркетплейс',
    feat1d: 'Uzum, Yandex, WB, Ozon — подключите одним OAuth и управляйте централизованно',
    feat2: 'AI-генерация карточек',
    feat2d: 'Загрузите фото — AI создаст название, описание, категорию и SEO-тексты',
    feat3: 'Финансы и PnL',
    feat3d: 'Отслеживайте чистую прибыль, маржу, комиссии и логистику по каждому SKU',
    feat4: 'ABC-анализ',
    feat4d: 'Разделите товары на A/B/C категории и выявите убыточные позиции',
    feat5: 'Оптимизация цен',
    feat5d: 'Автоматический расчёт цен на основе реальных тарифов и защита минимальной цены',
    feat6: 'Аудит инвентаризации',
    feat6d: 'Выявляйте потерянные товары на складах и требуйте компенсацию',
    howTitle: 'Как это работает?',
    howDesc: 'Три шага для начала автоматизации продаж',
    step1: 'Зарегистрируйтесь',
    step1d: '7 дней бесплатно — банковская карта не требуется',
    step2: 'Подключите маркетплейсы',
    step2d: 'Введите API-ключ — система синхронизируется автоматически',
    step3: 'Начните управлять',
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
    t1n: 'Сардор М.',
    t1r: 'Продавец электроники',
    t2: '"Через ABC-анализ выявил 30% убыточных товаров и оптимизировал ассортимент."',
    t2n: 'Нилуфар Р.',
    t2r: 'Магазин одежды',
    t3: '"Аудит инвентаризации помог получить компенсацию за 47 потерянных единиц товара."',
    t3n: 'Жасур Т.',
    t3r: 'Продавец гаджетов',
    ctaTitle: 'Готовы автоматизировать продажи?',
    ctaDesc: 'Тысячи профессиональных продавцов уже используют SellerCloudX',
    ctaButton: 'Начать сейчас',
    footer: 'SellerCloudX',
    footerDesc: 'Платформа автоматизации маркетплейсов',
    rights: 'Все права защищены',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    support: 'Поддержка',
  },
  en: {
    badge: 'Marketplace Automation Platform',
    heroTitle1: 'Manage all marketplaces',
    heroTitle2: 'from one place',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — automate everything through a unified dashboard. Create product cards with AI, optimize prices, and track net profit in real-time.',
    cta: 'Start Free',
    ctaSecondary: 'Learn More',
    loginCta: 'Sign In',
    statsMarketplaces: 'Marketplaces',
    statsProducts: 'Synced Products',
    statsOrders: 'Auto Orders',
    statsTime: 'Time Saved',
    featuresTitle: 'Why SellerCloudX?',
    featuresDesc: 'Powerful toolkit built for professional sellers',
    feat1: 'Multi-Marketplace',
    feat1d: 'Uzum, Yandex, WB, Ozon — connect via OAuth and manage centrally',
    feat2: 'AI Card Generation',
    feat2d: 'Upload a photo — AI generates title, description, category, and SEO texts',
    feat3: 'Finance & PnL',
    feat3d: 'Track net profit, margin, commissions, and logistics per SKU',
    feat4: 'ABC Analysis',
    feat4d: 'Categorize products into A/B/C tiers and identify underperformers',
    feat5: 'Price Optimization',
    feat5d: 'Auto-calculate prices based on real tariffs with minimum price protection',
    feat6: 'Inventory Audit',
    feat6d: 'Detect lost items in warehouses and claim compensation',
    howTitle: 'How It Works',
    howDesc: 'Three steps to start automating your sales',
    step1: 'Sign Up',
    step1d: '7-day free trial — no credit card required',
    step2: 'Connect Marketplaces',
    step2d: 'Enter your API key — system syncs automatically',
    step3: 'Start Managing',
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
    t1n: 'Sardor M.',
    t1r: 'Electronics Seller',
    t2: '"ABC analysis revealed 30% of unprofitable products. I optimized my assortment."',
    t2n: 'Nilufar R.',
    t2r: 'Clothing Store',
    t3: '"Inventory audit helped me claim compensation for 47 lost units."',
    t3n: 'Jasur T.',
    t3r: 'Gadget Seller',
    ctaTitle: 'Ready to automate your sales?',
    ctaDesc: 'Thousands of professional sellers already use SellerCloudX',
    ctaButton: 'Get Started Now',
    footer: 'SellerCloudX',
    footerDesc: 'Marketplace automation platform',
    rights: 'All rights reserved',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    support: 'Support',
  },
};

export default function Index() {
  const { language } = useLanguage();
  const txt = LANDING_TEXT[language] || LANDING_TEXT.en;
  
  const stats = useInView();
  const c1 = useCountUp(4, 1500, stats.inView);
  const c2 = useCountUp(50000, 2000, stats.inView);
  const c3 = useCountUp(10000, 2000, stats.inView);

  const features = [
    { icon: Globe, title: txt.feat1, desc: txt.feat1d, gradient: 'from-blue-500 to-indigo-600' },
    { icon: Bot, title: txt.feat2, desc: txt.feat2d, gradient: 'from-violet-500 to-purple-600' },
    { icon: DollarSign, title: txt.feat3, desc: txt.feat3d, gradient: 'from-emerald-500 to-teal-600' },
    { icon: BarChart3, title: txt.feat4, desc: txt.feat4d, gradient: 'from-amber-500 to-orange-600' },
    { icon: TrendingUp, title: txt.feat5, desc: txt.feat5d, gradient: 'from-rose-500 to-pink-600' },
    { icon: AlertTriangle, title: txt.feat6, desc: txt.feat6d, gradient: 'from-cyan-500 to-blue-600' },
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
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead 
        title="SellerCloudX — Marketplace Automation Platform"
        description="Manage Uzum, Yandex Market, Wildberries, Ozon from one dashboard. AI card generation, PnL analytics, price optimization."
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold font-display">SellerCloudX</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {txt.featuresTitle?.split('?')[0] || 'Features'}
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {txt.howTitle}
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {txt.pricingTitle?.split(',')[0] || 'Pricing'}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">{txt.loginCta}</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/auth?mode=register">{txt.cta}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-accent/8 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10 pt-20 pb-24 md:pt-32 md:pb-36">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex animate-fade-up">
              <Badge className="mb-8 px-5 py-2.5 text-sm font-medium bg-primary/10 text-primary border-primary/20 backdrop-blur-sm">
                <Zap className="h-4 w-4 mr-2" />
                {txt.badge}
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 animate-fade-up font-display" style={{ animationDelay: '0.1s' }}>
              <span className="text-foreground">{txt.heroTitle1}</span>
              <br />
              <span className="text-gradient">{txt.heroTitle2}</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
              {txt.heroDesc}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all btn-glow group" asChild>
                <Link to="/auth?mode=register">
                  {txt.cta}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 glass hover:bg-primary/5 transition-all" asChild>
                <a href="#features">{txt.ctaSecondary}</a>
              </Button>
            </div>

            {/* Marketplace logos */}
            <div className="mt-16 flex items-center justify-center gap-6 md:gap-10 opacity-60 animate-fade-up" style={{ animationDelay: '0.5s' }}>
              {['🟣 Uzum', '🟡 Yandex', '🔵 Wildberries', '🟢 Ozon'].map((mp, i) => (
                <span key={i} className="text-sm md:text-base font-medium text-muted-foreground">{mp}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-muted-foreground/50 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section ref={stats.ref} className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-4xl mx-auto">
            {[
              { value: `${c1}+`, label: txt.statsMarketplaces, icon: Globe },
              { value: c2 >= 1000 ? `${(c2/1000).toFixed(0)}K+` : `${c2}+`, label: txt.statsProducts, icon: Package },
              { value: c3 >= 1000 ? `${(c3/1000).toFixed(0)}K+` : `${c3}+`, label: txt.statsOrders, icon: ShoppingCart },
              { value: '15h+', label: txt.statsTime, icon: Clock },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <stat.icon className="h-6 w-6 mx-auto mb-3 text-primary group-hover:scale-110 transition-transform" />
                <div className="text-3xl md:text-4xl font-bold text-foreground font-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">{txt.featuresTitle}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{txt.featuresDesc}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feat, i) => (
              <Card key={i} className="group border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <feat.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feat.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Process</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">{txt.howTitle}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{txt.howDesc}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                )}
                <div className="relative z-10 w-24 h-24 rounded-2xl bg-card border-2 border-primary/20 flex flex-col items-center justify-center mx-auto mb-6 group-hover:border-primary/50 group-hover:shadow-lg transition-all">
                  <span className="text-xs font-bold text-primary mb-1">{step.num}</span>
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">{txt.pricingTitle}</h2>
            <p className="text-muted-foreground">{txt.pricingDesc}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pro */}
            <Card className="relative border-2 border-primary/30 shadow-xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
              <CardContent className="p-8">
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                  <Star className="h-3 w-3 mr-1" />
                  {txt.freeTrial}
                </Badge>
                <h3 className="text-2xl font-bold mb-1">{txt.proPlan}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-primary font-display">{txt.proPrice}</span>
                  <span className="text-muted-foreground">{txt.perMonth}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{txt.commission}</p>
                <ul className="space-y-3 mb-8">
                  {txt.proFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/auth?mode=register">
                    {txt.startPro}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <Badge variant="outline" className="mb-4">Enterprise</Badge>
                <h3 className="text-2xl font-bold mb-1">{txt.entPlan}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold font-display">{txt.entPrice}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{txt.commissionEnt}</p>
                <ul className="space-y-3 mb-8">
                  {txt.entFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold font-display">{txt.testimonialsTitle}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <Card key={i} className="border shadow-sm hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic text-sm leading-relaxed">{t.text}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">{t.name[0]}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
        <div className="absolute inset-0 bg-dot-pattern opacity-10" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6 font-display">
            {txt.ctaTitle}
          </h2>
          <p className="text-primary-foreground/80 mb-10 max-w-2xl mx-auto text-lg">
            {txt.ctaDesc}
          </p>
          <Button size="lg" variant="secondary" className="text-lg px-8 py-6 shadow-xl" asChild>
            <Link to="/auth?mode=register">
              {txt.ctaButton}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="font-bold font-display">{txt.footer}</span>
                <p className="text-xs text-muted-foreground">{txt.footerDesc}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>{txt.privacy}</span>
              <span>{txt.terms}</span>
              <span>{txt.support}</span>
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