import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SellerCloudSubscription {
  id: string;
  user_id: string;
  plan_type: 'pro' | 'enterprise';
  monthly_fee: number;
  commission_percent: number;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  started_at: string;
  expires_at: string | null;
  admin_override: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SellerCloudBilling {
  id: string;
  user_id: string;
  billing_period_start: string;
  billing_period_end: string;
  monthly_fee_amount: number;
  sales_commission_amount: number;
  total_sales_volume: number;
  commission_percent: number;
  total_due: number;
  total_paid: number;
  balance_due: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paid_at: string | null;
  created_at: string;
}

interface AccessStatus {
  is_active: boolean;
  reason: 'active' | 'trial' | 'admin_override' | 'debt' | 'inactive' | 'no_subscription';
  message: string;
  total_debt?: number;
  trial_ends_at?: string;
  subscription?: SellerCloudSubscription;
}

interface UseSellerCloudSubscriptionReturn {
  subscription: SellerCloudSubscription | null;
  billing: SellerCloudBilling[];
  totalDebt: number;
  accessStatus: AccessStatus | null;
  isLoading: boolean;
  error: string | null;
  createSubscription: (planType: 'pro' | 'enterprise', monthlyFee?: number, commissionPercent?: number) => Promise<{ success: boolean; error?: string }>;
  checkAccess: () => Promise<AccessStatus>;
  refetch: () => Promise<void>;
}

const USD_TO_UZS = 12800;

export function useSellerCloudSubscription(): UseSellerCloudSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SellerCloudSubscription | null>(null);
  const [billing, setBilling] = useState<SellerCloudBilling[]>([]);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setSubscription(null);
      setBilling([]);
      setAccessStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('sellercloud_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      setSubscription(subData as SellerCloudSubscription | null);

      // Fetch billing history
      const { data: billingData, error: billingError } = await supabase
        .from('sellercloud_billing')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (billingError) throw billingError;
      setBilling((billingData as SellerCloudBilling[]) || []);

      // Check access status
      const status = await checkAccess();
      setAccessStatus(status);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const checkAccess = async (): Promise<AccessStatus> => {
    if (!user) {
      return {
        is_active: false,
        reason: 'no_subscription',
        message: 'Tizimga kirilmagan',
      };
    }

    try {
      const { data, error } = await supabase.rpc('check_sellercloud_access', {
        p_user_id: user.id,
      });

      if (error) throw error;
      
      // Safely cast the response
      const result = data as unknown as AccessStatus;
      return result;
    } catch (err: any) {
      console.error('Error checking access:', err);
      return {
        is_active: false,
        reason: 'no_subscription',
        message: 'Xatolik yuz berdi',
      };
    }
  };

  const createSubscription = async (
    planType: 'pro' | 'enterprise',
    monthlyFee: number = 499,
    commissionPercent: number = planType === 'pro' ? 4 : 2
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Tizimga kirilmagan' };
    }

    try {
      const { error } = await supabase
        .from('sellercloud_subscriptions')
        .insert({
          user_id: user.id,
          plan_type: planType,
          monthly_fee: monthlyFee,
          commission_percent: commissionPercent,
          is_trial: true,
          is_active: false, // Will be activated after trial or payment
        });

      if (error) throw error;

      await fetchData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Calculate total debt
  const totalDebt = billing
    .filter(b => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + b.balance_due, 0);

  return {
    subscription,
    billing,
    totalDebt,
    accessStatus,
    isLoading,
    error,
    createSubscription,
    checkAccess,
    refetch: fetchData,
  };
}

// Admin hook for managing all subscriptions
export function useSellerCloudAdmin() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      
      const [subsResult, billingResult] = await Promise.all([
        supabase.from('sellercloud_subscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('sellercloud_billing').select('*').order('created_at', { ascending: false }),
      ]);

      setSubscriptions(subsResult.data || []);
      setBillings(billingResult.data || []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [user]);

  const activateSubscription = async (subscriptionId: string, adminNotes?: string) => {
    const { error } = await supabase
      .from('sellercloud_subscriptions')
      .update({
        is_active: true,
        admin_override: true,
        admin_notes: adminNotes || 'Admin tomondan aktivlashtirildi',
      })
      .eq('id', subscriptionId);

    if (!error) await fetchAll();
    return { success: !error, error: error?.message };
  };

  const deactivateSubscription = async (subscriptionId: string) => {
    const { error } = await supabase
      .from('sellercloud_subscriptions')
      .update({
        is_active: false,
        admin_override: false,
      })
      .eq('id', subscriptionId);

    if (!error) await fetchAll();
    return { success: !error, error: error?.message };
  };

  const waiveBilling = async (billingId: string, reason: string) => {
    const { error } = await supabase
      .from('sellercloud_billing')
      .update({
        status: 'waived',
        balance_due: 0,
        waived_by: user?.id,
        waived_reason: reason,
      })
      .eq('id', billingId);

    if (!error) await fetchAll();
    return { success: !error, error: error?.message };
  };

  const markBillingPaid = async (billingId: string, amount: number) => {
    const billing = billings.find(b => b.id === billingId);
    if (!billing) return { success: false, error: 'Billing not found' };

    const newPaid = (billing.total_paid || 0) + amount;
    const newBalance = Math.max(0, billing.total_due - newPaid);
    const isPaid = newBalance === 0;

    const { error } = await supabase
      .from('sellercloud_billing')
      .update({
        total_paid: newPaid,
        balance_due: newBalance,
        status: isPaid ? 'paid' : billing.status,
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .eq('id', billingId);

    if (!error) await fetchAll();
    return { success: !error, error: error?.message };
  };

  const createBilling = async (
    userId: string,
    subscriptionId: string,
    totalSales: number,
    monthlyFee: number,
    commissionPercent: number
  ) => {
    const monthlyFeeUZS = monthlyFee * USD_TO_UZS;
    const commissionAmount = totalSales * (commissionPercent / 100);
    const totalDue = monthlyFeeUZS + commissionAmount;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { error } = await supabase
      .from('sellercloud_billing')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        billing_period_start: periodStart.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        monthly_fee_amount: monthlyFeeUZS,
        sales_commission_amount: commissionAmount,
        total_sales_volume: totalSales,
        commission_percent: commissionPercent,
        total_due: totalDue,
        total_paid: 0,
        balance_due: totalDue,
        status: 'pending',
      });

    if (!error) await fetchAll();
    return { success: !error, error: error?.message };
  };

  return {
    subscriptions,
    billings,
    isLoading,
    refetch: fetchAll,
    activateSubscription,
    deactivateSubscription,
    waiveBilling,
    markBillingPaid,
    createBilling,
  };
}