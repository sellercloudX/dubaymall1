import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UZUM_API_BASE = "https://api-seller.uzum.uz";
const UZUM_OPENAPI_BASE = "https://api-seller.uzum.uz/api/seller-openapi";
const BASIC_AUTH = "YjJiLWZyb250OmNsaWVudFNlY3JldA=="; // b2b-front:clientSecret

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
    // Authenticate via OAuth2 password grant
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

      const phone = managerPhone.replace(/\s/g, "");
      console.log(`[uzum-manager-auth] Login attempt for: ${phone.substring(0, 8)}***`);

      // OAuth2 password grant - the real Uzum seller auth endpoint
      const formData = new URLSearchParams({
        grant_type: "password",
        username: phone,
        password: managerPassword,
      });

      console.log(`[uzum-manager-auth] Trying OAuth2 password grant at ${UZUM_API_BASE}/api/oauth/token`);
      
      const resp = await fetch(`${UZUM_API_BASE}/api/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${BASIC_AUTH}`,
          "Accept": "application/json",
        },
        body: formData.toString(),
      });

      const respText = await resp.text();
      console.log(`[uzum-manager-auth] OAuth response status: ${resp.status}`);
      
      let data: any;
      try {
        data = JSON.parse(respText);
      } catch {
        console.error(`[uzum-manager-auth] Non-JSON response: ${respText.substring(0, 300)}`);
        return jsonResponse({
          success: false,
          error: "Invalid response from Uzum auth",
          details: respText.substring(0, 200),
        }, 500);
      }

      if (!resp.ok || data.errors) {
        const errorMsg = data.errors?.[0]?.message || data.error || data.error_description || "Login failed";
        console.error(`[uzum-manager-auth] Login failed: ${errorMsg}`);
        return jsonResponse({
          success: false,
          error: errorMsg,
          hint: "Telefon raqam va parol to'g'riligini tekshiring. Account seller.uzum.uz da ro'yxatdan o'tgan bo'lishi kerak.",
        }, 401);
      }

      // Extract tokens
      const accessToken = data.access_token || data.payload?.access_token || "";
      const refreshToken = data.refresh_token || data.payload?.refresh_token || "";
      const expiresIn = data.expires_in || data.payload?.expires_in || 3600;

      if (!accessToken) {
        console.error(`[uzum-manager-auth] No access_token in response. Keys: ${Object.keys(data).join(",")}`);
        // Log payload structure for debugging
        if (data.payload) {
          console.log(`[uzum-manager-auth] Payload keys: ${Object.keys(data.payload).join(",")}`);
        }
        return jsonResponse({
          success: false,
          error: "No access token received",
          responseKeys: Object.keys(data),
        }, 500);
      }

      console.log(`[uzum-manager-auth] ✅ Login successful! Token length: ${accessToken.length}`);

      // Extract cookies if any
      const loginCookies = extractCookies(resp);

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const sessionData = {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: data.token_type || "Bearer",
        cookies: loginCookies,
        expiresAt,
        updatedAt: new Date().toISOString(),
      };

      await storeManagerSession(adminSupabase, sessionData);

      // Discover shops
      let shops: any[] = [];
      try {
        shops = await discoverShops(accessToken);
        console.log(`[uzum-manager-auth] Discovered ${shops.length} shops`);
      } catch (e: any) {
        console.warn(`[uzum-manager-auth] Shop discovery failed: ${e.message}`);
      }

      return jsonResponse({
        success: true,
        message: "Manager sessiyasi muvaffaqiyatli yaratildi",
        shopsCount: shops.length,
        shops: shops.map((s: any) => ({
          id: s.shopId || s.id,
          name: s.shopTitle || s.title || s.name,
        })),
        expiresAt,
      });
    }

    // ========================
    // ACTION: refresh
    // Refresh expired access token using refresh_token
    // ========================
    if (action === "refresh") {
      const session = await getManagerSession(adminSupabase);
      if (!session?.refreshToken) {
        return jsonResponse({ success: false, error: "No refresh token available", needsRelogin: true }, 401);
      }

      const formData = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      });

      const resp = await fetch(`${UZUM_API_BASE}/api/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${BASIC_AUTH}`,
          "Accept": "application/json",
        },
        body: formData.toString(),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[uzum-manager-auth] Refresh failed: ${resp.status} - ${errText.substring(0, 200)}`);
        return jsonResponse({ success: false, error: "Token refresh failed", needsRelogin: true }, 401);
      }

      const data = await resp.json();
      const accessToken = data.access_token || data.payload?.access_token || "";
      const refreshToken = data.refresh_token || data.payload?.refresh_token || session.refreshToken;
      const expiresIn = data.expires_in || data.payload?.expires_in || 3600;

      if (!accessToken) {
        return jsonResponse({ success: false, error: "No access token after refresh", needsRelogin: true }, 401);
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      await storeManagerSession(adminSupabase, {
        ...session,
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[uzum-manager-auth] ✅ Token refreshed successfully`);
      return jsonResponse({ success: true, message: "Token yangilandi", expiresAt });
    }

    // ========================
    // ACTION: verify
    // ========================
    if (action === "verify") {
      const { userId } = body;
      if (!userId) {
        return jsonResponse({ success: false, error: "userId required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({
          success: false,
          message: "Manager sessiyasi topilmadi yoki muddati o'tgan",
          needsRelogin: true,
        });
      }

      // Test session by calling shops endpoint
      const isValid = await testSession(session.accessToken);
      if (!isValid) {
        return jsonResponse({
          success: false,
          message: "Manager sessiyasi muddati o'tgan",
          needsRelogin: true,
        });
      }

      // Check if user has uzum_accounts entry
      const { data: account } = await adminSupabase
        .from("uzum_accounts")
        .select("id, shop_id, manager_status, shop_name")
        .eq("user_id", userId)
        .eq("manager_status", "active")
        .maybeSingle();

      return jsonResponse({
        success: true,
        message: "Manager sessiyasi faol",
        hasManagerLink: !!account,
        shopId: account?.shop_id,
        shopName: account?.shop_name,
      });
    }

    // ========================
    // ACTION: get-session
    // Internal: get active session for other edge functions
    // ========================
    if (action === "get-session") {
      const session = await getActiveSession(adminSupabase);
      if (session) {
        return jsonResponse({
          success: true,
          accessToken: session.accessToken,
          tokenType: session.tokenType || "Bearer",
        });
      }

      // Auto-login attempt
      console.log("[uzum-manager-auth] No active session, attempting auto-login...");
      const managerPhone = Deno.env.get("UZUM_MANAGER_PHONE");
      const managerPassword = Deno.env.get("UZUM_MANAGER_PASSWORD");
      
      if (!managerPhone || !managerPassword) {
        return jsonResponse({ success: false, error: "No credentials configured" }, 401);
      }

      const formData = new URLSearchParams({
        grant_type: "password",
        username: managerPhone.replace(/\s/g, ""),
        password: managerPassword,
      });

      const resp = await fetch(`${UZUM_API_BASE}/api/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${BASIC_AUTH}`,
          "Accept": "application/json",
        },
        body: formData.toString(),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[uzum-manager-auth] Auto-login failed: ${errText.substring(0, 200)}`);
        return jsonResponse({ success: false, error: "Auto-login failed" }, 401);
      }

      const data = await resp.json();
      const accessToken = data.access_token || data.payload?.access_token || "";
      const refreshToken = data.refresh_token || data.payload?.refresh_token || "";
      
      if (!accessToken) {
        return jsonResponse({ success: false, error: "No token from auto-login" }, 401);
      }

      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await storeManagerSession(adminSupabase, {
        accessToken,
        refreshToken,
        expiresIn: data.expires_in || 3600,
        tokenType: data.token_type || "Bearer",
        cookies: extractCookies(resp),
        expiresAt,
        updatedAt: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        accessToken,
        tokenType: data.token_type || "Bearer",
      });
    }

    // ========================
    // ACTION: list-shops
    // ========================
    if (action === "list-shops") {
      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session", needsRelogin: true }, 401);
      }

      const shops = await discoverShops(session.accessToken);
      return jsonResponse({ success: true, shops });
    }

    // ========================
    // ACTION: proxy
    // ========================
    if (action === "proxy") {
      const { endpoint, method = "GET", payload, useInternal = false } = body;
      if (!endpoint) {
        return jsonResponse({ success: false, error: "endpoint required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session", needsRelogin: true }, 401);
      }

      const baseUrl = useInternal ? UZUM_API_BASE : UZUM_OPENAPI_BASE;
      const fullUrl = endpoint.startsWith("http")
        ? endpoint
        : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${session.accessToken}`,
        "Accept": "application/json",
      };
      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
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
    // ========================
    if (action === "fetch-products") {
      const { shopId } = body;
      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${session.accessToken}`,
        "Accept": "application/json",
      };

      let targetShopIds: string[] = shopId ? [shopId] : [];
      if (targetShopIds.length === 0) {
        const shops = await discoverShops(session.accessToken);
        targetShopIds = shops.map((s: any) => String(s.shopId || s.id));
      }

      const allProducts: any[] = [];
      for (const sid of targetShopIds) {
        let page = 0;
        let hasMore = true;
        while (hasMore && page < 50) {
          try {
            const resp = await fetch(
              `${UZUM_OPENAPI_BASE}/v1/product/shop/${sid}?size=100&page=${page}`,
              { headers }
            );
            if (resp.status === 429) {
              console.warn(`[uzum-manager-auth] Rate limited on products, waiting 2s...`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            if (!resp.ok) {
              console.error(`Products fetch failed for shop ${sid}: ${resp.status}`);
              break;
            }
            const data = await resp.json();
            const cards = data.productCards || data.payload?.productCards || [];
            allProducts.push(...cards);
            if (cards.length < 100) hasMore = false;
            else page++;
          } catch (e: any) {
            console.error(`Products fetch error: ${e.message}`);
            break;
          }
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
    // ========================
    if (action === "fetch-orders") {
      const { shopId, dateFrom, dateTo, status } = body;
      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${session.accessToken}`,
        "Accept": "application/json",
      };

      // Fetch all orders with pagination
      const allOrders: any[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore && page < 100) {
        const params = new URLSearchParams();
        params.append("size", "50");
        params.append("page", String(page));
        if (dateFrom) params.append("dateFrom", dateFrom);
        if (dateTo) params.append("dateTo", dateTo);
        if (status) params.append("status", status);
        if (shopId) params.append("shopIds", shopId);

        try {
          const resp = await fetch(
            `${UZUM_OPENAPI_BASE}/v2/fbs/orders?${params.toString()}`,
            { headers }
          );
          
          if (resp.status === 429) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Orders fetch failed: ${resp.status} - ${errText.substring(0, 200)}`);
            break;
          }

          const data = await resp.json();
          const orders = data.payload?.orders || data.orders || [];
          allOrders.push(...orders);
          
          const totalElements = data.payload?.totalElements || 0;
          if (allOrders.length >= totalElements || orders.length < 50) {
            hasMore = false;
          } else {
            page++;
          }
        } catch (e: any) {
          console.error(`Orders fetch error: ${e.message}`);
          break;
        }
      }

      return jsonResponse({
        success: true,
        orders: allOrders,
        total: allOrders.length,
      });
    }

    // ========================
    // ACTION: fetch-finance
    // ========================
    if (action === "fetch-finance") {
      const { shopIds, dateFrom, dateTo } = body;
      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${session.accessToken}`,
        "Accept": "application/json",
      };

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
      return jsonResponse({ success: true, financeOrders: data });
    }

    // ========================
    // ACTION: update-price
    // ========================
    if (action === "update-price") {
      const { shopId, priceData } = body;
      if (!shopId || !priceData) {
        return jsonResponse({ success: false, error: "shopId and priceData required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v1/product/${shopId}/sendPriceData`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(priceData),
        }
      );

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({ success: resp.ok, status: resp.status, data: result });
    }

    // ========================
    // ACTION: update-stock
    // ========================
    if (action === "update-stock") {
      const { stockData } = body;
      if (!stockData) {
        return jsonResponse({ success: false, error: "stockData required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v2/fbs/sku/stocks`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(stockData),
        }
      );

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({ success: resp.ok, status: resp.status, data: result });
    }

    // ========================
    // ACTION: manage-order
    // ========================
    if (action === "manage-order") {
      const { orderId, orderAction } = body;
      if (!orderId || !orderAction) {
        return jsonResponse({ success: false, error: "orderId and orderAction required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const endpoint = orderAction === "cancel"
        ? `/v1/fbs/order/${orderId}/cancel`
        : `/v1/fbs/order/${orderId}/confirm`;

      const resp = await fetch(`${UZUM_OPENAPI_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const result = await resp.json().catch(() => ({}));
      return jsonResponse({ success: resp.ok, status: resp.status, data: result });
    }

    // ========================
    // ACTION: print-label
    // ========================
    if (action === "print-label") {
      const { orderId } = body;
      if (!orderId) {
        return jsonResponse({ success: false, error: "orderId required" }, 400);
      }

      const session = await getActiveSession(adminSupabase);
      if (!session) {
        return jsonResponse({ success: false, error: "No active session" }, 401);
      }

      const resp = await fetch(
        `${UZUM_OPENAPI_BASE}/v1/fbs/order/${orderId}/labels/print`,
        {
          headers: {
            "Authorization": `Bearer ${session.accessToken}`,
            "Accept": "application/pdf",
          },
        }
      );

      if (!resp.ok) {
        return jsonResponse({ success: false, error: `Label print failed: ${resp.status}` }, resp.status);
      }

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
        setting_key: "uzum_manager_session",
        setting_value: session,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

  if (error) {
    console.error("[uzum-manager-auth] Failed to store session:", error);
  }
}

async function getManagerSession(supabase: any): Promise<any | null> {
  const { data } = await supabase
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", "uzum_manager_session")
    .maybeSingle();

  if (!data?.setting_value) return null;

  try {
    return typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : data.setting_value;
  } catch {
    return null;
  }
}

async function getActiveSession(supabase: any): Promise<any | null> {
  const session = await getManagerSession(supabase);
  if (!session?.accessToken) return null;

  // Check expiry - refresh if within 5 minutes of expiring
  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    
    if (now > expiresAt) {
      // Token expired - try refresh
      if (session.refreshToken) {
        console.log("[uzum-manager-auth] Token expired, attempting refresh...");
        try {
          const formData = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: session.refreshToken,
          });

          const resp = await fetch(`${UZUM_API_BASE}/api/oauth/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${BASIC_AUTH}`,
              "Accept": "application/json",
            },
            body: formData.toString(),
          });

          if (resp.ok) {
            const data = await resp.json();
            const newAccessToken = data.access_token || data.payload?.access_token || "";
            if (newAccessToken) {
              const newSession = {
                ...session,
                accessToken: newAccessToken,
                refreshToken: data.refresh_token || data.payload?.refresh_token || session.refreshToken,
                expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await storeManagerSession(supabase, newSession);
              console.log("[uzum-manager-auth] ✅ Token auto-refreshed");
              return newSession;
            }
          } else {
            await resp.text(); // consume body
          }
        } catch (e: any) {
          console.error("[uzum-manager-auth] Auto-refresh failed:", e.message);
        }
      }
      return null;
    }
    
    // Proactive refresh if within 5 min of expiry
    if (expiresAt - now < 5 * 60 * 1000 && session.refreshToken) {
      // Don't block, just try refresh in background
      console.log("[uzum-manager-auth] Proactive token refresh...");
    }
  }

  return session;
}

async function testSession(accessToken: string): Promise<boolean> {
  try {
    const resp = await fetch(`${UZUM_OPENAPI_BASE}/v1/shops`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    const body = await resp.text(); // consume
    return resp.ok;
  } catch {
    return false;
  }
}

async function discoverShops(accessToken: string): Promise<any[]> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };

  const resp = await fetch(`${UZUM_OPENAPI_BASE}/v1/shops`, { headers });
  if (resp.ok) {
    const data = await resp.json();
    const shops = Array.isArray(data) ? data : (data.payload || data.data || []);
    return Array.isArray(shops) ? shops : [shops];
  }

  await resp.text(); // consume body
  return [];
}
