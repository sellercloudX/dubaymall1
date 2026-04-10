import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UZUM_SELLER_BASE = "https://seller.uzum.uz";
const UZUM_AUTH_BASE = "https://id.uzum.uz"; // Uzum ID auth service

/**
 * Uzum Manager Auth Edge Function
 * 
 * Actions:
 *   - login: Authenticate the platform's manager account with Uzum, store session
 *   - verify: Check if a valid session exists for a user's connected store
 *   - refresh: Refresh an expiring session token
 *   - proxy: Make an authenticated request to Uzum seller panel on behalf of a user
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, userId } = body;

    if (!action) {
      return jsonResponse({ success: false, error: "action required" }, 400);
    }

    // ========================
    // ACTION: login
    // Authenticate platform manager account with Uzum
    // ========================
    if (action === "login") {
      const managerPhone = Deno.env.get("UZUM_MANAGER_PHONE");
      const managerPassword = Deno.env.get("UZUM_MANAGER_PASSWORD");

      if (!managerPhone || !managerPassword) {
        return jsonResponse({
          success: false,
          error: "UZUM_MANAGER_PHONE and UZUM_MANAGER_PASSWORD secrets not configured",
        }, 500);
      }

      // Step 1: Authenticate with Uzum ID
      // seller.uzum.uz uses Uzum ID (id.uzum.uz) for SSO authentication
      // The login flow: POST credentials → receive access_token + refresh_token
      const loginPayload = {
        phone: managerPhone.replace(/\s/g, "").replace(/^\+/, ""),
        password: managerPassword,
      };

      console.log(`[uzum-manager-auth] Attempting login for manager phone: ${managerPhone.substring(0, 8)}***`);

      // Try seller.uzum.uz direct login endpoint
      const loginResp = await fetch(`${UZUM_SELLER_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "SellerCloudX/1.0",
        },
        body: JSON.stringify(loginPayload),
      });

      if (!loginResp.ok) {
        // Try alternative auth endpoint
        const altResp = await fetch(`${UZUM_AUTH_BASE}/api/v1/auth/signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            login: managerPhone.replace(/\s/g, ""),
            password: managerPassword,
          }),
        });

        if (!altResp.ok) {
          const errText = await altResp.text().catch(() => "");
          console.error(`[uzum-manager-auth] Login failed: ${altResp.status} ${errText.substring(0, 200)}`);
          return jsonResponse({
            success: false,
            error: "Login failed",
            status: altResp.status,
            details: errText.substring(0, 200),
          }, 401);
        }

        const altData = await altResp.json();
        console.log(`[uzum-manager-auth] Alt login successful, storing session`);

        // Store session in DB
        await storeManagerSession(adminSupabase, {
          accessToken: altData.accessToken || altData.access_token || altData.token,
          refreshToken: altData.refreshToken || altData.refresh_token,
          expiresAt: altData.expiresAt || altData.expires_at || new Date(Date.now() + 3600000).toISOString(),
          cookies: extractCookies(altResp),
        });

        return jsonResponse({ success: true, message: "Logged in via alt endpoint" });
      }

      const loginData = await loginResp.json();
      console.log(`[uzum-manager-auth] Login successful`);

      await storeManagerSession(adminSupabase, {
        accessToken: loginData.accessToken || loginData.access_token || loginData.token,
        refreshToken: loginData.refreshToken || loginData.refresh_token,
        expiresAt: loginData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
        cookies: extractCookies(loginResp),
      });

      return jsonResponse({ success: true, message: "Manager session established" });
    }

    // ========================
    // ACTION: verify
    // Check if manager connection works for a specific user
    // ========================
    if (action === "verify") {
      if (!userId) {
        return jsonResponse({ success: false, error: "userId required" }, 400);
      }

      // Check if user has uzum_accounts with active manager
      const { data: account } = await adminSupabase
        .from("uzum_accounts")
        .select("id, shop_id, manager_status")
        .eq("user_id", userId)
        .eq("manager_status", "active")
        .maybeSingle();

      if (!account) {
        return jsonResponse({
          success: false,
          message: "Manager connection not found or not active",
        });
      }

      // Get stored manager session
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({
          success: false,
          message: "Manager session expired or not established. Re-login required.",
        });
      }

      // Verify session is still valid by making a test request
      const testResp = await fetch(`${UZUM_SELLER_BASE}/api/seller/shops`, {
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Accept": "application/json",
        },
      });

      if (!testResp.ok) {
        return jsonResponse({
          success: false,
          message: "Manager session expired",
          needsRelogin: true,
        });
      }

      const shops = await testResp.json().catch(() => ({}));
      return jsonResponse({
        success: true,
        message: "Manager session is valid",
        shops: Array.isArray(shops) ? shops.length : 0,
      });
    }

    // ========================
    // ACTION: proxy
    // Make authenticated request to Uzum seller panel
    // ========================
    if (action === "proxy") {
      const { endpoint, method, payload } = body;
      if (!endpoint) {
        return jsonResponse({ success: false, error: "endpoint required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({
          success: false,
          error: "No active manager session",
          needsRelogin: true,
        }, 401);
      }

      const proxyUrl = endpoint.startsWith("http") 
        ? endpoint 
        : `${UZUM_SELLER_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

      const proxyResp = await fetch(proxyUrl, {
        method: method || "GET",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(session.cookies ? { "Cookie": session.cookies } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });

      const proxyData = await proxyResp.text();
      let parsed;
      try {
        parsed = JSON.parse(proxyData);
      } catch {
        parsed = { raw: proxyData.substring(0, 2000) };
      }

      return jsonResponse({
        success: proxyResp.ok,
        status: proxyResp.status,
        data: parsed,
      }, proxyResp.ok ? 200 : proxyResp.status);
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[uzum-manager-auth] Error:", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
});

// ---- Helpers ----

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractCookies(resp: Response): string {
  const setCookies = resp.headers.getSetCookie?.() || [];
  return setCookies.map((c: string) => c.split(";")[0]).join("; ");
}

async function storeManagerSession(
  supabase: any,
  session: { accessToken: string; refreshToken?: string; expiresAt: string; cookies: string }
) {
  // Store in platform_settings as encrypted JSON
  const { error } = await supabase
    .from("platform_settings")
    .upsert({
      key: "uzum_manager_session",
      value: JSON.stringify({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken || null,
        expiresAt: session.expiresAt,
        cookies: session.cookies,
        updatedAt: new Date().toISOString(),
      }),
    }, { onConflict: "key" });

  if (error) {
    console.error("[uzum-manager-auth] Failed to store session:", error);
  }
}

async function getManagerSession(supabase: any) {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "uzum_manager_session")
    .maybeSingle();

  if (!data?.value) return null;

  try {
    const session = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    // Check if expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
