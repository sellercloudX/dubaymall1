import { useState, forwardRef } from 'react';
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
import { useFeaturePricing, useUserBalance, MIN_TOPUP_UZS, ACTIVATION_FEE_UZS } from '@/hooks/useFeaturePricing';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CreditCard, AlertTriangle, CheckCircle2, Clock, Crown,
  Calendar, DollarSign, TrendingUp, XCircle, FileText,
  ArrowRight, Wallet, History, Zap, ArrowUpDown,
  Sparkles, Settings2, Key, Rocket, Loader2, Store, Image, Copy, Percent,
} from 'lucide-react';
import { format } from 'date-fns';
import { PromoCodeInput, type PromoValidation } from './PromoCodeInput';
import { notifyAffiliatePayment } from '@/lib/affiliateWebhook';
import { cn } from '@/lib/utils';

interface SubscriptionBillingProps {
  totalSalesVolume?: number;
}

const categoryIcons: Record<string, React.ElementType> = {
  card_creation: Sparkles, cloning: ArrowUpDown, ai_tools: Sparkles, pricing: DollarSign,
  sync: ArrowUpDown, analytics: Zap, management: Settings2, activation: Key,
};

const categoryNames: Record<string, string> = {
  card_creation: 'Kartochka yaratish', cloning: 'Klonlash', ai_tools: 'AI Asboblar',
  pricing: 'Narx boshqarish', sync: 'Sinxronizatsiya', analytics: 'Analitika',
  management: 'Boshqaruv', activation: 'Aktivatsiya',
};

const TOPUP_OPTIONS = [300_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

type PaymentMethod = 'click' | 'payme';

function PaymentMethodSelector({ value, onChange }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => onChange('click')}
        className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
          value === 'click' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50')}>
        <CreditCard className="h-4 w-4" /> Click
      </button>
      <button onClick={() => onChange('payme')}
        className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
          value === 'payme' ? 'border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]' : 'border-border hover:border-[#00CCCC]/50')}>
        <Wallet className="h-4 w-4" /> Payme
      </button>
    </div>
  );
}

async function invokePayment(method: PaymentMethod, action: string, body: Record<string, unknown>) {
  const fnName = method === 'payme' ? 'payme-payment' : 'click-payment';
  const { data, error } = await supabase.functions.invoke(fnName, { body: { action, ...body } });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Xatolik');
  return data;
}

