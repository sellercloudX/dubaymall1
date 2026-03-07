import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useFeaturePricing, useUserBalance, MIN_TOPUP_UZS, ACTIVATION_FEE_UZS, TRIAL_DAYS } from '@/hooks/useFeaturePricing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CreditCard, AlertTriangle, CheckCircle2, Clock, Crown, 
  Calendar, Receipt, DollarSign, TrendingUp, XCircle, FileText, 
  ArrowRight, Landmark, Wallet, History, Zap, Shield, ArrowUpDown,
  Sparkles, Settings2, Users, Key,
} from 'lucide-react';
import { format } from 'date-fns';
import { PromoCodeInput, type PromoValidation } from './PromoCodeInput';
import { notifyAffiliatePayment } from '@/lib/affiliateWebhook';

interface SubscriptionBillingProps {
  totalSalesVolume?: number;
}

const USD_TO_UZS = 12800;

const categoryIcons: Record<string, React.ElementType> = {
  card_creation: Sparkles,
  cloning: ArrowUpDown,
  ai_tools: Sparkles,
  pricing: DollarSign,
  sync: ArrowUpDown,
  analytics: Zap,
  management: Settings2,
  activation: Key,
};

const categoryNames: Record<string, string> = {
  card_creation: 'Kartochka yaratish',
  cloning: 'Klonlash',
  ai_tools: 'AI Asboblar',
  pricing: 'Narx boshqarish',
  sync: 'Sinxronizatsiya',
  analytics: 'Analitika',
  management: 'Boshqaruv',
  activation: 'Aktivatsiya',
};

