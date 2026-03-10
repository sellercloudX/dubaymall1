import { supabase } from '@/integrations/supabase/client';

/**
 * Dispatch a notification to a user via in-app + Telegram (if linked).
 * Call this from any part of the app when you want to notify a user.
 */
export async function dispatchNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  referenceId?: string
): Promise<{ success: boolean; telegram_sent?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('dispatch-notification', {
      body: { user_id: userId, type, title, message, reference_id: referenceId },
    });
    if (error) {
      console.error('Dispatch notification error:', error);
      return { success: false };
    }
    return { success: true, telegram_sent: data?.telegram_sent };
  } catch (e) {
    console.error('Dispatch notification error:', e);
    return { success: false };
  }
}

/**
 * Dispatch batch notifications for a user (sends summary via Telegram).
 */
export async function dispatchBatchNotifications(userId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('dispatch-notification', {
      body: { batch_user_id: userId },
    });
    if (error) console.error('Batch dispatch error:', error);
    return data;
  } catch (e) {
    console.error('Batch dispatch error:', e);
    return null;
  }
}