function BalanceTopup({ userId }: { userId?: string }) {
  const [selectedAmount, setSelectedAmount] = useState<number>(TOPUP_OPTIONS[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('click');

  const formatP = (p: number) => p >= 1_000_000 ? (p / 1_000_000).toFixed(1) + ' mln' : (p / 1_000).toFixed(0) + ' ming';
  const amount = useCustom ? Number(customAmount) : selectedAmount;

  const handleTopup = async () => {
    if (!userId) { toast.error('Avval tizimga kiring'); return; }
    if (!amount || amount < MIN_TOPUP_UZS) { toast.error(`Minimal summa: ${MIN_TOPUP_UZS.toLocaleString()} so'm`); return; }
    setIsProcessing(true);
    try {
      const data = await invokePayment(paymentMethod, 'topup', {
        user_id: userId, amount_uzs: amount,
        return_url: window.location.origin + '/seller-cloud?tab=balance',
      });
      toast.success("To'lov sahifasiga yo'naltirilmoqda...");
      window.open(data.payment_url, '_blank');

      // For Payme, start polling for payment status
      if (paymentMethod === 'payme' && data.receipt_id) {
        pollPaymeStatus(data.receipt_id, data.order_number, userId);
      }
    } catch (err: any) {
      toast.error("To'lov xatoligi: " + (err.message || "Qaytadan urinib ko'ring"));
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Balansni to'ldirish</h4>
      <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
      <p className="text-xs text-muted-foreground">Minimal: <strong>{MIN_TOPUP_UZS.toLocaleString()} so'm</strong></p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {TOPUP_OPTIONS.map((opt) => (
          <button key={opt} onClick={() => { setSelectedAmount(opt); setUseCustom(false); }}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${!useCustom && selectedAmount === opt ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
            {formatP(opt)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setUseCustom(!useCustom)} className={`text-xs underline ${useCustom ? 'text-primary' : 'text-muted-foreground'}`}>Boshqa summa</button>
        {useCustom && <input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Summa kiriting" min={MIN_TOPUP_UZS} className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm" />}
      </div>
      <Button className="w-full" size="lg" onClick={handleTopup} disabled={isProcessing || !amount || amount < MIN_TOPUP_UZS}
        style={paymentMethod === 'payme' ? { backgroundColor: '#00CCCC' } : undefined}>
        {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</> : (
          <span className="flex items-center gap-1.5 truncate">
            {paymentMethod === 'payme' ? <Wallet className="h-4 w-4 shrink-0" /> : <CreditCard className="h-4 w-4 shrink-0" />}
            <span className="truncate">{paymentMethod === 'payme' ? 'Payme' : 'Click'} · {amount >= MIN_TOPUP_UZS ? `${amount.toLocaleString()} so'm` : "To'ldirish"}</span>
          </span>
        )}
      </Button>
    </div>
  );
}

/** Poll Payme receipt status every 5 seconds for up to 10 minutes */
function pollPaymeStatus(receiptId: string, orderNumber: string, userId: string) {
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) { clearInterval(interval); return; }
    try {
      const { data } = await supabase.functions.invoke('payme-payment', {
        body: { action: 'check', receipt_id: receiptId, order_number: orderNumber, user_id: userId },
      });
      if (data?.paid) {
        clearInterval(interval);
        toast.success("To'lov muvaffaqiyatli qabul qilindi! ✅");
        window.location.reload();
      }
    } catch {}
  }, 5000);
}

// ─── Dynamic Plan Card ───
function DynamicPlanCard({ plan, isCurrentPlan, onSelect, isProcessing }: {
  plan: SubscriptionPlan; isCurrentPlan: boolean; onSelect: (plan: SubscriptionPlan) => void; isProcessing: boolean;
}) {
  const formatPrice = (p: number) => p >= 1_000_000 ? (p / 1_000_000).toFixed(1) + ' mln so\'m' : p.toLocaleString() + ' so\'m';

  return (
    <div className={cn(
      'p-5 rounded-xl border-2 space-y-3 transition-all',
      isCurrentPlan ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
    )}>
      <div className="flex items-center gap-2">
        <Badge style={{ backgroundColor: (plan.color || '#3b82f6') + '15', color: plan.color || '#3b82f6', borderColor: (plan.color || '#3b82f6') + '30' }}>
          {plan.name_uz || plan.name}
        </Badge>
        {isCurrentPlan && <Badge variant="secondary" className="text-[10px]">Hozirgi</Badge>}
      </div>

      <div>
        <p className="text-2xl font-bold">{formatPrice(plan.onetime_price_uzs)}</p>
        <p className="text-xs text-muted-foreground">
          {plan.monthly_fee_uzs > 0
            ? `Bir martalik + ${formatPrice(plan.monthly_fee_uzs)}/oy`
            : 'Bir martalik to\'lov'}
        </p>
      </div>

      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-primary shrink-0" />
          {plan.max_stores_per_marketplace >= 999 ? 'Cheksiz' : plan.max_stores_per_marketplace} do'kon / marketplace
        </li>
        {plan.free_card_creation_monthly > 0 && (
          <li className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5 text-primary shrink-0" /> {plan.free_card_creation_monthly} bepul kartochka / oy</li>
        )}
        {plan.free_cloning_monthly > 0 && (
          <li className="flex items-center gap-1.5"><Copy className="h-3.5 w-3.5 text-primary shrink-0" /> {plan.free_cloning_monthly} bepul klonlash / oy</li>
        )}
        {plan.balance_discount_percent > 0 && (
          <li className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5 text-primary shrink-0" /> Pullik xizmatlar {plan.balance_discount_percent}% arzon</li>
        )}
        {(plan.included_feature_keys?.length || 0) > 0 && (
          <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> {plan.included_feature_keys.length} ta bepul funksiya</li>
        )}
      </ul>

      <Button className="w-full text-xs sm:text-sm" variant={isCurrentPlan ? 'outline' : 'default'}
        style={!isCurrentPlan ? { backgroundColor: plan.color || undefined } : undefined}
        onClick={() => onSelect(plan)} disabled={isProcessing}>
        {isProcessing
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yuklanmoqda...</>
          : <span className="flex items-center gap-1.5 truncate"><CreditCard className="h-4 w-4 shrink-0" /><span className="truncate">{isCurrentPlan ? 'Uzaytirish' : "To'lash"}</span></span>}
      </Button>
    </div>
  );
}

export const SubscriptionBilling = forwardRef<HTMLDivElement, SubscriptionBillingProps>(function SubscriptionBilling({ totalSalesVolume }, ref) {
  const { user } = useAuth();
  const { subscription, billing, totalDebt, accessStatus, isLoading, createSubscription, refetch } = useSellerCloudSubscription();
  const { features } = useFeaturePricing();
  const { balance, transactions, loadingTx, payActivation } = useUserBalance();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const [isCreating, setIsCreating] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPayingActivation, setIsPayingActivation] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [selectedPlanForTerms, setSelectedPlanForTerms] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('click');

  const formatPrice = (price: number) => price >= 1000000 ? (price / 1000000).toFixed(1) + ' mln so\'m' : new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';

  const activationPaidUntil = (subscription as any)?.activation_paid_until;
  const activationTrialEnds = (subscription as any)?.activation_trial_ends;
  const isActivationActive = activationPaidUntil && new Date(activationPaidUntil) > new Date();
  const isTrialActive = activationTrialEnds && new Date(activationTrialEnds) > new Date();

  const handlePayActivation = async () => {
    setIsPayingActivation(true);
    try {
      const result = await payActivation();
      if (!result.success) {
        toast.error(result.error === 'insufficient_balance'
          ? `Balans yetarli emas. Kamida ${MIN_TOPUP_UZS.toLocaleString()} so'm to'ldiring.`
          : (result.error || 'Xatolik yuz berdi'));
      }
    } catch (err: any) { toast.error('Xatolik: ' + err.message); }
    finally { setIsPayingActivation(false); }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlanForTerms(plan);
    setShowTermsDialog(true);
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !selectedPlanForTerms) { toast.error('Shartlarni qabul qilishingiz kerak'); return; }
    setIsCreating(true);

    const payBody = {
      user_id: user?.id, plan_type: selectedPlanForTerms.slug,
      amount_uzs: selectedPlanForTerms.onetime_price_uzs || selectedPlanForTerms.monthly_fee_uzs,
      return_url: window.location.origin + '/seller-cloud?tab=subscription',
    };

    if (!subscription) {
      const result = await createSubscription(selectedPlanForTerms.slug, selectedPlanForTerms.monthly_fee_uzs);
      if (result.success) {
        setShowTermsDialog(false);
        toast.success('Tabriklaymiz! Akkauntingiz faollashtirildi.');
        if (selectedPlanForTerms.onetime_price_uzs > 0 && user?.id) {
          try {
            const data = await invokePayment(paymentMethod, 'prepare', payBody);
            window.open(data.payment_url, '_blank');
            if (paymentMethod === 'payme' && data.receipt_id) {
              pollPaymeStatus(data.receipt_id, data.order_number, user.id);
            }
          } catch {}
        }
      } else { toast.error(result.error || 'Xatolik yuz berdi'); }
    } else {
      if (user?.id) {
        setIsProcessingPayment(selectedPlanForTerms.slug);
        try {
          const data = await invokePayment(paymentMethod, 'prepare', payBody);
          toast.success("To'lov sahifasiga yo'naltirilmoqda...");
          window.open(data.payment_url, '_blank');
          setShowTermsDialog(false);
          if (paymentMethod === 'payme' && data.receipt_id) {
            pollPaymeStatus(data.receipt_id, data.order_number, user.id);
          }
        } catch (err: any) {
          toast.error('To\'lov xatoligi: ' + (err.message || 'Qaytadan urinib ko\'ring'));
        } finally { setIsProcessingPayment(null); }
      }
    }
    setIsCreating(false);
  };

  if (isLoading || plansLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>;
  }

  const activePlans = plans?.filter(p => p.is_active) || [];

  // ========== Terms Dialog (shared) ==========
  const termsDialog = (
    <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Xizmat shartlari</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {selectedPlanForTerms && (
            <div className="p-4 rounded-lg border" style={{ borderColor: (selectedPlanForTerms.color || '#3b82f6') + '40' }}>
              <div className="flex items-center justify-between mb-2">
                <Badge style={{ backgroundColor: (selectedPlanForTerms.color || '#3b82f6') + '15', color: selectedPlanForTerms.color || '#3b82f6' }}>
                  {selectedPlanForTerms.name_uz || selectedPlanForTerms.name}
                </Badge>
                <span className="font-bold">{formatPrice(selectedPlanForTerms.onetime_price_uzs)}</span>
              </div>
              {selectedPlanForTerms.monthly_fee_uzs > 0 && (
                <p className="text-xs text-muted-foreground">+ {formatPrice(selectedPlanForTerms.monthly_fee_uzs)} oylik to'lov</p>
              )}
            </div>
          )}
          <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto text-sm space-y-2">
            <p className="font-medium">SellerCloudX xizmat shartlari:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Tanlangan tarif: <strong>{selectedPlanForTerms?.name_uz || selectedPlanForTerms?.name}</strong></li>
              <li>Bir martalik to'lov: {formatPrice(selectedPlanForTerms?.onetime_price_uzs || 0)}</li>
              {(selectedPlanForTerms?.monthly_fee_uzs || 0) > 0 && <li>Oylik to'lov: {formatPrice(selectedPlanForTerms!.monthly_fee_uzs)}</li>}
              <li>Do'kon limiti: {(selectedPlanForTerms?.max_stores_per_marketplace || 1) >= 999 ? 'Cheksiz' : selectedPlanForTerms?.max_stores_per_marketplace} / marketplace</li>
              <li>AI xizmatlar — balans orqali ({selectedPlanForTerms?.balance_discount_percent || 0}% chegirma)</li>
              <li>Balansni to'ldirish: kamida {MIN_TOPUP_UZS.toLocaleString()} so'm</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">To'lov usulini tanlang:</p>
            <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
          </div>
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
            <Label htmlFor="terms" className="text-sm cursor-pointer">Men shartlarni qabul qilaman</Label>
          </div>
          <Button onClick={handleAcceptTerms} className="w-full" disabled={!termsAccepted || isCreating}
            style={paymentMethod === 'payme' ? { backgroundColor: '#00CCCC' } : undefined}>
            {isCreating ? 'Yuklanmoqda...' : (
              <span className="flex items-center gap-1.5">
                {paymentMethod === 'payme' ? <Wallet className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                {paymentMethod === 'payme' ? 'Payme orqali to\'lash' : 'Click orqali to\'lash'}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ========== NO SUBSCRIPTION — SHOW PLANS ==========
  if (!subscription) {
    return (
      <>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /> Tarifni tanlang</CardTitle>
              <CardDescription>Biznesingizga mos rejani tanlang va marketplace boshqaruvini boshlang</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activePlans.map((plan, idx) => (
              <DynamicPlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={false}
                onSelect={handleSelectPlan}
                isProcessing={isProcessingPayment === plan.slug}
              />
            ))}
          </div>
        </div>
        {termsDialog}
      </>
    );
  }

  // ========== HAS SUBSCRIPTION ==========
  const currentPlanSlug = (subscription as any).plan_slug || subscription.plan_type;
  const currentPlan = activePlans.find(p => p.slug === currentPlanSlug);
  const currentPlanLabel = currentPlan?.name_uz || currentPlan?.name || currentPlanSlug;

  const getStatusBadge = () => {
    if (!accessStatus) return null;
    const statusBadge = (() => {
      switch (accessStatus.reason) {
        case 'active': return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> Faol</Badge>;
        case 'trial': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Sinov</Badge>;
        case 'admin_override': return <Badge className="bg-primary text-primary-foreground"><Crown className="h-3 w-3 mr-1" /> Faol</Badge>;
        default: return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Nofaol</Badge>;
      }
    })();
    return (
      <div className="flex items-center gap-1.5">
        <Badge style={currentPlan ? { backgroundColor: (currentPlan.color || '#3b82f6') + '15', color: currentPlan.color || '#3b82f6' } : undefined}>
          {currentPlanLabel}
        </Badge>
        {statusBadge}
      </div>
    );
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
              </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3 shrink-0" /><span className="truncate">Boshlangan</span></div>
                  <div className="text-sm sm:text-base font-bold mt-1">{format(new Date(subscription.started_at), 'dd.MM.yy')}</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" /><span className="truncate">Tugash</span></div>
                  <div className="text-sm sm:text-base font-bold mt-1">{subscription.activated_until ? format(new Date(subscription.activated_until), 'dd.MM.yy') : '—'}</div>
                </div>
                {currentPlan && (
                  <>
                    <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50">
                      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3 shrink-0" /><span className="truncate">Do'konlar</span></div>
                      <div className="text-sm sm:text-base font-bold mt-1">{currentPlan.max_stores_per_marketplace >= 999 ? '∞' : currentPlan.max_stores_per_marketplace}/MP</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50">
                      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3 shrink-0" /><span className="truncate">Chegirma</span></div>
                      <div className="text-sm sm:text-base font-bold mt-1">{currentPlan.balance_discount_percent}%</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection — dynamic from DB */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5" /> Tarifni almashtirish</CardTitle>
              <CardDescription>Click yoki Payme orqali to'lab, tarifni faollashtiring yoki uzaytiring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePlans.map(plan => (
                  <DynamicPlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrentPlan={plan.slug === currentPlanSlug}
                    onSelect={handleSelectPlan}
                    isProcessing={isProcessingPayment === plan.slug}
                  />
                ))}
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
            </CardContent>
          </Card>
        </TabsContent>




        {/* TAB 4: TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Tranzaksiyalar tarixi</CardTitle></CardHeader>
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
                            <p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), 'dd.MM.yy HH:mm')}{tx.feature_key && <span className="ml-1 font-mono">• {tx.feature_key}</span>}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-sm font-bold ${isDebit ? 'text-destructive' : 'text-primary'}`}>{isDebit ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}</p>
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

        {/* TAB 4: PRICING — shows all plans comparison */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Tariflar taqqoslash</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Plans comparison header */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Xususiyat</th>
                      {activePlans.map(p => (
                        <th key={p.id} className="text-center py-2 px-2 font-medium" style={{ color: p.color || undefined }}>
                          {p.name_uz || p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Narx</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center font-bold">{(p.onetime_price_uzs / 1000).toFixed(0)}K</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Oylik</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center">{p.monthly_fee_uzs > 0 ? (p.monthly_fee_uzs / 1000).toFixed(0) + 'K' : '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Do'kon/MP</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center">{p.max_stores_per_marketplace >= 999 ? '∞' : p.max_stores_per_marketplace}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Kartochka/oy</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center">{p.free_card_creation_monthly || '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Klon/oy</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center">{p.free_cloning_monthly || '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Chegirma</td>
                      {activePlans.map(p => (
                        <td key={p.id} className="py-2 px-2 text-center">{p.balance_discount_percent > 0 ? p.balance_discount_percent + '%' : '—'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Feature pricing list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Xizmatlar narxi (donalik)</CardTitle>
              <CardDescription>Har bir amal uchun balansdan yechiladi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

      {termsDialog}
    </div>
  );
});
