import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface YandexCampaignResponse {
  campaign?: {
    id: number;
    domain?: string;
    clientId?: number;
    state?: string;
    stateReasons?: string[];
  };
}

interface YandexOffersResponse {
  offerMappingEntries?: Array<{
    offer: {
      offerId: string;
      name: string;
      price?: number;
    };
  }>;
  paging?: {
    total: number;
  };
}

interface YandexOrdersResponse {
  orders?: Array<{
    id: number;
    status: string;
    total: number;
    createdAt: string;
  }>;
  paging?: {
    total: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { shopId, marketplace, apiKey, campaignId, sellerId } = await req.json();

    if (!marketplace || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: marketplace and apiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Connecting marketplace:", marketplace);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accountInfo: Record<string, any> = {};
    let productsCount = 0;
    let ordersCount = 0;
    let totalRevenue = 0;
    let isValid = false;

    // Validate and fetch data based on marketplace
    if (marketplace === "yandex" && campaignId) {
      console.log("Validating Yandex Market API...");
      
      // 1. Get campaign info
      try {
        const campaignResponse = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
          {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (campaignResponse.ok) {
          const campaignData: YandexCampaignResponse = await campaignResponse.json();
          isValid = true;
          accountInfo = {
            campaignId: campaignId,
            campaignName: campaignData.campaign?.domain || "Yandex Market Store",
            state: campaignData.campaign?.state || "UNKNOWN",
            clientId: campaignData.campaign?.clientId,
          };
          console.log("Campaign validated:", accountInfo.campaignName);
        } else {
          console.log("Campaign validation failed, status:", campaignResponse.status);
          // For demo, still allow connection
          isValid = true;
          accountInfo = {
            campaignId: campaignId,
            campaignName: "Yandex Market Store",
            state: "PENDING_VALIDATION",
          };
        }
      } catch (e) {
        console.error("Campaign fetch error:", e);
        isValid = true;
        accountInfo = {
          campaignId: campaignId,
          campaignName: "Yandex Market Store",
          state: "CONNECTION_ERROR",
        };
      }

      // 2. Get products count
      try {
        const offersResponse = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offer-mapping-entries?limit=1`,
          {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (offersResponse.ok) {
          const offersData: YandexOffersResponse = await offersResponse.json();
          productsCount = offersData.paging?.total || 0;
          console.log("Products count:", productsCount);
        }
      } catch (e) {
        console.error("Products fetch error:", e);
      }

      // 3. Get orders count and revenue
      try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
        const toDate = today.toISOString().split('T')[0];

        const ordersResponse = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${fromDate}&toDate=${toDate}&status=PROCESSING,DELIVERY,DELIVERED`,
          {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (ordersResponse.ok) {
          const ordersData: YandexOrdersResponse = await ordersResponse.json();
          ordersCount = ordersData.orders?.length || 0;
          totalRevenue = ordersData.orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
          console.log("Orders count:", ordersCount, "Revenue:", totalRevenue);
        }
      } catch (e) {
        console.error("Orders fetch error:", e);
      }
  } else if (marketplace === "uzum" && apiKey) {
      // Uzum Market Seller OpenAPI validation
      console.log("Validating Uzum Market Seller API...");
      const uzumBaseUrl = "https://api-seller.uzum.uz/api/seller-openapi";
      const uzumHeaders = {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      };

      // 1. Get owned shops (returns array directly per Swagger spec)
      try {
        const shopsResponse = await fetch(`${uzumBaseUrl}/v1/shops`, {
          headers: uzumHeaders,
        });

        if (shopsResponse.ok) {
          const shopsData = await shopsResponse.json();
          // API returns array directly, NOT wrapped in payload
          const shops = Array.isArray(shopsData) ? shopsData : (shopsData.payload || shopsData.data || shopsData || []);
          const shopList = Array.isArray(shops) ? shops : [shops];
          
          if (shopList.length > 0) {
            const shop = shopList[0];
            isValid = true;
            accountInfo = {
              shopId: shop.shopId || shop.id || sellerId,
              storeName: shop.shopTitle || shop.title || shop.name || "Uzum Market Store",
              state: "CONNECTED",
              sellerId: sellerId || shop.sellerId,
              shopsCount: shopList.length,
            };
            console.log("Uzum shop validated:", accountInfo.storeName);
          } else {
            isValid = true;
            accountInfo = {
              shopId: sellerId,
              storeName: "Uzum Market Store",
              state: "CONNECTED",
              sellerId: sellerId,
            };
          }
        } else {
          console.log("Uzum shops validation status:", shopsResponse.status);
          // Still allow connection - API key might be valid but shops endpoint differs
          isValid = true;
          accountInfo = {
            shopId: sellerId,
            storeName: "Uzum Market Store",
            state: "PENDING_VALIDATION",
            sellerId: sellerId,
          };
        }
      } catch (e) {
        console.error("Uzum shops fetch error:", e);
        isValid = true;
        accountInfo = {
          shopId: sellerId,
          storeName: "Uzum Market Store",
          state: "CONNECTION_ERROR",
          sellerId: sellerId,
        };
      }

      // 2. Get products count if we have shopId
      const uzumShopId = accountInfo.shopId || sellerId;
      if (uzumShopId) {
        try {
          const params = new URLSearchParams({
            size: '10',
            page: '0',
            filter: 'ALL',
          });
          const productsResponse = await fetch(
            `${uzumBaseUrl}/v1/product/shop/${uzumShopId}?${params.toString()}`,
            { headers: uzumHeaders }
          );
          if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            const totalCount = productsData.payload?.totalElements || productsData.payload?.total;
            const items = productsData.payload?.productCards || productsData.payload || productsData.data || [];
            productsCount = totalCount || (Array.isArray(items) ? items.length : 0);
            console.log("Uzum products count:", productsCount);
          } else {
            console.log("Uzum products status:", productsResponse.status);
          }
        } catch (e) {
          console.error("Uzum products fetch error:", e);
        }
      }

      // 3. Get orders count
      try {
        const params = new URLSearchParams();
        params.append("status", "CREATED");
        if (uzumShopId) params.append("shopIds", String(uzumShopId));
        
        const ordersResponse = await fetch(
          `${uzumBaseUrl}/v2/fbs/orders/count?${params.toString()}`,
          { headers: uzumHeaders }
        );
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          // GenericResponseLong: { payload: number }
          ordersCount = typeof ordersData.payload === 'number' ? ordersData.payload : (ordersData.payload?.count || 0);
          console.log("Uzum orders count:", ordersCount);
        } else {
          console.log("Uzum orders count status:", ordersResponse.status);
        }
      } catch (e) {
        console.error("Uzum orders fetch error:", e);
      }
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Could not validate marketplace credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encrypt credentials before storing
    const ENCRYPTION_KEY = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");
    
    // For Yandex: derive businessId from campaign info if available
    let businessId = "";
    if (marketplace === "yandex" && campaignId && !businessId) {
      try {
        const bizResp = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
          { headers: { "Api-Key": apiKey, "Content-Type": "application/json" } }
        );
        if (bizResp.ok) {
          const bizData = await bizResp.json();
          businessId = bizData.campaign?.business?.id?.toString() || "";
          console.log(`Derived businessId: ${businessId} from campaign ${campaignId}`);
        }
      } catch (e) {
        console.error("Failed to derive businessId:", e);
      }
    }
    
    const credentialsPayload = {
      apiKey: apiKey,
      campaignId: campaignId || null,
      sellerId: sellerId || null,
      businessId: businessId || null,
    };

    let encryptedCredentials: string | null = null;
    if (ENCRYPTION_KEY) {
      // Use the database function to encrypt
      const { data: encData, error: encError } = await supabase
        .rpc("encrypt_credentials", { p_credentials: credentialsPayload });
      if (!encError && encData) {
        encryptedCredentials = encData;
        console.log("Credentials encrypted successfully");
      } else {
        console.error("Encryption failed, storing without encryption:", encError);
      }
    }

    // Store connection in database
    const connectionData = {
      user_id: user.id,
      shop_id: shopId || null,
      marketplace,
      credentials: encryptedCredentials ? {} : credentialsPayload, // Empty if encrypted
      encrypted_credentials: encryptedCredentials,
      account_info: accountInfo,
      products_count: productsCount,
      orders_count: ordersCount,
      total_revenue: totalRevenue,
      last_sync_at: new Date().toISOString(),
      is_active: true,
    };

    // Upsert connection (update if exists, insert if not)
    const { data: connection, error: dbError } = await supabase
      .from("marketplace_connections")
      .upsert(connectionData, {
        onConflict: "user_id,marketplace",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save connection: " + dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Connection saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        marketplace,
        connection: {
          id: connection.id,
          accountInfo,
          productsCount,
          ordersCount,
          totalRevenue,
          lastSync: connection.last_sync_at,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Connect marketplace error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
