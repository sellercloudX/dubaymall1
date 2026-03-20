import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DynamicPricing } from '@/components/landing/DynamicPricing';
import { SEOHead, StructuredData } from '@/components/SEOHead';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, ArrowRight, CheckCircle, BarChart3, Zap, 
  Bot, DollarSign, LineChart, Clock, Users, Star, 
  ChevronRight, Crown, TrendingUp, AlertTriangle,
  Play, Sparkles, Shield, Rocket, Send, MessageCircle,
  ChevronDown, Lock, FileCheck
} from 'lucide-react';
import React, { useState, useEffect, useRef, ReactNode } from 'react';
import heroDashboard from '@/assets/hero-dashboard.png';
import abstractShapes from '@/assets/abstract-shapes.png';
import { MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';

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

const FadeInSection = React.forwardRef<HTMLDivElement, { children: ReactNode; className?: string; delay?: number }>(
  ({ children, className = '', delay = 0 }, _ref) => {
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
);
FadeInSection.displayName = 'FadeInSection';

const FloatingParticles = React.memo(React.forwardRef<HTMLDivElement>((_props, ref) => {
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
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
}));
FloatingParticles.displayName = 'FloatingParticles';

// ─── FAQ Component ───
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-semibold text-sm md:text-base pr-4">{question}</span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Translations ───
const T = {
  uz: {
    badge: '🚀 O\'zbekistonning #1 marketplace platformasi',
    heroTitle1: '4-5 ta hodim ishini',
    heroTitle2: 'bitta platforma',
    heroTitle3: 'bajaradi.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — barchasini yagona AI-quvvatli dashboard orqali boshqaring. Kuniga 1-2 soat ishlash yetarli — qolganini platforma avtomatlashtiradi.',
    cta: 'Hoziroq boshlash',
    ctaSecondary: 'Imkoniyatlarni ko\'rish',
    loginCta: 'Kirish',
    trusted: 'Qo\'llab-quvvatlanadigan marketplacelar',
    statsMarketplaces: 'Marketplace',
    statsProducts: 'Sinxron mahsulot',
    statsOrders: 'Avtomatik buyurtma',
    statsReplace: 'Hodim o\'rniga',
    featuresTitle: 'Sotuvchi uchun barcha vositalar',
    featuresSubtitle: 'bitta platformada',
    featuresDesc: 'Bozordagi eng kuchli avtomatizatsiya vositalarini birlashtirdik',
    feat1: 'Multi-marketplace',
    feat1d: 'Uzum, Yandex, WB, Ozon — bitta OAuth bilan ulang va barchani markazdan boshqaring',
    feat2: 'AI kartochka yaratish',
    feat2d: 'Rasm yuklang — AI nom, tavsif, kategoriya va SEO matnlarni 3 tilda avtomatik yaratadi',
    feat3: 'Real-vaqt moliya',
    feat3d: 'Har bir SKU bo\'yicha sof foyda, marja, komissiya va logistika xarajatlarini kuzating',
    feat4: 'ABC-analiz',
    feat4d: 'Mahsulotlaringizni A/B/C toifalariga ajratib, zarar keltiruvchilarni aniqlang',
    feat5: 'Smart narxlash',
    feat5d: 'Real tariflarga asoslangan avtomatik narx hisoblash va minimal narx himoyasi',
    feat6: 'Inventarizatsiya auditi',
    feat6d: 'Omborlardagi yo\'qolgan tovarlarni aniqlang va kompensatsiya talab qiling',
    feat7: 'Trend Hunter AI',
    feat7d: 'Eng ko\'p sotiladigan mahsulotlarni toping va AI tavsiyalari bilan to\'g\'ri vaqtda qo\'shing',
    feat8: '24/7 Monitoring',
    feat8d: 'Stok tugashi, narx o\'zgarishi, yangi buyurtmalar — Telegram orqali real-time xabarnomalar',
    feat9: 'Bulk operatsiyalar',
    feat9d: 'Yuzlab mahsulotni bir vaqtda yangilang. Excel import/export. Narx, stok hammasini tez o\'zgartiring',
    howTitle: 'Qanday ishlaydi?',
    howDesc: 'Uch qadam bilan sotuvlarni avtomatlashtirishni boshlang',
    step1: 'Ro\'yxatdan o\'ting',
    step1d: 'Akkount yarating va tizimga kiring — 5 daqiqada sozlash',
    step2: 'Marketplacelarni ulang',
    step2d: 'API kalitingizni kiriting — tizim avtomatik sinxronlashadi',
    step3: 'Foydani kuzating',
    step3d: 'Analitika, buyurtmalar va narxlarni yagona paneldan boshqaring',
    pricingTitle: 'Oddiy va shaffof narxlar',
    pricingDesc: 'Yashirin to\'lovlar yo\'q. 1 kunlik bepul sinov.',
    perMonth: '/oyiga',
    guarantee: '60 kunlik kafolat',
    startPro: 'Boshlash',
    contactSales: 'Taklif olish',
    testimonialsTitle: 'Sotuvchilar nima deydi?',
    t1: '"SellerCloudX bilan Uzum va Yandex\'ni bitta joydan boshqaraman. Kuniga 1-2 soat yetarli."',
    t1n: 'Sardor M.', t1r: 'Elektronika sotuvchisi',
    t2: '"ABC-analiz orqali 30% zarar keltiruvchi mahsulotlarni aniqladim va assortimentni optimallashtirdim."',
    t2n: 'Nilufar R.', t2r: 'Kiyim-kechak do\'koni',
    t3: '"Inventarizatsiya auditi yordamida yo\'qolgan 47 dona mahsulot uchun kompensatsiya oldim."',
    t3n: 'Jasur T.', t3r: 'Gadget sotuvchisi',
    ctaTitle: 'Raqobatchilaringiz allaqachon avtomatlashtirilgan.',
    ctaSubtitle: 'Siz-chi?',
    ctaDesc: '60 kunlik savdo o\'sishi kafolati. Natija bo\'lmasa — to\'lov yo\'q.',
    ctaButton: 'Hoziroq boshlang',
    footer: 'SellerCloudX',
    footerDesc: 'AI-Powered Marketplace Automation',
    rights: 'Barcha huquqlar himoyalangan',
    privacy: 'Maxfiylik siyosati',
    terms: 'Foydalanish shartlari',
    support: 'Yordam',
    resultTitle: 'Aniq natijalar',
    resultDesc: 'SellerCloudX foydalanuvchilari erishgan ko\'rsatkichlar',
    r1: 'Hodim o\'rniga', r1v: '4-5 ta',
    r2: 'Kuniga ishlash', r2v: '1-2 soat',
    r3: 'Savdo o\'sishi', r3v: '+250-300%',
    faqTitle: 'Tez-tez so\'raladigan savollar',
    faq1q: 'Platformani qanday boshlash mumkin?',
    faq1a: 'Ro\'yxatdan o\'ting, API kalitingizni kiriting va 5 daqiqada barcha marketplacelaringizni ulang. Maxsus bilim talab qilinmaydi.',
    faq2q: 'Qaysi marketplace\'lar qo\'llab-quvvatlanadi?',
    faq2a: 'Hozirda Uzum Market, Yandex Market, Wildberries va Ozon qo\'llab-quvvatlanadi. Yangi platformalar muntazam qo\'shilmoqda.',
    faq3q: 'AI kartochka yaratish qanday ishlaydi?',
    faq3a: 'Mahsulot rasmini yuklang — AI avtomatik nom, tavsif, kategoriya va SEO matnlarni 3 tilda (UZ, RU, EN) yaratadi.',
    faq4q: 'To\'lovni qanday amalga oshiraman?',
    faq4a: 'Click yoki bank o\'tkazmasi orqali balansni to\'ldiring. 1 kunlik bepul sinov, keyin 99,000 so\'m/oy aktivatsiya. Pullik AI xizmatlari balans orqali.',
    faq5q: '60 kunlik kafolat nima?',
    faq5a: 'Agar 60 kun ichida savdolaringiz o\'smasa, to\'langan summani qaytarib olamiz. Bu bizning sifatga ishonchimiz.',
    faq6q: 'Ma\'lumotlarim xavfsizmi?',
    faq6a: 'Ha. API kalitlaringiz shifrlangan holda saqlanadi. SSL himoyasi va GDPR standartlariga muvofiq ishlaymiz.',
    // Pricing translations removed — now dynamic from DB
  },
  ru: {
    badge: '🚀 Платформа #1 для маркетплейсов Узбекистана',
    heroTitle1: 'Работу 4-5 сотрудников',
    heroTitle2: 'выполняет одна',
    heroTitle3: 'платформа.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — управляйте всем через единый AI-дашборд. Достаточно 1-2 часа в день — остальное платформа автоматизирует.',
    cta: 'Начать сейчас',
    ctaSecondary: 'Узнать возможности',
    loginCta: 'Войти',
    trusted: 'Поддерживаемые маркетплейсы',
    statsMarketplaces: 'Маркетплейсов',
    statsProducts: 'Синхр. товаров',
    statsOrders: 'Авто-заказов',
    statsReplace: 'Вместо сотрудников',
    featuresTitle: 'Все инструменты для продавца',
    featuresSubtitle: 'в одной платформе',
    featuresDesc: 'Мы объединили самые мощные инструменты автоматизации на рынке',
    feat1: 'Мульти-маркетплейс',
    feat1d: 'Uzum, Yandex, WB, Ozon — подключите одним OAuth и управляйте централизованно',
    feat2: 'AI-генерация карточек',
    feat2d: 'Загрузите фото — AI создаст название, описание, категорию и SEO-тексты на 3 языках',
    feat3: 'Финансы реального времени',
    feat3d: 'Отслеживайте чистую прибыль, маржу, комиссии и логистику по каждому SKU',
    feat4: 'ABC-анализ',
    feat4d: 'Разделите товары на A/B/C категории и выявите убыточные позиции',
    feat5: 'Smart-ценообразование',
    feat5d: 'Автоматический расчёт цен на основе реальных тарифов и защита минимальной цены',
    feat6: 'Аудит инвентаризации',
    feat6d: 'Выявляйте потерянные товары на складах и требуйте компенсацию',
    feat7: 'Trend Hunter AI',
    feat7d: 'Находите самые продаваемые товары и добавляйте их в нужный момент по AI-рекомендациям',
    feat8: '24/7 Мониторинг',
    feat8d: 'Остатки, цены, новые заказы — real-time уведомления через Telegram',
    feat9: 'Массовые операции',
    feat9d: 'Обновляйте сотни товаров одновременно. Excel import/export. Быстро меняйте цены и остатки',
    howTitle: 'Как это работает?',
    howDesc: 'Три шага для начала автоматизации продаж',
    step1: 'Зарегистрируйтесь',
    step1d: 'Создайте аккаунт и войдите в систему — настройка за 5 минут',
    step2: 'Подключите маркетплейсы',
    step2d: 'Введите API-ключ — система синхронизируется автоматически',
    step3: 'Управляйте прибылью',
    step3d: 'Аналитика, заказы и цены в едином интерфейсе',
    pricingTitle: 'Простые и прозрачные цены',
    pricingDesc: 'Никаких скрытых платежей. 1 день бесплатного пробного периода.',
    perMonth: '/мес',
    guarantee: '60-дневная гарантия',
    startPro: 'Начать',
    contactSales: 'Получить предложение',
    testimonialsTitle: 'Что говорят продавцы?',
    t1: '"С SellerCloudX управляю Uzum и Yandex из одного места. Достаточно 1-2 часа в день."',
    t1n: 'Сардор М.', t1r: 'Продавец электроники',
    t2: '"Через ABC-анализ выявил 30% убыточных товаров и оптимизировал ассортимент."',
    t2n: 'Нилуфар Р.', t2r: 'Магазин одежды',
    t3: '"Аудит инвентаризации помог получить компенсацию за 47 потерянных единиц товара."',
    t3n: 'Жасур Т.', t3r: 'Продавец гаджетов',
    ctaTitle: 'Ваши конкуренты уже автоматизированы.',
    ctaSubtitle: 'А вы?',
    ctaDesc: '60-дневная гарантия роста продаж. Нет результата — нет оплаты.',
    ctaButton: 'Начать сейчас',
    footer: 'SellerCloudX',
    footerDesc: 'AI-Powered Marketplace Automation',
    rights: 'Все права защищены',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    support: 'Поддержка',
    resultTitle: 'Реальные результаты',
    resultDesc: 'Показатели пользователей SellerCloudX',
    r1: 'Вместо сотрудников', r1v: '4-5',
    r2: 'Работа в день', r2v: '1-2 ч',
    r3: 'Рост продаж', r3v: '+250-300%',
    faqTitle: 'Часто задаваемые вопросы',
    faq1q: 'Как начать работу с платформой?',
    faq1a: 'Зарегистрируйтесь, введите API-ключ и подключите все маркетплейсы за 5 минут. Специальных знаний не требуется.',
    faq2q: 'Какие маркетплейсы поддерживаются?',
    faq2a: 'Сейчас поддерживаются Uzum Market, Yandex Market, Wildberries и Ozon. Новые платформы добавляются регулярно.',
    faq3q: 'Как работает AI-генерация карточек?',
    faq3a: 'Загрузите фото товара — AI автоматически создаст название, описание, категорию и SEO-тексты на 3 языках (UZ, RU, EN).',
    faq4q: 'Как оплатить подписку?',
    faq4a: 'Оплата через Click или банковский перевод. 1 день бесплатно, затем 99 000 сум/мес активация. AI-сервисы оплачиваются через баланс.',
    faq5q: 'Что такое 60-дневная гарантия?',
    faq5a: 'Если за 60 дней ваши продажи не вырастут, мы вернём оплаченную сумму. Это наша уверенность в качестве.',
    faq6q: 'Мои данные в безопасности?',
    faq6a: 'Да. API-ключи хранятся в зашифрованном виде. SSL-защита и соответствие стандартам GDPR.',
    // Pricing translations removed — now dynamic from DB
  },
  en: {
    badge: '🚀 #1 Marketplace Automation Platform in Uzbekistan',
    heroTitle1: 'Replace 4-5 employees',
    heroTitle2: 'with one',
    heroTitle3: 'platform.',
    heroDesc: 'Uzum, Yandex Market, Wildberries, Ozon — manage everything through a single AI-powered dashboard. Just 1-2 hours a day — the platform automates the rest.',
    cta: 'Get Started',
    ctaSecondary: 'Explore Features',
    loginCta: 'Sign In',
    trusted: 'Supported Marketplaces',
    statsMarketplaces: 'Marketplaces',
    statsProducts: 'Synced Products',
    statsOrders: 'Auto Orders',
    statsReplace: 'Replaces employees',
    featuresTitle: 'All seller tools',
    featuresSubtitle: 'in one platform',
    featuresDesc: 'We\'ve combined the most powerful marketplace automation tools',
    feat1: 'Multi-Marketplace',
    feat1d: 'Uzum, Yandex, WB, Ozon — connect via OAuth and manage centrally',
    feat2: 'AI Card Generation',
    feat2d: 'Upload a photo — AI generates title, description, category, and SEO texts in 3 languages',
    feat3: 'Real-time Finance',
    feat3d: 'Track net profit, margin, commissions, and logistics per SKU',
    feat4: 'ABC Analysis',
    feat4d: 'Categorize products into A/B/C tiers and identify underperformers',
    feat5: 'Smart Pricing',
    feat5d: 'Auto-calculate prices based on real tariffs with minimum price protection',
    feat6: 'Inventory Audit',
    feat6d: 'Detect lost items in warehouses and claim compensation',
    feat7: 'Trend Hunter AI',
    feat7d: 'Find best-selling products and add them at the right time with AI recommendations',
    feat8: '24/7 Monitoring',
    feat8d: 'Stock, prices, new orders — real-time Telegram notifications',
    feat9: 'Bulk Operations',
    feat9d: 'Update hundreds of products at once. Excel import/export. Change prices and stock instantly',
    howTitle: 'How It Works',
    howDesc: 'Three steps to start automating your sales',
    step1: 'Sign Up',
    step1d: 'Create your account and sign in — setup in 5 minutes',
    step2: 'Connect Marketplaces',
    step2d: 'Enter your API key — system syncs automatically',
    step3: 'Manage Profits',
    step3d: 'Analytics, orders, and pricing in one unified panel',
    pricingTitle: 'Simple, Transparent Pricing',
    pricingDesc: 'No hidden fees. 1-day free trial.',
    perMonth: '/mo',
    guarantee: '60-day guarantee',
    startPro: 'Get Started',
    contactSales: 'Get a Quote',
    testimonialsTitle: 'What Sellers Say',
    t1: '"With SellerCloudX I manage Uzum and Yandex from one place. Just 1-2 hours a day is enough."',
    t1n: 'Sardor M.', t1r: 'Electronics Seller',
    t2: '"ABC analysis revealed 30% of unprofitable products. I optimized my assortment."',
    t2n: 'Nilufar R.', t2r: 'Clothing Store',
    t3: '"Inventory audit helped me claim compensation for 47 lost units."',
    t3n: 'Jasur T.', t3r: 'Gadget Seller',
    ctaTitle: 'Your competitors are already automated.',
    ctaSubtitle: 'Are you?',
    ctaDesc: '60-day sales growth guarantee. No results — no payment.',
    ctaButton: 'Get Started Now',
    footer: 'SellerCloudX',
    footerDesc: 'AI-Powered Marketplace Automation',
    rights: 'All rights reserved',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    support: 'Support',
    resultTitle: 'Real Results',
    resultDesc: 'Metrics achieved by SellerCloudX users',
    r1: 'Replaces employees', r1v: '4-5',
    r2: 'Daily work needed', r2v: '1-2 hrs',
    r3: 'Sales Growth', r3v: '+250-300%',
    faqTitle: 'Frequently Asked Questions',
    faq1q: 'How do I get started?',
    faq1a: 'Sign up, enter your API key and connect all your marketplaces in 5 minutes. No special knowledge required.',
    faq2q: 'Which marketplaces are supported?',
    faq2a: 'Currently Uzum Market, Yandex Market, Wildberries and Ozon are supported. New platforms are added regularly.',
    faq3q: 'How does AI card generation work?',
    faq3a: 'Upload a product photo — AI automatically generates name, description, category and SEO texts in 3 languages (UZ, RU, EN).',
    faq4q: 'How do I pay for the subscription?',
    faq4a: 'Pay via Click or bank transfer. 1-day free trial, then 99,000 UZS/month activation. AI services are billed via balance.',
    faq5q: 'What is the 60-day guarantee?',
    faq5a: 'If your sales don\'t grow within 60 days, we refund the paid amount. That\'s our confidence in quality.',
    faq6q: 'Is my data secure?',
    faq6a: 'Yes. API keys are stored encrypted. SSL protection and GDPR compliance.',
    // Pricing translations removed — now dynamic from DB
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
    { icon: Sparkles, title: txt.feat7, desc: txt.feat7d, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-500/10' },
    { icon: Zap, title: txt.feat8, desc: txt.feat8d, color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: LineChart, title: txt.feat9, desc: txt.feat9d, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
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

  const faqs = [
    { q: txt.faq1q, a: txt.faq1a },
    { q: txt.faq2q, a: txt.faq2a },
    { q: txt.faq3q, a: txt.faq3a },
    { q: txt.faq4q, a: txt.faq4a },
    { q: txt.faq5q, a: txt.faq5a },
    { q: txt.faq6q, a: txt.faq6a },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SEOHead 
        title="SellerCloudX — AI Marketplace Automation Platform"
        description="Uzum, Yandex Market, Wildberries, Ozon — barchasini yagona AI dashboarddan boshqaring. 4-5 hodim o'rnini bosadi."
        url="https://sellercloudx.lovable.app"
      />
      <StructuredData type="Organization" data={{
        name: 'SellerCloudX',
        url: 'https://sellercloudx.lovable.app',
        description: 'AI-Powered Marketplace Automation Platform for Uzbekistan sellers',
        sameAs: ['https://t.me/sellercloudx'],
      }} />
      <StructuredData type="WebSite" data={{
        name: 'SellerCloudX',
        url: 'https://sellercloudx.lovable.app',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://sellercloudx.lovable.app/auth?mode=register',
        },
      }} />

      {/* ━━━ Navigation ━━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-2 sm:px-4 flex h-12 sm:h-16 items-center justify-between gap-1">
          <Link to="/" className="flex items-center gap-1 shrink-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Crown className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-white" />
            </div>
            <span className="hidden sm:inline text-xl font-bold font-display tracking-tight">SellerCloudX</span>
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
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="font-medium text-[11px] sm:text-sm h-7 sm:h-8 px-1.5 sm:px-3" asChild>
              <Link to="/auth">{txt.loginCta}</Link>
            </Button>
            <Button size="sm" asChild className="shadow-lg shadow-primary/20 text-[11px] sm:text-sm h-7 sm:h-8 px-2 sm:px-4 whitespace-nowrap">
              <Link to="/auth?mode=register">
                {language === 'uz' ? "Ro'yxatdan o'tish" : language === 'ru' ? 'Регистрация' : 'Sign Up'}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-[100vh] flex items-center pt-14 sm:pt-32 md:pt-36 pb-8 sm:pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/6 rounded-full blur-[100px]" />
        <FloatingParticles />

        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl w-full mx-auto lg:mx-0 text-center lg:text-left">
              <div className="animate-fade-up">
                <Badge className="mb-2 sm:mb-8 px-2.5 sm:px-4 py-1 sm:py-2 text-[11px] sm:text-sm font-medium bg-primary/10 text-primary border-primary/20">
                  {txt.badge}
                </Badge>
              </div>

              <h1 className="text-[22px] sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-3 sm:mb-8 font-display leading-[1.2] animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <span className="text-foreground">{txt.heroTitle1}</span>
                <br />
                <span className="text-gradient">{txt.heroTitle2}</span>
                <br />
                <span className="text-foreground">{txt.heroTitle3}</span>
              </h1>
              
              <p className="text-[13px] sm:text-lg text-muted-foreground mb-4 sm:mb-10 leading-relaxed animate-fade-up max-w-xl mx-auto lg:mx-0" style={{ animationDelay: '0.2s' }}>
                {txt.heroDesc}
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 animate-fade-up justify-center lg:justify-start" style={{ animationDelay: '0.3s' }}>
                <Button size="lg" className="text-sm sm:text-base px-5 sm:px-8 py-5 sm:py-6 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all group" asChild>
                  <Link to="/auth?mode=register">
                    <Rocket className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    {txt.cta}
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-sm sm:text-base px-5 sm:px-8 py-5 sm:py-6 glass" asChild>
                  <a href="#features">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {txt.ctaSecondary}
                  </a>
                </Button>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex flex-wrap items-center gap-4 animate-fade-up justify-center lg:justify-start" style={{ animationDelay: '0.45s' }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{txt.guarantee}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>SSL Secured</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileCheck className="h-4 w-4 text-primary" />
                  <span>GDPR</span>
                </div>
              </div>

              {/* Marketplace logos */}
              <div className="mt-6 sm:mt-8 animate-fade-up text-center lg:text-left" style={{ animationDelay: '0.5s' }}>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3 uppercase tracking-widest font-medium">{txt.trusted}</p>
                <div className="flex items-center gap-3 sm:gap-6 md:gap-8 justify-center lg:justify-start flex-wrap">
                  {Object.entries(MARKETPLACE_CONFIG).map(([key, mp]) => (
                    <div key={key} className="flex items-center gap-1 sm:gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                      <img src={mp.logo} alt={mp.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover" />
                      <span className="text-[11px] sm:text-sm font-medium text-muted-foreground">{mp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Dashboard Image */}
            <div className="relative animate-fade-up hidden lg:block" style={{ animationDelay: '0.4s' }}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
                <img 
                  src={heroDashboard} 
                  alt="SellerCloudX Dashboard" 
                  className="relative rounded-2xl shadow-2xl border border-border/30 w-full"
                  loading="eager"
                />
                <div className="absolute -bottom-4 -left-4 bg-card border shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 animate-bounce-subtle">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">4-5 → 1</div>
                    <div className="text-xs text-muted-foreground">{txt.statsReplace}</div>
                  </div>
                </div>
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

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle hidden md:block">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-primary/50 animate-pulse" />
          </div>
        </div>
      </section>

      {/* ━━━ Stats Bar ━━━ */}
      <section ref={stats.ref} className="py-16 bg-muted/30 border-y relative">
        <div className="container mx-auto px-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-5xl mx-auto">
             {[
               { value: `${c1}+`, label: txt.statsMarketplaces, icon: Globe, color: 'text-primary' },
               { value: c2 >= 1000 ? `${(c2/1000).toFixed(0)}K+` : `${c2}+`, label: txt.statsProducts, icon: BarChart3, color: 'text-accent' },
               { value: c3 >= 1000 ? `${(c3/1000).toFixed(0)}K+` : `${c3}+`, label: txt.statsOrders, icon: TrendingUp, color: 'text-emerald-500' },
               { value: '4-5', label: txt.statsReplace, icon: Users, color: 'text-amber-500' },
             ].map((stat, i) => (
               <div key={i} className="text-center group cursor-default">
                 <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-card border shadow-sm mx-auto mb-2 sm:mb-4 flex items-center justify-center group-hover:shadow-lg group-hover:scale-105 transition-all`}>
                   <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                 </div>
                 <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground font-display">{stat.value}</div>
                 <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* ━━━ Features ━━━ */}
      <section id="features" className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-[0.03]" />
        <div className="absolute inset-0 flex items-center justify-center opacity-10 dark:opacity-5 pointer-events-none">
          <img src={abstractShapes} alt="" className="w-full h-full object-cover" loading="lazy" />
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
             {features.map((feat, i) => (
               <FadeInSection key={i} delay={i * 80}>
                 <Card className="group border shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden hover:-translate-y-2 h-full">
                   <CardContent className="p-5 sm:p-6 md:p-8">
                     <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${feat.bg} flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300`}>
                       <feat.icon className={`h-6 w-6 sm:h-7 sm:w-7 ${feat.color}`} />
                     </div>
                     <h3 className="text-base sm:text-lg font-bold mb-2 font-display">{feat.title}</h3>
                     <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{feat.desc}</p>
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
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display mb-3">{txt.resultTitle}</h2>
             <p className="text-sm sm:text-base text-muted-foreground">{txt.resultDesc}</p>
           </FadeInSection>
           <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-3xl mx-auto">
             {[
               { label: txt.r1, value: txt.r1v, icon: Users, color: 'text-primary' },
               { label: txt.r2, value: txt.r2v, icon: Clock, color: 'text-emerald-500' },
               { label: txt.r3, value: txt.r3v, icon: TrendingUp, color: 'text-accent' },
             ].map((r, i) => (
               <FadeInSection key={i} delay={i * 150} className="text-center">
                 <r.icon className={`h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 sm:mb-3 ${r.color}`} />
                 <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-display mb-1">{r.value}</div>
                 <div className="text-xs sm:text-sm text-muted-foreground font-medium">{r.label}</div>
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
          
           <div className="grid md:grid-cols-3 gap-6 md:gap-12 max-w-5xl mx-auto relative">
             <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
             
             {steps.map((step, i) => (
               <FadeInSection key={i} delay={i * 200} className="relative text-center group">
                 <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl sm:rounded-3xl bg-card border-2 border-primary/10 flex flex-col items-center justify-center mx-auto mb-6 sm:mb-8 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-primary/10 transition-all duration-300">
                   <span className="text-xs font-bold text-primary/60 mb-0.5 tracking-wider">{step.num}</span>
                   <step.icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-primary" />
                 </div>
                 <h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 font-display">{step.title}</h3>
                 <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">{step.desc}</p>
               </FadeInSection>
             ))}
          </div>
        </div>
      </section>

      {/* ━━━ Pricing (Dynamic from DB) ━━━ */}
      <DynamicPricing FadeInSection={FadeInSection} />

      {/* ━━━ Testimonials ━━━ */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <FadeInSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Testimonials</Badge>
            <h2 className="text-3xl md:text-5xl font-bold font-display">{txt.testimonialsTitle}</h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-5xl mx-auto">
             {testimonials.map((t, i) => (
               <FadeInSection key={i} delay={i * 150}>
                 <Card className="border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                   <CardContent className="p-4 sm:p-6 md:p-8 flex flex-col h-full">
                     <div className="flex gap-1 mb-4 sm:mb-5">
                       {Array.from({ length: 5 }).map((_, j) => (
                         <Star key={j} className="h-3 w-3 sm:h-4 sm:w-4 fill-amber-400 text-amber-400" />
                       ))}
                     </div>
                     <p className="text-foreground mb-4 sm:mb-6 text-xs sm:text-sm leading-relaxed flex-1">{t.text}</p>
                     <div className="flex items-center gap-3 pt-3 sm:pt-4 border-t">
                       <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                         <span className="text-primary font-bold text-xs sm:text-sm">{t.name[0]}</span>
                       </div>
                       <div>
                         <div className="font-bold text-xs sm:text-sm">{t.name}</div>
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



      {/* ━━━ FAQ ━━━ */}
      <section id="faq" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeInSection className="text-center mb-16">
             <Badge variant="outline" className="mb-4 px-4 py-1.5">FAQ</Badge>
             <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-display">{txt.faqTitle}</h2>
           </FadeInSection>

           <FadeInSection>
             <Card className="max-w-3xl mx-auto border">
               <CardContent className="p-4 sm:p-6 md:p-8">
                {faqs.map((faq, i) => (
                  <FAQItem key={i} question={faq.q} answer={faq.a} />
                ))}
              </CardContent>
            </Card>
          </FadeInSection>
        </div>
      </section>

       {/* ━━━ Final CTA ━━━ */}
       <section className="py-20 md:py-32 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
         <div className="absolute inset-0 bg-dot-pattern opacity-10" />
         <FloatingParticles />
         
         <div className="container mx-auto px-4 relative z-10 text-center">
           <FadeInSection>
             <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary-foreground mb-3 font-display leading-tight">
               {txt.ctaTitle}
             </h2>
             <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary-foreground/90 mb-6 sm:mb-8 font-display leading-tight">
               {txt.ctaSubtitle}
             </p>
             <p className="text-primary-foreground/70 mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
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
       <footer className="border-t bg-card py-10 md:py-14">
         <div className="container mx-auto px-4">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                 <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
               </div>
               <div>
                 <span className="font-bold font-display text-base sm:text-lg">{txt.footer}</span>
                 <p className="text-xs text-muted-foreground">{txt.footerDesc}</p>
               </div>
             </div>
             <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm text-muted-foreground">
               <a href="https://t.me/sellercloudx" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1 sm:gap-1.5">
                 <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Telegram
               </a>
               <a href="https://sellercloudx.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors whitespace-nowrap">
                 sellercloudx.com
               </a>
               <span className="hover:text-foreground transition-colors cursor-pointer hidden sm:block">{txt.privacy}</span>
               <span className="hover:text-foreground transition-colors cursor-pointer hidden sm:block">{txt.terms}</span>
               <span className="hover:text-foreground transition-colors cursor-pointer hidden sm:block">{txt.support}</span>
             </div>
             <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
               <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
               <span className="whitespace-nowrap">SSL Secured</span>
               <span className="hidden sm:block">•</span>
               <span className="whitespace-nowrap">GDPR</span>
             </div>
           </div>
           <div className="text-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
             <p className="text-xs sm:text-sm text-muted-foreground">
               © {new Date().getFullYear()} SellerCloudX. {txt.rights}
             </p>
           </div>
         </div>
       </footer>
    </div>
  );
}
