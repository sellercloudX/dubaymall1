import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';

/**
 * FeatureGate v2 — Plan-based gating is removed.
 * 
 * All tabs are open for active subscribers. Features not included in the
 * plan are charged per-use from the user's balance at the point of action
 * (handled by check_feature_access RPC in edge functions).
 * 
 * This gate only blocks when there is NO active subscription at all.
 */

interface FeatureGateProps {
  tabId: string;
  children: React.ReactNode;
  onNavigateToSubscription: () => void;
}

export function FeatureGate({ children }: FeatureGateProps) {
  // All tabs are always accessible for active subscribers.
  // Per-use billing is handled at the action level (edge functions / RPC).
  return <>{children}</>;
}
