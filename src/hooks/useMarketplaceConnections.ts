import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  account_info: {
    campaignName?: string;
    storeName?: string;
    state?: string;
    campaignId?: string;
    sellerId?: string;
  };
  products_count: number;
  orders_count: number;
  total_revenue: number;
  last_sync_at: string | null;
  is_active: boolean;
}

interface UseMarketplaceConnectionsReturn {
  connections: MarketplaceConnection[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  connectMarketplace: (marketplace: string, credentials: Record<string, string>) => Promise<{ success: boolean; error?: string; data?: any }>;
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
  syncMarketplace: (marketplace: string) => Promise<void>;
}

export function useMarketplaceConnections(): UseMarketplaceConnectionsReturn {
  const { user } = useAuth();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) {
      setConnections([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('marketplace_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const mappedConnections: MarketplaceConnection[] = (data || []).map(item => ({
        id: item.id,
        marketplace: item.marketplace,
        account_info: (item.account_info as MarketplaceConnection['account_info']) || {},
        products_count: item.products_count || 0,
        orders_count: item.orders_count || 0,
        total_revenue: item.total_revenue || 0,
        last_sync_at: item.last_sync_at,
        is_active: item.is_active || false,
      }));
      setConnections(mappedConnections);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching connections:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const connectMarketplace = async (
    marketplace: string, 
    credentials: Record<string, string>
  ): Promise<{ success: boolean; error?: string; data?: any }> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('connect-marketplace', {
        body: {
          marketplace,
          ...credentials,
        },
      });

      if (invokeError) {
        return { success: false, error: invokeError.message };
      }

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // Refresh connections
      await fetchConnections();

      return { success: true, data: data.connection };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const fetchMarketplaceData = async (
    marketplace: string, 
    dataType: string, 
    options: Record<string, any> = {}
  ): Promise<any> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: {
          marketplace,
          dataType,
          ...options,
        },
      });

      if (invokeError) throw invokeError;
      return data;
    } catch (err: any) {
      console.error(`Error fetching ${dataType} from ${marketplace}:`, err);
      return { success: false, error: err.message };
    }
  };

  const syncMarketplace = async (marketplace: string) => {
    const connection = connections.find(c => c.marketplace === marketplace);
    if (!connection) return;

    try {
      // Fetch products count
      const productsResult = await fetchMarketplaceData(marketplace, 'products', { limit: 1 });
      const ordersResult = await fetchMarketplaceData(marketplace, 'orders');

      // Update local state with new data
      setConnections(prev => prev.map(c => 
        c.marketplace === marketplace 
          ? {
              ...c,
              products_count: productsResult.total || c.products_count,
              orders_count: ordersResult.total || ordersResult.data?.length || c.orders_count,
              last_sync_at: new Date().toISOString(),
            }
          : c
      ));
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  return {
    connections,
    isLoading,
    error,
    refetch: fetchConnections,
    connectMarketplace,
    fetchMarketplaceData,
    syncMarketplace,
  };
}
