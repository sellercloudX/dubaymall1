import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to real-time changes on marketplace cache tables
 * so orders, products, and cost prices update instantly.
 */
export function useMarketplaceRealtime(connectedMarketplaces: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || connectedMarketplaces.length === 0) return;

    const channel = supabase
      .channel(`mp-realtime-${user.id}`)
      // Orders cache changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders_cache',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate all order queries for connected marketplaces
          connectedMarketplaces.forEach(mp => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-orders', mp] });
          });
          queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] });
        }
      )
      // Products cache changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_products_cache',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          connectedMarketplaces.forEach(mp => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-products', mp] });
          });
          queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] });
        }
      )
      // Cost prices changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_cost_prices',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cost-prices'] });
          connectedMarketplaces.forEach(mp => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-products', mp] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, connectedMarketplaces.join(','), queryClient]);
}
