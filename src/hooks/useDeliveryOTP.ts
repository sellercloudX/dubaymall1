import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDeliveryOTP() {
  const [loading, setLoading] = useState(false);

  const generateOTP = async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_delivery_otp', {
        p_order_id: orderId
      });

      if (error) throw error;

      toast.success('OTP kod yaratildi!');
      return data as string;
    } catch (error: any) {
      console.error('Generate OTP error:', error);
      toast.error(error.message || 'OTP yaratishda xatolik');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (orderId: string, otp: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_delivery_otp', {
        p_order_id: orderId,
        p_otp: otp
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }

      return result;
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      toast.error(error.message || 'OTP tekshirishda xatolik');
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    generateOTP,
    verifyOTP,
    loading
  };
}
