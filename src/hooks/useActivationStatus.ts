import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ActivationStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface ActivationState {
  sellerStatus: ActivationStatus;
  isSellerApproved: boolean;
  loading: boolean;
}

export function useActivationStatus(): ActivationState {
  const { user } = useAuth();
  const [sellerStatus, setSellerStatus] = useState<ActivationStatus>('none');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSellerStatus('none');
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      try {
        const [adminResult] = await Promise.all([
          supabase
            .from('admin_permissions')
            .select('is_super_admin')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        setIsAdmin(!!adminResult.data);
        // SellerCloudX: all authenticated users are considered sellers
        setSellerStatus('approved');
      } catch (err) {
        console.error('Error fetching activation status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [user]);

  return {
    sellerStatus,
    isSellerApproved: isAdmin || sellerStatus === 'approved',
    loading,
  };
}
