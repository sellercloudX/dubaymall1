import { createContext, useContext } from 'react';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';

/**
 * Returns the max allowed data retention days for the current user's subscription.
 * Components can use this to limit date range filters.
 */
export function useDataRetention(): number {
  const { subscription } = useSellerCloudSubscription();
  const { data: plans } = useSubscriptionPlans();

  const userPlanSlug = subscription?.plan_type || 'business';
  const userPlan = plans?.find(p => p.slug === userPlanSlug);
  return userPlan?.data_retention_days || 7;
}
