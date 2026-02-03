import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Get total users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total shops count
      const { count: shopsCount } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true });

      // Get total products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Get total orders count and sum
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status');

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      // Get recent orders
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        usersCount: usersCount || 0,
        shopsCount: shopsCount || 0,
        productsCount: productsCount || 0,
        totalOrders,
        totalRevenue,
        pendingOrders,
        recentOrders: recentOrders || [],
      };
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Get roles for all users
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      // Combine profiles with roles
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.user_id).map(r => r.role) || [],
      }));

      return usersWithRoles || [];
    },
  });
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          shops (name, slug)
        `)
        .order('created_at', { ascending: false });

      return data || [];
    },
  });
}

export function useAdminShops() {
  return useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      return data || [];
    },
  });
}

export function useAdminOrders() {
  return useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      return data || [];
    },
  });
}
