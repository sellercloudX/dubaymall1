import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SYNC_KEY = 'sellercloud_last_sync';

interface UseAutoSyncOptions {
  connectedMarketplaces: string[];
  enabled: boolean;
  onSyncComplete?: () => void;
}

export function useAutoSync({ connectedMarketplaces, enabled, onSyncComplete }: UseAutoSyncOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const syncAll = useCallback(async (silent = true) => {
    if (isSyncingRef.current || connectedMarketplaces.length === 0) return;
    isSyncingRef.current = true;

    try {
      const results = await Promise.allSettled(
        connectedMarketplaces.map(mp =>
          supabase.functions.invoke('fetch-marketplace-data', {
            body: { marketplace: mp, dataType: 'sync-all' },
          })
        )
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      localStorage.setItem(SYNC_KEY, new Date().toISOString());

      if (!silent) {
        if (failed === 0) {
          toast.success(`${connectedMarketplaces.length} ta marketplace sinxronlandi`);
        } else {
          toast.warning(`${connectedMarketplaces.length - failed}/${connectedMarketplaces.length} sinxronlandi`);
        }
      }

      onSyncComplete?.();
    } catch (e) {
      console.error('Auto-sync error:', e);
    } finally {
      isSyncingRef.current = false;
    }
  }, [connectedMarketplaces, onSyncComplete]);

  useEffect(() => {
    if (!enabled || connectedMarketplaces.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check if we need an immediate sync
    const lastSync = localStorage.getItem(SYNC_KEY);
    const timeSinceLastSync = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity;

    if (timeSinceLastSync > SYNC_INTERVAL_MS) {
      // Delay initial sync by 5 seconds to let the page load
      const timeout = setTimeout(() => syncAll(true), 5000);
      return () => clearTimeout(timeout);
    }

    // Set up periodic sync
    intervalRef.current = setInterval(() => syncAll(true), SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, connectedMarketplaces, syncAll]);

  return { syncAll, isSyncing: isSyncingRef.current };
}
