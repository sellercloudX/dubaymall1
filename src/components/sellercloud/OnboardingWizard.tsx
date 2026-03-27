import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Globe, Key, BarChart3, ArrowRight, Clock, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  connectedMarketplaces: string[];
  trialEndsAt?: string;
  onNavigate: (tab: string) => void;
  onDismiss: () => void;
}

const STEPS = [
  {
    id: 'connect',
    icon: Globe,
    titleUz: 'Marketplace ulang',
    titleRu: 'Подключите маркетплейс',
    descUz: 'API kalitingiz bilan Uzum, Yandex yoki WB ulang',
    descRu: 'Подключите Uzum, Yandex или WB с помощью API-ключа',
    tab: 'marketplaces',
    check: (props: OnboardingWizardProps) => props.connectedMarketplaces.length > 0,
  },
  {
    id: 'sync',
    icon: Key,
    titleUz: 'Ma\'lumotlar sinxronlansin',
    titleRu: 'Дождитесь синхронизации',
    descUz: 'Marketplace ulangandan so\'ng mahsulot va buyurtmalar avtomatik yuklanadi',
    descRu: 'После подключения товары и заказы загрузятся автоматически',
    tab: 'products',
    check: (props: OnboardingWizardProps) => props.connectedMarketplaces.length > 0,
  },
  {
    id: 'tutorials',
    icon: BookOpen,
    titleUz: 'Qo\'llanmalarni ko\'ring',
    titleRu: 'Просмотрите обучение',
    descUz: 'Video darsliklar orqali platformadan to\'liq foydalaning',
    descRu: 'Изучите видеоуроки для полноценного использования',
    tab: 'tutorials',
    check: () => false,
  },
  {
    id: 'analytics',
    icon: BarChart3,
    titleUz: 'Analitikani ko\'ring',
    titleRu: 'Изучите аналитику',
    descUz: 'Sotuv, foyda va ABC tahlilni ko\'rib chiqing',
    descRu: 'Просмотрите продажи, прибыль и ABC-анализ',
    tab: 'sales',
    check: () => false,
  },
];

export function OnboardingWizard({ connectedMarketplaces, trialEndsAt, onNavigate, onDismiss }: OnboardingWizardProps) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('scx-onboarding-dismissed') === 'true'; } catch { return false; }
  });

  if (dismissed) return null;

  const completedCount = STEPS.filter(s => s.check({ connectedMarketplaces, onNavigate, onDismiss } as OnboardingWizardProps)).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);
  
  const trialHoursLeft = trialEndsAt
    ? Math.max(0, Math.round((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60)))
    : null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('scx-onboarding-dismissed', 'true'); } catch {}
    onDismiss();
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.02] mb-4">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Boshlash yo'riqnomasi</span>
          </div>
          <div className="flex items-center gap-2">
            {trialHoursLeft !== null && trialHoursLeft <= 24 && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                <Clock className="h-3 w-3 mr-1" />
                {trialHoursLeft > 0 ? `${trialHoursLeft} soat qoldi` : 'Sinov tugadi'}
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={handleDismiss}>
              Yopish
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-1.5 mb-4" />

        <div className="grid gap-2">
          {STEPS.map((step) => {
            const done = step.check({ connectedMarketplaces, onNavigate, onDismiss } as OnboardingWizardProps);
            return (
              <button
                key={step.id}
                onClick={() => onNavigate(step.tab)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg text-left transition-all w-full',
                  done
                    ? 'bg-primary/5 opacity-70'
                    : 'bg-card border hover:border-primary/30 hover:shadow-sm'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  done ? 'bg-primary/10' : 'bg-muted'
                )}>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <step.icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{step.titleUz}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.descUz}</p>
                </div>
                {!done && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>

        {completedCount === STEPS.length && (
          <div className="mt-3 text-center">
            <p className="text-sm text-primary font-medium">🎉 Tabriklaymiz! Asosiy sozlamalar tayyor.</p>
            <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={handleDismiss}>
              Yo'riqnomani yopish
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
