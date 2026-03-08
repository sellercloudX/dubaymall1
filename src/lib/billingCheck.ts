import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Pre-flight billing check — call BEFORE invoking any billable edge function.
 * Returns true if access is allowed, false if blocked (shows toast automatically).
 */
export async function checkBillingAccess(featureKey: string, userId?: string): Promise<boolean> {
  try {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) {
      toast.error('Avval tizimga kiring');
      return false;
    }

    const { data, error } = await supabase.rpc('check_feature_access', {
      p_user_id: uid,
      p_feature_key: featureKey,
    });

    if (error) {
      console.warn('Billing check error:', error);
      // Allow through on RPC error (don't block user if billing system has issues)
      return true;
    }

    const ac = data as any;
    if (ac && !ac.allowed) {
      if (ac.error === 'insufficient_balance') {
        toast.error(`Balans yetarli emas (${ac.balance?.toLocaleString() || 0} so'm). Balansni kamida 300,000 so'm to'ldiring.`);
      } else if (ac.error === 'activation_required') {
        toast.error("Oylik aktivatsiya (99,000 so'm) talab etiladi. Obuna bo'limiga o'ting.");
      } else if (ac.error === 'feature_disabled') {
        toast.error(ac.message || "Bu funksiya hozircha o'chirilgan");
      } else if (ac.error === 'premium_only') {
        toast.error(ac.message || 'Bu funksiya faqat Premium/Elegant foydalanuvchilar uchun');
      } else if (ac.error === 'limit_reached') {
        toast.error(ac.message || 'Oylik limit tugadi');
      } else {
        toast.error(ac.message || 'Ruxsat berilmadi');
      }
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Billing pre-check failed:', err);
    // Allow through on unexpected error
    return true;
  }
}

/**
 * Parse billing error from edge function FunctionsHttpError response.
 * Returns true if it was a billing error (toast shown), false otherwise.
 */
export function handleEdgeFunctionBillingError(error: any, data: any): boolean {
  const errorBody = data || error?.context || {};
  const billingErr = errorBody?.billingError;
  if (billingErr === 'insufficient_balance' || billingErr === 'activation_required' || billingErr === 'feature_disabled' || billingErr === 'premium_only') {
    toast.error(errorBody.error || 'Balans yetarli emas. Balansni to\'ldiring.');
    return true;
  }
  return false;
}