export function SubscriptionBilling({ totalSalesVolume }: SubscriptionBillingProps) {
  const { user } = useAuth();
  const { 
    subscription, 
    billing, 
    totalDebt, 
    accessStatus, 
    isLoading,
    createSubscription,
    refetch
  } = useSellerCloudSubscription();
  const { features } = useFeaturePricing();
  const { balance, transactions, loadingTx, payActivation } = useUserBalance();
  const [isCreating, setIsCreating] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [promoValidation, setPromoValidation] = useState<PromoValidation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'click' | 'uzum'>('click');
  const [showUzumInstructions, setShowUzumInstructions] = useState(false);
  const [uzumPaymentAmount, setUzumPaymentAmount] = useState(0);
  const [isPayingActivation, setIsPayingActivation] = useState(false);

  const formatPrice = (price: number, currency: 'uzs' | 'usd' = 'uzs') => {
    if (currency === 'usd') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
    }
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  // Check activation status
  const activationPaidUntil = (subscription as any)?.activation_paid_until;
  const activationTrialEnds = (subscription as any)?.activation_trial_ends;
  const isActivationActive = activationPaidUntil && new Date(activationPaidUntil) > new Date();
  const isTrialActive = activationTrialEnds && new Date(activationTrialEnds) > new Date();
  const needsActivation = subscription && !isActivationActive && !isTrialActive && subscription.plan_type !== 'enterprise';

  const handlePayActivation = async () => {
    setIsPayingActivation(true);
    try {
      const result = await payActivation();
      if (!result.success) {
        if (result.error === 'insufficient_balance') {
          toast.error(`Balans yetarli emas. Kamida ${MIN_TOPUP_UZS.toLocaleString()} so'm to'ldiring.`);
        } else {
          toast.error(result.error || 'Xatolik yuz berdi');
        }
      }
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    } finally {
      setIsPayingActivation(false);
    }
  };

  // --- existing payment handlers (kept as-is) ---
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
      setShowPaymentModal(true);
    } else {
      toast.error(result.error || 'Xatolik yuz berdi');
    }
    setIsCreating(false);
  };

  const getDiscount = (months: number) => {
    if (months >= 6) return 0.15;
    if (months >= 3) return 0.10;
    return 0;
  };

  const handleSubscriptionPayment = async (months: number = 1) => {
    if (!subscription) return;
    const baseMonthlyUSD = subscription.monthly_fee;
    const promoDiscount = (promoValidation && months === 1) ? (promoValidation.discount || 0) : 0;
    const firstMonthUSD = baseMonthlyUSD - promoDiscount;
    let totalAmountUSD: number;
    if (months === 1) {
      totalAmountUSD = firstMonthUSD;
    } else {
      const discount = getDiscount(months);
      totalAmountUSD = Math.round((firstMonthUSD + baseMonthlyUSD * (months - 1)) * (1 - discount));
    }
    const totalAmount = Math.round(totalAmountUSD * USD_TO_UZS);
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('click-payment', {
        body: {
          paymentType: 'subscription',
          subscriptionId: subscription.id,
          amount: totalAmount,
          months,
          promoCode: promoValidation?.promo_id ? promoValidation : undefined,
          returnUrl: window.location.origin + '/seller-cloud-mobile?tab=billing'
        }
      });
      if (error) throw error;
      if (data?.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        toast.success('Click to\'lov sahifasi ochildi.');
        if (user?.email) {
          const isFirstPayment = !billing.some(b => b.status === 'paid');
          notifyAffiliatePayment({
            eventType: isFirstPayment ? 'FIRST_PAYMENT' : 'RENEWAL',
            customerEmail: user.email,
            customerName: user.user_metadata?.full_name || '',
            customerPhone: user.user_metadata?.phone || '',
            amount: totalAmountUSD,
            currency: 'USD',
            promoCode: promoValidation ? promoValidation.promo_id || '' : undefined,
            providerPaymentId: data.orderId || `SCX-${Date.now()}`,
          }).catch(err => console.warn('Affiliate webhook failed:', err));
        }
      }
    } catch (error: any) {
      toast.error('To\'lov xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleUzumPayment = async (months: number = 1) => {
    if (!subscription) return;
    const baseMonthlyUSD = subscription.monthly_fee;
    const promoDiscount = (promoValidation && months === 1) ? (promoValidation.discount || 0) : 0;
    const firstMonthUSD = baseMonthlyUSD - promoDiscount;
    let totalAmountUSD: number;
    if (months === 1) {
      totalAmountUSD = firstMonthUSD;
    } else {
      const discount = getDiscount(months);
      totalAmountUSD = Math.round((firstMonthUSD + baseMonthlyUSD * (months - 1)) * (1 - discount));
    }
    const totalAmountUZS = Math.round(totalAmountUSD * USD_TO_UZS);
    setUzumPaymentAmount(totalAmountUZS);
    setShowUzumInstructions(true);
    if (user?.email) {
      const isFirstPayment = !billing.some(b => b.status === 'paid');
      notifyAffiliatePayment({
        eventType: isFirstPayment ? 'FIRST_PAYMENT' : 'RENEWAL',
        customerEmail: user.email,
        customerName: user.user_metadata?.full_name || '',
        customerPhone: user.user_metadata?.phone || '',
        amount: totalAmountUSD,
        currency: 'USD',
        promoCode: promoValidation ? promoValidation.promo_id || '' : undefined,
        providerPaymentId: `SCX-UZUM-${Date.now()}`,
      }).catch(err => console.warn('Affiliate webhook failed:', err));
    }
  };

  const handlePayment = async (months: number = 1) => {
    if (paymentMethod === 'uzum') {
      await handleUzumPayment(months);
    } else {
      await handleSubscriptionPayment(months);
    }
  };

  const handleInitialPayment = async () => {
    if (!subscription) return;
    await handlePayment(1);
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
            <Card className="border-2 border-primary/20 relative">
              <div className="absolute -top-3 left-4">
                <Badge className="bg-primary text-primary-foreground">Tavsiya etiladi</Badge>
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>Kichik va o'rta biznes uchun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">Bepul</div>
                  <div className="text-sm text-muted-foreground">Balans orqali pullik xizmatlar</div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 4 ta marketplace</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Cheksiz mahsulotlar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> AI Scanner Pro</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Zaxira sinxronizatsiya</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 24/7 qo'llab-quvvatlash</li>
                </ul>
                <Button className="w-full" onClick={() => handleStartSubscription('pro')} disabled={isCreating}>
                  {isCreating ? 'Yuklanmoqda...' : 'Obunani boshlash'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>Yirik kompaniyalar uchun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">Individual</div>
                  <div className="text-sm text-muted-foreground">Maxsus narxlar</div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Pro'dagi barcha imkoniyatlar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Maxsus integratsiyalar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Shaxsiy menejer</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> API kirish</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> SLA kafolati</li>
                </ul>
                <Button variant="outline" className="w-full">Bog'lanish</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Terms Dialog */}
        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Shartnoma shartlari
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto text-sm space-y-2">
                <p className="font-medium">SellerCloudX xizmat shartlari:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Bepul marketplace ulash va boshqarish</li>
                  <li>Bepul analitika va hisobotlar</li>
                  <li>Pullik AI xizmatlari balans orqali</li>
                  <li>Balansni to'ldirish: kamida {MIN_TOPUP_UZS.toLocaleString()} so'm</li>
                  <li>Sotuvdan hech qanday foiz olinmaydi</li>
                </ul>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
                <Label htmlFor="terms" className="text-sm cursor-pointer">Men yuqoridagi shartlarni o'qidim va qabul qilaman</Label>
              </div>
              <Button onClick={handleAcceptTerms} className="w-full" disabled={!termsAccepted || isCreating}>
                {isCreating ? 'Yuklanmoqda...' : <>To'lovga o'tish <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> To'lovni amalga oshirish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tarif:</span>
                  <span className="font-medium">{selectedPlan === 'pro' ? 'Pro' : 'Enterprise'}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">Oylik to'lov:</span>
                  <span className="font-bold">${selectedPlan === 'pro' ? '499' : 'Individual'}</span>
                </div>
                {promoValidation && (
                  <div className="flex justify-between items-center mt-1 text-green-600">
                    <span className="text-sm">Promo chegirma:</span>
                    <span className="font-bold">-${promoValidation.discount}</span>
                  </div>
                )}
              </div>
              <PromoCodeInput customerEmail={user?.email || ''} onValidated={setPromoValidation} disabled={isCreating} />
              <div className="flex gap-2">
                <Button variant={paymentMethod === 'click' ? 'default' : 'outline'} className="flex-1" onClick={() => setPaymentMethod('click')} type="button">
                  <CreditCard className="h-4 w-4 mr-1" /> Click
                </Button>
                <Button variant={paymentMethod === 'uzum' ? 'default' : 'outline'} className="flex-1" onClick={() => setPaymentMethod('uzum')} type="button">
                  <Landmark className="h-4 w-4 mr-1" /> Uzum Bank
                </Button>
              </div>
              <Button onClick={handleInitialPayment} className="w-full" disabled={isCreating || !subscription}>
                {isCreating ? 'Yuklanmoqda...' : <>{paymentMethod === 'click' ? 'Click' : 'Uzum Bank'} orqali to'lash <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Muammo bormi? Telegram: <a href="https://t.me/sellercloudx_support" target="_blank" className="text-primary underline">@sellercloudx_support</a>
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Uzum Payment Instructions */}
        <Dialog open={showUzumInstructions} onOpenChange={setShowUzumInstructions}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Uzum Bank orqali to'lov</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm font-medium">To'lov qilish tartibi:</p>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  <li>Uzum Bank ilovasini oching</li>
                  <li><strong>"To'lovlar"</strong> bo'limiga o'ting</li>
                  <li><strong>"SellerCloudX"</strong> xizmatini toping</li>
                  <li>Quyidagi <strong>hisob raqamni</strong> kiriting:</li>
                </ol>
                <div className="p-3 bg-background rounded-lg border-2 border-primary/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Hisob raqam:</p>
                  <p className="font-mono text-lg font-bold text-primary select-all break-all">{subscription?.id || '—'}</p>
                  <Button variant="ghost" size="sm" className="mt-1" onClick={() => { navigator.clipboard.writeText(subscription?.id || ''); toast.success('Nusxalandi!'); }}>
                    📋 Nusxalash
                  </Button>
                </div>
                <div className="p-3 bg-background rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Miqdor:</p>
                  <p className="text-xl font-bold">{formatPrice(uzumPaymentAmount)}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setShowUzumInstructions(false); refetch(); }}>
                Tushundim, to'lov qilaman
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const monthlyFeeUZS = subscription.monthly_fee * USD_TO_UZS;
  const currentBillingTotal = monthlyFeeUZS;

  const getStatusBadge = () => {
    if (!accessStatus) return null;
    switch (accessStatus.reason) {
      case 'active': return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> Faol</Badge>;
      case 'admin_override': return <Badge className="bg-accent text-accent-foreground"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>;
      case 'debt': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Qarzdorlik</Badge>;
      default: return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Nofaol</Badge>;
    }
  };

  // Group features by category
  const featuresByCategory = features?.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, typeof features>) || {};

  return (
    <div className="space-y-6">
      {/* Access Status Alert */}
      {accessStatus && !accessStatus.is_active && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">Akkount bloklangan</h4>
                <p className="text-sm text-muted-foreground mt-1">{accessStatus.message}</p>
                {accessStatus.total_debt && accessStatus.total_debt > 0 && (
                  <p className="font-medium mt-2">Qarzdorlik: {formatPrice(accessStatus.total_debt)}</p>
                )}
              </div>
              <Button variant="destructive" size="sm" onClick={() => handlePayment(1)} disabled={isCreating}>
                {isCreating ? '...' : 'To\'lash'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activation Warning */}
      {needsActivation && (
        <Card className="border-amber-400/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Key className="h-6 w-6 text-amber-500 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-700 dark:text-amber-400">Oylik aktivatsiya talab qilinadi</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {isTrialActive 
                    ? `Sinov muddati: ${format(new Date(activationTrialEnds), 'dd.MM.yyyy')} gacha`
                    : `Aktivatsiya muddati tugagan. Davom etish uchun ${ACTIVATION_FEE_UZS.toLocaleString()} so'm to'lang.`
                  }
                </p>
                {!isTrialActive && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Balansdan yechiladi. Balans yetarli emas? Kamida {MIN_TOPUP_UZS.toLocaleString()} so'm to'ldiring.
                  </p>
                )}
              </div>
              {!isTrialActive && (
                <Button size="sm" onClick={handlePayActivation} disabled={isPayingActivation}>
                  {isPayingActivation ? '...' : `${ACTIVATION_FEE_UZS.toLocaleString()} so'm`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Obuna | Balans | Narxlar */}
      <Tabs defaultValue="subscription">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="subscription" className="gap-1.5 text-xs">
            <CreditCard className="h-3.5 w-3.5" /> Obuna
          </TabsTrigger>
          <TabsTrigger value="balance" className="gap-1.5 text-xs">
            <Wallet className="h-3.5 w-3.5" /> Balans
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Tarix
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Narxlar
          </TabsTrigger>
        </TabsList>

        {/* === TAB 1: SUBSCRIPTION === */}
        <TabsContent value="subscription" className="space-y-6 mt-4">
          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" /> Obuna ma'lumotlari
                  </CardTitle>
                  <CardDescription>{subscription.plan_type === 'pro' ? 'Pro' : 'Enterprise'} tarif rejasi</CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Oylik</div>
                  <div className="text-lg font-bold mt-1">${subscription.monthly_fee}</div>
                  <div className="text-[10px] text-muted-foreground">{formatPrice(monthlyFeeUZS)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Model</div>
                  <div className="text-lg font-bold mt-1">Balans</div>
                  <div className="text-[10px] text-muted-foreground">Xizmatlar uchun</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Holat</div>
                  <div className="text-lg font-bold mt-1">
                    {(subscription as any).activated_until
                      ? format(new Date((subscription as any).activated_until), 'dd.MM.yy')
                      : format(new Date(subscription.started_at), 'dd.MM.yy')
                    }
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {(subscription as any).activated_until ? (
                      new Date((subscription as any).activated_until) > new Date()
                        ? `${Math.ceil((new Date((subscription as any).activated_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} kun qoldi`
                        : 'Muddati tugagan'
                    ) : subscription.is_trial && subscription.trial_ends_at ? (
                      <>Sinov: {format(new Date(subscription.trial_ends_at), 'dd.MM.yy')}</>
                    ) : null}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-accent">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Joriy oy</div>
                  <div className="text-lg font-bold mt-1 text-accent-foreground">{formatPrice(currentBillingTotal)}</div>
                  <div className="text-[10px] text-muted-foreground">To'lanishi kerak</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Month Calculation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Joriy oy hisob-kitobi</CardTitle>
              <CardDescription>{format(new Date(), 'MMMM yyyy')} uchun</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Oylik abonent to'lovi</span>
                  <span className="font-medium text-sm">{formatPrice(monthlyFeeUZS)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Savdodan komissiya</span>
                  <span className="font-medium text-sm text-primary">0% — Olinmaydi ✓</span>
                </div>
                <div className="flex items-center justify-between py-2 text-base font-bold">
                  <span>Jami</span>
                  <span className="text-primary">{formatPrice(currentBillingTotal)}</span>
                </div>
              </div>

              {/* Payment options */}
              <div className="mt-6 pt-4 border-t border-border space-y-3">
                <PromoCodeInput customerEmail={user?.email || ''} onValidated={setPromoValidation} disabled={isCreating} />
                <div className="flex gap-2">
                  <Button variant={paymentMethod === 'click' ? 'default' : 'outline'} className="flex-1" onClick={() => setPaymentMethod('click')} type="button">
                    <CreditCard className="h-4 w-4 mr-1" /> Click
                  </Button>
                  <Button variant={paymentMethod === 'uzum' ? 'default' : 'outline'} className="flex-1" onClick={() => setPaymentMethod('uzum')} type="button">
                    <Landmark className="h-4 w-4 mr-1" /> Uzum Bank
                  </Button>
                </div>

                {[1, 3, 6].map(months => {
                  const discount = getDiscount(months);
                  const total = months === 1
                    ? (promoValidation ? (subscription.monthly_fee - (promoValidation.discount || 0)) * USD_TO_UZS : monthlyFeeUZS)
                    : Math.round(monthlyFeeUZS * months * (1 - discount));
                  const original = monthlyFeeUZS * months;
                  const hasDiscount = discount > 0 || (months === 1 && promoValidation);
                  return (
                    <div key={months} className="relative">
                      {hasDiscount && (
                        <div className="absolute -top-2 right-3 z-10">
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                            {months === 1 && promoValidation ? `-$${promoValidation.discount}` : `-${discount * 100}%`}
                          </Badge>
                        </div>
                      )}
                      <Button
                        variant={months === 6 ? 'default' : 'outline'}
                        onClick={() => handlePayment(months)}
                        disabled={isCreating}
                        className={`w-full justify-between h-auto py-3 px-4 ${hasDiscount ? 'border-primary/30' : ''}`}
                      >
                        <span className="text-sm font-medium">{months} oy</span>
                        <div className="flex items-center gap-2">
                          {hasDiscount && <span className="text-xs text-foreground/60 line-through">{formatPrice(original)}</span>}
                          <span className="font-bold text-sm">{formatPrice(total)}</span>
                        </div>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Billing History */}
          {billing.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">To'lovlar tarixi</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {billing.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <div className="font-medium text-sm">{format(new Date(bill.billing_period_start), 'MMMM yyyy')}</div>
                        <div className="text-xs text-muted-foreground">Savdo: {formatPrice(bill.total_sales_volume)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatPrice(bill.total_due)}</div>
                        <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'waived' ? 'secondary' : bill.status === 'overdue' ? 'destructive' : 'outline'} className="text-[10px]">
                          {bill.status === 'paid' ? 'To\'langan' : bill.status === 'waived' ? 'Bekor' : bill.status === 'overdue' ? 'Muddati o\'tgan' : 'Kutilmoqda'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {totalDebt > 0 && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <div>
                      <h4 className="font-semibold">Jami qarzdorlik</h4>
                      <p className="text-sm text-muted-foreground">Akkountni aktivlashtirish uchun to'lang</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-destructive">{formatPrice(totalDebt)}</div>
                    <Button variant="destructive" size="sm" className="mt-2" onClick={() => handlePayment(1)} disabled={isCreating}>
                      {isCreating ? '...' : 'Hozir to\'lash'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === TAB 2: BALANCE === */}
        <TabsContent value="balance" className="space-y-4 mt-4">
          {/* Balance Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Balans</CardTitle>
              <CardDescription>AI funksiyalar va pullik xizmatlar uchun</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Joriy balans</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {balance ? Number(balance.balance_uzs).toLocaleString() : '0'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">UZS</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jami kirim</p>
                  <p className="text-lg font-bold mt-1">
                    {balance ? Number(balance.total_deposited).toLocaleString() : '0'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">UZS</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jami chiqim</p>
                  <p className="text-lg font-bold mt-1">
                    {balance ? Number(balance.total_spent).toLocaleString() : '0'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">UZS</p>
                </div>
              </div>

              {/* Top-up section */}
              <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Balansni to'ldirish
                </h4>
                <p className="text-xs text-muted-foreground">
                  Minimal to'ldirish miqdori: <strong>{MIN_TOPUP_UZS.toLocaleString()} so'm</strong>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled>
                    <CreditCard className="h-4 w-4 mr-1" /> Click (tez kunda)
                  </Button>
                  <Button variant="outline" className="flex-1" disabled>
                    <Landmark className="h-4 w-4 mr-1" /> Uzum (tez kunda)
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Hozircha admin orqali to'ldiring: <a href="https://t.me/sellercloudx_support" target="_blank" className="text-primary underline">@sellercloudx_support</a>
                </p>
              </div>

              {/* Activation info */}
              <div className="mt-4 p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Oylik aktivatsiya</span>
                  </div>
                  {isActivationActive ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {format(new Date(activationPaidUntil), 'dd.MM.yy')} gacha
                    </Badge>
                  ) : isTrialActive ? (
                    <Badge variant="secondary" className="text-[10px]">
                      <Clock className="h-3 w-3 mr-1" /> Sinov: {format(new Date(activationTrialEnds), 'dd.MM.yy')}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handlePayActivation} disabled={isPayingActivation}>
                      {isPayingActivation ? '...' : `${ACTIVATION_FEE_UZS.toLocaleString()} so'm`}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Free tarif uchun {TRIAL_DAYS} kunlik bepul sinov, keyin oyiga {ACTIVATION_FEE_UZS.toLocaleString()} so'm
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === TAB 3: TRANSACTIONS === */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Tranzaksiyalar tarixi
              </CardTitle>
              <CardDescription>Balans o'zgarishlari va xarajatlar logi</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTx ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Hali tranzaksiyalar yo'q</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {transactions.map((tx) => {
                    const isDebit = tx.transaction_type === 'deduction' || tx.amount < 0;
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDebit ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            {isDebit 
                              ? <ArrowRight className="h-4 w-4 text-destructive rotate-45" /> 
                              : <ArrowRight className="h-4 w-4 text-primary -rotate-135" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {tx.description || tx.feature_key || tx.transaction_type}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(tx.created_at), 'dd.MM.yy HH:mm')}
                              {tx.feature_key && <span className="ml-1 font-mono">• {tx.feature_key}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-sm font-bold ${isDebit ? 'text-destructive' : 'text-primary'}`}>
                            {isDebit ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Qoldiq: {Number(tx.balance_after).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === TAB 4: PRICING === */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Xizmatlar narxi
              </CardTitle>
              <CardDescription>Har bir funksiya uchun balansdan yechiladigan narx</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tier explanation */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-center">
                  <Badge variant="secondary" className="text-[10px] mb-1">Free</Badge>
                  <p className="text-[10px] text-muted-foreground">To'liq narx</p>
                </div>
                <div className="text-center">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] mb-1">Premium</Badge>
                  <p className="text-[10px] text-muted-foreground">30% chegirma</p>
                </div>
                <div className="text-center">
                  <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-[10px] mb-1">Elegant</Badge>
                  <p className="text-[10px] text-muted-foreground">0 so'm + limit</p>
                </div>
              </div>

              {Object.entries(featuresByCategory).map(([cat, catFeatures]) => {
                if (!catFeatures || catFeatures.length === 0) return null;
                const CatIcon = categoryIcons[cat] || Zap;
                return (
                  <div key={cat}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                      <CatIcon className="h-3.5 w-3.5" /> {categoryNames[cat] || cat}
                    </h4>
                    <div className="space-y-1">
                      {catFeatures.map(f => (
                        <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm">{f.feature_name_uz || f.feature_name}</span>
                            {f.is_free && <Badge variant="secondary" className="text-[8px] px-1 py-0">Bepul</Badge>}
                          </div>
                          <div className="text-right shrink-0">
                            {f.is_free ? (
                              <span className="text-sm font-medium text-primary">Bepul</span>
                            ) : (
                              <span className="text-sm font-bold">{f.base_price_uzs.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">UZS</span></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Uzum Payment Instructions Dialog */}
      <Dialog open={showUzumInstructions} onOpenChange={setShowUzumInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Uzum Bank orqali to'lov</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Uzum Bank ilovasini oching</li>
                <li><strong>"SellerCloudX"</strong> xizmatini toping</li>
                <li>Hisob raqamni kiriting:</li>
              </ol>
              <div className="p-3 bg-background rounded-lg border-2 border-primary/30 text-center">
                <p className="font-mono text-lg font-bold text-primary select-all break-all">{subscription?.id || '—'}</p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => { navigator.clipboard.writeText(subscription?.id || ''); toast.success('Nusxalandi!'); }}>
                  📋 Nusxalash
                </Button>
              </div>
              <div className="p-3 bg-background rounded-lg border text-center">
                <p className="text-xs text-muted-foreground mb-1">Miqdor:</p>
                <p className="text-xl font-bold">{formatPrice(uzumPaymentAmount)}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setShowUzumInstructions(false); refetch(); }}>
              Tushundim, to'lov qilaman
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}