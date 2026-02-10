import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CostPriceEntry {
  id: string;
  marketplace: string;
  offer_id: string;
  cost_price: number;
  currency: string;
  notes: string | null;
}

export function useCostPrices() {
  const { user } = useAuth();
  const [costPrices, setCostPrices] = useState<CostPriceEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCostPrices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_cost_prices')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setCostPrices(data || []);
    } catch (err) {
      console.error('Failed to fetch cost prices:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCostPrices();
  }, [fetchCostPrices]);

  // Build a lookup map for O(1) access
  const costPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    costPrices.forEach(entry => {
      map.set(`${entry.marketplace}:${entry.offer_id}`, entry.cost_price);
    });
    return map;
  }, [costPrices]);

  const getCostPrice = useCallback((marketplace: string, offerId: string): number | null => {
    return costPriceMap.get(`${marketplace}:${offerId}`) ?? null;
  }, [costPriceMap]);

  const setCostPrice = useCallback(async (
    marketplace: string,
    offerId: string,
    costPrice: number,
    notes?: string
  ) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('marketplace_cost_prices')
        .upsert({
          user_id: user.id,
          marketplace,
          offer_id: offerId,
          cost_price: costPrice,
          notes: notes || null,
        }, {
          onConflict: 'user_id,marketplace,offer_id',
        });

      if (error) throw error;

      // Update local state
      setCostPrices(prev => {
        const key = `${marketplace}:${offerId}`;
        const exists = prev.findIndex(e => `${e.marketplace}:${e.offer_id}` === key);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = { ...updated[exists], cost_price: costPrice, notes: notes || null };
          return updated;
        }
        return [...prev, {
          id: crypto.randomUUID(),
          marketplace,
          offer_id: offerId,
          cost_price: costPrice,
          currency: 'UZS',
          notes: notes || null,
        }];
      });
    } catch (err) {
      console.error('Failed to save cost price:', err);
      toast.error('Tannarxni saqlashda xatolik');
    }
  }, [user]);

  const bulkSetCostPrices = useCallback(async (
    entries: { marketplace: string; offerId: string; costPrice: number }[]
  ) => {
    if (!user || entries.length === 0) return;
    try {
      const upsertData = entries.map(e => ({
        user_id: user.id,
        marketplace: e.marketplace,
        offer_id: e.offerId,
        cost_price: e.costPrice,
      }));

      const { error } = await supabase
        .from('marketplace_cost_prices')
        .upsert(upsertData, {
          onConflict: 'user_id,marketplace,offer_id',
        });

      if (error) throw error;
      toast.success(`${entries.length} ta tannarx saqlandi`);
      await fetchCostPrices();
    } catch (err) {
      console.error('Failed to bulk save cost prices:', err);
      toast.error('Tannarxlarni saqlashda xatolik');
    }
  }, [user, fetchCostPrices]);

  return {
    costPrices,
    loading,
    getCostPrice,
    setCostPrice,
    bulkSetCostPrices,
    refetch: fetchCostPrices,
  };
}
