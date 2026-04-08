import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, X, ArrowRight, Star, Crown, Zap, Sparkles, MessageCircle, Store, Image, Copy, Percent, Shield, CreditCard } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const iconMap: Record<string, React.ElementType> = {
  zap: Zap, briefcase: Crown, crown: Crown, building: Sparkles, star: Crown,
};

const styleMap: Record<number, { border: string; accent: string; btn: string; topBar: string; badgeCls: string }> = {
  0: { border: 'border-border', accent: '', btn: '', topBar: '', badgeCls: 'bg-muted text-muted-foreground' },
  1: { border: 'border-blue-300/50', accent: 'text-blue-600', btn: 'bg-blue-500 hover:bg-blue-600 text-white', topBar: 'bg-blue-500', badgeCls: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  2: { border: 'border-primary/50 ring-2 ring-primary/20', accent: 'text-primary', btn: 'shadow-lg shadow-primary/20', topBar: 'bg-primary', badgeCls: 'bg-primary/10 text-primary border-primary/20' },
  3: { border: 'border-amber-300/50', accent: 'text-amber-600', btn: 'bg-amber-500 hover:bg-amber-600 text-white', topBar: 'bg-gradient-to-r from-amber-500 to-amber-600', badgeCls: 'bg-amber-500/10 text-amber-600 border-amber-200' },
};

// Feature display names - maps feature_key to localized label
const FEATURE_LABELS: Record<string, { uz: string; ru: string; en: string }> = {
  'sales-dashboard': { uz: 'Sotuvlar paneli', ru: 'Панель продаж', en: 'Sales Dashboard' },
  'unit-economy': { uz: 'Unit ekonomika', ru: 'Юнит-экономика', en: 'Unit Economy' },
  'multi-store': { uz: 'Ko\'p do\'kon boshqaruvi', ru: 'Мульти-магазин', en: 'Multi-Store Manager' },
  'cost-price-manager': { uz: 'Tannarx boshqaruvi', ru: 'Управление себестоимостью', en: 'Cost Price Manager' },
  'marketplace-connect': { uz: 'Marketplace ulash', ru: 'Подключение маркетплейса', en: 'Marketplace Connect' },
  'notifications': { uz: 'Bildirishnomalar', ru: 'Уведомления', en: 'Notifications' },
  'financial-dashboard': { uz: 'Moliya paneli', ru: 'Финансовая панель', en: 'Financial Dashboard' },
  'marketplace-sync': { uz: 'MP sinxronizatsiya', ru: 'Синхронизация МП', en: 'Marketplace Sync' },
  'inventory-sync': { uz: 'Qoldiq sinxronizatsiya', ru: 'Синхронизация остатков', en: 'Inventory Sync' },
  'stock-forecast': { uz: 'Zaxira prognozi', ru: 'Прогноз запасов', en: 'Stock Forecast' },
  'abc-analysis': { uz: 'ABC tahlil', ru: 'ABC анализ', en: 'ABC Analysis' },
  'orders-management': { uz: 'Buyurtmalar boshqaruvi', ru: 'Управление заказами', en: 'Orders Management' },
  'marketplace-reviews': { uz: 'Izohlar monitoringi', ru: 'Мониторинг отзывов', en: 'Review Monitoring' },
  'profit-calculator': { uz: 'Foyda kalkulyatori', ru: 'Калькулятор прибыли', en: 'Profit Calculator' },
  'price-apply': { uz: 'Narx boshqaruvi', ru: 'Управление ценами', en: 'Price Management' },
  'min-price-protection': { uz: 'Min narx himoyasi', ru: 'Защита мин. цены', en: 'Min Price Protection' },
  'problematic-products': { uz: 'Muammoli tovarlar', ru: 'Проблемные товары', en: 'Problematic Products' },
  'support-chat': { uz: 'Yordam chat', ru: 'Чат поддержки', en: 'Support Chat' },
  'ai_scanner': { uz: 'AI Skaner', ru: 'AI Сканер', en: 'AI Scanner' },
  'clone_card': { uz: 'Kartochka klonlash', ru: 'Клонирование карточек', en: 'Card Cloning' },
  'team-management': { uz: 'Jamoa boshqaruvi', ru: 'Управление командой', en: 'Team Management' },
  'seo-monitor': { uz: 'SEO Monitoring', ru: 'SEO Мониторинг', en: 'SEO Monitor' },
  'competitor-monitor': { uz: 'Raqobatchi monitoring', ru: 'Мониторинг конкурентов', en: 'Competitor Monitor' },
  'ads-campaigns': { uz: 'Reklama kampaniyalari', ru: 'Рекламные кампании', en: 'Ad Campaigns' },
  'sellzen-image-generate': { uz: 'SellZen Studio', ru: 'SellZen Студия', en: 'SellZen Studio' },
  'reports-export': { uz: 'Hisobotlar eksporti', ru: 'Экспорт отчётов', en: 'Export Reports' },
  'seller-analytics': { uz: 'Seller analitikasi', ru: 'Аналитика продавца', en: 'Seller Analytics' },
  'auto-reorder': { uz: 'Avto buyurtma ogohlantirishlari', ru: 'Авто-заказы', en: 'Auto Reorder Alerts' },
  'trend_hunter': { uz: 'Trend qidiruvchi', ru: 'Охотник за трендами', en: 'Trend Hunter' },
  'search-keywords': { uz: 'Kalit so\'zlar', ru: 'Ключевые слова', en: 'Search Keywords' },
};

// Features to display in landing (top 10 most relevant)
const LANDING_FEATURE_KEYS = [
  'sales-dashboard',
  'unit-economy',
  'financial-dashboard',
  'marketplace-sync',
  'cost-price-manager',
  'orders-management',
  'stock-forecast',
  'ai_scanner',
  'clone_card',
  'team-management',
  'seo-monitor',
  'reports-export',
];

interface DynamicPricingProps {
  FadeInSection: React.ComponentType<{ children: React.ReactNode; className?: string; delay?: number }>;
}

export const DynamicPricing = React.forwardRef<HTMLElement, DynamicPricingProps>(function DynamicPricing({ FadeInSection }, _fwdRef) {
    const ref = useRef<HTMLElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const { language } = useLanguage();
    const lang = (language || 'uz') as 'uz' | 'ru' | 'en';

    useEffect(() => {
      const node = ref.current;
      if (!node || shouldLoad) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        { rootMargin: '400px 0px' }
      );

      observer.observe(node);
      return () => observer.disconnect();
    }, [shouldLoad]);

    const { data: plans, isLoading: isPlansLoading } = useSubscriptionPlans({ enabled: shouldLoad });
    const isLoading = !shouldLoad || isPlansLoading;

    const t = {
      uz: {
        title: 'Oddiy va shaffof narxlar',
        desc: 'Oylik obuna + AI xizmatlarga chegirma. Yashirin to\'lovlar yo\'q.',
        monthly: 'Oylik to\'lov',
        perMonth: '/oy',
        start: 'Boshlash',
        contact: 'Taklif olish',
        popular: 'ENG MASHHUR',
        stores: 'do\'kon/MP',
        discount: 'AI chegirma',
        unlimited: 'Cheksiz',
        features: 'Imkoniyatlar',
        paidFeatures: 'Tarifga kiritilmagan AI xizmatlar balansdan foydalaniladi',
        includedCount: 'ta funksiya kiritilgan',
        dataRetention: 'kunlik tahlillar',
        depositBonus: 'Balansga +15% bonus (1M+ to\'ldirganda)',
      },
      ru: {
        title: 'Простые и прозрачные цены',
        desc: 'Ежемесячная подписка + скидки на AI. Без скрытых платежей.',
        monthly: 'Ежемесячно',
        perMonth: '/мес',
        start: 'Начать',
        contact: 'Получить предложение',
        popular: 'ПОПУЛЯРНЫЙ',
        stores: 'магазин/МП',
        discount: 'AI скидка',
        unlimited: 'Безлимит',
        features: 'Возможности',
        paidFeatures: 'AI-функции вне тарифа — оплата с баланса',
        includedCount: 'функций включено',
        dataRetention: 'дней аналитики',
        depositBonus: '+15% бонус к балансу (при пополнении от 1M)',
      },
      en: {
        title: 'Simple, Transparent Pricing',
        desc: 'Monthly subscription + AI discounts. No hidden charges.',
        monthly: 'Monthly fee',
        perMonth: '/mo',
        start: 'Get Started',
        contact: 'Get a Quote',
        popular: 'MOST POPULAR',
        stores: 'store/MP',
        discount: 'AI discount',
        unlimited: 'Unlimited',
        features: 'Features',
        paidFeatures: 'AI features outside plan are pay-per-use from balance',
        includedCount: 'features included',
        dataRetention: 'days analytics',
        depositBonus: '+15% balance bonus (on 1M+ deposit)',
      },
    };
    const txt = t[lang] || t.en;

    const getName = (p: SubscriptionPlan) => {
      if (lang === 'ru') return p.name_ru || p.name;
      if (lang === 'uz') return p.name_uz || p.name;
      return p.name;
    };

    const getDesc = (p: SubscriptionPlan) => {
      if (lang === 'ru') return p.description_ru || p.description || '';
      if (lang === 'uz') return p.description_uz || p.description || '';
      return p.description || '';
    };

    const formatPrice = (n: number) => {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' mln';
      return n.toLocaleString();
    };

    const getFeatureLabel = (key: string) => {
      const labels = FEATURE_LABELS[key];
      if (!labels) return key;
      return lang === 'ru' ? labels.ru : lang === 'uz' ? labels.uz : labels.en;
    };

    if (!shouldLoad || isLoading) {
      return (
        <section ref={ref} id="pricing" className="py-24 md:py-32 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-1.5">Pricing</Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 font-display">{txt.title}</h2>
            </div>
            {shouldLoad ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-[500px] rounded-xl" />)}
              </div>
            ) : (
              <div className="h-[500px] max-w-6xl mx-auto" aria-hidden="true" />
            )}
          </div>
        </section>
      );
    }

    const activePlans = (plans?.filter(p => p.is_active) || []).sort((a, b) => a.sort_order - b.sort_order);

    return (
      <section ref={ref} id="pricing" className="py-16 sm:py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-3 sm:px-4">
          <FadeInSection className="text-center mb-10 sm:mb-16">
            <Badge variant="outline" className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5">Pricing</Badge>
            <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 font-display">{txt.title}</h2>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto">{txt.desc}</p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-7xl mx-auto items-stretch">
            {activePlans.map((plan, idx) => {
              const style = styleMap[Math.min(idx, 3)] || styleMap[0];
              const isPopular = idx === 2;
              const isLast = idx === activePlans.length - 1 && activePlans.length > 2;
              const Icon = iconMap[plan.icon || 'star'] || Crown;
              const includedKeys = plan.included_feature_keys || [];
              const totalIncluded = includedKeys.length;

              return (
                <FadeInSection key={plan.id} delay={idx * 80}>
                  <Card className={`relative border-2 ${style.border} ${isPopular ? 'shadow-xl' : 'shadow-sm'} transition-all h-full hover:-translate-y-1 hover:shadow-xl flex flex-col`}>
                    {(style.topBar || isPopular) && (
                      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${style.topBar || 'bg-primary'}`} />
                    )}
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge className="bg-primary text-primary-foreground text-[10px] px-3 shadow-lg">
                          <Star className="h-3 w-3 mr-1" />
                          {txt.popular}
                        </Badge>
                      </div>
                    )}

                    <CardContent className={`p-4 sm:p-5 flex flex-col h-full ${isPopular ? 'pt-6' : 'pt-4'}`}>
                      {/* Header */}
                      <div className="mb-4">
                        <Badge className={`mb-2 ${style.badgeCls} text-[10px] sm:text-xs`} variant="outline">
                          <Icon className="h-3 w-3 mr-1" />
                          {plan.name}
                        </Badge>
                        <h3 className="text-base sm:text-lg font-bold font-display">{getName(plan)}</h3>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{getDesc(plan)}</p>
                      </div>

                      {/* Pricing */}
                      <div className="space-y-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {txt.monthly}
                          </span>
                          {plan.monthly_fee_uzs > 0 ? (
                            <span className="text-sm sm:text-base font-bold">
                              {formatPrice(plan.monthly_fee_uzs)} <span className="text-[10px] font-normal text-muted-foreground">so'm{txt.perMonth}</span>
                            </span>
                          ) : (
                            <span className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400">
                              {txt.free}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Store className="h-3 w-3 shrink-0 text-primary" />
                          <span>{plan.max_stores_per_marketplace >= 999 ? txt.unlimited : plan.max_stores_per_marketplace} {txt.stores}</span>
                        </div>
                        {plan.balance_discount_percent > 0 && (
                          <div className="flex items-center gap-1">
                            <Percent className="h-3 w-3 shrink-0 text-primary" />
                            <span>{plan.balance_discount_percent}% {txt.discount}</span>
                          </div>
                        )}
                      </div>

                      {/* Total included count badge */}
                      <div className="mb-2">
                        <Badge variant="outline" className="text-[10px] border-green-300/50 text-green-600 dark:text-green-400">
                          ✅ {totalIncluded} {txt.includedCount}
                        </Badge>
                      </div>

                      {/* Feature checklist from DB - sorted: included first, then excluded */}
                      <div className="flex-1 mb-4">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{txt.features}</p>
                        <ul className="space-y-1.5">
                          {/* Included features first */}
                          {LANDING_FEATURE_KEYS
                            .filter(key => includedKeys.includes(key))
                            .map(key => (
                              <li key={key} className="flex items-center gap-1.5 text-[11px]">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                <span className="text-foreground">{getFeatureLabel(key)}</span>
                              </li>
                            ))}
                          {/* Excluded features after */}
                          {LANDING_FEATURE_KEYS
                            .filter(key => !includedKeys.includes(key))
                            .map(key => (
                              <li key={key} className="flex items-center gap-1.5 text-[11px]">
                                <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                <span className="text-muted-foreground/50 line-through">{getFeatureLabel(key)}</span>
                              </li>
                            ))}
                        </ul>
                      </div>


                      {/* CTA */}
                      {isLast ? (
                        <Button className={`w-full mt-auto ${style.btn}`} size="sm" asChild>
                          <a href="https://t.me/sellercloudx" target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            {txt.contact}
                          </a>
                        </Button>
                      ) : (
                        <Button className={`w-full mt-auto ${style.btn}`} size="sm" variant={isPopular ? 'default' : 'outline'} asChild>
                          <Link to="/auth?mode=register">
                            {txt.start} <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </FadeInSection>
              );
            })}
          </div>

          {/* Footer note */}
          <FadeInSection className="text-center mt-6 sm:mt-8" delay={400}>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              💡 {txt.paidFeatures}
            </p>
          </FadeInSection>
        </div>
      </section>
    );
});
DynamicPricing.displayName = 'DynamicPricing';
