import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, ArrowRight, Star, Crown, Zap, Sparkles, MessageCircle, Store, Image, Copy, Percent } from 'lucide-react';
import React from 'react';

const iconMap: Record<string, React.ElementType> = {
  zap: Zap, briefcase: Crown, crown: Crown, building: Sparkles, star: Crown,
};

const colorMap: Record<number, { border: string; accent: string; checkColor: string; btnClass: string; topBar: string; badgeBg: string; badgeText: string }> = {
  0: { border: 'border-border', accent: '', checkColor: 'text-primary', btnClass: '', topBar: '', badgeBg: '', badgeText: '' },
  1: { border: 'border-blue-300/50', accent: 'text-blue-600', checkColor: 'text-blue-500', btnClass: 'bg-blue-500 hover:bg-blue-600 text-white', topBar: 'bg-blue-500', badgeBg: 'bg-blue-500/10', badgeText: 'text-blue-600 border-blue-200' },
  2: { border: 'border-primary/50 ring-2 ring-primary/20', accent: 'text-primary', checkColor: 'text-primary', btnClass: 'shadow-lg shadow-primary/20', topBar: 'bg-primary', badgeBg: 'bg-primary/10', badgeText: 'text-primary border-primary/20' },
  3: { border: 'border-amber-300/50', accent: 'text-amber-600', checkColor: 'text-amber-500', btnClass: 'bg-amber-500 hover:bg-amber-600 text-white', topBar: 'bg-gradient-to-r from-amber-500 to-amber-600', badgeBg: 'bg-amber-500/10', badgeText: 'text-amber-600 border-amber-200' },
};

interface DynamicPricingProps {
  FadeInSection: React.ComponentType<{ children: React.ReactNode; className?: string; delay?: number }>;
}

export function DynamicPricing({ FadeInSection }: DynamicPricingProps) {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { language } = useLanguage();
  const lang = (language || 'uz') as 'uz' | 'ru' | 'en';

  const t = {
    uz: { title: 'Oddiy va shaffof narxlar', desc: 'Yashirin to\'lovlar yo\'q. 1 kunlik bepul sinov.', perMonth: '/oyiga', start: 'Boshlash', contact: 'Taklif olish', popular: 'MASHHUR', free: 'Bepul', stores: 'do\'kon/MP', cards: 'kartochka/oy', clones: 'klon/oy', discount: 'chegirma', unlimited: 'Cheksiz' },
    ru: { title: 'Простые и прозрачные цены', desc: 'Никаких скрытых платежей. 1 день бесплатно.', perMonth: '/мес', start: 'Начать', contact: 'Получить предложение', popular: 'ПОПУЛЯРНЫЙ', free: 'Бесплатно', stores: 'магазин/МП', cards: 'карточек/мес', clones: 'клонов/мес', discount: 'скидка', unlimited: 'Безлимит' },
    en: { title: 'Simple, Transparent Pricing', desc: 'No hidden fees. 1-day free trial.', perMonth: '/mo', start: 'Get Started', contact: 'Get a Quote', popular: 'POPULAR', free: 'Free', stores: 'store/MP', cards: 'cards/mo', clones: 'clones/mo', discount: 'discount', unlimited: 'Unlimited' },
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

  if (isLoading) {
    return (
      <section id="pricing" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">Pricing</Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 font-display">{txt.title}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
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
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg">{txt.desc}</p>
        </FadeInSection>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${activePlans.length >= 4 ? 'lg:grid-cols-4' : activePlans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-3 sm:gap-4 md:gap-6 max-w-6xl mx-auto`}>
          {activePlans.map((plan, idx) => {
            const style = colorMap[Math.min(idx, 3)] || colorMap[0];
            const isPopular = idx === 2;
            const isLast = idx === activePlans.length - 1 && activePlans.length > 2;
            const isFree = plan.onetime_price_uzs === 0 && plan.monthly_fee_uzs === 0;
            const Icon = iconMap[plan.icon || 'star'] || Crown;

            const features: string[] = [];
            const storeLabel = plan.max_stores_per_marketplace >= 999 ? txt.unlimited : `${plan.max_stores_per_marketplace}`;
            features.push(`${storeLabel} ${txt.stores}`);
            if (plan.free_card_creation_monthly > 0) features.push(`${plan.free_card_creation_monthly} ${txt.cards}`);
            if (plan.free_cloning_monthly > 0) features.push(`${plan.free_cloning_monthly} ${txt.clones}`);
            if (plan.balance_discount_percent > 0) features.push(`AI ${plan.balance_discount_percent}% ${txt.discount}`);

            return (
              <FadeInSection key={plan.id} delay={idx * 80}>
                <Card className={`relative border-2 ${style.border} ${isPopular ? 'shadow-xl hover:shadow-2xl' : 'shadow-sm hover:shadow-xl'} transition-all h-full hover:-translate-y-1`}>
                  {(style.topBar || isPopular) && (
                    <div className={`absolute top-0 left-0 right-0 h-1 ${style.topBar || 'bg-primary'}`} />
                  )}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-3">
                        <Star className="h-3 w-3 mr-1" />
                        {txt.popular}
                      </Badge>
                    </div>
                  )}
                  <CardContent className={`p-4 sm:p-5 md:p-6 ${isPopular ? 'pt-5 sm:pt-6' : ''}`}>
                    <Badge className={`mb-2 sm:mb-3 ${style.badgeBg || ''} ${style.badgeText || ''} text-[10px] sm:text-xs`} variant={idx === 0 ? 'outline' : 'default'}>
                      <Icon className="h-3 w-3 mr-1" />
                      {plan.name}
                    </Badge>
                    <h3 className="text-base sm:text-lg font-bold mb-1 font-display truncate">{getName(plan)}</h3>
                    <div className="flex items-baseline gap-1 mb-1 flex-wrap">
                      {isFree ? (
                        <span className="text-2xl sm:text-3xl font-bold text-primary font-display">{txt.free}</span>
                      ) : (
                        <>
                          <span className={`text-lg sm:text-2xl font-bold font-display ${isPopular ? 'text-primary' : ''}`}>
                            {plan.onetime_price_uzs.toLocaleString()} <span className="text-xs sm:text-sm font-normal">{lang === 'en' ? 'UZS' : 'so\'m'}</span>
                          </span>
                          {plan.monthly_fee_uzs > 0 && (
                            <span className="text-muted-foreground text-[10px] sm:text-xs">+ {plan.monthly_fee_uzs.toLocaleString()}{txt.perMonth}</span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mb-4 sm:mb-5 line-clamp-2">{getDesc(plan)}</p>
                    <ul className="space-y-2 sm:space-y-2.5 mb-4 sm:mb-6">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 sm:gap-2 text-[12px] sm:text-sm">
                          <CheckCircle className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${style.checkColor} shrink-0 mt-0.5`} />
                          <span className={isPopular ? 'font-medium' : ''}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {isLast ? (
                      <Button className={`w-full ${style.btnClass}`} size="sm" asChild>
                        <a href="https://t.me/sellercloudx" target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          {txt.contact}
                        </a>
                      </Button>
                    ) : (
                      <Button className={`w-full ${style.btnClass}`} size="sm" asChild>
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
      </div>
    </section>
  );
}
