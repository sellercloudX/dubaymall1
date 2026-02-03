import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'seller' | 'blogger' | 'buyer' | 'admin';

interface UserRolesState {
  roles: UserRole[];
  isAdmin: boolean;
  isSeller: boolean;
  isBlogger: boolean;
  loading: boolean;
}

export function useUserRoles(): UserRolesState {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const userRoles = data?.map(r => r.role as UserRole) || [];
        setRoles(userRoles);
      } catch (err) {
        console.error('Error fetching user roles:', err);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  return {
    roles,
    isAdmin: roles.includes('admin'),
    isSeller: roles.includes('seller'),
    isBlogger: roles.includes('blogger'),
    loading,
  };
}
