import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Note: Yandex Market for Uzbekistan already returns prices in UZS (som)
// No currency conversion needed - prices are displayed as-is
// IMPORTANT: Yandex Market allows max 4 parallel requests per businessId
// We must serialize API calls within a single edge function invocation

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper for Yandex API calls with rate limit handling
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    // 420 = rate limit hit, 429 = too many requests
    if (response.status === 420 || response.status === 429) {
      const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000); // 1s, 2s, 4s
      console.warn(`Rate limit hit (${response.status}), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await sleep(waitTime);
      continue;
    }
    
    return response;
  }
  
  // Final attempt without retry
  return fetch(url, options);
}

interface YandexProduct {
  offerId: string;
  name: string;
  price?: number;
  shopSku?: string;
  category?: string;
  pictures?: string[];
  availability?: string;
  stockFBO?: number;
  stockFBS?: number;
  stockCount?: number;
}

interface YandexOrder {
  id: number;
  status: string;
  substatus?: string;
  createdAt: string;
  total: number;
  totalUZS: number;
  itemsTotal: number;
  itemsTotalUZS: number;
  deliveryTotal: number;
  deliveryTotalUZS: number;
  buyer?: {
    firstName?: string;
    lastName?: string;
  };
  items?: Array<{
    offerId: string;
    offerName: string;
    count: number;
    price: number;
    priceUZS: number;
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

    const { marketplace, dataType, limit = 200, page = 1, fromDate, toDate, status, fetchAll = false } = await req.json();

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

      // Helper to get businessId from campaign if not available
      let effectiveBusinessId = businessId;
      if (!effectiveBusinessId && campaignId) {
        try {
          const campaignInfoResponse = await fetch(
            `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
            { headers }
          );
          if (campaignInfoResponse.ok) {
            const campaignData = await campaignInfoResponse.json();
            effectiveBusinessId = campaignData.campaign?.business?.id;
            console.log(`Got businessId ${effectiveBusinessId} from campaign ${campaignId}`);
          }
        } catch (e) {
          console.error("Error fetching campaign info:", e);
        }
      }

      if (dataType === "products") {
        // Use a Map for dedup during fetching — prevents accumulating duplicates
        const productMap = new Map<string, YandexProduct>();
        let total = 0;
        let pageToken: string | undefined;
        let prevPageToken: string | undefined;
        let currentPage = 0;
        const pageLimit = fetchAll ? 200 : limit;

        // Fetch products with pagination
        do {
          let response: Response;
          let useOffersEndpoint = false;
          
          if (effectiveBusinessId) {
            const apiPath = `https://api.partner.market.yandex.ru/businesses/${effectiveBusinessId}/offer-mappings`;
            console.log(`Calling Business API page ${currentPage}: ${apiPath}`);
            
            const body: any = { limit: pageLimit };
            if (pageToken) {
              body.page_token = pageToken;
            }
            
            response = await fetchWithRetry(apiPath, { 
              method: 'POST',
              headers,
              body: JSON.stringify(body)
            });
          } else {
            const apiPath = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers`;
            console.log(`Calling Campaign Offers API page ${currentPage}: ${apiPath}`);
            useOffersEndpoint = true;
            
            const body: any = { limit: pageLimit };
            if (pageToken) {
              body.page_token = pageToken;
            }
            
            response = await fetchWithRetry(apiPath, { 
              method: 'POST',
              headers,
              body: JSON.stringify(body)
            });
          }

          console.log(`Products API response status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Yandex products error:", response.status, errorText);
            break;
          }

          const data = await response.json();
          
          // Get next page token
          const newPageToken = data.result?.paging?.nextPageToken;
          total = data.result?.paging?.total || total;
          
          // CRITICAL: Detect pagination loop — same token means API is repeating
          if (newPageToken && newPageToken === prevPageToken) {
            console.log(`Pagination loop detected at page ${currentPage}, same token returned. Stopping.`);
            break;
          }
          prevPageToken = pageToken;
          pageToken = newPageToken;
          
          let newProductsOnPage = 0;
          
          if (useOffersEndpoint) {
            const offers = data.result?.offers || data.offers || [];
            console.log(`Found ${offers.length} offers on page ${currentPage}`);
            
            if (offers.length === 0) break; // No more data
            
            offers.forEach((offer: any) => {
              const offerId = offer.offerId || '';
              if (!offerId || productMap.has(offerId)) return;
              
              const price = offer.basicPrice?.value || offer.price?.value || offer.price || 0;
              let stockFBO = 0;
              let stockFBS = 0;
              
              if (offer.warehouses && Array.isArray(offer.warehouses)) {
                offer.warehouses.forEach((wh: any) => {
                  const stocks = wh.stocks || [];
                  const warehouseStock = stocks.reduce((s: number, st: any) => s + (st.count || 0), 0);
                  if (wh.warehouseId && wh.warehouseId < 100000) {
                    stockFBO += warehouseStock;
                  } else {
                    stockFBS += warehouseStock;
                  }
                });
              } else if (offer.stocks && Array.isArray(offer.stocks)) {
                stockFBS = offer.stocks.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
              }
              
              newProductsOnPage++;
              productMap.set(offerId, {
                offerId,
                name: offer.name || offer.marketModelName || '',
                price,
                shopSku: offer.shopSku || offerId,
                category: offer.category?.name || offer.marketCategoryName || '',
                pictures: offer.pictures || offer.urls || [],
                availability: offer.cardStatus || offer.status || 'UNKNOWN',
                stockFBO,
                stockFBS,
                stockCount: stockFBO + stockFBS,
              });
            });
          } else {
            const offerMappings = data.result?.offerMappings || [];
            console.log(`Found ${offerMappings.length} offer mappings on page ${currentPage}`);
            
            if (offerMappings.length === 0) break; // No more data
            
            offerMappings.forEach((entry: any) => {
              const offer = entry.offer || {};
              const mapping = entry.mapping || {};
              const awaitingMapping = entry.awaitingModerationMapping || {};
              
              const offerId = offer.offerId || offer.shopSku || '';
              if (!offerId || productMap.has(offerId)) return;
              
              const price = offer.basicPrice?.value || 
                           offer.price?.value || 
                           offer.price ||
                           mapping.price?.value || 0;
              
              let stockFBO = 0;
              let stockFBS = 0;
              
              if (offer.stocks && Array.isArray(offer.stocks)) {
                offer.stocks.forEach((s: any) => {
                  const count = s.count || s.available || 0;
                  if (s.type === 'FBO' || s.warehouseType === 'FBO') stockFBO += count;
                  else stockFBS += count;
                });
              }
              if (mapping.stocks && Array.isArray(mapping.stocks)) {
                mapping.stocks.forEach((s: any) => {
                  const count = s.count || s.available || 0;
                  if (s.type === 'FBO' || s.warehouseType === 'FBO') stockFBO += count;
                  else stockFBS += count;
                });
              }
              
              const statusValue = mapping.status || 
                                 awaitingMapping?.cardStatus || 
                                 offer.cardStatus || 
                                 (offer.archived ? 'ARCHIVED' : null) ||
                                 'ACTIVE';
              
              const category = mapping.marketCategoryName || 
                              mapping.categoryName || 
                              offer.category?.name || 
                              offer.category || 
                              '';
              
              newProductsOnPage++;
              productMap.set(offerId, {
                offerId,
                name: offer.name || mapping.marketSkuName || mapping.marketModelName || '',
                price,
                shopSku: offer.shopSku || offerId,
                category,
                pictures: offer.pictures || offer.urls || mapping.pictures || [],
                availability: statusValue,
                stockFBO,
                stockFBS,
                stockCount: stockFBO + stockFBS,
              });
            });
          }

          console.log(`Page ${currentPage}: ${newProductsOnPage} new unique products (total unique: ${productMap.size})`);
          
          // If no new unique products found on this page, stop — we've seen them all
          if (newProductsOnPage === 0) {
            console.log(`No new products on page ${currentPage}, stopping pagination.`);
            break;
          }
          
          currentPage++;
          
          // If not fetching all, break after first page
          if (!fetchAll) break;
          
          // Add delay between pages to avoid rate limiting
          if (pageToken) {
            await sleep(500);
          }
          
        } while (pageToken && currentPage < 50); // Max 50 pages safety limit
        
        let allProducts = Array.from(productMap.values());

        console.log(`Total unique products: ${allProducts.length}`);
        
        // Try to get stocks from dedicated endpoint (with delay to avoid rate limit)
        if (campaignId && allProducts.length > 0) {
          try {
            await sleep(800); // Wait before making another API call
            const stocksResponse = await fetchWithRetry(
              `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit: 200 })
              }
            );
            
            if (stocksResponse.ok) {
              const stocksData = await stocksResponse.json();
              const warehouseOffers = stocksData.result?.warehouses || [];
              console.log(`Got stocks data from ${warehouseOffers.length} warehouses`);
              
              // Create a map of offerId -> stocks
              const stockMap = new Map<string, { fbo: number; fbs: number }>();
              
              warehouseOffers.forEach((wh: any) => {
                const offers = wh.offers || [];
                offers.forEach((offer: any) => {
                  const offerId = offer.offerId;
                  const items = offer.stocks || [];
                  const count = items.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
                  
                  const existing = stockMap.get(offerId) || { fbo: 0, fbs: 0 };
                  if (wh.warehouseId < 100000) {
                    existing.fbo += count;
                  } else {
                    existing.fbs += count;
                  }
                  stockMap.set(offerId, existing);
                });
              });
              
              // REPLACE (not add) stock data with accurate dedicated endpoint data
              allProducts = allProducts.map(p => {
                const stocks = stockMap.get(p.offerId);
                if (stocks) {
                  return {
                    ...p,
                    stockFBO: stocks.fbo,
                    stockFBS: stocks.fbs,
                    stockCount: stocks.fbo + stocks.fbs,
                  };
                }
                return p;
              });
              
              console.log(`Updated stocks for ${stockMap.size} products`);
            }
          } catch (e) {
            console.error("Error fetching stocks:", e);
          }
        }

        result = {
          success: true,
          data: allProducts,
          total: allProducts.length,
          page,
          limit,
        };
      } else if (dataType === "orders") {
        // Fetch ALL orders from Yandex Market
        const today = new Date();
        const defaultFromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const from = fromDate || defaultFromDate.toISOString().split('T')[0];
        const to = toDate || today.toISOString().split('T')[0];

        let allOrders: YandexOrder[] = [];
        let orderPage = 1;
        let hasMoreOrders = true;

        while (hasMoreOrders) {
          let url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${from}&toDate=${to}&page=${orderPage}&pageSize=50`;
          if (status) {
            url += `&status=${status}`;
          }

          console.log(`Calling orders API page ${orderPage}: ${url}`);

          const response = await fetchWithRetry(url, { headers });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Yandex orders error:", response.status, errorText);
            break;
          }

          const data = await response.json();
          const orders = data.orders || [];
          console.log(`Found ${orders.length} orders on page ${orderPage}`);
          
          // Log first order to see available fields
          if (orders.length > 0 && orderPage === 1) {
            console.log('Sample order fields:', JSON.stringify(Object.keys(orders[0])));
            console.log('Sample order dates:', JSON.stringify({
              createdAt: orders[0].createdAt,
              creationDate: orders[0].creationDate,
              updateDate: orders[0].updateDate,
            }));
          }

          // Yandex Market UZ returns prices in UZS directly - no conversion needed
          const pageOrders: YandexOrder[] = orders.map((order: any) => {
            const total = order.total || 0;
            const itemsTotal = order.itemsTotal || 0;
            const deliveryTotal = order.deliveryTotal || 0;
            
            return {
              id: order.id,
              status: order.status,
              substatus: order.substatus,
              createdAt: order.creationDate || order.createdAt || new Date().toISOString(),
              total: total,
              totalUZS: total,
              itemsTotal: itemsTotal,
              itemsTotalUZS: itemsTotal,
              deliveryTotal: deliveryTotal,
              deliveryTotalUZS: deliveryTotal,
              buyer: {
                firstName: order.buyer?.firstName || '',
                lastName: order.buyer?.lastName || '',
                type: order.buyer?.type,
              },
              deliveryAddress: order.delivery?.address,
              deliveryRegion: order.delivery?.region?.name,
              items: order.items?.map((item: any) => {
                const itemPrice = item.price || 0;
                return {
                  offerId: item.offerId,
                  offerName: item.offerName,
                  count: item.count,
                  price: itemPrice,
                  priceUZS: itemPrice,
                };
              }),
            };
          });

          allOrders = [...allOrders, ...pageOrders];

          // Check if there are more pages
          const paging = data.pager || data.paging || {};
          const totalPages = paging.pagesCount || Math.ceil((paging.total || 0) / 50);
          
          if (orderPage >= totalPages || orders.length < 50 || !fetchAll) {
            hasMoreOrders = false;
          } else {
            orderPage++;
            await sleep(500); // Delay between pages to avoid rate limiting
          }
        }

        console.log(`Total orders fetched: ${allOrders.length}`);

        result = {
          success: true,
          data: allOrders,
          total: allOrders.length,
        };
      } else if (dataType === "stocks") {
        // Dedicated stocks endpoint with FBO/FBS breakdown
        if (!campaignId) {
          result = { success: false, error: "Campaign ID required for stocks" };
        } else {
          try {
            const stocksResponse = await fetchWithRetry(
              `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit: 200 })
              }
            );
            
            if (stocksResponse.ok) {
              const stocksData = await stocksResponse.json();
              const warehouseOffers = stocksData.result?.warehouses || [];
              
              // Aggregate by offerId
              const stockMap = new Map<string, { offerId: string; fbo: number; fbs: number; total: number }>();
              
              warehouseOffers.forEach((wh: any) => {
                const warehouseName = wh.warehouseName || '';
                const isFBO = warehouseName.toLowerCase().includes('yandex') || wh.warehouseId < 100000;
                
                const offers = wh.offers || [];
                offers.forEach((offer: any) => {
                  const offerId = offer.offerId;
                  const items = offer.stocks || [];
                  const count = items.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
                  
                  const existing = stockMap.get(offerId) || { offerId, fbo: 0, fbs: 0, total: 0 };
                  if (isFBO) {
                    existing.fbo += count;
                  } else {
                    existing.fbs += count;
                  }
                  existing.total = existing.fbo + existing.fbs;
                  stockMap.set(offerId, existing);
                });
              });
              
              result = {
                success: true,
                data: Array.from(stockMap.values()),
                total: stockMap.size,
              };
            } else {
              result = { success: false, error: "Failed to fetch stocks" };
            }
          } catch (e) {
            console.error("Error fetching stocks:", e);
            result = { success: false, error: "Error fetching stocks" };
          }
        }
      } else if (dataType === "stats") {
        // Fetch statistics from Yandex Market
        const response = await fetchWithRetry(
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
          const offersResponse = await fetchWithRetry(
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
        const response = await fetchWithRetry(
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
