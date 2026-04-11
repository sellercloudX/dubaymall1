import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UZUM_SELLER_BASE = "https://seller.uzum.uz";
const UZUM_OPENAPI_BASE = "https://api-seller.uzum.uz/api/seller-openapi";

/**
 * Uzum Manager Auth Edge Function
 * 
 * This function manages the platform's manager account session for accessing
 * Uzum Seller Panel on behalf of connected sellers.
 * 
 * Actions:
 *   - login: Authenticate the platform manager account, store session
 *   - verify: Check if a user has an active manager connection
 *   - get-session: Get active session token for API calls (internal use)
 *   - proxy: Make authenticated request to Uzum APIs
 *   - list-shops: List all shops the manager has access to
 *   - create-product: Create a product card via internal panel API
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
    const { action } = body;

    if (!action) {
      return jsonResponse({ success: false, error: "action required" }, 400);
    }

    // ========================
    // ACTION: login
    // Authenticate platform manager account with Uzum Seller Panel
    // ========================
    if (action === "login") {
      const managerPhone = Deno.env.get("UZUM_MANAGER_PHONE");
      const managerPassword = Deno.env.get("UZUM_MANAGER_PASSWORD");

      if (!managerPhone || !managerPassword) {
        return jsonResponse({
          success: false,
          error: "UZUM_MANAGER_PHONE and UZUM_MANAGER_PASSWORD not configured",
        }, 500);
      }

      // Normalize phone: remove spaces, ensure +998 prefix
      const phone = managerPhone.replace(/\s/g, "");
      console.log(`[uzum-manager-auth] Login attempt for: ${phone.substring(0, 8)}***`);

      // Try multiple auth endpoints (Uzum's SSO may vary)
      const authEndpoints = [
        {
          url: `${UZUM_SELLER_BASE}/api/auth/login`,
          body: { phone, password: managerPassword },
        },
        {
          url: `${UZUM_SELLER_BASE}/api/auth/signin`,
          body: { login: phone, password: managerPassword },
        },
        {
          url: "https://id.uzum.uz/api/v1/auth/signin",
          body: { login: phone, password: managerPassword },
        },
        {
          // Uzum uses Keycloak-based auth
          url: "https://id.uzum.uz/realms/uzum/protocol/openid-connect/token",
          body: null, // Will use form-encoded
          formData: new URLSearchParams({
            grant_type: "password",
            client_id: "seller-cabinet",
            username: phone,
            password: managerPassword,
          }),
        },
      ];

      let sessionData: any = null;
      let loginCookies = "";

      for (const endpoint of authEndpoints) {
        try {
          const fetchOpts: RequestInit = {
            method: "POST",
            headers: endpoint.formData
              ? { "Content-Type": "application/x-www-form-urlencoded" }
              : { "Content-Type": "application/json", "Accept": "application/json" },
            body: endpoint.formData
              ? endpoint.formData.toString()
              : JSON.stringify(endpoint.body),
          };

          console.log(`[uzum-manager-auth] Trying: ${endpoint.url}`);
          const resp = await fetch(endpoint.url, fetchOpts);

          if (resp.ok) {
            const data = await resp.json();
            loginCookies = extractCookies(resp);
            
            sessionData = {
              accessToken: data.access_token || data.accessToken || data.token || data.jwt || "",
              refreshToken: data.refresh_token || data.refreshToken || "",
              expiresIn: data.expires_in || data.expiresIn || 3600,
              tokenType: data.token_type || "Bearer",
              source: endpoint.url,
            };

            if (sessionData.accessToken) {
              console.log(`[uzum-manager-auth] ✅ Login successful via ${endpoint.url}`);
              break;
            }
          } else {
            const errText = await resp.text().catch(() => "");
            console.warn(`[uzum-manager-auth] ❌ ${endpoint.url} → ${resp.status}: ${errText.substring(0, 200)}`);
          }
        } catch (e: any) {
          console.warn(`[uzum-manager-auth] Error on ${endpoint.url}: ${e.message}`);
        }
      }

      if (!sessionData?.accessToken) {
        return jsonResponse({
          success: false,
          error: "All login endpoints failed. Check UZUM_MANAGER_PHONE and UZUM_MANAGER_PASSWORD.",
          hint: "Manager account needs to be registered at seller.uzum.uz first",
        }, 401);
      }

      // Store session securely
      const expiresAt = new Date(Date.now() + (sessionData.expiresIn || 3600) * 1000).toISOString();
      await storeManagerSession(adminSupabase, {
        ...sessionData,
        cookies: loginCookies,
        expiresAt,
        updatedAt: new Date().toISOString(),
      });

      // Discover shops accessible to this manager
      let shops: any[] = [];
      try {
        shops = await discoverShops(sessionData.accessToken, loginCookies);
        console.log(`[uzum-manager-auth] Discovered ${shops.length} shops`);
      } catch (e: any) {
        console.warn(`[uzum-manager-auth] Shop discovery failed: ${e.message}`);
      }

      return jsonResponse({
        success: true,
        message: "Manager session established",
        shopsCount: shops.length,
        shops: shops.map((s: any) => ({
          id: s.shopId || s.id,
          name: s.shopTitle || s.title || s.name,
        })),
        expiresAt,
      });
    }

    // ========================
    // ACTION: verify
    // Check if manager connection works for a specific user
    // ========================
    if (action === "verify") {
      const { userId } = body;
      if (!userId) {
        return jsonResponse({ success: false, error: "userId required" }, 400);
      }

      // Check user's uzum_accounts
      const { data: account } = await adminSupabase
        .from("uzum_accounts")
        .select("id, shop_id, manager_status, shop_name")
        .eq("user_id", userId)
        .eq("manager_status", "active")
        .maybeSingle();

      if (!account) {
        return jsonResponse({
          success: false,
          message: "Manager ulanishi topilmadi yoki faol emas",
        });
      }

      // Get stored session
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({
          success: false,
          message: "Manager sessiyasi muddati o'tgan. Qayta login kerak.",
          needsRelogin: true,
        });
      }

      // Test session validity
      const isValid = await testSession(session);
      if (!isValid) {
        return jsonResponse({
          success: false,
          message: "Manager sessiyasi muddati o'tgan",
          needsRelogin: true,
        });
      }

      return jsonResponse({
        success: true,
        message: "Manager sessiyasi faol",
        shopId: account.shop_id,
        shopName: account.shop_name,
      });
    }

    // ========================
    // ACTION: get-session
    // Internal: get active session token for other edge functions
    // ========================
    if (action === "get-session") {
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        // Try auto-login
        const managerPhone = Deno.env.get("UZUM_MANAGER_PHONE");
        const managerPassword = Deno.env.get("UZUM_MANAGER_PASSWORD");
        if (managerPhone && managerPassword) {
          console.log("[uzum-manager-auth] Session expired, attempting auto-login...");
          // Recursively call login
          const loginResp = await fetch(`${supabaseUrl}/functions/v1/uzum-manager-auth`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "login" }),
          });
          const loginResult = await loginResp.json();
          if (loginResult.success) {
            const newSession = await getManagerSession(adminSupabase);
            return jsonResponse({
              success: true,
              accessToken: newSession?.accessToken,
              cookies: newSession?.cookies,
              tokenType: newSession?.tokenType || "Bearer",
            });
          }
        }
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      return jsonResponse({
        success: true,
        accessToken: session.accessToken,
        cookies: session.cookies,
        tokenType: session.tokenType || "Bearer",
      });
    }

    // ========================
    // ACTION: list-shops
    // List all shops accessible to the manager
    // ========================
    if (action === "list-shops") {
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const shops = await discoverShops(session.accessToken, session.cookies);
      return jsonResponse({ success: true, shops });
    }

    // ========================
    // ACTION: proxy
    // Make authenticated request to Uzum APIs
    // Supports both OpenAPI and internal seller panel endpoints
    // ========================
    if (action === "proxy") {
      const { endpoint, method = "GET", payload, useInternal = false } = body;
      if (!endpoint) {
        return jsonResponse({ success: false, error: "endpoint required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session", needsRelogin: true }, 401);
      }

      // Determine base URL
      const baseUrl = useInternal ? UZUM_SELLER_BASE : UZUM_OPENAPI_BASE;
      const fullUrl = endpoint.startsWith("http")
        ? endpoint
        : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

      const headers: Record<string, string> = {
        "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Accept": "application/json",
      };
      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
      }
      if (session.cookies) {
        headers["Cookie"] = session.cookies;
      }

      try {
        const proxyResp = await fetch(fullUrl, {
          method,
          headers,
          ...(payload && method !== "GET" ? { body: JSON.stringify(payload) } : {}),
        });

        const respText = await proxyResp.text();
        let parsed;
        try {
          parsed = JSON.parse(respText);
        } catch {
          parsed = { raw: respText.substring(0, 3000) };
        }

        return jsonResponse({
          success: proxyResp.ok,
          status: proxyResp.status,
          data: parsed,
        }, proxyResp.ok ? 200 : proxyResp.status);
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // ========================
    // ACTION: fetch-products
    // Fetch products using manager session (drop-in for OpenAPI)
    // ========================
    if (action === "fetch-products") {
      const { shopId } = body;
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Accept": "application/json",
      };

      // First discover shops if no shopId provided
      let targetShopIds: string[] = shopId ? [shopId] : [];
      if (targetShopIds.length === 0) {
        const shops = await discoverShops(session.accessToken, session.cookies);
        targetShopIds = shops.map((s: any) => String(s.shopId || s.id));
      }

      const allProducts: any[] = [];
      for (const sid of targetShopIds) {
        let page = 0;
        let hasMore = true;
        while (hasMore && page < 50) {
          const resp = await fetch(
            `${UZUM_OPENAPI_BASE}/v1/product/shop/${sid}?size=100&page=${page}`,
            { headers }
          );
          if (!resp.ok) {
            console.error(`Products fetch failed for shop ${sid}: ${resp.status}`);
            break;
          }
          const data = await resp.json();
          const cards = data.productCards || data.payload?.productCards || [];
          allProducts.push(...cards);
          if (cards.length < 100) hasMore = false;
          else page++;
        }
      }

      return jsonResponse({
        success: true,
        products: allProducts,
        total: allProducts.length,
        shopIds: targetShopIds,
      });
    }

    // ========================
    // ACTION: fetch-orders
    // Fetch orders using manager session
    // ========================
    if (action === "fetch-orders") {
      const { shopId, dateFrom, dateTo } = body;
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Accept": "application/json",
      };

      const params = new URLSearchParams();
      params.append("size", "100");
      params.append("page", "0");
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v2/fbs/orders?${params.toString()}`,
        { headers }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        return jsonResponse({
          success: false,
          error: `Orders fetch failed: ${resp.status}`,
          details: errText.substring(0, 500),
        }, resp.status);
      }

      const data = await resp.json();
      return jsonResponse({
        success: true,
        orders: data,
      });
    }

    // ========================
    // ACTION: fetch-finance
    // Fetch finance data using manager session
    // ========================
    if (action === "fetch-finance") {
      const { shopIds, dateFrom, dateTo } = body;
      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Accept": "application/json",
      };

      // Finance orders
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      params.append("size", "100");
      params.append("page", "0");
      if (shopIds && Array.isArray(shopIds)) {
        shopIds.forEach((sid: string) => params.append("shopIds", sid));
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v1/finance/orders?${params.toString()}`,
        { headers }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        return jsonResponse({
          success: false,
          error: `Finance fetch failed: ${resp.status}`,
          details: errText.substring(0, 500),
        }, resp.status);
      }

      const data = await resp.json();

      // Also fetch expenses
      let expenses = null;
      try {
        const expParams = new URLSearchParams();
        if (dateFrom) expParams.append("dateFrom", dateFrom);
        if (dateTo) expParams.append("dateTo", dateTo);
        expParams.append("size", "100");
        expParams.append("page", "0");
        
        const expResp = await fetch(
          `${UZUM_OPENAPI_BASE}/v1/finance/expenses?${expParams.toString()}`,
          { headers }
        );
        if (expResp.ok) {
          expenses = await expResp.json();
        }
      } catch (e) {
        console.warn("Expenses fetch failed:", e);
      }

      return jsonResponse({
        success: true,
        financeOrders: data,
        expenses,
      });
    }

    // ========================
    // ACTION: update-price
    // Update product prices using manager session
    // ========================
    if (action === "update-price") {
      const { shopId, priceData } = body;
      if (!shopId || !priceData) {
        return jsonResponse({ success: false, error: "shopId and priceData required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v1/product/${shopId}/sendPriceData`,
        {
          method: "POST",
          headers: {
            "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(priceData),
        }
      );

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({
        success: resp.ok,
        status: resp.status,
        data: result,
      });
    }

    // ========================
    // ACTION: update-stock
    // Update FBS stock using manager session
    // ========================
    if (action === "update-stock") {
      const { stockData } = body;
      if (!stockData) {
        return jsonResponse({ success: false, error: "stockData required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v2/fbs/sku/stocks`,
        {
          method: "POST",
          headers: {
            "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(stockData),
        }
      );

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({
        success: resp.ok,
        status: resp.status,
        data: result,
      });
    }

    // ========================
    // ACTION: manage-order
    // Confirm/cancel FBS orders using manager session
    // ========================
    if (action === "manage-order") {
      const { orderId, orderAction } = body; // orderAction: 'confirm' | 'cancel'
      if (!orderId || !orderAction) {
        return jsonResponse({ success: false, error: "orderId and orderAction required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const endpoint = orderAction === "cancel" 
        ? `/v1/fbs/order/${orderId}/cancel`
        : `/v1/fbs/order/${orderId}/confirm`;

      const resp = await fetch(`${UZUM_OPENAPI_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({
        success: resp.ok,
        status: resp.status,
        data: result,
      });
    }

    // ========================
    // ACTION: print-label
    // Print FBS order label
    // ========================
    if (action === "print-label") {
      const { orderId } = body;
      if (!orderId) {
        return jsonResponse({ success: false, error: "orderId required" }, 400);
      }

      const session = await getManagerSession(adminSupabase);
      if (!session?.accessToken) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v1/fbs/order/${orderId}/labels/print`,
        {
          headers: {
            "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
            "Accept": "application/pdf",
          },
        }
      );

      if (!resp.ok) {
        return jsonResponse({ success: false, error: `Label print failed: ${resp.status}` }, resp.status);
      }

      // Return as base64
      const buffer = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return jsonResponse({
        success: true,
        label: base64,
        contentType: "application/pdf",
      });
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
  try {
    const setCookies = resp.headers.getSetCookie?.() || [];
    return setCookies.map((c: string) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

async function storeManagerSession(supabase: any, session: any) {
  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      {
        key: "uzum_manager_session",
        value: JSON.stringify(session),
      },
      { onConflict: "key" }
    );

  if (error) {
    console.error("[uzum-manager-auth] Failed to store session:", error);
  }
}

async function getManagerSession(supabase: any): Promise<any | null> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "uzum_manager_session")
    .maybeSingle();

  if (!data?.value) return null;

  try {
    const session = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    // Check expiry
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      console.log("[uzum-manager-auth] Session expired");
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function testSession(session: any): Promise<boolean> {
  try {
    const resp = await fetch(`${UZUM_OPENAPI_BASE}/v1/shops`, {
      headers: {
        "Authorization": `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Accept": "application/json",
      },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function discoverShops(accessToken: string, cookies?: string): Promise<any[]> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };
  if (cookies) headers["Cookie"] = cookies;

  // Try OpenAPI endpoint first
  const resp = await fetch(`${UZUM_OPENAPI_BASE}/v1/shops`, { headers });
  if (resp.ok) {
    const data = await resp.json();
    const shops = Array.isArray(data) ? data : (data.payload || data.data || []);
    return Array.isArray(shops) ? shops : [shops];
  }

  // Try internal endpoint
  const intResp = await fetch(`${UZUM_SELLER_BASE}/api/seller/shops`, { headers });
  if (intResp.ok) {
    const data = await intResp.json();
    return Array.isArray(data) ? data : (data.shops || data.data || []);
  }

  return [];
}
