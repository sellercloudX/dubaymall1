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

    const credentials = connection.credentials as { apiKey: string; campaignId?: string; businessId?: string };
    const { apiKey, campaignId, businessId } = credentials;

    console.log(`Fetching ${dataType} from ${marketplace} for user ${user.id}, campaignId: ${campaignId}, businessId: ${businessId}`);

    let result: any = { success: true, data: [] };

    if (marketplace === "yandex" && (campaignId || businessId)) {
      const headers = {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      };

      if (dataType === "products") {
        // Use offer-mappings endpoint which returns full product data
        const apiPath = businessId 
          ? `https://api.partner.market.yandex.ru/businesses/${businessId}/offer-mappings`
          : `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offer-mappings`;
        
        console.log(`Calling API: ${apiPath}`);
        
        const response = await fetch(
          `${apiPath}?limit=${limit}`,
          { 
            method: 'POST',
            headers,
            body: JSON.stringify({})
          }
        );

        console.log(`Products API response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log("Products API response keys:", Object.keys(data.result || {}));
          
          const offerMappings = data.result?.offerMappings || [];
          console.log(`Found ${offerMappings.length} offer mappings`);
          
          if (offerMappings.length > 0) {
            console.log("Sample mapping structure:", JSON.stringify(offerMappings[0]).substring(0, 800));
          }
          
          const products: YandexProduct[] = offerMappings.map((entry: any) => {
            const offer = entry.offer || {};
            const mapping = entry.mapping || {};
            const awaitingMapping = entry.awaitingModerationMapping || {};
            
            // Get pictures from multiple possible locations
            const pictures = offer.urls || offer.pictures || mapping.pictures || [];
            
            // Get price - check multiple fields
            const price = offer.basicPrice?.value || 
                         offer.price?.value || 
                         offer.price ||
                         mapping.price?.value || 0;
            
            // Get stock from warehouses or stocks array
            let stockCount = 0;
            if (offer.stocks && offer.stocks.length > 0) {
              stockCount = offer.stocks.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
            } else if (offer.stockCount !== undefined) {
              stockCount = offer.stockCount;
            }
            
            // Get status
            const statusValue = mapping.status || 
                          awaitingMapping.status || 
                          offer.availability || 
                          'UNKNOWN';
            
            return {
              offerId: offer.offerId || offer.shopSku || '',
              name: offer.name || mapping.marketSkuName || 'Nomsiz',
              price: price,
              shopSku: offer.shopSku || offer.offerId || '',
              category: mapping.categoryName || offer.category || '',
              pictures: pictures,
              availability: statusValue,
              stockCount: stockCount,
            };
          });

          console.log(`Mapped ${products.length} products`);
          if (products.length > 0) {
            console.log("Sample product:", JSON.stringify(products[0]));
          }

          result = {
            success: true,
            data: products,
            total: data.result?.paging?.total || products.length,
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

        console.log(`Calling orders API: ${url}`);

        const response = await fetch(url, { headers });

        console.log(`Orders API response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`Found ${data.orders?.length || 0} orders`);
          
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
