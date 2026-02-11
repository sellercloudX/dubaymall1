import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Label } from '@/components/ui/label';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
 import { PaymentModal } from '@/components/payment/PaymentModal';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
import { 
  CreditCard, AlertTriangle, CheckCircle2, Clock, Crown, 
   Calendar, Receipt, DollarSign, TrendingUp, XCircle, FileText, ArrowRight
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
     createSubscription,
     refetch
  } = useSellerCloudSubscription();
  const [isCreating, setIsCreating] = useState(false);
   const [showTermsDialog, setShowTermsDialog] = useState(false);
   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
   const [termsAccepted, setTermsAccepted] = useState(false);

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
     setSelectedPlan(planType);
     setShowTermsDialog(true);
   };
 
   const handleAcceptTerms = async () => {
     if (!termsAccepted) {
       toast.error('Shartlarni qabul qilishingiz kerak');
       return;
     }
     
     setIsCreating(true);
     const result = await createSubscription(selectedPlan);
     
     if (result.success) {
       setShowTermsDialog(false);
       // Show payment modal
       setShowPaymentModal(true);
     } else {
       toast.error(result.error || 'Xatolik yuz berdi');
     }
     setIsCreating(false);
   };
 
   const handlePaymentSuccess = async () => {
     // Update subscription as payment completed
     if (subscription) {
       await supabase
         .from('sellercloud_subscriptions')
         .update({
           initial_payment_completed: true,
           initial_payment_at: new Date().toISOString(),
           terms_accepted: true,
           terms_accepted_at: new Date().toISOString(),
         })
         .eq('id', subscription.id);
     }
     
     toast.success('To\'lov muvaffaqiyatli! Akkountingiz aktivlashtirildi.');
     refetch();
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
       <>
         <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
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
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 4 ta marketplace</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Cheksiz mahsulotlar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> AI Scanner Pro</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Zaxira sinxronizatsiya</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 24/7 qo'llab-quvvatlash</li>
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
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Pro'dagi barcha imkoniyatlar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Maxsus integratsiyalar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Shaxsiy menejer</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> API kirish</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> SLA kafolati</li>
              </ul>
              <Button variant="outline" className="w-full">
                Bog'lanish
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
 
         {/* Terms Dialog */}
         <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
           <DialogContent className="max-w-lg">
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <FileText className="h-5 w-5" />
                 Shartnoma shartlari
               </DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
               <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto text-sm space-y-2">
                 <p className="font-medium">SellerCloudX xizmat shartlari:</p>
                 <ul className="list-disc pl-4 space-y-1">
                   <li>Oylik to'lov: <strong>${selectedPlan === 'pro' ? '499' : 'Individual'}</strong></li>
                   <li>Savdodan komissiya: <strong>{selectedPlan === 'pro' ? '4%' : '2%'}</strong></li>
                   <li>To'lovlar har oy boshida hisoblanadi</li>
                   <li>Marketplace savdo pullari to'g'ridan-to'g'ri sizning hisobingizga tushadi</li>
                   <li>Platforma xizmat haqini alohida hisob-kitob qiladi</li>
                   <li>To'lanmagan hisob-kitoblar akkountni bloklashga olib keladi</li>
                 </ul>
                 <p className="mt-3 font-medium">Mas'uliyat:</p>
                 <ul className="list-disc pl-4 space-y-1">
                   <li>Marketplace API kalitlarini xavfsiz saqlash</li>
                   <li>Marketplacelar qoidalariga rioya qilish</li>
                   <li>To'g'ri va halol savdo yuritish</li>
                 </ul>
               </div>
 
               <div className="flex items-start gap-3 p-3 border rounded-lg">
                 <Checkbox 
                   id="terms" 
                   checked={termsAccepted}
                   onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                 />
                 <Label htmlFor="terms" className="text-sm cursor-pointer">
                   Men yuqoridagi shartlarni o'qidim va qabul qilaman
                 </Label>
               </div>
 
               <Button 
                 onClick={handleAcceptTerms}
                 className="w-full"
                 disabled={!termsAccepted || isCreating}
               >
                 {isCreating ? 'Yuklanmoqda...' : (
                   <>
                     To'lovga o'tish
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </>
                 )}
               </Button>
             </div>
           </DialogContent>
         </Dialog>
 
         {/* Payment Modal */}
         <PaymentModal
           open={showPaymentModal}
           onClose={() => setShowPaymentModal(false)}
           onSuccess={handlePaymentSuccess}
           paymentMethod="click"
           amount={selectedPlan === 'pro' ? 499 * USD_TO_UZS : 999 * USD_TO_UZS}
           orderNumber={`SCX-${Date.now()}`}
           orderId={subscription?.id}
         />
       </>
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
        return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> Faol</Badge>;
      case 'admin_override':
        return <Badge className="bg-accent text-accent-foreground"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>;
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
            <div className="p-4 rounded-lg bg-accent/50 border border-accent">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Joriy oy
              </div>
              <div className="text-xl font-bold mt-1 text-accent-foreground">{formatPrice(currentBillingTotal)}</div>
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