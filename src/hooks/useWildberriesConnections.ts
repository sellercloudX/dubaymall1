import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WildberriesConnection {
  id: string;
  supplier_id: number;
  warehouse_id?: number;
  account_info?: Record<string, any>;
  products_count: number;
  orders_count: number;
  total_revenue: number;
  last_sync_at: string | null;
  is_active: boolean;
}

interface UseWildberriesConnectionsReturn {
  connections: WildberriesConnection[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  connectWildberries: (supplierId: number, apiKey: string, warehouseId?: number) => Promise<{ success: boolean; error?: string }>;
  disconnectWildberries: (supplierId: number) => Promise<{ success: boolean; error?: string }>;
  syncWildberries: (supplierId: number) => Promise<void>;
}

export function useWildberriesConnections(): UseWildberriesConnectionsReturn {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WildberriesConnection[]>([]);
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
        .from('wildberries_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const mappedConnections: WildberriesConnection[] = (data || []).map(item => ({
        id: item.id,
        supplier_id: item.supplier_id,
        warehouse_id: item.warehouse_id || undefined,
        account_info: (typeof item.account_info === 'object' && item.account_info !== null ? item.account_info : {}) as Record<string, any>,
        products_count: item.products_count || 0,
        orders_count: item.orders_count || 0,
        total_revenue: Number(item.total_revenue) || 0,
        last_sync_at: item.last_sync_at,
        is_active: item.is_active || false,
      }));

      setConnections(mappedConnections);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching Wildberries connections:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const connectWildberries = async (
    supplierId: number,
    apiKey: string,
    warehouseId?: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { error: insertError } = await supabase
        .from('wildberries_connections')
        .insert({
          user_id: user.id,
          supplier_id: supplierId,
          api_key: apiKey,
          warehouse_id: warehouseId,
          account_info: {
            supplierId,
            warehouseId,
          },
        });

      if (insertError) {
        if (insertError.code === '23505') {
          return { success: false, error: 'Bu supplier ID allaqachon ulangan' };
        }
        throw insertError;
      }

      await fetchConnections();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const disconnectWildberries = async (supplierId: number): Promise<{ success: boolean; error?: string }> => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    if (!connection) return { success: false, error: 'Connection not found' };

    try {
      const { error: updateError } = await supabase
        .from('wildberries_connections')
        .update({ is_active: false })
        .eq('id', connection.id);

      if (updateError) throw updateError;

      setConnections(prev => prev.filter(c => c.supplier_id !== supplierId));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const syncWildberries = async (supplierId: number) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    if (!connection) return;

    try {
      await supabase.functions.invoke('fetch-wildberries-data', {
        body: {
          supplierId,
          connectionId: connection.id,
          warehouseId: connection.warehouse_id,
        },
      });

      // Refresh connection after sync
      await fetchConnections();
    } catch (err) {
      console.error('Sync error:', err);
      throw err;
    }
  };

  return {
    connections,
    isLoading,
    error,
    refetch: fetchConnections,
    connectWildberries,
    disconnectWildberries,
    syncWildberries,
  };
}
