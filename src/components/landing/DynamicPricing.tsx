import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, X, ArrowRight, Star, Crown, Zap, Sparkles, MessageCircle, Store, Image, Copy, Percent, Shield, CreditCard } from 'lucide-react';
import React from 'react';

const iconMap: Record<string, React.ElementType> = {
  zap: Zap, briefcase: Crown, crown: Crown, building: Sparkles, star: Crown,
};

const styleMap: Record<number, { border: string; accent: string; btn: string; topBar: string; badgeCls: string }> = {
  0: { border: 'border-border', accent: '', btn: '', topBar: '', badgeCls: 'bg-muted text-muted-foreground' },
  1: { border: 'border-blue-300/50', accent: 'text-blue-600', btn: 'bg-blue-500 hover:bg-blue-600 text-white', topBar: 'bg-blue-500', badgeCls: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  2: { border: 'border-primary/50 ring-2 ring-primary/20', accent: 'text-primary', btn: 'shadow-lg shadow-primary/20', topBar: 'bg-primary', badgeCls: 'bg-primary/10 text-primary border-primary/20' },
  3: { border: 'border-amber-300/50', accent: 'text-amber-600', btn: 'bg-amber-500 hover:bg-amber-600 text-white', topBar: 'bg-gradient-to-r from-amber-500 to-amber-600', badgeCls: 'bg-amber-500/10 text-amber-600 border-amber-200' },
};

// Key features to display in comparison
const DISPLAY_FEATURES = [
  { key: 'sales-dashboard', uz: 'Sotuvlar paneli', ru: 'Панель продаж', en: 'Sales Dashboard' },
  { key: 'marketplace-sync', uz: 'Marketplace sinxronizatsiya', ru: 'Синхронизация маркетплейса', en: 'Marketplace Sync' },
  { key: 'financial-dashboard', uz: 'Moliya dashboardi', ru: 'Финансовая панель', en: 'Financial Dashboard' },
  { key: 'stock-forecast', uz: 'Zaxira prognozi', ru: 'Прогноз запасов', en: 'Stock Forecast' },
  { key: 'ai_scanner', uz: 'AI Skaner', ru: 'AI Сканер', en: 'AI Scanner' },
  { key: 'clone_card', uz: 'Kartochka klonlash', ru: 'Клонирование карточек', en: 'Card Cloning' },
  { key: 'team-management', uz: 'Jamoa boshqaruvi', ru: 'Управление командой', en: 'Team Management' },
  { key: 'seo-monitor', uz: 'SEO Monitoring', ru: 'SEO Мониторинг', en: 'SEO Monitor' },
  { key: 'competitor-monitor', uz: 'Raqobatchi monitoring', ru: 'Мониторинг конкурентов', en: 'Competitor Monitor' },
  { key: 'ads-campaigns', uz: 'Reklama kampaniyalari', ru: 'Рекламные кампании', en: 'Ad Campaigns' },
  { key: 'sellzen-image-generate', uz: 'SellZen Studio', ru: 'SellZen Студия', en: 'SellZen Studio' },
  { key: 'reports-export', uz: 'Hisobotlar eksporti', ru: 'Экспорт отчётов', en: 'Export Reports' },
];

interface DynamicPricingProps {
  FadeInSection: React.ComponentType<{ children: React.ReactNode; className?: string; delay?: number }>;
}

export function DynamicPricing({ FadeInSection }: DynamicPricingProps) {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { language } = useLanguage();
  const lang = (language || 'uz') as 'uz' | 'ru' | 'en';

  const t = {
    uz: {
      title: 'Oddiy va shaffof narxlar',
      desc: 'Bir martalik aktivatsiya to\'lovi. Yashirin to\'lovlar yo\'q.',
      onetime: 'Bir martalik to\'lov',
      monthly: 'Oylik to\'lov',
      noMonthly: 'Oylik to\'lov yo\'q ✓',
      perMonth: '/oy',
      start: 'Boshlash',
      contact: 'Taklif olish',
      popular: 'ENG MASHHUR',
      stores: 'do\'kon/MP',
      cards: 'kartochka/oy',
      clones: 'klon/oy',
      discount: 'AI chegirma',
      unlimited: 'Cheksiz',
      included: 'Kiritilgan',
      notIncluded: 'Kiritilmagan',
      features: 'Imkoniyatlar',
      trial: '1 kunlik bepul sinov',
      paidFeatures: 'Tarifga kiritilmagan xizmatlar balansdan foydalaniladi',
    },
    ru: {
      title: 'Простые и прозрачные цены',
      desc: 'Единоразовая активация. Без скрытых платежей.',
      onetime: 'Разовый платёж',
      monthly: 'Ежемесячно',
      noMonthly: 'Без ежемесячной оплаты ✓',
      perMonth: '/мес',
      start: 'Начать',
      contact: 'Получить предложение',
      popular: 'ПОПУЛЯРНЫЙ',
      stores: 'магазин/МП',
      cards: 'карточек/мес',
      clones: 'клонов/мес',
      discount: 'AI скидка',
      unlimited: 'Безлимит',
      included: 'Включено',
      notIncluded: 'Не включено',
      features: 'Возможности',
      trial: '1 день бесплатно',
      paidFeatures: 'Функции вне тарифа — оплата с баланса',
    },
    en: {
      title: 'Simple, Transparent Pricing',
      desc: 'One-time activation fee. No hidden charges.',
      onetime: 'One-time fee',
      monthly: 'Monthly fee',
      noMonthly: 'No monthly fee ✓',
      perMonth: '/mo',
      start: 'Get Started',
      contact: 'Get a Quote',
      popular: 'MOST POPULAR',
      stores: 'store/MP',
      cards: 'cards/mo',
      clones: 'clones/mo',
      discount: 'AI discount',
      unlimited: 'Unlimited',
      included: 'Included',
      notIncluded: 'Not included',
      features: 'Features',
      trial: '1-day free trial',
      paidFeatures: 'Features outside plan are pay-per-use from balance',
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

  if (isLoading) {
    return (
      <section id="pricing" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Pricing</Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 font-display">{txt.title}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[500px] rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  const activePlans = (plans?.filter(p => p.is_active) || []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section id="pricing" className="py-16 sm:py-24 md:py-32 bg-muted/30">
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

                    {/* Pricing - Clear separation */}
                    <div className="space-y-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                      {/* One-time */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {txt.onetime}
                        </span>
                        <span className="text-sm sm:text-base font-bold">
                          {formatPrice(plan.onetime_price_uzs)} <span className="text-[10px] font-normal text-muted-foreground">so'm</span>
                        </span>
                      </div>
                      {/* Monthly */}
                      <div className="flex items-center justify-between border-t border-border/30 pt-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {txt.monthly}
                        </span>
                        {plan.monthly_fee_uzs > 0 ? (
                          <span className="text-sm font-semibold">
                            {formatPrice(plan.monthly_fee_uzs)} <span className="text-[10px] font-normal text-muted-foreground">so'm{txt.perMonth}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            {txt.noMonthly}
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
                      <div className="flex items-center gap-1">
                        <Image className="h-3 w-3 shrink-0 text-primary" />
                        <span>{plan.free_card_creation_monthly || 0} {txt.cards}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Copy className="h-3 w-3 shrink-0 text-primary" />
                        <span>{plan.free_cloning_monthly || 0} {txt.clones}</span>
                      </div>
                      {plan.balance_discount_percent > 0 && (
                        <div className="flex items-center gap-1">
                          <Percent className="h-3 w-3 shrink-0 text-primary" />
                          <span>{plan.balance_discount_percent}% {txt.discount}</span>
                        </div>
                      )}
                    </div>

                    {/* Feature checklist */}
                    <div className="flex-1 mb-4">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{txt.features}</p>
                      <ul className="space-y-1.5">
                        {DISPLAY_FEATURES.map(feat => {
                          const isIncluded = includedKeys.includes(feat.key);
                          const label = lang === 'ru' ? feat.ru : lang === 'uz' ? feat.uz : feat.en;
                          return (
                            <li key={feat.key} className="flex items-center gap-1.5 text-[11px]">
                              {isIncluded ? (
                                <>
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                  <span className="text-foreground">{label}</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                  <span className="text-muted-foreground/50 line-through">{label}</span>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Trial badge for starter */}
                    {idx === 0 && (
                      <div className="text-center mb-3">
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-600 dark:text-green-400">
                          🎁 {txt.trial}
                        </Badge>
                      </div>
                    )}

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
}
