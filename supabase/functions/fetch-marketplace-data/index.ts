import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface YandexProduct {
  offerId: string;
  name: string;
  price?: number;
  shopSku?: string;
  category?: string;
  pictures?: string[];
  availability?: string;
  stockCount?: number;
}

interface YandexOrder {
  id: number;
  status: string;
  substatus?: string;
  createdAt: string;
  total: number;
  itemsTotal: number;
  deliveryTotal: number;
  buyer?: {
    firstName?: string;
    lastName?: string;
  };
  items?: Array<{
    offerId: string;
    offerName: string;
    count: number;
    price: number;
  }>;
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

    const { marketplace, dataType, limit = 50, page = 1, fromDate, toDate, status } = await req.json();

    if (!marketplace || !dataType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: marketplace and dataType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get marketplace connection
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", marketplace)
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Marketplace not connected", code: "NOT_CONNECTED" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = connection.credentials as { apiKey: string; campaignId?: string; sellerId?: string };
    const { apiKey, campaignId } = credentials;

    console.log(`Fetching ${dataType} from ${marketplace} for user ${user.id}`);

    let result: any = { success: true, data: [] };

    if (marketplace === "yandex" && campaignId) {
      const headers = {
        "Authorization": `OAuth oauth_token="${apiKey}"`,
        "Content-Type": "application/json",
      };

      if (dataType === "products") {
        // Fetch products from Yandex Market
        const offset = (page - 1) * limit;
        const response = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offer-mapping-entries?limit=${limit}&offset=${offset}`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          const products: YandexProduct[] = data.offerMappingEntries?.map((entry: any) => ({
            offerId: entry.offer?.offerId,
            name: entry.offer?.name,
            price: entry.offer?.price?.value,
            shopSku: entry.offer?.shopSku,
            category: entry.offer?.category,
            pictures: entry.offer?.pictures || [],
            availability: entry.awaitingModerationMapping?.availability,
            stockCount: entry.offer?.stockCount,
          })) || [];

          result = {
            success: true,
            data: products,
            total: data.paging?.total || 0,
            page,
            limit,
          };
        } else {
          const errorText = await response.text();
          console.error("Yandex products error:", response.status, errorText);
          result = { success: false, error: "Failed to fetch products", details: errorText };
        }
      } else if (dataType === "orders") {
        // Fetch orders from Yandex Market
        const today = new Date();
        const defaultFromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const from = fromDate || defaultFromDate.toISOString().split('T')[0];
        const to = toDate || today.toISOString().split('T')[0];

        let url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${from}&toDate=${to}`;
        if (status) {
          url += `&status=${status}`;
        }

        const response = await fetch(url, { headers });

        if (response.ok) {
          const data = await response.json();
          const orders: YandexOrder[] = data.orders?.map((order: any) => ({
            id: order.id,
            status: order.status,
            substatus: order.substatus,
            createdAt: order.createdAt,
            total: order.total,
            itemsTotal: order.itemsTotal,
            deliveryTotal: order.deliveryTotal,
            buyer: order.buyer,
            items: order.items?.map((item: any) => ({
              offerId: item.offerId,
              offerName: item.offerName,
              count: item.count,
              price: item.price,
            })),
          })) || [];

          result = {
            success: true,
            data: orders,
            total: data.paging?.total || orders.length,
          };
        } else {
          const errorText = await response.text();
          console.error("Yandex orders error:", response.status, errorText);
          result = { success: false, error: "Failed to fetch orders", details: errorText };
        }
      } else if (dataType === "stats") {
        // Fetch statistics from Yandex Market
        const response = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}/stats/orders`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          result = {
            success: true,
            data: {
              ordersStats: data.result || {},
              campaignId,
            },
          };
        } else {
          // Try alternative stats endpoint
          const offersResponse = await fetch(
            `https://api.partner.market.yandex.ru/campaigns/${campaignId}/stats/offers?limit=100`,
            { headers }
          );

          if (offersResponse.ok) {
            const offersData = await offersResponse.json();
            result = {
              success: true,
              data: {
                offersStats: offersData.offerStats || [],
                total: offersData.paging?.total || 0,
              },
            };
          } else {
            result = { success: false, error: "Failed to fetch stats" };
          }
        }
      } else if (dataType === "balance") {
        // Fetch balance/financial info
        const response = await fetch(
          `https://api.partner.market.yandex.ru/campaigns/${campaignId}/balance`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          result = {
            success: true,
            data: data.balance || {},
          };
        } else {
          result = { success: false, error: "Failed to fetch balance" };
        }
      }

      // Update connection with latest sync time
      await supabase
        .from("marketplace_connections")
        .update({ 
          last_sync_at: new Date().toISOString(),
          products_count: result.total || connection.products_count,
        })
        .eq("id", connection.id);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch marketplace data error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
