import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Shop = Tables<'shops'>;
type ShopInsert = TablesInsert<'shops'>;

export function useShop() {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchShop();
    } else {
      setShop(null);
      setLoading(false);
    }
  }, [user]);

  const fetchShop = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else {
      setShop(data);
    }
    setLoading(false);
  };

  const createShop = async (shopData: Omit<ShopInsert, 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('shops')
      .insert({
        ...shopData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    setShop(data);
    return data;
  };

  const updateShop = async (updates: Partial<Shop>) => {
    if (!shop) throw new Error('No shop to update');

    const { data, error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shop.id)
      .select()
      .single();

    if (error) throw error;
    setShop(data);
    return data;
  };

  return {
    shop,
    loading,
    error,
    createShop,
    updateShop,
    refetch: fetchShop,
  };
}

export function useShopBySlug(slug: string) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchShop();
    }
  }, [slug]);

  const fetchShop = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else {
      setShop(data);
    }
    setLoading(false);
  };

  return { shop, loading, error };
}