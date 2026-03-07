import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderAction {
  marketplace: string;
  action: string;
  orderIds?: (string | number)[];
  orderId?: string | number;
  [key: string]: any;
}

export function useOrderManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const executeAction = useCallback(async (params: OrderAction) => {
    setIsLoading(true);
    setActionInProgress(params.action);
    try {
      const { data, error } = await supabase.functions.invoke('manage-marketplace-orders', {
        body: params,
      });

      if (error) throw error;
      if (!data?.success && data?.error) throw new Error(data.error);

      return data;
    } catch (err: any) {
      console.error(`Order action ${params.action} failed:`, err);
      toast.error(`Xatolik: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
    }
  }, []);

  const confirmOrders = useCallback(async (marketplace: string, orderIds: (string | number)[]) => {
    const result = await executeAction({ marketplace, action: 'confirm', orderIds });
    const successCount = result.results?.filter((r: any) => r.success).length || 0;
    toast.success(`${successCount}/${orderIds.length} buyurtma tasdiqlandi`);
    return result;
  }, [executeAction]);

  const cancelOrders = useCallback(async (marketplace: string, orderIds: (string | number)[], reason?: string) => {
    const result = await executeAction({ marketplace, action: 'cancel', orderIds, cancelReason: reason });
    const successCount = result.results?.filter((r: any) => r.success).length || 0;
    toast.success(`${successCount}/${orderIds.length} buyurtma bekor qilindi`);
    return result;
  }, [executeAction]);

  const getLabels = useCallback(async (marketplace: string, orderIds: (string | number)[]) => {
    return executeAction({ marketplace, action: 'labels', orderIds });
  }, [executeAction]);

  const getDropOffPoints = useCallback(async (orderIds: (string | number)[]) => {
    return executeAction({ marketplace: 'uzum', action: 'drop-off-points', orderIds });
  }, [executeAction]);

  const getTimeSlots = useCallback(async (orderIds: (string | number)[], dropOffPointId: string) => {
    return executeAction({ marketplace: 'uzum', action: 'time-slots', orderIds, dropOffPointId });
  }, [executeAction]);

  const createInvoice = useCallback(async (orderIds: (string | number)[]) => {
    return executeAction({ marketplace: 'uzum', action: 'create-invoice', orderIds });
  }, [executeAction]);

  const setDropOff = useCallback(async (invoiceId: string, dropOffPointId: string, timeSlotId: string) => {
    return executeAction({ marketplace: 'uzum', action: 'set-drop-off', invoiceId, dropOffPointId, timeSlotId });
  }, [executeAction]);

  // WB specific
  const getSupplies = useCallback(async () => {
    return executeAction({ marketplace: 'wildberries', action: 'supplies' });
  }, [executeAction]);

  const createSupply = useCallback(async (name?: string) => {
    return executeAction({ marketplace: 'wildberries', action: 'create-supply', supplyName: name });
  }, [executeAction]);

  const addToSupply = useCallback(async (supplyId: string, orderIds: (string | number)[]) => {
    return executeAction({ marketplace: 'wildberries', action: 'add-to-supply', supplyId, orderIds });
  }, [executeAction]);

  // Yandex specific
  const updateYandexStatus = useCallback(async (orderId: string | number, newStatus: string, substatus?: string) => {
    return executeAction({ marketplace: 'yandex', action: 'update-status', orderId, newStatus, substatus });
  }, [executeAction]);

  const setYandexBoxes = useCallback(async (orderId: string | number, boxes?: any[]) => {
    return executeAction({ marketplace: 'yandex', action: 'set-boxes', orderId, boxes });
  }, [executeAction]);

  return {
    isLoading,
    actionInProgress,
    executeAction,
    confirmOrders,
    cancelOrders,
    getLabels,
    getDropOffPoints,
    getTimeSlots,
    createInvoice,
    setDropOff,
    getSupplies,
    createSupply,
    addToSupply,
    updateYandexStatus,
    setYandexBoxes,
  };
}
