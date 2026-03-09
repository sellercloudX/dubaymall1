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
  Calendar, DollarSign, TrendingUp, XCircle, FileText, 
  ArrowRight, Landmark, Wallet, History, Zap, ArrowUpDown,
  Sparkles, Settings2, Key, Rocket, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { PromoCodeInput, type PromoValidation } from './PromoCodeInput';
import { notifyAffiliatePayment } from '@/lib/affiliateWebhook';

interface SubscriptionBillingProps {
  totalSalesVolume?: number;
}

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

const PLAN_PRICES = {
  premium: {
    amount_uzs: 1_270_000, // ~$99/month
    label: 'Premium',
    duration: '1 oy',
    months: 1,
  },
  elegant: {
    amount_uzs: 6_400_000,
    label: 'Elegant',
    duration: '1 oy',
    months: 1,
  },
};

const TOPUP_OPTIONS = [300_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

function BalanceTopup({ userId }: { userId?: string }) {
  const [selectedAmount, setSelectedAmount] = useState<number>(TOPUP_OPTIONS[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const formatP = (p: number) => {
    if (p >= 1_000_000) return (p / 1_000_000).toFixed(1) + ' mln';
    return (p / 1_000).toFixed(0) + ' ming';
  };

  const amount = useCustom ? Number(customAmount) : selectedAmount;

  const handleTopup = async () => {
    if (!userId) { toast.error('Avval tizimga kiring'); return; }
    if (!amount || amount < MIN_TOPUP_UZS) {
      toast.error(`Minimal summa: ${MIN_TOPUP_UZS.toLocaleString()} so'm`);
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('click-payment', {
        body: {
          action: 'topup',
          user_id: userId,
          amount_uzs: amount,
          return_url: window.location.origin + '/seller-cloud?tab=balance',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Xatolik');
      toast.success("To'lov sahifasiga yo'naltirilmoqda...");
      window.open(data.payment_url, '_blank');
    } catch (err: any) {
      toast.error("To'lov xatoligi: " + (err.message || "Qaytadan urinib ko'ring"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <DollarSign className="h-4 w-4" /> Balansni to'ldirish
      </h4>
      <p className="text-xs text-muted-foreground">
        Minimal: <strong>{MIN_TOPUP_UZS.toLocaleString()} so'm</strong>
      </p>

      {/* Preset amounts */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {TOPUP_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => { setSelectedAmount(opt); setUseCustom(false); }}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              !useCustom && selectedAmount === opt
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {formatP(opt)}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUseCustom(!useCustom)}
          className={`text-xs underline ${useCustom ? 'text-primary' : 'text-muted-foreground'}`}
        >
          Boshqa summa
        </button>
        {useCustom && (
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Summa kiriting"
            min={MIN_TOPUP_UZS}
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm"
          />
        )}
      </div>

      {/* Pay button */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleTopup}
        disabled={isProcessing || !amount || amount < MIN_TOPUP_UZS}
      >
        {isProcessing ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
        ) : (
          <><CreditCard className="h-4 w-4 mr-2" /> Click orqali {amount >= MIN_TOPUP_UZS ? `${amount.toLocaleString()} so'm` : ''} to'ldirish</>
        )}
      </Button>
    </div>
  );
}

export function SubscriptionBilling({ totalSalesVolume }: SubscriptionBillingProps) {
  const { user } = useAuth();
  const { 
    subscription, billing, totalDebt, accessStatus, isLoading,
    createSubscription, refetch
  } = useSellerCloudSubscription();
  const { features } = useFeaturePricing();
  const { balance, transactions, loadingTx, payActivation } = useUserBalance();
  const [isCreating, setIsCreating] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPayingActivation, setIsPayingActivation] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

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
        toast.error(result.error === 'insufficient_balance' 
          ? `Balans yetarli emas. Kamida ${MIN_TOPUP_UZS.toLocaleString()} so'm to'ldiring.`
          : (result.error || 'Xatolik yuz berdi'));
      }
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    } finally {
      setIsPayingActivation(false);
    }
  };

  const handleStartFree = () => setShowTermsDialog(true);

  const handleAcceptTerms = async () => {
    if (!termsAccepted) { toast.error('Shartlarni qabul qilishingiz kerak'); return; }
    setIsCreating(true);
    const result = await createSubscription('pro', 0);
    if (result.success) {
      setShowTermsDialog(false);
      toast.success('Tabriklaymiz! Akkauntingiz faollashtirildi.');
    } else {
      toast.error(result.error || 'Xatolik yuz berdi');
    }
    setIsCreating(false);
  };

  const handleClickPayment = async (planKey: 'premium' | 'elegant') => {
    if (!user?.id) { toast.error('Avval tizimga kiring'); return; }
    const plan = PLAN_PRICES[planKey];
    setIsProcessingPayment(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('click-payment', {
        body: {
          action: 'prepare',
          user_id: user.id,
          plan_type: planKey === 'elegant' ? 'enterprise' : planKey,
          amount_uzs: plan.amount_uzs,
          return_url: window.location.origin + '/seller-cloud?tab=subscription',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Xatolik');
      toast.success(`To'lov sahifasiga yo'naltirilmoqda...`);
      window.open(data.payment_url, '_blank');
    } catch (err: any) {
      toast.error('To\'lov xatoligi: ' + (err.message || 'Qaytadan urinib ko\'ring'));
    } finally {
      setIsProcessingPayment(null);
    }
  };

  if (isLoading) {
    return (<div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>);
  }

  // ========== NO SUBSCRIPTION — SHOW PLANS ==========
  if (!subscription) {
    return (
      <>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                SellerCloudX — Boshlash
              </CardTitle>
              <CardDescription>
                Marketplace boshqaruvini bepul boshlang, pullik AI xizmatlardan balans orqali foydalaning
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            {/* FREE */}
            <Card className="border-2 border-primary/30 relative">
              <div className="absolute -top-3 left-4">
                <Badge className="bg-primary text-primary-foreground">Bepul boshlash</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Free</CardTitle>
                <CardDescription>Yangi sotuvchilar uchun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold text-primary">Bepul</div>
                  <div className="text-xs text-muted-foreground mt-1">{TRIAL_DAYS} kunlik sinov, keyin {ACTIVATION_FEE_UZS.toLocaleString()} so'm/oy</div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> 4 ta marketplace ulash</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Analitika va hisobotlar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Buyurtmalarni boshqarish</li>
                  <li className="flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground shrink-0" /> AI xizmatlar — balans orqali</li>
                </ul>
                <Button className="w-full" size="lg" onClick={handleStartFree} disabled={isCreating}>
                  <Rocket className="h-4 w-4 mr-2" />
                  {isCreating ? 'Yuklanmoqda...' : 'Bepul boshlash'}
                </Button>
              </CardContent>
            </Card>

            {/* PREMIUM */}
            <Card className="border-2 border-amber-300/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Premium
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]">40% chegirma</Badge>
                </CardTitle>
                <CardDescription>Faol sotuvchilar uchun</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">{formatPrice(PLAN_PRICES.premium.amount_uzs)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Oylik to'lov, aktivatsiya bepul</div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" /> Free'dagi barcha imkoniyatlar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" /> Pullik xizmatlar 40% arzon, cheksiz</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" /> Oylik aktivatsiya bepul</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" /> Ustuvor qo'llab-quvvatlash</li>
                </ul>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" size="lg" 
                  onClick={() => handleClickPayment('premium')} disabled={isProcessingPayment === 'premium'}>
                  {isProcessingPayment === 'premium' 
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
                    : <><CreditCard className="h-4 w-4 mr-2" /> Click orqali to'lash</>}
                </Button>
              </CardContent>
            </Card>

            {/* ELEGANT */}
            <Card className="border-2 border-violet-300/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Elegant
                  <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-[10px]">0 so'm AI</Badge>
                </CardTitle>
                <CardDescription>Katta hajmdagi biznes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">{formatPrice(PLAN_PRICES.elegant.amount_uzs)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Oylik to'lov, barcha xizmatlar bepul</div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" /> Premium'dagi barcha imkoniyatlar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" /> AI xizmatlar 0 so'm (limitli)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" /> Shaxsiy menejer</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" /> API kirish + SLA</li>
                </ul>
                <Button className="w-full bg-violet-500 hover:bg-violet-600 text-white" size="lg" 
                  onClick={() => handleClickPayment('elegant')} disabled={isProcessingPayment === 'elegant'}>
                  {isProcessingPayment === 'elegant' 
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
                    : <><CreditCard className="h-4 w-4 mr-2" /> Click orqali to'lash</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Xizmat shartlari</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto text-sm space-y-2">
                <p className="font-medium">SellerCloudX xizmat shartlari:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Marketplace ulash va boshqarish — bepul</li>
                  <li>Analitika, hisobotlar, buyurtmalar — bepul</li>
                  <li>AI xizmatlar — balans orqali</li>
                  <li>Balansni to'ldirish: kamida {MIN_TOPUP_UZS.toLocaleString()} so'm</li>
                  <li>{TRIAL_DAYS} kunlik bepul sinov muddati</li>
                  <li>Sinov muddatidan keyin: {ACTIVATION_FEE_UZS.toLocaleString()} so'm/oy</li>
                </ul>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
                <Label htmlFor="terms" className="text-sm cursor-pointer">Men shartlarni qabul qilaman</Label>
              </div>
              <Button onClick={handleAcceptTerms} className="w-full" disabled={!termsAccepted || isCreating}>
                {isCreating ? 'Yuklanmoqda...' : <><Rocket className="h-4 w-4 mr-2" /> Bepul boshlash</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ========== HAS SUBSCRIPTION ==========
  const getPlanLabel = (planType: string) => {
    if (planType === 'pro' || planType === 'free') return 'Free';
    if (planType === 'enterprise' || planType === 'elegant') return 'Elegant';
    if (planType === 'premium') return 'Premium';
    return planType;
  };

  const currentPlanLabel = getPlanLabel(subscription.plan_type as string);

  const getPlanBadge = () => {
    const colors: Record<string, string> = {
      'Free': 'bg-muted text-muted-foreground',
      'Premium': 'bg-amber-500/10 text-amber-600 border-amber-200',
      'Elegant': 'bg-violet-500/10 text-violet-600 border-violet-200',
    };
    return <Badge className={colors[currentPlanLabel] || 'bg-muted'}>{currentPlanLabel}</Badge>;
  };

  const getStatusBadge = () => {
    if (!accessStatus) return null;
    const statusBadge = (() => {
      switch (accessStatus.reason) {
        case 'active': return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> Faol</Badge>;
        case 'trial': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Sinov</Badge>;
        case 'admin_override': return <Badge className="bg-primary text-primary-foreground"><Crown className="h-3 w-3 mr-1" /> Faol</Badge>;
        case 'debt': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Qarzdorlik</Badge>;
        default: return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Nofaol</Badge>;
      }
    })();
    return <div className="flex items-center gap-1.5">{getPlanBadge()}{statusBadge}</div>;
  };

  const featuresByCategory = features?.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, typeof features>) || {};

  return (
    <div className="space-y-6">
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
            </div>
          </CardContent>
        </Card>
      )}

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
                    : `Davom etish uchun ${ACTIVATION_FEE_UZS.toLocaleString()} so'm to'lang.`}
                </p>
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

      <Tabs defaultValue="subscription">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="subscription" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3 py-2 flex-col sm:flex-row"><Crown className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Obuna</span></TabsTrigger>
          <TabsTrigger value="balance" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3 py-2 flex-col sm:flex-row"><Wallet className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Balans</span></TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3 py-2 flex-col sm:flex-row"><History className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Tarix</span></TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3 py-2 flex-col sm:flex-row"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Narxlar</span></TabsTrigger>
        </TabsList>

        {/* TAB 1: SUBSCRIPTION */}
        <TabsContent value="subscription" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Hozirgi tarif</CardTitle>
                  <CardDescription>{currentPlanLabel} tarif rejasi</CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Boshlangan</div>
                  <div className="text-base font-bold mt-1">{format(new Date(subscription.started_at), 'dd.MM.yyyy')}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tugash</div>
                  <div className="text-base font-bold mt-1">
                    {subscription.activated_until ? format(new Date(subscription.activated_until), 'dd.MM.yyyy') : '—'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Tarif</div>
                  <div className="text-base font-bold mt-1">{currentPlanLabel}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                {subscription.plan_type === 'pro' ? 'Tarifni tanlash' : 'Tarifni almashtirish'}
              </CardTitle>
              <CardDescription>Click orqali to'lab, tarifni faollashtiring yoki muddatni uzaytiring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Premium */}
                <div className={`p-5 rounded-xl border-2 space-y-3 ${(subscription.plan_type as string) === 'premium' ? 'border-amber-400 bg-amber-500/5' : 'border-border hover:border-amber-300 transition-colors'}`}>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Premium</Badge>
                    {(subscription.plan_type as string) === 'premium' && <Badge variant="secondary" className="text-[10px]">Hozirgi</Badge>}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatPrice(PLAN_PRICES.premium.amount_uzs)}</p>
                    <p className="text-xs text-muted-foreground">{PLAN_PRICES.premium.duration}lik to'lov</p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Pullik xizmatlar 40% arzon, cheksiz</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Oylik aktivatsiya bepul</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Ustuvor qo'llab-quvvatlash</li>
                  </ul>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => handleClickPayment('premium')} disabled={isProcessingPayment === 'premium'}>
                    {isProcessingPayment === 'premium'
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
                      : <><CreditCard className="h-4 w-4 mr-2" /> {(subscription.plan_type as string) === 'premium' ? 'Muddatni uzaytirish' : 'Click orqali to\'lash'}</>}
                  </Button>
                </div>

                {/* Elegant */}
                <div className={`p-5 rounded-xl border-2 space-y-3 ${subscription.plan_type === 'enterprise' ? 'border-violet-400 bg-violet-500/5' : 'border-border hover:border-violet-300 transition-colors'}`}>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-violet-500/10 text-violet-600 border-violet-200">Elegant</Badge>
                    {subscription.plan_type === 'enterprise' && <Badge variant="secondary" className="text-[10px]">Hozirgi</Badge>}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatPrice(PLAN_PRICES.elegant.amount_uzs)}</p>
                    <p className="text-xs text-muted-foreground">{PLAN_PRICES.elegant.duration}lik to'lov</p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-violet-500" /> AI xizmatlar 0 so'm (limitli)</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-violet-500" /> Shaxsiy menejer</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-violet-500" /> API kirish + SLA</li>
                  </ul>
                  <Button className="w-full bg-violet-500 hover:bg-violet-600 text-white"
                    onClick={() => handleClickPayment('elegant')} disabled={isProcessingPayment === 'elegant'}>
                    {isProcessingPayment === 'elegant'
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
                      : <><CreditCard className="h-4 w-4 mr-2" /> {subscription.plan_type === 'enterprise' ? 'Muddatni uzaytirish' : 'Click orqali to\'lash'}</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: BALANCE */}
        <TabsContent value="balance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Balans</CardTitle>
              <CardDescription>AI funksiyalar va pullik xizmatlar uchun</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Joriy balans</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{balance ? Number(balance.balance_uzs).toLocaleString() : '0'} <span className="text-xs font-normal text-muted-foreground">UZS</span></p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 sm:contents">
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/50 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jami kirim</p>
                    <p className="text-base sm:text-lg font-bold mt-1">{balance ? Number(balance.total_deposited).toLocaleString() : '0'} <span className="text-[10px] font-normal text-muted-foreground">UZS</span></p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/50 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jami chiqim</p>
                    <p className="text-base sm:text-lg font-bold mt-1">{balance ? Number(balance.total_spent).toLocaleString() : '0'} <span className="text-[10px] font-normal text-muted-foreground">UZS</span></p>
                  </div>
                </div>
              </div>

              <BalanceTopup userId={user?.id} />

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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Tranzaksiyalar tarixi</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTx ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
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
                            {isDebit ? <ArrowRight className="h-4 w-4 text-destructive rotate-45" /> : <ArrowRight className="h-4 w-4 text-primary -rotate-135" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{tx.description || tx.feature_key || tx.transaction_type}</p>
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
                          <p className="text-[10px] text-muted-foreground">Qoldiq: {Number(tx.balance_after).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PRICING */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Xizmatlar narxi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-center">
                  <Badge variant="secondary" className="text-[10px] mb-1">Free</Badge>
                  <p className="text-[10px] text-muted-foreground">To'liq narx</p>
                </div>
                <div className="text-center">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] mb-1">Premium</Badge>
                  <p className="text-[10px] text-muted-foreground">40% chegirma</p>
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
                            {f.is_free 
                              ? <span className="text-sm font-medium text-primary">Bepul</span>
                              : <span className="text-sm font-bold">{f.base_price_uzs.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">UZS</span></span>}
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
    </div>
  );
}
