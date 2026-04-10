/**
 * SellerCloudX Extension — Auto-login from web app
 * Reads Supabase session from localStorage on sellercloudx.com
 * and forwards auth tokens to the background service worker.
 */

(function () {
  const STORAGE_KEY_PREFIX = 'sb-idcshubgqrzdvkttnslz-auth-token';

  function getSupabaseSession() {
    try {
      // Supabase stores session in localStorage with key pattern: sb-{ref}-auth-token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // Match various Supabase key patterns
        const isAuthKey = (
          key.includes('auth-token') ||
          key.includes('auth_token') ||
          key.startsWith('sb-')
        );
        
        if (!isAuthKey) continue;
        
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          
          // Handle both direct token format and nested format
          const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
          const user = parsed?.user || parsed?.currentSession?.user;
          
          if (accessToken && user?.id) {
            return {
              accessToken,
              userId: user.id,
              userEmail: user.email || '',
            };
          }
        } catch { continue; }
      }
    } catch (e) {
      console.warn('[SCX] Failed to read Supabase session:', e);
    }
    return null;
  }

  function isExtensionValid() {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  function syncSession() {
    if (!isExtensionValid()) return;
    const session = getSupabaseSession();
    if (!session) return;

    try {
      chrome.storage.local.get(['userId', 'accessToken'], (stored) => {
        if (chrome.runtime.lastError || !isExtensionValid()) return;
        
        if (stored.userId === session.userId && stored.accessToken === session.accessToken) {
          return;
        }

        console.log('[SCX] Auto-syncing session from web app for:', session.userEmail);
        
        chrome.storage.local.set({
          accessToken: session.accessToken,
          userId: session.userId,
          userEmail: session.userEmail,
        });

        chrome.runtime.sendMessage({
          type: 'SCX_LOGIN',
          accessToken: session.accessToken,
          userId: session.userId,
        }, () => void chrome.runtime.lastError);
      });
    } catch (e) {
      if (!String(e).includes('Extension context invalidated')) {
        console.warn('[SCX] syncSession error:', e);
      }
    }
  }

  // Also listen for postMessage from the web app (explicit token pass)
  window.addEventListener('message', (event) => {
    if (!isExtensionValid()) return;
    if (event.data?.type === 'SCX_AUTH_TOKEN' && event.data?.accessToken && event.data?.userId) {
      console.log('[SCX] Received auth token via postMessage');
      try {
        chrome.storage.local.set({
          accessToken: event.data.accessToken,
          userId: event.data.userId,
          userEmail: event.data.userEmail || '',
        });
        chrome.runtime.sendMessage({
          type: 'SCX_LOGIN',
          accessToken: event.data.accessToken,
          userId: event.data.userId,
        }, () => void chrome.runtime.lastError);
      } catch (e) {
        // Extension was reloaded/updated — ignore silently
      }
    }
  });

  // Sync on load
  syncSession();

  // Re-sync periodically (session refresh)
  setInterval(syncSession, 30000);

  // Listen for storage changes (Supabase session refresh)
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('auth-token')) {
      setTimeout(syncSession, 500);
    }
  });

  console.log('[SCX] SellerCloudX web app content script loaded');
})();
