import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Navigate to the subscription/balance tab.
 * Works by changing URL hash which SellerCloudX listens to.
 */
function navigateToBalanceTab() {
  // Use hash navigation that SellerCloudX/Mobile both listen to
  if (window.location.pathname.includes('seller-cloud') || window.location.hash) {
    window.location.hash = 'subscription';
  }
}

/**
 * Pre-flight billing check — call BEFORE invoking any billable edge function.
 * Returns true if access is allowed, false if blocked (shows toast + navigates automatically).
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
      return true;
    }

    const ac = data as any;
    if (ac && !ac.allowed) {
      if (ac.error === 'insufficient_balance') {
        toast.error(
          `Balans yetarli emas (${ac.balance?.toLocaleString() || 0} so'm). Kerakli summa: ${ac.price?.toLocaleString() || 0} so'm`,
          {
            duration: 6000,
            action: {
              label: 'Balansni to\'ldirish',
              onClick: navigateToBalanceTab,
            },
          }
        );
      } else if (ac.error === 'activation_required') {
        toast.error(
          'Obuna muddati tugagan. Davom etish uchun obunani yangilang.',
          {
            duration: 6000,
            action: {
              label: 'Obunaga o\'tish',
              onClick: navigateToBalanceTab,
            },
          }
        );
      } else if (ac.error === 'feature_disabled') {
        toast.error(ac.message || "Bu funksiya hozircha o'chirilgan");
      } else if (ac.error === 'premium_only') {
        toast.error(
          ac.message || 'Bu funksiya faqat Business va undan yuqori tariflar uchun',
          {
            duration: 6000,
            action: {
              label: 'Tarifni yangilash',
              onClick: navigateToBalanceTab,
            },
          }
        );
      } else if (ac.error === 'limit_reached') {
        toast.error(
          ac.message || 'Oylik limit tugadi. Keyingi oyni kuting yoki tarifni oshiring.',
          {
            duration: 6000,
            action: {
              label: 'Tarifni ko\'rish',
              onClick: navigateToBalanceTab,
            },
          }
        );
      } else {
        toast.error(ac.message || 'Ruxsat berilmadi');
      }
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Billing pre-check failed:', err);
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
