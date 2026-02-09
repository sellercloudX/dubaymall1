import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ActivationStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface ActivationState {
  sellerStatus: ActivationStatus;
  bloggerStatus: ActivationStatus;
  isSellerApproved: boolean;
  isBloggerApproved: boolean;
  loading: boolean;
}

export function useActivationStatus(): ActivationState {
  const { user } = useAuth();
  const [sellerStatus, setSellerStatus] = useState<ActivationStatus>('none');
  const [bloggerStatus, setBloggerStatus] = useState<ActivationStatus>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSellerStatus('none');
      setBloggerStatus('none');
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      try {
        const [sellerResult, bloggerResult] = await Promise.all([
          supabase
            .from('seller_profiles')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('blogger_profiles')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        setSellerStatus(
          (sellerResult.data?.status as ActivationStatus) || 'none'
        );
        setBloggerStatus(
          (bloggerResult.data?.status as ActivationStatus) || 'none'
        );
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
    bloggerStatus,
    isSellerApproved: sellerStatus === 'approved',
    isBloggerApproved: bloggerStatus === 'approved',
    loading,
  };
}
