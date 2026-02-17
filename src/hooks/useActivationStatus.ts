import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type ActivationStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface ActivationState {
  sellerStatus: ActivationStatus;
  isSellerApproved: boolean;
  loading: boolean;
}

export function useActivationStatus(): ActivationState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    // SellerCloudX: all authenticated users are sellers
    setLoading(false);
  }, [user]);

  return {
    sellerStatus: user ? 'approved' : 'none',
    isSellerApproved: !!user,
    loading,
  };
}
