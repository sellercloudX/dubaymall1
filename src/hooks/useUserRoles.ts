import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'seller' | 'admin';

interface UserRolesState {
  roles: UserRole[];
  isAdmin: boolean;
  isSeller: boolean;
  loading: boolean;
}

export function useUserRoles(): UserRolesState {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('admin_permissions')
          .select('is_super_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        setIsAdmin(!!data);
      } catch (err) {
        console.error('Error fetching user roles:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const roles: UserRole[] = [];
  if (isAdmin) roles.push('admin');
  if (user) roles.push('seller'); // All authenticated users are sellers in SellerCloudX

  return {
    roles,
    isAdmin,
    isSeller: !!user,
    loading,
  };
}
