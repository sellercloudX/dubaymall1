import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { 
  CreditCard, AlertTriangle, CheckCircle2, Clock, Crown, 
  Calendar, Receipt, DollarSign, TrendingUp, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface SubscriptionBillingProps {
  totalSalesVolume: number;
}

const USD_TO_UZS = 12800;

export function SubscriptionBilling({ totalSalesVolume }: SubscriptionBillingProps) {
  const { 
    subscription, 
    billing, 
    totalDebt, 
    accessStatus, 
    isLoading,
    createSubscription 
  } = useSellerCloudSubscription();
  const [isCreating, setIsCreating] = useState(false);

  const formatPrice = (price: number, currency: 'uzs' | 'usd' = 'uzs') => {
    if (currency === 'usd') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
    }
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const handleStartSubscription = async (planType: 'pro' | 'enterprise') => {
    setIsCreating(true);
    await createSubscription(planType);
    setIsCreating(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // No subscription - show plans
  if (!subscription) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              SellerCloudX Obuna rejalari
            </CardTitle>
            <CardDescription>
              Marketplacelarni professional boshqarish uchun obunani tanlang
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Pro Plan */}
          <Card className="border-2 border-primary/20 relative">
            <div className="absolute -top-3 left-4">
              <Badge className="bg-primary">Tavsiya etiladi</Badge>
            </div>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>Kichik va o'rta biznes uchun</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold">$499<span className="text-lg font-normal text-muted-foreground">/oy</span></div>
                <div className="text-sm text-muted-foreground">+ savdodan 4%</div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> 4 ta marketplace</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Cheksiz mahsulotlar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> AI Scanner Pro</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Zaxira sinxronizatsiya</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> 24/7 qo'llab-quvvatlash</li>
              </ul>
              <Button 
                className="w-full" 
                onClick={() => handleStartSubscription('pro')}
                disabled={isCreating}
              >
                {isCreating ? 'Yuklanmoqda...' : 'Obunani boshlash'}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>Yirik kompaniyalar uchun</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold">Individual</div>
                <div className="text-sm text-muted-foreground">+ savdodan 2%</div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Pro'dagi barcha imkoniyatlar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Maxsus integratsiyalar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Shaxsiy menejer</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> API kirish</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> SLA kafolati</li>
              </ul>
              <Button variant="outline" className="w-full">
                Bog'lanish
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate current billing
  const monthlyFeeUZS = subscription.monthly_fee * USD_TO_UZS;
  const commissionAmount = totalSalesVolume * (subscription.commission_percent / 100);
  const currentBillingTotal = monthlyFeeUZS + commissionAmount;

  // Status badges
  const getStatusBadge = () => {
    if (!accessStatus) return null;
    
    switch (accessStatus.reason) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Faol</Badge>;
      case 'admin_override':
        return <Badge className="bg-purple-500"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>;
      case 'debt':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Qarzdorlik</Badge>;
      default:
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Nofaol</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Access Status Alert */}
      {accessStatus && !accessStatus.is_active && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">Akkount bloklangan</h4>
                <p className="text-sm text-muted-foreground mt-1">{accessStatus.message}</p>
                {accessStatus.total_debt && accessStatus.total_debt > 0 && (
                  <p className="font-medium mt-2">Qarzdorlik: {formatPrice(accessStatus.total_debt)}</p>
                )}
              </div>
              <Button variant="destructive" size="sm">To'lash</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Obuna ma'lumotlari
              </CardTitle>
              <CardDescription>
                {subscription.plan_type === 'pro' ? 'Pro' : 'Enterprise'} tarif rejasi
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Oylik to'lov
              </div>
              <div className="text-xl font-bold mt-1">${subscription.monthly_fee}</div>
              <div className="text-xs text-muted-foreground">{formatPrice(monthlyFeeUZS)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Komissiya
              </div>
              <div className="text-xl font-bold mt-1">{subscription.commission_percent}%</div>
              <div className="text-xs text-muted-foreground">Savdodan</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Boshlanish
              </div>
              <div className="text-xl font-bold mt-1">{format(new Date(subscription.started_at), 'dd.MM.yy')}</div>
              <div className="text-xs text-muted-foreground">
                {subscription.is_trial && subscription.trial_ends_at && (
                  <>Sinov: {format(new Date(subscription.trial_ends_at), 'dd.MM.yy')}</>
                )}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Joriy oy
              </div>
              <div className="text-xl font-bold mt-1 text-amber-600">{formatPrice(currentBillingTotal)}</div>
              <div className="text-xs text-muted-foreground">To'lanishi kerak</div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Current Month Calculation */}
      <Card>
        <CardHeader>
          <CardTitle>Joriy oy hisob-kitobi</CardTitle>
          <CardDescription>
            {format(new Date(), 'MMMM yyyy')} uchun to'lovlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Oylik abonent to'lovi</span>
              <span className="font-medium">{formatPrice(monthlyFeeUZS)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <span className="text-muted-foreground">Savdodan komissiya ({subscription.commission_percent}%)</span>
                <div className="text-xs text-muted-foreground">Savdo hajmi: {formatPrice(totalSalesVolume)}</div>
              </div>
              <span className="font-medium">{formatPrice(commissionAmount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-lg font-bold">
              <span>Jami to'lanishi kerak</span>
              <span className="text-primary">{formatPrice(currentBillingTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      {billing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>To'lovlar tarixi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {billing.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">
                      {format(new Date(bill.billing_period_start), 'MMMM yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Savdo: {formatPrice(bill.total_sales_volume)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(bill.total_due)}</div>
                    <Badge 
                      variant={
                        bill.status === 'paid' ? 'default' : 
                        bill.status === 'waived' ? 'secondary' : 
                        bill.status === 'overdue' ? 'destructive' : 'outline'
                      }
                    >
                      {bill.status === 'paid' ? 'To\'langan' : 
                       bill.status === 'waived' ? 'Bekor qilingan' :
                       bill.status === 'overdue' ? 'Muddati o\'tgan' : 'Kutilmoqda'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Debt Warning */}
      {totalDebt > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <h4 className="font-semibold">Jami qarzdorlik</h4>
                  <p className="text-sm text-muted-foreground">Qarzdorlikni yoping va akkountni aktivlashtiring</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-destructive">{formatPrice(totalDebt)}</div>
                <Button variant="destructive" size="sm" className="mt-2">Hozir to'lash</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}