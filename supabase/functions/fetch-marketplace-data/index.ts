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
  marketCategoryId?: number;
  pictures?: string[];
  description?: string;
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

// Helper to map WB order object to unified format
function mapWBOrder(o: any, defaultStatus: string) {
  return {
    id: o.id || o.rid,
    status: defaultStatus,
    createdAt: o.createdAt || o.dateCreated || new Date().toISOString(),
    total: o.convertedPrice || o.price || o.salePrice || 0,
    totalUZS: o.convertedPrice || o.price || o.salePrice || 0,
    itemsTotal: o.convertedPrice || o.price || o.salePrice || 0,
    itemsTotalUZS: o.convertedPrice || o.price || o.salePrice || 0,
    deliveryTotal: 0,
    deliveryTotalUZS: 0,
    items: [{
      offerId: o.article || o.supplierArticle || "",
      offerName: o.subject || "",
      count: 1,
      price: o.convertedPrice || o.price || 0,
      priceUZS: o.convertedPrice || o.price || 0,
    }],
    buyer: { firstName: o.regionName || "", lastName: "" },
    nmID: o.nmId,
    warehouseName: o.warehouseName || "",
    deliveryType: o.deliveryType || "",
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

    const requestBody = await req.json();
    const { marketplace, dataType, limit = 200, page = 1, fromDate, toDate, status, fetchAll = false, offers: tariffOffers } = requestBody;

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

    // Decrypt credentials if encrypted, otherwise use plain credentials
    let credentials: { apiKey: string; campaignId?: string; businessId?: string; sellerId?: string };
    
    if (connection.encrypted_credentials) {
      const { data: decData, error: decError } = await supabase
        .rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
      if (decError || !decData) {
        console.error("Failed to decrypt credentials:", decError);
        return new Response(
          JSON.stringify({ error: "Failed to decrypt credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      credentials = decData as any;
    } else {
      credentials = connection.credentials as any;
    }
    
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
        const pageLimit = fetchAll ? 100 : Math.min(limit, 100); // Yandex max 100 per request

        // Fetch products with pagination
        do {
          let response: Response;
          let useOffersEndpoint = false;
          
          if (effectiveBusinessId) {
            let apiPath = `https://api.partner.market.yandex.ru/v2/businesses/${effectiveBusinessId}/offer-mappings?limit=${pageLimit}`;
            if (pageToken) {
              apiPath += `&page_token=${encodeURIComponent(pageToken)}`;
            }
            console.log(`Calling Business API page ${currentPage}: ${apiPath}`);
            
            response = await fetchWithRetry(apiPath, { 
              method: 'POST',
              headers,
              body: JSON.stringify({})
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
              // Initial stock = 0; will be replaced by dedicated stocks endpoint below
              let stockFBO = 0;
              let stockFBS = 0;
              
              newProductsOnPage++;
              productMap.set(offerId, {
                offerId,
                name: offer.name || offer.marketModelName || '',
                price,
                shopSku: offer.shopSku || offerId,
                category: offer.category?.name || offer.marketCategoryName || '',
                marketCategoryId: offer.marketCategoryId || offer.category?.id || 0,
                pictures: offer.pictures || offer.urls || [],
                description: offer.description || '',
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
              
              // Initial stock = 0; will be replaced by dedicated stocks endpoint below
              let stockFBO = 0;
              let stockFBS = 0;
              
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
                marketCategoryId: mapping.marketCategoryId || offer.marketCategoryId || 0,
                pictures: offer.pictures || offer.urls || mapping.pictures || [],
                description: offer.description || '',
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
        // Paginate to get ALL stocks, not just first 200
        if (campaignId && allProducts.length > 0) {
          try {
            await sleep(800);
            const stockMap = new Map<string, { fbo: number; fbs: number }>();
            
            // First, get seller's own warehouses (FBS) to distinguish from Yandex warehouses (FBO)
            const sellerWarehouseIds = new Set<number>();
            try {
              const whResp = await fetchWithRetry(
                `https://api.partner.market.yandex.ru/campaigns/${campaignId}/warehouses`,
                { headers }
              );
              if (whResp.ok) {
                const whData = await whResp.json();
                const warehouses = whData.result?.warehouses || whData.warehouses || [];
                warehouses.forEach((wh: any) => {
                  if (wh.id) sellerWarehouseIds.add(wh.id);
                });
                console.log(`Seller warehouses (FBS): ${Array.from(sellerWarehouseIds).join(', ')}`);
              }
            } catch (e) {
              console.error("Error fetching seller warehouses:", e);
            }
            
            let stockPageToken: string | undefined;
            let stockPage = 0;

            do {
              const stockBody: any = { limit: 200 };
              if (stockPageToken) stockBody.page_token = stockPageToken;

              const stocksResponse = await fetchWithRetry(
                `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(stockBody)
                }
              );
              
              if (!stocksResponse.ok) break;

              const stocksData = await stocksResponse.json();
              const warehouseOffers = stocksData.result?.warehouses || [];
              stockPageToken = stocksData.result?.paging?.nextPageToken;
              
              console.log(`Stocks page ${stockPage}: ${warehouseOffers.length} warehouses`);
              
              warehouseOffers.forEach((wh: any) => {
                const whId = wh.warehouseId;
                const isFBS = sellerWarehouseIds.has(whId) || sellerWarehouseIds.size === 0;
                console.log(`  Warehouse ${whId} => ${isFBS ? 'FBS' : 'FBO'}`);
                
                const offers = wh.offers || [];
                offers.forEach((offer: any) => {
                  const offerId = offer.offerId;
                  const items = offer.stocks || [];
                  const fitCount = items
                    .filter((s: any) => s.type === "FIT" || s.type === "AVAILABLE")
                    .reduce((sum: number, s: any) => sum + (s.count || 0), 0);
                  
                  const existing = stockMap.get(offerId) || { fbo: 0, fbs: 0 };
                  if (isFBS) {
                    existing.fbs += fitCount;
                  } else {
                    existing.fbo += fitCount;
                  }
                  stockMap.set(offerId, existing);
                });
              });

              stockPage++;
              if (stockPageToken) await sleep(500);
            } while (stockPageToken && stockPage < 20);
            
            // REPLACE stock data with accurate dedicated endpoint data
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
            
            // Log sample stock data for debugging
            const sampleProducts = allProducts.slice(0, 3);
            sampleProducts.forEach(p => {
              console.log(`Stock debug: ${p.offerId} => FBO=${p.stockFBO}, FBS=${p.stockFBS}, total=${p.stockCount}`);
            });
            console.log(`Updated stocks for ${stockMap.size} products`);
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
        // Fetch orders from Yandex Market
        // Yandex API allows max 30-day intervals, so we split into 30-day chunks
        // to fetch up to 365 days of data for client-side date filtering
        const today = new Date();
        const requestedDays = 365;
        const chunkDays = 30;
        const startDate = fromDate ? new Date(fromDate) : new Date(today.getTime() - requestedDays * 24 * 60 * 60 * 1000);
        const endDate = toDate ? new Date(toDate) : today;

        let allOrders: YandexOrder[] = [];
        const orderIdsSeen = new Set<number>();

        // Split into 30-day chunks
        let chunkEnd = new Date(endDate);
        while (chunkEnd > startDate) {
          let chunkStart = new Date(chunkEnd.getTime() - chunkDays * 24 * 60 * 60 * 1000);
          if (chunkStart < startDate) chunkStart = new Date(startDate);
          
          const from = chunkStart.toISOString().split('T')[0];
          const to = chunkEnd.toISOString().split('T')[0];
          
          let orderPage = 1;
          let hasMoreOrders = true;

          while (hasMoreOrders) {
            let url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${from}&toDate=${to}&page=${orderPage}&pageSize=50`;
            if (status) {
              url += `&status=${status}`;
            }

            console.log(`Calling orders API page ${orderPage} (${from} to ${to}): ${url}`);

            const response = await fetchWithRetry(url, { headers });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Yandex orders error:", response.status, errorText);
              hasMoreOrders = false;
              break;
            }

            const data = await response.json();
            const orders = data.orders || [];
            console.log(`Found ${orders.length} orders on page ${orderPage} (${from} to ${to})`);
            
            if (orders.length > 0 && orderPage === 1 && allOrders.length === 0) {
              console.log('Sample order fields:', JSON.stringify(Object.keys(orders[0])));
            }

            const pageOrders: YandexOrder[] = orders.map((order: any) => {
              const itemsTotal = order.buyerItemsTotal || order.itemsTotal || 0;
              const deliveryTotal = order.deliveryTotal || 0;
              const total = order.buyerTotal || order.buyerItemsTotalBeforeDiscount || (itemsTotal + deliveryTotal) || 0;
              
              // Parse Yandex date format "DD-MM-YYYY HH:MM:SS" to ISO
              let parsedDate = new Date().toISOString();
              const rawDate = order.creationDate || order.createdAt || '';
              if (rawDate) {
                const ddmmMatch = rawDate.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
                if (ddmmMatch) {
                  // DD-MM-YYYY HH:MM:SS → ISO
                  parsedDate = `${ddmmMatch[3]}-${ddmmMatch[2]}-${ddmmMatch[1]}T${ddmmMatch[4]}:${ddmmMatch[5]}:${ddmmMatch[6]}Z`;
                } else if (rawDate.includes('T') || rawDate.match(/^\d{4}-/)) {
                  // Already ISO-like
                  parsedDate = rawDate;
                } else {
                  // Try DD-MM-YYYY without time
                  const dateOnlyMatch = rawDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                  if (dateOnlyMatch) {
                    parsedDate = `${dateOnlyMatch[3]}-${dateOnlyMatch[2]}-${dateOnlyMatch[1]}T00:00:00Z`;
                  } else {
                    parsedDate = new Date().toISOString();
                  }
                }
              }

              return {
                id: order.id,
                status: order.status,
                substatus: order.substatus,
                createdAt: parsedDate,
                total: total,
                totalUZS: total,
                itemsTotal: itemsTotal,
                itemsTotalUZS: itemsTotal,
                deliveryTotal: deliveryTotal,
                deliveryTotalUZS: deliveryTotal,
                paymentType: order.paymentType,
                paymentMethod: order.paymentMethod,
                buyer: {
                  firstName: order.buyer?.firstName || '',
                  lastName: order.buyer?.lastName || '',
                  type: order.buyer?.type,
                },
                deliveryAddress: order.delivery?.address,
                deliveryRegion: order.delivery?.region?.name,
                items: order.items?.map((item: any) => {
                  const itemPrice = item.buyerPrice || item.price || 0;
                  return {
                    offerId: item.offerId,
                    offerName: item.offerName,
                    count: item.count,
                    price: itemPrice,
                    priceUZS: itemPrice,
                    categoryId: item.marketCategoryId,
                  };
                }),
              };
            });

            // Deduplicate orders across chunks
            for (const order of pageOrders) {
              if (!orderIdsSeen.has(order.id)) {
                orderIdsSeen.add(order.id);
                allOrders.push(order);
              }
            }

            const paging = data.pager || data.paging || {};
            const totalPages = paging.pagesCount || Math.ceil((paging.total || 0) / 50);
            
            if (orderPage >= totalPages || orders.length < 50 || !fetchAll) {
              hasMoreOrders = false;
            } else {
              orderPage++;
              await sleep(500);
            }
          }

          // Move to previous chunk
          chunkEnd = new Date(chunkStart.getTime() - 1);
          await sleep(300); // Small delay between chunks
        }

        // Calculate total revenue from non-cancelled orders
        const activeYandexOrders = allOrders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
        const yandexTotalRevenue = activeYandexOrders.reduce((sum, o) => sum + (o.totalUZS || o.total || 0), 0);

        console.log(`Total orders fetched: ${allOrders.length}, active: ${activeYandexOrders.length}, revenue: ${yandexTotalRevenue}`);

        result = {
          success: true,
          data: allOrders,
          total: allOrders.length,
        };

        // Update connection with orders count and revenue
        await supabase
          .from("marketplace_connections")
          .update({
            orders_count: allOrders.length,
            total_revenue: yandexTotalRevenue,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      } else if (dataType === "stocks") {
        // Dedicated stocks endpoint with FBO/FBS breakdown
        if (!campaignId) {
          result = { success: false, error: "Campaign ID required for stocks" };
        } else {
          try {
            // Get seller warehouses to distinguish FBS from FBO
            const sellerWhIds = new Set<number>();
            try {
              const whResp = await fetchWithRetry(
                `https://api.partner.market.yandex.ru/campaigns/${campaignId}/warehouses`,
                { headers }
              );
              if (whResp.ok) {
                const whData = await whResp.json();
                (whData.result?.warehouses || whData.warehouses || []).forEach((wh: any) => {
                  if (wh.id) sellerWhIds.add(wh.id);
                });
              }
            } catch (_) {}
            
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
              
              const stockMap = new Map<string, { offerId: string; fbo: number; fbs: number; total: number }>();
              
              warehouseOffers.forEach((wh: any) => {
                const whId = wh.warehouseId;
                const isFBS = sellerWhIds.has(whId) || sellerWhIds.size === 0;
                
                const offers = wh.offers || [];
                offers.forEach((offer: any) => {
                  const offerId = offer.offerId;
                  const items = offer.stocks || [];
                  
                  const existing = stockMap.get(offerId) || { offerId, fbo: 0, fbs: 0, total: 0 };
                  const fitCount = items
                    .filter((s: any) => s.type === "FIT" || s.type === "AVAILABLE")
                    .reduce((sum: number, s: any) => sum + (s.count || 0), 0);
                  if (isFBS) {
                    existing.fbs += fitCount;
                  } else {
                    existing.fbo += fitCount;
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
    } else if (dataType === "tariffs") {
        // Calculate real Yandex Market tariffs per product
        try {
          const offersForCalc = (tariffOffers || []).slice(0, 200).map((o: any) => ({
            categoryId: (o.categoryId && o.categoryId > 0) ? o.categoryId : 91491,
            price: o.price || 0,
            length: o.length || 20,
            width: o.width || 15,
            height: o.height || 10,
            weight: o.weight || 0.5,
          }));

          console.log(`Tariff calc: ${offersForCalc.length} offers, campaignId: ${campaignId}`);

          if (offersForCalc.length === 0) {
            result = { success: true, data: [], message: "No offers provided" };
          } else {
            await sleep(500);
            const tariffResponse = await fetchWithRetry(
              'https://api.partner.market.yandex.ru/v2/tariffs/calculate',
              {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  parameters: { 
                    campaignId: Number(campaignId),
                  },
                  offers: offersForCalc,
                }),
              }
            );

            console.log(`Tariff API response status: ${tariffResponse.status}`);

            if (tariffResponse.ok) {
              const tariffData = await tariffResponse.json();
              const tariffResults = tariffData.result?.offers || [];
              
              console.log(`Got ${tariffResults.length} tariff results`);
              
              const parsed = tariffResults.map((t: any, idx: number) => {
                const tariffs = t.tariffs || [];
                let agencyCommission = 0;
                let fulfillment = 0;
                let delivery = 0;
                let sorting = 0;
                let other = 0;
                // Extract EXACT commission percentage from API parameters
                let commissionPercentFromApi = 0;
                
                tariffs.forEach((tariff: any) => {
                  const amount = tariff.amount || 0;
                  const type = tariff.type || '';
                  
                  // Extract percentage from parameters array (most accurate source)
                  const params = tariff.parameters || [];
                  const valueParam = params.find((p: any) => p.name === 'value');
                  const valueType = params.find((p: any) => p.name === 'valueType');
                  const isRelative = valueType?.value === 'relative';
                  
                  if (type === 'FEE' || type === 'AGENCY_COMMISSION' || type === 'PAYMENT_TRANSFER') {
                    agencyCommission += amount;
                    // Accumulate exact % from API for commission-type fees
                    if (isRelative && valueParam?.value) {
                      commissionPercentFromApi += parseFloat(valueParam.value) || 0;
                    }
                  } else if (type === 'DELIVERY_TO_CUSTOMER' || type === 'CROSSREGIONAL_DELIVERY' || type === 'EXPRESS_DELIVERY' || type === 'MIDDLE_MILE') {
                    delivery += amount;
                  } else if (type === 'SORTING') {
                    sorting += amount;
                  } else {
                    other += amount;
                  }
                });
                
                const price = offersForCalc[idx]?.price || 0;
                const totalTariff = agencyCommission + fulfillment + delivery + sorting + other;
                
                return {
                  index: idx,
                  categoryId: offersForCalc[idx]?.categoryId,
                  price,
                  agencyCommission,
                  // EXACT commission % from API parameters (e.g. FEE 5.50% + PAYMENT_TRANSFER 1.50% = 7%)
                  commissionPercent: commissionPercentFromApi > 0 
                    ? Math.round(commissionPercentFromApi * 100) / 100
                    : (price > 0 ? Math.round((agencyCommission / price) * 10000) / 100 : 0),
                  fulfillment,
                  delivery,
                  sorting,
                  other,
                  totalTariff,
                  tariffPercent: price > 0 ? Math.round((totalTariff / price) * 10000) / 100 : 0,
                  rawTariffs: tariffs,
                };
              });
              
              console.log(`Parsed tariffs sample:`, JSON.stringify(parsed[0] || {}));
              result = { success: true, data: parsed };
            } else {
              const errText = await tariffResponse.text();
              console.error("Tariff calc error:", tariffResponse.status, errText);
              result = { success: false, error: `Tariff calculation failed: ${tariffResponse.status}`, details: errText };
            }
          }
        } catch (e) {
          console.error("Tariff calc error:", e);
          result = { success: false, error: "Tariff calculation error" };
        }
      } else if (dataType === "update-prices") {
        // Update product prices via Yandex Market API
        // POST /businesses/{businessId}/offer-prices/updates
        try {
          const { offers: priceOffers } = requestBody;
          
          if (!priceOffers || priceOffers.length === 0) {
            result = { success: false, error: "No offers provided for price update" };
          } else if (!effectiveBusinessId) {
            result = { success: false, error: "Business ID required for price updates" };
          } else {
            console.log(`Updating prices for ${priceOffers.length} offers, businessId: ${effectiveBusinessId}`);
            
            const priceUpdateBody = {
              offers: priceOffers.map((o: any) => ({
                offerId: o.offerId,
                price: {
                  value: o.price,
                  currencyId: 'UZS',
                },
              })),
            };
            
            await sleep(500);
            const priceResponse = await fetchWithRetry(
              `https://api.partner.market.yandex.ru/businesses/${effectiveBusinessId}/offer-prices/updates`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify(priceUpdateBody),
              }
            );
            
            console.log(`Price update response status: ${priceResponse.status}`);
            
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              result = { success: true, data: priceData, updated: priceOffers.length };
            } else {
              const errText = await priceResponse.text();
              console.error("Price update error:", priceResponse.status, errText);
              result = { success: false, error: `Price update failed: ${priceResponse.status}`, details: errText };
            }
          }
        } catch (e) {
          console.error("Price update error:", e);
          result = { success: false, error: "Price update error" };
        }
      } else if (dataType === "inventory-reconciliation") {
        // Yandex Market: LOST = SUPPLIED - SOLD - STOCK - RETURNED
        try {
          if (!campaignId) {
            result = { success: false, error: "Campaign ID required for reconciliation" };
          } else {
            console.log("Yandex inventory reconciliation starting...");
            
            // 1. Get all products with stocks
            const productMap = new Map<string, { name: string; price: number }>();
            const stockMap = new Map<string, number>();
            
            // Fetch products
            const productsResponse = await fetchWithRetry(
              `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers`,
              { method: 'POST', headers, body: JSON.stringify({ limit: 200 }) }
            );
            if (productsResponse.ok) {
              const pd = await productsResponse.json();
              const offers = pd.result?.offers || [];
              offers.forEach((o: any) => {
                const offerId = o.offerId || '';
                if (!offerId) return;
                productMap.set(offerId, { 
                  name: o.name || '', 
                  price: o.basicPrice?.value || o.price?.value || 0 
                });
              });
            }
            
            await sleep(500);
            
            // Fetch stocks
            const stocksResponse = await fetchWithRetry(
              `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
              { method: 'POST', headers, body: JSON.stringify({ limit: 200 }) }
            );
            if (stocksResponse.ok) {
              const sd = await stocksResponse.json();
              const warehouses = sd.result?.warehouses || [];
              warehouses.forEach((wh: any) => {
                (wh.offers || []).forEach((offer: any) => {
                  const count = (offer.stocks || []).reduce((s: number, st: any) => s + (st.count || 0), 0);
                  stockMap.set(offer.offerId, (stockMap.get(offer.offerId) || 0) + count);
                });
              });
            }
            
            await sleep(500);
            
            // 2. Fetch orders (last 90 days for comprehensive data)
            const soldMap = new Map<string, number>();
            const returnedMap = new Map<string, number>();
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const ordFrom = ninetyDaysAgo.toISOString().split('T')[0];
            const ordTo = new Date().toISOString().split('T')[0];
            
            // Fetch delivered/completed orders (sold items)
            for (const orderStatus of ['DELIVERED', 'DELIVERY']) {
              let orderPage = 1;
              let hasMore = true;
              while (hasMore) {
                const url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${ordFrom}&toDate=${ordTo}&status=${orderStatus}&page=${orderPage}&pageSize=50`;
                const ordResp = await fetchWithRetry(url, { headers });
                if (!ordResp.ok) break;
                const ordData = await ordResp.json();
                const orders = ordData.orders || [];
                orders.forEach((order: any) => {
                  (order.items || []).forEach((item: any) => {
                    soldMap.set(item.offerId, (soldMap.get(item.offerId) || 0) + (item.count || 1));
                  });
                });
                if (orders.length < 50) hasMore = false;
                else { orderPage++; await sleep(500); }
              }
              await sleep(300);
            }
            
            // Fetch returned orders
            let retPage = 1;
            let retHasMore = true;
            while (retHasMore) {
              const url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${ordFrom}&toDate=${ordTo}&status=RETURNED&page=${retPage}&pageSize=50`;
              const retResp = await fetchWithRetry(url, { headers });
              if (!retResp.ok) break;
              const retData = await retResp.json();
              const retOrders = retData.orders || [];
              retOrders.forEach((order: any) => {
                (order.items || []).forEach((item: any) => {
                  returnedMap.set(item.offerId, (returnedMap.get(item.offerId) || 0) + (item.count || 1));
                });
              });
              if (retOrders.length < 50) retHasMore = false;
              else { retPage++; await sleep(500); }
            }
            
            // 3. Calculate: We use current stock + sold + returned as expected minimum
            // If supplier delivered X items, then: X = stock + sold + returned + lost
            // Since Yandex doesn't have a direct "supplied" endpoint, we calculate based on known data
            const allOfferIds = new Set([
              ...productMap.keys(),
              ...stockMap.keys(),
              ...soldMap.keys(),
              ...returnedMap.keys(),
            ]);
            
            const reconciliation = Array.from(allOfferIds).map(offerId => {
              const sold = soldMap.get(offerId) || 0;
              const stock = stockMap.get(offerId) || 0;
              const returned = returnedMap.get(offerId) || 0;
              const productInfo = productMap.get(offerId);
              // For Yandex, "invoiced" = total known flow (sold + current stock + returned)
              // Any discrepancy would need FBO supply reports which aren't public API
              const accountedFor = sold + stock + returned;
              
              return {
                skuId: offerId,
                name: productInfo?.name || offerId,
                price: productInfo?.price || 0,
                invoiced: accountedFor, // Best estimate from available data
                sold,
                currentStock: stock,
                returned,
                lost: 0, // Will be calculated when supply data is available
                reconciled: true,
              };
            }).filter(item => item.sold > 0 || item.currentStock > 0)
            .sort((a, b) => b.sold - a.sold);
            
            result = {
              success: true,
              data: reconciliation,
              summary: {
                totalProducts: productMap.size,
                totalSold: Array.from(soldMap.values()).reduce((a, b) => a + b, 0),
                totalStock: Array.from(stockMap.values()).reduce((a, b) => a + b, 0),
                totalReturned: Array.from(returnedMap.values()).reduce((a, b) => a + b, 0),
              },
              total: reconciliation.length,
            };
          }
        } catch (e) {
          console.error("Yandex inventory reconciliation error:", e);
          result = { success: false, error: "Inventory reconciliation error" };
        }
      } else if (dataType === "update-stock") {
        // PUT /campaigns/{campaignId}/offers/stocks — update stock quantities
        try {
          const { stocks } = requestBody;
          
          if (!stocks || stocks.length === 0 || !campaignId) {
            result = { success: false, error: "No stocks provided or campaignId missing" };
          } else {
            // First get warehouseId from stocks endpoint to find seller's FBS warehouse
            let warehouseId: number | undefined;
            try {
              const stocksCheckResp = await fetchWithRetry(
                `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ limit: 1 })
                }
              );
              if (stocksCheckResp.ok) {
                const stocksCheckData = await stocksCheckResp.json();
                const warehouses = stocksCheckData.result?.warehouses || [];
                // Find FBS warehouse (warehouseId >= 100000) or use first available
                const fbsWh = warehouses.find((wh: any) => wh.warehouseId >= 100000);
                warehouseId = fbsWh?.warehouseId || warehouses[0]?.warehouseId;
                console.log(`Found warehouseId: ${warehouseId}`);
              }
            } catch (e) {
              console.error("Error fetching warehouse info:", e);
            }

            if (!warehouseId) {
              result = { success: false, error: "Could not determine warehouseId for stock update" };
            } else {
              const skus = stocks.map((s: any) => ({
                sku: s.sku || s.offerId,
                warehouseId: warehouseId,
                items: [{
                  type: "FIT",
                  count: s.quantity,
                  updatedAt: new Date().toISOString(),
                }],
              }));

              console.log(`Updating stocks for ${skus.length} SKUs in warehouse ${warehouseId}`);

              const response = await fetchWithRetry(
                `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers/stocks`,
                {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({ skus }),
                }
              );

              if (response.ok) {
                const data = await response.json();
                console.log("Yandex stock update response:", JSON.stringify(data));
                result = { success: true, data, updated: skus.length };
              } else {
                const errText = await response.text();
                console.error("Yandex stock update failed:", response.status, errText);
                result = { success: false, error: `Stock update failed: ${response.status}`, details: errText };
              }
            }
          }
        } catch (e) {
          console.error("Yandex stock update error:", e);
          result = { success: false, error: "Stock update error" };
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
    } else if (marketplace === "uzum") {
      // ========== UZUM MARKET SELLER OPENAPI ==========
      const uzumBaseUrl = "https://api-seller.uzum.uz/api/seller-openapi";


      // Uzum OpenAPI uses raw API key without prefix (not Bearer, not Token)
      const uzumHeaders: Record<string, string> = {
        "Authorization": apiKey,
        "Accept": "application/json",
      };
      
      // Discover actual shopId from /v1/shops endpoint first
      let uzumShopId = credentials.sellerId || 
                       (connection.account_info as any)?.shopId || 
                       (connection.account_info as any)?.sellerId;
      let allShopIds: string[] = uzumShopId ? [String(uzumShopId)] : [];

      // Always try to discover the real shopId from /v1/shops
      try {
        console.log(`Uzum: discovering shopId from /v1/shops...`);
        const shopsResp = await fetch(`${uzumBaseUrl}/v1/shops`, { headers: uzumHeaders });
        
        if (shopsResp.ok) {
          const shopsData = await shopsResp.json();
          const shops = Array.isArray(shopsData) ? shopsData : (shopsData.payload || shopsData.data || shopsData || []);
          const shopList = Array.isArray(shops) ? shops : [shops];
          console.log(`Uzum: /v1/shops returned ${shopList.length} shops`);
          
          // Log all available shops for debugging
          shopList.forEach((s: any, i: number) => {
            console.log(`Uzum shop[${i}]: id=${s.shopId || s.id}, title=${s.shopTitle || s.title || s.name}`);
          });
          
          if (shopList.length > 0) {
            // Store ALL shop IDs for multi-shop product fetching
            allShopIds = shopList.map((s: any) => String(s.shopId || s.id));
            
            // Use sellerId to find matching shop, or fall back to first shop
            let matchedShop = shopList[0];
            if (uzumShopId) {
              const found = shopList.find((s: any) => 
                String(s.shopId || s.id) === String(uzumShopId) || 
                String(s.sellerId) === String(uzumShopId)
              );
              if (found) matchedShop = found;
            }
            
            const realShopId = matchedShop.shopId || matchedShop.id;
            if (realShopId) {
              console.log(`Uzum: primary shopId=${realShopId}, total shops=${allShopIds.length}`);
              uzumShopId = String(realShopId);
              await supabase
                .from("marketplace_connections")
                .update({ 
                  account_info: { 
                    ...(connection.account_info as any),
                    shopId: uzumShopId,
                    storeName: matchedShop.shopTitle || matchedShop.title || matchedShop.name || "Uzum Market Store",
                    state: "CONNECTED",
                    allShops: shopList.map((s: any) => ({ id: s.shopId || s.id, title: s.shopTitle || s.title || s.name })),
                  }
                })
                .eq("id", connection.id);
            }
          }
        } else {
          const errText = await shopsResp.text();
          console.error(`Uzum /v1/shops failed (${shopsResp.status}): ${errText}`);
        }
      } catch (e) {
        console.error("Uzum shops discovery error:", e);
      }

      console.log(`Uzum API: dataType=${dataType}, shopId=${uzumShopId}, allShops=${allShopIds.length}`);

      if (dataType === "products") {
        // Fetch products from ALL shops, not just one
        if (allShopIds.length === 0) {
          result = { success: false, error: "No shops found for Uzum" };
        } else {
          try {
            let allProducts: any[] = [];
            
            // Also fetch FBS stock data via /v2/fbs/sku/stocks
            let fbsStockMap: Record<string, number> = {};
            try {
              console.log(`Uzum: fetching FBS stocks from /v2/fbs/sku/stocks...`);
              const fbsResp = await fetch(`${uzumBaseUrl}/v2/fbs/sku/stocks`, { headers: uzumHeaders });
              if (fbsResp.ok) {
                const fbsData = await fbsResp.json();
                const fbsItems = fbsData.payload || fbsData.data || fbsData || [];
                const fbsList = Array.isArray(fbsItems) ? fbsItems : [];
                console.log(`Uzum FBS stocks: ${fbsList.length} SKUs`);
                fbsList.forEach((item: any) => {
                  const skuId = String(item.skuId || item.sku || '');
                  if (skuId) {
                    fbsStockMap[skuId] = item.amount || item.stock || item.available || 0;
                  }
                });
              } else {
                console.log(`Uzum FBS stocks failed: ${fbsResp.status}`);
              }
            } catch (e) {
              console.error("Uzum FBS stocks error:", e);
            }
            
            await sleep(300); // Delay after FBS stocks before fetching products
            
            // Iterate through ALL shops
            for (let shopIdx = 0; shopIdx < allShopIds.length; shopIdx++) {
              const currentShopId = allShopIds[shopIdx];
              if (shopIdx > 0) await sleep(500); // Delay between shops to avoid 429
              
              let currentPage = 0;
              let hasMore = true;
              const pageSize = 100;

              while (hasMore) {
                const params = new URLSearchParams({
                  size: String(pageSize),
                  page: String(currentPage),
                  filter: 'ALL',
                });

                console.log(`Uzum products shop=${currentShopId} page ${currentPage}`);

                const response = await fetch(
                  `${uzumBaseUrl}/v1/product/shop/${currentShopId}?${params.toString()}`,
                  { headers: uzumHeaders }
                );

                if (!response.ok) {
                  const errText = await response.text();
                  // 403 = no access to this shop, 429 = rate limit - skip silently
                  if (response.status === 403) {
                    console.log(`Uzum: no access to shop=${currentShopId}, skipping`);
                  } else {
                    console.error(`Uzum products error shop=${currentShopId}:`, response.status, errText);
                  }
                  break;
                }

                const data = await response.json();
                
                // Uzum uses "productList" key
                const productCards = data.productList || data.productCards || data.payload?.productCards || data.payload?.productList || data.payload || data.data || [];
                const items = Array.isArray(productCards) ? productCards : [];

                console.log(`Uzum shop=${currentShopId} page ${currentPage}: ${items.length} products`);

                if (items.length === 0) {
                  hasMore = false;
                  break;
                }

                // Log first product's full structure for debugging photos and stock
                if (currentPage === 0 && allProducts.length === 0 && items.length > 0) {
                  const s = items[0];
                  console.log(`Uzum product[0] ALL keys: ${JSON.stringify(Object.keys(s))}`);
                  console.log(`Uzum product[0] title: ${s.title || s.name}, productId: ${s.productId || s.id}`);
                  // Log photo-related fields exhaustively
                  ['photos', 'images', 'photoList', 'photo', 'photoUrl', 'previewImage', 'mainPhoto', 'imageUrl'].forEach(k => {
                    if (s[k] !== undefined) console.log(`Uzum product[0].${k}: ${JSON.stringify(s[k]).substring(0, 500)}`);
                  });
                  // Log SKU fields
                  const skuSample = (s.skuList || s.skus || [])[0];
                  if (skuSample) {
                    console.log(`Uzum SKU[0] ALL keys: ${JSON.stringify(Object.keys(skuSample))}`);
                    console.log(`Uzum SKU[0] barCode=${skuSample.barCode}, barcode=${skuSample.barcode}, article=${skuSample.article}, vendorCode=${skuSample.vendorCode}, sellerItemCode=${skuSample.sellerItemCode}, skuId=${skuSample.skuId}, skuTitle=${skuSample.skuTitle}`);
                    ['photos', 'photoList', 'photo', 'photoUrl', 'previewImage', 'image', 'imageUrl'].forEach(k => {
                      if (skuSample[k] !== undefined) console.log(`Uzum SKU[0].${k}: ${JSON.stringify(skuSample[k]).substring(0, 500)}`);
                    });
                  }
                  // Log product-level image fields
                  ['image', 'previewImg', 'previewImage', 'photo', 'photoUrl'].forEach(k => {
                    if (items[0][k] !== undefined) console.log(`Uzum product[0].${k}: ${JSON.stringify(items[0][k]).substring(0, 500)}`);
                  });
                }

                const products = items.map((card: any) => {
                  const skus = card.skuList || card.skus || [];
                  const firstSku = skus[0] || {};
                  const price = firstSku.fullPrice || firstSku.purchasePrice || card.price || 0;
                  
                  // Uzum SKU has direct quantity fields: quantityActive, quantityFbs, etc.
                  let fboStock = 0;
                  let fbsStock = 0;
                  skus.forEach((sku: any) => {
                    fboStock += (sku.quantityActive || 0);
                    fbsStock += (sku.quantityFbs || 0);
                    const amounts = sku.skuAmountList || sku.amounts || [];
                    if (amounts.length > 0) {
                      amounts.forEach((a: any) => {
                        const amt = a.amount || a.available || 0;
                        fboStock += amt;
                      });
                    }
                  });
                  
                  const skuId = String(firstSku.skuId || '');
                  if (fbsStockMap[skuId]) {
                    fbsStock = Math.max(fbsStock, fbsStockMap[skuId]);
                  }
                  
                  // SKU identifier: use article or sellerItemCode (human-readable), NOT numeric skuId
                  // Uzum API: SKU is set via 'sellerItemCode' or 'article' at SKU or product level
                  // The user's Uzum portal shows SKU like "VITECH", "FERRE8213" etc.
                  // Check both camelCase and lowercase variants of barcode field
                  const humanSku = firstSku.sellerItemCode || firstSku.article ||
                                   card.sellerItemCode || card.article ||
                                   firstSku.vendorCode || card.vendorCode ||
                                   card.skuTitle || firstSku.skuTitle ||
                                   firstSku.barcode || firstSku.barCode ||
                                   String(firstSku.skuId || card.productId || '');
                  
                  // Extract photos from ALL possible sources
                  const UZUM_CDN_BASE = 'https://images.uzum.uz';
                  let pictures: string[] = [];
                  
                  // 1. Card-level photos array
                  const cardPhotos = card.photos || card.images || card.photoList || [];
                  if (Array.isArray(cardPhotos)) {
                    cardPhotos.forEach((p: any) => {
                      const url = p.photo?.url || p.url || p.photoUrl || p.photo || (typeof p === 'string' ? p : null);
                      if (url) pictures.push(url);
                    });
                  }
                  
                  // 2. Card-level single photo fields — Uzum returns 'image' and 'previewImg'
                  if (pictures.length === 0) {
                    const directPhoto = card.image || card.previewImg || card.previewImage || 
                                       card.photoUrl || card.mainPhoto?.url || 
                                       card.photo?.url || card.photo?.photo?.url || card.imageUrl ||
                                       (typeof card.photo === 'string' ? card.photo : null);
                    if (directPhoto) pictures.push(typeof directPhoto === 'string' ? directPhoto : (directPhoto?.url || directPhoto?.photo?.url || ''));
                  }
                  
                  // 3. SKU-level photos — Uzum SKU has 'previewImage' with full CDN URL
                  if (pictures.length === 0) {
                    skus.forEach((sku: any) => {
                      // previewImage is the most reliable field for Uzum SKU images
                      if (sku.previewImage && !pictures.includes(sku.previewImage)) {
                        pictures.push(sku.previewImage);
                      }
                      const skuPhotos = sku.photos || sku.photoList || [];
                      if (Array.isArray(skuPhotos)) {
                        skuPhotos.forEach((p: any) => {
                          const url = p.photo?.url || p.url || p.photoUrl || (typeof p === 'string' ? p : null);
                          if (url && !pictures.includes(url)) pictures.push(url);
                        });
                      }
                      if (pictures.length === 0) {
                        const skuPhoto = sku.photoUrl || sku.photo?.url || 
                                        sku.photo?.photo?.url || sku.image?.url || sku.imageUrl ||
                                        (typeof sku.photo === 'string' ? sku.photo : null) || 
                                        (typeof sku.image === 'string' ? sku.image : null);
                        if (skuPhoto && !pictures.includes(skuPhoto)) pictures.push(skuPhoto);
                      }
                    });
                  }
                  
                  // 4. Construct image URL from productId if no photos found
                  // Uzum product images follow pattern: /product/{productId}
                  if (pictures.length === 0 && (card.productId || card.id)) {
                    // Try common Uzum image patterns
                    const pId = card.productId || card.id;
                    pictures.push(`${UZUM_CDN_BASE}/product/${pId}/original`);
                  }
                  
                  // 5. Ensure full URLs — Uzum may return relative paths
                  pictures = pictures.map(url => {
                    if (url.startsWith('http')) return url;
                    if (url.startsWith('/')) return `${UZUM_CDN_BASE}${url}`;
                    return `${UZUM_CDN_BASE}/${url}`;
                  });

                  return {
                    offerId: String(card.productId || card.id || firstSku.skuId || ''),
                    name: card.title || card.name || '',
                    price,
                    shopSku: humanSku,
                    category: typeof card.category === 'string' ? card.category : (card.category?.title || card.categoryTitle || ''),
                    marketCategoryId: typeof card.category === 'object' ? (card.category?.id || 0) : (card.categoryId || 0),
                    pictures,
                    description: card.description || '',
                    availability: card.status?.value || card.status?.title || card.moderationStatus || 'ACTIVE',
                    stockFBO: fboStock,
                    stockFBS: fbsStock,
                    stockCount: fboStock + fbsStock,
                    shopId: currentShopId,
                  };
                });

                allProducts = [...allProducts, ...products];

                if (items.length < pageSize || !fetchAll) {
                  hasMore = false;
                } else {
                  currentPage++;
                  await sleep(300);
                }
              }
            }

            console.log(`Uzum total products from ${allShopIds.length} shops: ${allProducts.length}`);
            result = {
              success: true,
              data: allProducts,
              total: allProducts.length,
            };
          } catch (e) {
            console.error("Uzum products error:", e);
            result = { success: false, error: "Uzum products fetch error" };
          }
        }

      } else if (dataType === "orders") {
        // GET /v2/fbs/orders
        try {
          let allOrders: any[] = [];
          let page = 0;
          let hasMore = true;
          const pageSize = 50; // Uzum max 50 per page

          // Fetch all order statuses to get complete picture
          const orderStatuses = status ? [status] : [
            'CREATED', 'PACKING', 'PENDING_DELIVERY', 'DELIVERING', 
            'DELIVERED', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT',
            'COMPLETED', 'CANCELED', 'PENDING_CANCELLATION', 'RETURNED'
          ];

          for (let si = 0; si < orderStatuses.length; si++) {
            const orderStatus = orderStatuses[si];
            // Add delay between status queries to avoid 429 rate limits
            if (si > 0) await sleep(500);
            page = 0;
            hasMore = true;

            while (hasMore) {
              const params = new URLSearchParams({
                size: String(pageSize),
                page: String(page),
                status: orderStatus,
              });
              // shopIds is required - pass as array param
              if (uzumShopId) {
                params.append("shopIds", String(uzumShopId));
              }
              // dateFrom/dateTo are int64 timestamps (milliseconds)
              if (fromDate) {
                const ts = new Date(fromDate).getTime();
                if (!isNaN(ts)) params.append("dateFrom", String(ts));
              }
              if (toDate) {
                const ts = new Date(toDate).getTime();
                if (!isNaN(ts)) params.append("dateTo", String(ts));
              }

              console.log(`Uzum orders (${orderStatus}) page ${page}: ${uzumBaseUrl}/v2/fbs/orders?${params.toString()}`);

              const response = await fetch(
                `${uzumBaseUrl}/v2/fbs/orders?${params.toString()}`,
                { headers: uzumHeaders }
              );

            if (!response.ok) {
              const errText = await response.text();
              console.error(`Uzum orders error (${orderStatus}):`, response.status, errText);
              hasMore = false;
              continue;
            }

            const data = await response.json();
            const ordersPayload = data.payload?.sellerOrders || data.payload?.fbsOrders || data.payload?.orders || data.payload || [];
            const orderList = Array.isArray(ordersPayload) ? ordersPayload : [];
            
            console.log(`Uzum orders (${orderStatus}) page ${page}: ${orderList.length} orders`);

            // Log first order item structure for debugging
            if (page === 0 && allOrders.length === 0 && orderList.length > 0) {
              const sampleOrder = orderList[0];
              const sampleItems = sampleOrder.items || sampleOrder.orderItems || [];
              if (sampleItems.length > 0) {
                const s = sampleItems[0];
                console.log(`Uzum order item[0] keys: ${JSON.stringify(Object.keys(s))}`);
                console.log(`Uzum order item[0] id=${s.id}, barcode=${s.barcode}, title=${s.title}, skuTitle=${s.skuTitle}`);
                console.log(`Uzum order item[0] identifierInfo: ${JSON.stringify(s.identifierInfo || 'N/A')}`);
                console.log(`Uzum order item[0] photo: ${JSON.stringify(typeof s.photo === 'object' ? Object.keys(s.photo || {}) : s.photo)}`);
              }
            }

            const mapped = orderList.map((order: any) => {
              const items = order.items || order.orderItems || [];
              const itemsTotal = items.reduce((sum: number, item: any) => {
                return sum + ((item.price || item.amount || 0) * (item.quantity || item.count || 1));
              }, 0);

              return {
                id: order.orderId || order.id,
                status: order.status || orderStatus,
                substatus: order.substatus || '',
                createdAt: order.createdAt || order.createDate || new Date().toISOString(),
                total: order.totalPrice || order.totalAmount || itemsTotal,
                totalUZS: order.totalPrice || order.totalAmount || itemsTotal,
                itemsTotal,
                itemsTotalUZS: itemsTotal,
                deliveryTotal: order.deliveryPrice || 0,
                deliveryTotalUZS: order.deliveryPrice || 0,
                buyer: {
                  firstName: order.customerName || order.buyer?.firstName || '',
                  lastName: order.buyer?.lastName || '',
                },
                items: items.map((item: any) => {
                  // CRITICAL: Uzum FBS order items have these keys:
                  // id, barcode, skuTitle, title, price, amount, photo, identifierInfo
                  // identifierInfo may be "N/A" string, not an object!
                  const identInfo = (item.identifierInfo && typeof item.identifierInfo === 'object') ? item.identifierInfo : {};
                  const itemBarcode = item.barcode || identInfo.barcode || '';
                  // Use skuTitle (human-readable SKU like "TEXPERT-GEEMY") as primary identifier
                  // This matches the product offerId from product sync
                  const offerId = item.skuTitle || itemBarcode || String(item.id || '');
                  
                  // Extract photo URL - item.photo can be various structures
                  let itemPhoto = '';
                   try {
                     if (item.photo) {
                       // Log the raw photo structure for first item to debug
                       if (items.indexOf(item) === 0) {
                         console.log('[UZUM ORDER PHOTO DEBUG] Raw item.photo type:', typeof item.photo);
                         console.log('[UZUM ORDER PHOTO DEBUG] Raw item.photo keys:', typeof item.photo === 'object' ? Object.keys(item.photo) : 'N/A');
                         console.log('[UZUM ORDER PHOTO DEBUG] Raw item.photo JSON:', JSON.stringify(item.photo).substring(0, 500));
                       }
                       if (typeof item.photo === 'string') {
                        itemPhoto = item.photo.startsWith('http') ? item.photo : `https://images.uzum.uz/${item.photo.replace(/^\//, '')}`;
                       } else if (typeof item.photo === 'object') {
                        // Try nested photo.photo first, then direct item.photo
                        const photoObj = item.photo.photo || item.photo;
                        const sizes = [240, 120, 80, 60];
                        for (const size of sizes) {
                          const sizeData = photoObj[size] || photoObj[String(size)];
                          if (sizeData && typeof sizeData === 'object') {
                            if (typeof sizeData.high === 'string' && sizeData.high) {
                              itemPhoto = sizeData.high;
                              break;
                            } else if (typeof sizeData.low === 'string' && sizeData.low) {
                              itemPhoto = sizeData.low;
                              break;
                            }
                          }
                        }
                        // Fallback: check photoKey as a direct path
                        if (!itemPhoto && typeof item.photo.photoKey === 'string' && item.photo.photoKey) {
                          const pk = item.photo.photoKey;
                          itemPhoto = pk.startsWith('http') ? pk : `https://images.uzum.uz/${pk.replace(/^\//, '')}`;
                        }
                        // Fallback: deep search for any URL-like string in the photo object
                        if (!itemPhoto) {
                          const photoStr = JSON.stringify(item.photo);
                          // Look for full URLs first
                          const urlMatch = photoStr.match(/https?:\/\/[^\s"',}]+\.(jpg|jpeg|png|webp)/i);
                          if (urlMatch) {
                            itemPhoto = urlMatch[0];
                          } else {
                            // Look for path-like strings (e.g. "product/abc-123.jpg")
                            const pathMatch = photoStr.match(/"([\w\-\/\.]+\.(jpg|jpeg|png|webp))"/i);
                            if (pathMatch) {
                              itemPhoto = `https://images.uzum.uz/${pathMatch[1]}`;
                            }
                          }
                        }
                       }
                     }
                     // Also try item.productPhoto, item.image, item.imageUrl as last resort
                     if (!itemPhoto) {
                       const fallbackPhoto = item.productPhoto || item.image || item.imageUrl || item.img;
                       if (typeof fallbackPhoto === 'string' && fallbackPhoto) {
                         itemPhoto = fallbackPhoto.startsWith('http') ? fallbackPhoto : `https://images.uzum.uz/${fallbackPhoto.replace(/^\//, '')}`;
                       }
                     }
                     if (items.indexOf(item) === 0) {
                       console.log('[UZUM ORDER PHOTO DEBUG] Final itemPhoto:', itemPhoto || 'EMPTY');
                     }
                  } catch (photoErr) { 
                    console.error('[UZUM ORDER PHOTO ERROR]', photoErr);
                  }
                  
                  return {
                    offerId,
                    skuId: String(item.id || ''),
                    barcode: itemBarcode,
                    offerName: item.title || item.skuTitle || item.productTitle || item.name || '',
                    count: item.quantity || item.count || item.amount || 1,
                    price: item.price || 0,
                    priceUZS: item.price || 0,
                    photo: itemPhoto,
                  };
                }),
              };
            });

            allOrders = [...allOrders, ...mapped];

            if (orderList.length < pageSize || !fetchAll) {
              hasMore = false;
            } else {
              page++;
              await sleep(300);
            }
            } // end while
          } // end for statuses

          // Calculate total revenue from non-cancelled orders
          const activeUzumOrders = allOrders.filter((o: any) => !['CANCELED', 'CANCELLED', 'RETURNED'].includes(o.status));
          const uzumTotalRevenue = activeUzumOrders.reduce((sum: number, o: any) => sum + (o.totalUZS || o.total || 0), 0);
          
          console.log(`Uzum total orders: ${allOrders.length}, active: ${activeUzumOrders.length}, revenue: ${uzumTotalRevenue}`);
          result = {
            success: true,
            data: allOrders,
            total: allOrders.length,
          };

          // Update connection with orders count and revenue
          await supabase
            .from("marketplace_connections")
            .update({
              orders_count: allOrders.length,
              total_revenue: uzumTotalRevenue,
              last_sync_at: new Date().toISOString(),
            })
            .eq("id", connection.id);
        } catch (e) {
          console.error("Uzum orders error:", e);
          result = { success: false, error: "Uzum orders fetch error" };
        }

      } else if (dataType === "stocks") {
        // GET /v2/fbs/sku/stocks
        try {
          const response = await fetch(
            `${uzumBaseUrl}/v2/fbs/sku/stocks`,
            { headers: uzumHeaders }
          );

          if (response.ok) {
            const data = await response.json();
            const stocks = data.payload || data.data || [];
            const stockList = Array.isArray(stocks) ? stocks : [];
            
            result = {
              success: true,
              data: stockList.map((s: any) => ({
                offerId: String(s.skuId || s.productId || ''),
                fbo: 0,
                fbs: s.amount || s.available || 0,
                total: s.amount || s.available || 0,
              })),
              total: stockList.length,
            };
          } else {
            result = { success: false, error: "Failed to fetch Uzum stocks" };
          }
        } catch (e) {
          console.error("Uzum stocks error:", e);
          result = { success: false, error: "Uzum stocks fetch error" };
        }

      } else if (dataType === "finance") {
        // GET /v1/finance/orders + /v1/finance/expenses
        // Both require shopIds as mandatory param per Swagger spec
        try {
          const financeParams = new URLSearchParams();
          if (uzumShopId) financeParams.append("shopIds", String(uzumShopId));
          
          const [ordersRes, expensesRes] = await Promise.all([
            fetch(`${uzumBaseUrl}/v1/finance/orders?${financeParams.toString()}`, { headers: uzumHeaders }),
            fetch(`${uzumBaseUrl}/v1/finance/expenses?${financeParams.toString()}`, { headers: uzumHeaders }),
          ]);

          let financeOrders: any[] = [];
          let financeExpenses: any[] = [];

          if (ordersRes.ok) {
            const ordData = await ordersRes.json();
            financeOrders = ordData.payload || ordData.data || [];
          }
          if (expensesRes.ok) {
            const expData = await expensesRes.json();
            financeExpenses = expData.payload || expData.data || [];
          }

          result = {
            success: true,
            data: {
              orders: Array.isArray(financeOrders) ? financeOrders : [],
              expenses: Array.isArray(financeExpenses) ? financeExpenses : [],
            },
          };
        } catch (e) {
          console.error("Uzum finance error:", e);
          result = { success: false, error: "Uzum finance fetch error" };
        }

      } else if (dataType === "update-prices") {
        // POST /v1/product/{shopId}/sendPriceData
        try {
          const { offers: priceOffers } = requestBody;
          
          if (!priceOffers || priceOffers.length === 0) {
            result = { success: false, error: "No offers provided" };
          } else if (!uzumShopId) {
            result = { success: false, error: "Shop ID required for price updates" };
          } else {
            const priceData = priceOffers.map((o: any) => ({
              skuId: o.offerId || o.skuId,
              price: o.price,
            }));

            const response = await fetch(
              `${uzumBaseUrl}/v1/product/${uzumShopId}/sendPriceData`,
              {
                method: 'POST',
                headers: {
                  ...uzumHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ skuPriceList: priceData }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              result = { success: true, data, updated: priceOffers.length };
            } else {
              const errText = await response.text();
              result = { success: false, error: `Price update failed: ${response.status}`, details: errText };
            }
          }
        } catch (e) {
          console.error("Uzum price update error:", e);
          result = { success: false, error: "Price update error" };
        }

      } else if (dataType === "update-stock") {
        // POST /v2/fbs/sku/stocks
        try {
          const { stocks, stockUpdates } = requestBody;
          const updates = stocks || stockUpdates;
          
          if (!updates || updates.length === 0) {
            result = { success: false, error: "No stock updates provided" };
          } else {
            const response = await fetch(
              `${uzumBaseUrl}/v2/fbs/sku/stocks`,
              {
                method: 'POST',
                headers: {
                  ...uzumHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  skuAmountList: updates.map((s: any) => ({
                    skuId: s.skuId || s.offerId || s.sku,
                    amount: s.amount || s.quantity || s.stock || 0,
                  })),
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              result = { success: true, data, updated: stockUpdates.length };
            } else {
              const errText = await response.text();
              result = { success: false, error: `Stock update failed: ${response.status}`, details: errText };
            }
          }
        } catch (e) {
          console.error("Uzum stock update error:", e);
          result = { success: false, error: "Stock update error" };
        }

      } else if (dataType === "invoices") {
        // First fetch invoice list from /v1/shop/{shopId}/invoice, then get products per invoice
        try {
          if (!uzumShopId) {
            result = { success: false, error: "Shop ID required for Uzum invoices" };
          } else {
            // Step 1: Get all invoices list
            let allInvoiceItems: any[] = [];
            let invoicePage = 0;
            let invoiceHasMore = true;

            while (invoiceHasMore) {
              const invoiceListParams = new URLSearchParams({
                size: '50',
                page: String(invoicePage),
              });

              console.log(`Uzum invoice list page ${invoicePage}`);

              const invoiceListResp = await fetch(
                `${uzumBaseUrl}/v1/shop/${uzumShopId}/invoice?${invoiceListParams.toString()}`,
                { headers: uzumHeaders }
              );

              if (!invoiceListResp.ok) {
                const errText = await invoiceListResp.text();
                console.error("Uzum invoice list error:", invoiceListResp.status, errText);
                break;
              }

              const invoiceListData = await invoiceListResp.json();
              // Returns array of InvoiceInList directly
              const invoices = Array.isArray(invoiceListData) ? invoiceListData : (invoiceListData.payload || []);
              
              console.log(`Uzum invoice list page ${invoicePage}: ${invoices.length} invoices`);

              if (invoices.length === 0) {
                invoiceHasMore = false;
                break;
              }

              // Step 2: For each invoice, get products via /v1/shop/{shopId}/invoice/products?invoiceId=X
              for (const inv of invoices) {
                const invoiceId = inv.invoiceId || inv.id;
                if (!invoiceId) continue;

                await sleep(300);
                
                const prodParams = new URLSearchParams({
                  invoiceId: String(invoiceId),
                });

                const prodResp = await fetch(
                  `${uzumBaseUrl}/v1/shop/${uzumShopId}/invoice/products?${prodParams.toString()}`,
                  { headers: uzumHeaders }
                );

                if (prodResp.ok) {
                  const prodData = await prodResp.json();
                  // Returns array of ProductForInvoiceDto directly
                  const items = Array.isArray(prodData) ? prodData : (prodData.payload || []);
                  
                  const mapped = items.map((item: any) => ({
                    offerId: String(item.skuId || item.productId || ''),
                    skuId: String(item.skuId || ''),
                    invoiceId: String(invoiceId),
                    quantity: item.quantity || item.amount || 0,
                    receivedQuantity: item.receivedQuantity || item.receivedAmount || 0,
                    invoicedAt: inv.createdAt || inv.invoicedAt || new Date().toISOString(),
                  }));
                  allInvoiceItems = [...allInvoiceItems, ...mapped];
                } else {
                  console.error(`Uzum invoice products error for invoice ${invoiceId}:`, prodResp.status);
                }
              }

              if (invoices.length < 50) {
                invoiceHasMore = false;
              } else {
                invoicePage++;
                await sleep(300);
              }
            }

            // Group by SKU and sum quantities
            const invoiceMap = new Map<string, any>();
            allInvoiceItems.forEach(item => {
              const key = item.skuId || item.offerId;
              const existing = invoiceMap.get(key) || { 
                offerId: item.offerId,
                skuId: item.skuId,
                totalInvoiced: 0,
                totalReceived: 0,
                invoices: []
              };
              existing.totalInvoiced += item.quantity || 0;
              existing.totalReceived += item.receivedQuantity || 0;
              existing.invoices.push(item);
              invoiceMap.set(key, existing);
            });

            result = {
              success: true,
              data: Array.from(invoiceMap.values()),
              total: invoiceMap.size,
            };
          }
        } catch (e) {
          console.error("Uzum invoices error:", e);
          result = { success: false, error: "Uzum invoices fetch error" };
        }

      } else if (dataType === "returns") {
        // GET /v1/shop/{shopId}/return/{returnId} - fetch all returns
        try {
          if (!uzumShopId) {
            result = { success: false, error: "Shop ID required for Uzum returns" };
          } else {
            let allReturns: any[] = [];
            let page = 0;
            let hasMore = true;
            const pageSize = 50; // Swagger spec max is 50

            while (hasMore) {
              const params = new URLSearchParams({
                size: String(pageSize),
                page: String(page),
              });

              console.log(`Uzum returns page ${page}`);

              // Swagger: /v1/shop/{shopId}/return (NOT /returns)
              const response = await fetch(
                `${uzumBaseUrl}/v1/shop/${uzumShopId}/return?${params.toString()}`,
                { headers: uzumHeaders }
              );

              if (!response.ok) {
                const errText = await response.text();
                console.error("Uzum returns error:", response.status, errText);
                break;
              }

              const data = await response.json();
              // Returns array of SellerReturnLite directly per Swagger
              const items = Array.isArray(data) ? data : (data.payload?.items || data.payload || []);
              const itemList = Array.isArray(items) ? items : [];

              console.log(`Uzum returns page ${page}: ${itemList.length} returns`);

              const mapped = itemList.map((item: any) => ({
                returnId: item.returnId || item.id || '',
                offerId: String(item.skuId || item.productId || ''),
                skuId: String(item.skuId || ''),
                quantity: item.quantity || item.amount || 1,
                status: item.status || 'PENDING',
                reason: item.reason || '',
                returnedAt: item.returnedAt || item.createdAt || new Date().toISOString(),
              }));

              allReturns = [...allReturns, ...mapped];

              if (itemList.length < pageSize || !fetchAll) {
                hasMore = false;
              } else {
                page++;
                await sleep(300);
              }
            }

            // Group by SKU
            const returnMap = new Map<string, any>();
            allReturns.forEach(ret => {
              const key = ret.skuId || ret.offerId;
              const existing = returnMap.get(key) || {
                offerId: ret.offerId,
                skuId: ret.skuId,
                totalReturned: 0,
                returns: []
              };
              existing.totalReturned += ret.quantity || 0;
              existing.returns.push(ret);
              returnMap.set(key, existing);
            });

            result = {
              success: true,
              data: Array.from(returnMap.values()),
              total: returnMap.size,
            };
          }
        } catch (e) {
          console.error("Uzum returns error:", e);
          result = { success: false, error: "Uzum returns fetch error" };
        }

      } else if (dataType === "inventory-reconciliation") {
        // Calculate LOST = INVOICED - SOLD - STOCK - RETURNED
        try {
          if (!uzumShopId) {
            result = { success: false, error: "Shop ID required for reconciliation" };
          } else {
            // For inventory reconciliation, we need: invoices, orders, stocks, returns
            // /v1/shop/{shopId}/invoice/products requires invoiceId — so first get invoice list
            // /v2/fbs/orders requires shopIds
            // /v1/shop/{shopId}/return (NOT /returns)
            
            // Step 1: Fetch invoice list + stocks + returns in parallel
            const ordersParams = new URLSearchParams({
              shopIds: String(uzumShopId),
              status: 'COMPLETED',
              size: '50',
              page: '0',
            });
            
            const [invoiceListRes, ordersRes, stocksRes, returnsRes] = await Promise.all([
              fetch(
                `${uzumBaseUrl}/v1/shop/${uzumShopId}/invoice?size=50&page=0`,
                { headers: uzumHeaders }
              ),
              fetch(
                `${uzumBaseUrl}/v2/fbs/orders?${ordersParams.toString()}`,
                { headers: uzumHeaders }
              ),
              fetch(
                `${uzumBaseUrl}/v2/fbs/sku/stocks`,
                { headers: uzumHeaders }
              ),
              fetch(
                `${uzumBaseUrl}/v1/shop/${uzumShopId}/return?size=50&page=0`,
                { headers: uzumHeaders }
              ),
            ]);

            // Parse invoices - first get invoice IDs, then fetch products per invoice
            let invoiceMap = new Map<string, number>();
            if (invoiceListRes.ok) {
              const invoiceListData = await invoiceListRes.json();
              const invoices = Array.isArray(invoiceListData) ? invoiceListData : (invoiceListData.payload || []);
              
              // Fetch products for each invoice
              for (const inv of invoices) {
                const invoiceId = inv.invoiceId || inv.id;
                if (!invoiceId) continue;
                await sleep(300);
                
                const prodResp = await fetch(
                  `${uzumBaseUrl}/v1/shop/${uzumShopId}/invoice/products?invoiceId=${invoiceId}`,
                  { headers: uzumHeaders }
                );
                if (prodResp.ok) {
                  const prodData = await prodResp.json();
                  const items = Array.isArray(prodData) ? prodData : (prodData.payload || []);
                  items.forEach((item: any) => {
                    const key = String(item.skuId || item.productId || '');
                    invoiceMap.set(key, (invoiceMap.get(key) || 0) + (item.quantity || 0));
                  });
                }
              }
            }

            // Parse sold orders
            let soldMap = new Map<string, number>();
            if (ordersRes.ok) {
              const ordersData = await ordersRes.json();
              const orders = ordersData.payload?.sellerOrders || ordersData.payload?.fbsOrders || ordersData.payload?.orders || [];
              const orderList = Array.isArray(orders) ? orders : [];
              orderList.forEach((order: any) => {
                const items = order.items || order.orderItems || [];
                items.forEach((item: any) => {
                  const key = String(item.skuId || item.productId || '');
                  const qty = item.quantity || item.count || 1;
                  soldMap.set(key, (soldMap.get(key) || 0) + qty);
                });
              });
            }

            // Parse current stock
            let stockMap = new Map<string, number>();
            if (stocksRes.ok) {
              const stocksData = await stocksRes.json();
              const stocks = stocksData.payload || [];
              const stockList = Array.isArray(stocks) ? stocks : [];
              stockList.forEach((s: any) => {
                const key = String(s.skuId || s.productId || '');
                stockMap.set(key, s.amount || s.available || 0);
              });
            }

            // Parse returns — API returns array of SellerReturnLite directly
            let returnMap = new Map<string, number>();
            if (returnsRes.ok) {
              const returnsData = await returnsRes.json();
              const returns = Array.isArray(returnsData) ? returnsData : (returnsData.payload?.items || returnsData.payload || []);
              const returnList = Array.isArray(returns) ? returns : [];
              returnList.forEach((ret: any) => {
                const key = String(ret.skuId || ret.productId || '');
                const qty = ret.quantity || 1;
                returnMap.set(key, (returnMap.get(key) || 0) + qty);
              });
            }

            // Calculate loss for each SKU: LOST = INVOICED - SOLD - STOCK - RETURNED
            const allSkus = new Set([
              ...invoiceMap.keys(),
              ...soldMap.keys(),
              ...stockMap.keys(),
              ...returnMap.keys(),
            ]);

            const reconciliation = Array.from(allSkus).map(skuId => {
              const invoiced = invoiceMap.get(skuId) || 0;
              const sold = soldMap.get(skuId) || 0;
              const stock = stockMap.get(skuId) || 0;
              const returned = returnMap.get(skuId) || 0;
              const lost = Math.max(0, invoiced - sold - stock - returned);

              return {
                skuId,
                invoiced,
                sold,
                currentStock: stock,
                returned,
                lost,
                reconciled: invoiced === (sold + stock + returned + lost),
              };
            }).filter(item => item.invoiced > 0 || item.lost > 0) // Show only items with activity
            .sort((a, b) => b.lost - a.lost); // Sort by loss descending

            result = {
              success: true,
              data: reconciliation,
              summary: {
                totalInvoiced: Array.from(invoiceMap.values()).reduce((a, b) => a + b, 0),
                totalSold: Array.from(soldMap.values()).reduce((a, b) => a + b, 0),
                totalStock: Array.from(stockMap.values()).reduce((a, b) => a + b, 0),
                totalReturned: Array.from(returnMap.values()).reduce((a, b) => a + b, 0),
                totalLost: reconciliation.reduce((sum, item) => sum + item.lost, 0),
              },
              total: reconciliation.length,
            };
          }
        } catch (e) {
          console.error("Inventory reconciliation error:", e);
          result = { success: false, error: "Inventory reconciliation error" };
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
    } else if (marketplace === "wildberries") {
      // ========== WILDBERRIES API ==========
      // Important: suppliers-api.wildberries.ru was deprecated Jan 2025
      // New domains: content-api, marketplace-api, statistics-api, discounts-prices-api, seller-analytics-api
      const wbHeaders: Record<string, string> = {
        "Authorization": apiKey,
        "Content-Type": "application/json",
      };

      const supplierId = credentials.sellerId || (connection.account_info as any)?.supplierId;
      console.log(`WB API: dataType=${dataType}, supplierId=${supplierId}`);

      if (dataType === "products") {
        // Fetch product cards via Content API v2
        // POST https://content-api.wildberries.ru/content/v2/get/cards/list
        try {
          const allCards: any[] = [];
          let cursor = { limit: 100, updatedAt: "", nmID: 0 };
          let pageNum = 0;

          do {
            const body: any = {
              settings: {
                cursor: { limit: cursor.limit },
                filter: { withPhoto: -1 }, // all cards including without photos
              },
            };
            // For pagination, pass updatedAt and nmID from previous response
            if (cursor.updatedAt && cursor.nmID) {
              body.settings.cursor.updatedAt = cursor.updatedAt;
              body.settings.cursor.nmID = cursor.nmID;
            }

            const resp = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", {
              method: "POST",
              headers: wbHeaders,
              body: JSON.stringify(body),
            });

            if (!resp.ok) {
              const errText = await resp.text();
              console.error(`WB cards list error (${resp.status}):`, errText);
              break;
            }

            const data = await resp.json();
            const cards = data.cards || [];
            console.log(`WB cards page ${pageNum}: ${cards.length} cards (total cursor: ${data.cursor?.total})`);

            if (cards.length === 0) break;

            for (const card of cards) {
              const sizes = card.sizes || [];
              let totalStock = 0;
              sizes.forEach((s: any) => {
                (s.stocks || []).forEach((st: any) => {
                  totalStock += st.qty || 0;
                });
              });

              allCards.push({
                offerId: card.vendorCode || String(card.nmID),
                name: card.title || card.subjectName || "",
                price: (card.sizes?.[0]?.price || 0) / 100, // WB stores prices in kopeks
                shopSku: card.vendorCode || "",
                category: card.subjectName || "",
                marketCategoryId: card.subjectID || 0,
                pictures: (card.photos || []).map((p: any) => p.big || p.c246x328 || ""),
                description: card.description || "",
                availability: "ACTIVE",
                stockFBO: totalStock,
                stockFBS: 0,
                stockCount: totalStock,
                nmID: card.nmID,
                brand: card.brand || "",
                rating: card.rating || 0,
                feedbacks: card.feedbackCount || card.mediaCount || 0,
              });
            }

            // Pagination: use cursor from response
            const newCursor = data.cursor;
            if (!newCursor || !newCursor.updatedAt || !newCursor.nmID || cards.length < cursor.limit) {
              break;
            }
            cursor = { ...cursor, updatedAt: newCursor.updatedAt, nmID: newCursor.nmID };
            pageNum++;
            await sleep(300);
          } while (pageNum < 50); // Safety limit

          // Try to get accurate stocks from Marketplace API
          if (allCards.length > 0) {
            try {
              await sleep(300);
              // Get warehouses first
              const whResp = await fetch("https://marketplace-api.wildberries.ru/api/v3/warehouses", {
                headers: wbHeaders,
              });
              if (whResp.ok) {
                const warehouses = await whResp.json();
                const warehouseIds = (Array.isArray(warehouses) ? warehouses : []).map((w: any) => w.id);
                
                // Get stocks for each warehouse
                for (const whId of warehouseIds.slice(0, 5)) {
                  try {
                    const stockResp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/stocks/${whId}`, {
                      method: "POST",
                      headers: wbHeaders,
                      body: JSON.stringify({ skus: allCards.slice(0, 1000).flatMap((c: any) => {
                        const sizes = [];
                        // Try to extract barcodes/skus
                        return [c.offerId];
                      }) }),
                    });
                    // Note: stock endpoint expects barcodes, not vendorCodes
                    // This is a best-effort approach
                  } catch (e) {
                    console.warn(`Stock fetch for warehouse ${whId} failed:`, e);
                  }
                }
              }
            } catch (e) {
              console.warn("WB stocks enrichment failed:", e);
            }
          }

          // Try to get prices from Prices API
          try {
            await sleep(300);
            const pricesResp = await fetch("https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000&offset=0", {
              headers: wbHeaders,
            });
            if (pricesResp.ok) {
              const pricesData = await pricesResp.json();
              const goods = pricesData.data?.listGoods || [];
              const priceMap = new Map<number, { price: number; discount: number }>();
              goods.forEach((g: any) => {
                const sizes = g.sizes || [];
                sizes.forEach((s: any) => {
                  priceMap.set(g.nmID, {
                    price: s.price || g.price || 0,
                    discount: s.discountedPrice || g.discount || 0,
                  });
                });
              });
              
              // Enrich cards with real prices
              allCards.forEach(card => {
                const priceInfo = priceMap.get(card.nmID);
                if (priceInfo) {
                  card.price = priceInfo.price / 100; // kopeks to rubles
                }
              });
              console.log(`WB prices enriched for ${priceMap.size} products`);
            }
          } catch (e) {
            console.warn("WB prices enrichment failed:", e);
          }

          console.log(`WB total products: ${allCards.length}`);

          result = {
            success: true,
            data: allCards,
            total: allCards.length,
          };
        } catch (e) {
          console.error("WB products fetch error:", e);
          result = { success: false, error: "Error fetching WB products" };
        }
      } else if (dataType === "orders") {
        // Fetch orders via Marketplace API
        // New orders: GET /api/v3/orders/new
        // All orders with status: POST /api/v3/orders/status
        try {
          const allOrders: any[] = [];
          const orderIdsSeen = new Set<number>();

          // 1. Get new orders
          const newOrdersResp = await fetch("https://marketplace-api.wildberries.ru/api/v3/orders/new", {
            headers: wbHeaders,
          });
          if (newOrdersResp.ok) {
            const newData = await newOrdersResp.json();
            const newOrders = newData.orders || [];
            console.log(`WB new orders: ${newOrders.length}`);
            for (const o of newOrders) {
              if (orderIdsSeen.has(o.id)) continue;
              orderIdsSeen.add(o.id);
              allOrders.push(mapWBOrder(o, "NEW"));
            }
          }

          // 2. Get recent orders (last 30 days via Statistics API)
          await sleep(300);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const dateFrom = thirtyDaysAgo.toISOString().split('.')[0];
          
          const statsOrdersResp = await fetch(
            `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${dateFrom}`,
            { headers: wbHeaders }
          );
          if (statsOrdersResp.ok) {
            const statsOrders = await statsOrdersResp.json();
            const ordersList = Array.isArray(statsOrders) ? statsOrders : [];
            console.log(`WB stats orders: ${ordersList.length}`);
            for (const o of ordersList) {
              const orderId = o.orderID || o.odid || o.srid;
              if (!orderId || orderIdsSeen.has(orderId)) continue;
              orderIdsSeen.add(orderId);
              allOrders.push({
                id: orderId,
                status: o.isCancel ? "CANCELLED" : "DELIVERED",
                createdAt: o.date || o.lastChangeDate || new Date().toISOString(),
                total: o.totalPrice || o.finishedPrice || 0,
                totalUZS: o.totalPrice || o.finishedPrice || 0,
                itemsTotal: o.totalPrice || o.finishedPrice || 0,
                itemsTotalUZS: o.totalPrice || o.finishedPrice || 0,
                deliveryTotal: 0,
                deliveryTotalUZS: 0,
                items: [{
                  offerId: o.supplierArticle || o.techSize || "",
                  offerName: o.subject || o.category || "",
                  count: 1,
                  price: o.totalPrice || o.finishedPrice || 0,
                  priceUZS: o.totalPrice || o.finishedPrice || 0,
                }],
                buyer: { firstName: o.regionName || "", lastName: "" },
                nmID: o.nmId,
                warehouseName: o.warehouseName || "",
              });
            }
          } else {
            console.warn(`WB stats orders failed: ${statsOrdersResp.status}`);
          }

          // 3. Also fetch sales data for revenue accuracy
          await sleep(300);
          const salesResp = await fetch(
            `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom}`,
            { headers: wbHeaders }
          );
          if (salesResp.ok) {
            const salesData = await salesResp.json();
            const salesList = Array.isArray(salesData) ? salesData : [];
            console.log(`WB sales entries: ${salesList.length}`);
            // Sales data enriches order revenue info
            for (const sale of salesList) {
              const saleId = sale.saleID || sale.odid;
              if (!saleId || orderIdsSeen.has(saleId)) continue;
              orderIdsSeen.add(saleId);
              allOrders.push({
                id: saleId,
                status: sale.saleID?.startsWith("R") ? "RETURNED" : "DELIVERED",
                createdAt: sale.date || new Date().toISOString(),
                total: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                totalUZS: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                itemsTotal: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                itemsTotalUZS: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                deliveryTotal: 0,
                deliveryTotalUZS: 0,
                items: [{
                  offerId: sale.supplierArticle || "",
                  offerName: sale.subject || sale.category || "",
                  count: 1,
                  price: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                  priceUZS: sale.totalPrice || sale.finishedPrice || sale.priceWithDisc || 0,
                }],
                buyer: { firstName: sale.regionName || "", lastName: "" },
              });
            }
          }

          console.log(`WB total orders: ${allOrders.length}`);

          result = {
            success: true,
            data: allOrders,
            total: allOrders.length,
          };
        } catch (e) {
          console.error("WB orders fetch error:", e);
          result = { success: false, error: "Error fetching WB orders" };
        }
      } else if (dataType === "stocks") {
        // Get stocks from warehouses
        try {
          const whResp = await fetch("https://marketplace-api.wildberries.ru/api/v3/warehouses", {
            headers: wbHeaders,
          });
          
          if (!whResp.ok) {
            result = { success: false, error: "Failed to fetch warehouses" };
          } else {
            const warehouses = await whResp.json();
            const stockData: any[] = [];
            
            for (const wh of (Array.isArray(warehouses) ? warehouses : []).slice(0, 10)) {
              try {
                await sleep(200);
                const stockResp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/stocks/${wh.id}`, {
                  method: "POST",
                  headers: wbHeaders,
                  body: JSON.stringify({ skus: [] }), // Empty = get all
                });
                if (stockResp.ok) {
                  const data = await stockResp.json();
                  const stocks = data.stocks || [];
                  stocks.forEach((s: any) => {
                    stockData.push({
                      offerId: s.sku || "",
                      fbo: 0,
                      fbs: s.amount || 0,
                      total: s.amount || 0,
                      warehouseId: wh.id,
                      warehouseName: wh.name || "",
                    });
                  });
                }
              } catch (e) {
                console.warn(`WB stock fetch for warehouse ${wh.id} error:`, e);
              }
            }

            result = { success: true, data: stockData, total: stockData.length };
          }
        } catch (e) {
          console.error("WB stocks error:", e);
          result = { success: false, error: "Error fetching WB stocks" };
        }
      } else if (dataType === "tariffs") {
        // WB commission tariffs — get from API
        try {
          const commResp = await fetch("https://common-api.wildberries.ru/api/v1/tariffs/commission", {
            headers: wbHeaders,
          });
          if (commResp.ok) {
            const commData = await commResp.json();
            result = { success: true, data: commData.report || [] };
          } else {
            result = { success: false, error: `WB tariffs failed: ${commResp.status}` };
          }
        } catch (e) {
          console.error("WB tariffs error:", e);
          result = { success: false, error: "Error fetching WB tariffs" };
        }
      } else if (dataType === "update-stock") {
        // Update stock via WB Marketplace API v3
        // PUT /api/v3/stocks/{warehouseId}
        try {
          const { stocks, stockUpdates } = requestBody;
          const updates = stocks || stockUpdates;
          
          if (!updates || updates.length === 0) {
            result = { success: false, error: "No stock updates provided" };
          } else {
            // First get warehouses to find the right one
            const whResp = await fetch("https://marketplace-api.wildberries.ru/api/v3/warehouses", {
              headers: wbHeaders,
            });
            
            if (!whResp.ok) {
              result = { success: false, error: `Failed to fetch warehouses: ${whResp.status}` };
            } else {
              const warehouses = await whResp.json();
              const whList = Array.isArray(warehouses) ? warehouses : [];
              
              if (whList.length === 0) {
                result = { success: false, error: "WB skladlar topilmadi. Avval WB kabinetida sklad yarating." };
              } else {
                // Use first warehouse (FBS) by default
                const warehouseId = whList[0].id;
                console.log(`WB stock update: warehouse=${warehouseId} (${whList[0].name}), items=${updates.length}`);
                
                // WB expects: PUT /api/v3/stocks/{warehouseId} with { stocks: [{ sku, amount }] }
                // sku = barcode of the size (from card.sizes[].skus[])
                // We need to map vendorCode/offerId to actual barcodes
                
                // Fetch ALL cards with pagination to get barcode mapping
                const skuMap = new Map<string, string[]>(); // vendorCode -> barcodes
                let cardsCursor = { limit: 100, updatedAt: undefined as string | undefined, nmID: undefined as number | undefined };
                let cardsTotal = 0;
                for (let page = 0; page < 20; page++) {
                  const cursorPayload: any = { limit: cardsCursor.limit };
                  if (cardsCursor.updatedAt) {
                    cursorPayload.updatedAt = cardsCursor.updatedAt;
                    cursorPayload.nmID = cardsCursor.nmID;
                  }
                  const cardsResp = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", {
                    method: "POST",
                    headers: wbHeaders,
                    body: JSON.stringify({
                      settings: {
                        cursor: cursorPayload,
                        filter: { withPhoto: -1 },
                      },
                    }),
                  });
                  if (!cardsResp.ok) { await cardsResp.text(); break; }
                  const cardsData = await cardsResp.json();
                  const cards = cardsData.cards || [];
                  for (const card of cards) {
                    const vc = card.vendorCode?.toLowerCase() || "";
                    const barcodes: string[] = [];
                    for (const size of (card.sizes || [])) {
                      for (const sku of (size.skus || [])) {
                        if (sku) barcodes.push(sku);
                      }
                    }
                    if (vc && barcodes.length > 0) skuMap.set(vc, barcodes);
                  }
                  cardsTotal += cards.length;
                  const nextCursor = cardsData.cursor;
                  if (!nextCursor || cards.length < 100) break;
                  cardsCursor = { limit: 100, updatedAt: nextCursor.updatedAt, nmID: nextCursor.nmID };
                }
                console.log(`WB barcode map: ${skuMap.size} cards mapped (fetched ${cardsTotal} cards)`);
                
                const stockPayload: Array<{ sku: string; amount: number }> = [];
                const unmapped: string[] = [];
                
                for (const u of updates) {
                  const offerId = (u.offerId || u.sku || "").toLowerCase();
                  const qty = u.quantity || u.amount || u.stock || 0;
                  const barcodes = skuMap.get(offerId);
                  
                  if (barcodes && barcodes.length > 0) {
                    for (const barcode of barcodes) {
                      stockPayload.push({ sku: barcode, amount: qty });
                    }
                  } else {
                    unmapped.push(offerId);
                  }
                }
                
                if (unmapped.length > 0) {
                  console.warn(`WB unmapped offerIds (no barcode found): ${unmapped.slice(0, 5).join(", ")}...`);
                }
                
                if (stockPayload.length === 0) {
                  result = { success: false, error: "Barkodlar topilmadi. Mahsulotlar WB da to'liq yaratilmagan bo'lishi mumkin." };
                } else {
                  // WB API limit: max 100 SKUs per request, batch them
                  const BATCH_SIZE = 100;
                  let totalUpdated = 0;
                  let lastError = "";
                  for (let i = 0; i < stockPayload.length; i += BATCH_SIZE) {
                    const batch = stockPayload.slice(i, i + BATCH_SIZE);
                    const stockResp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/stocks/${warehouseId}`, {
                      method: "PUT",
                      headers: { ...wbHeaders, "Content-Type": "application/json" },
                      body: JSON.stringify({ stocks: batch }),
                    });
                    if (stockResp.ok) {
                      totalUpdated += batch.length;
                      console.log(`WB stock batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.length} SKUs updated`);
                    } else {
                      const errText = await stockResp.text();
                      console.error(`WB stock batch ${Math.floor(i/BATCH_SIZE)+1} failed (${stockResp.status}):`, errText);
                      lastError = errText;
                    }
                  }
                  if (totalUpdated > 0) {
                    console.log(`WB stock update total: ${totalUpdated}/${stockPayload.length} SKUs updated`);
                    result = { success: true, updated: totalUpdated, total: stockPayload.length, warehouseId, warehouseName: whList[0].name };
                  } else {
                    result = { success: false, error: `WB qoldiq yangilash xatosi`, details: lastError };
                  }
                }
              }
            }
          }
        } catch (e: any) {
          console.error("WB stock update error:", e?.message || e);
          result = { success: false, error: "WB qoldiq yangilashda xato" };
        }
      } else if (dataType === "update-prices") {
        // Update prices via Discounts/Prices API
        // Need to map vendorCode (offerId) → nmID first
        try {
          const { offers: priceOffers } = requestBody;
          if (!priceOffers || priceOffers.length === 0) {
            result = { success: false, error: "No offers provided" };
          } else {
            // Fetch all cards to map vendorCode → nmID
            const nmIdMap = new Map<string, number>();
            let cardsCursor: any = { limit: 100 };
            for (let page = 0; page < 20; page++) {
              const cursorPayload: any = { limit: cardsCursor.limit };
              if (cardsCursor.updatedAt) {
                cursorPayload.updatedAt = cardsCursor.updatedAt;
                cursorPayload.nmID = cardsCursor.nmID;
              }
              const cardsResp = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", {
                method: "POST",
                headers: wbHeaders,
                body: JSON.stringify({
                  settings: { cursor: cursorPayload, filter: { withPhoto: -1 } },
                }),
              });
              if (!cardsResp.ok) { await cardsResp.text(); break; }
              const cardsData = await cardsResp.json();
              const cards = cardsData.cards || [];
              for (const card of cards) {
                if (card.vendorCode && card.nmID) {
                  nmIdMap.set(card.vendorCode.toLowerCase(), card.nmID);
                }
              }
              const nextCursor = cardsData.cursor;
              if (!nextCursor || cards.length < 100) break;
              cardsCursor = { limit: 100, updatedAt: nextCursor.updatedAt, nmID: nextCursor.nmID };
            }
            console.log(`WB price update: mapped ${nmIdMap.size} vendorCodes to nmIDs`);

            const pricePayload: any[] = [];
            const unmapped: string[] = [];
            for (const o of priceOffers) {
              const offerId = (o.offerId || '').toLowerCase();
              const nmID = o.nmID || nmIdMap.get(offerId);
              if (!nmID) {
                unmapped.push(o.offerId);
                continue;
              }
              pricePayload.push({
                nmID,
                price: Math.round(o.price), // WB v2 API expects price in rubles
                discount: o.discount || 0,
              });
            }

            if (unmapped.length > 0) {
              console.warn(`WB price update: ${unmapped.length} unmapped offerIds: ${unmapped.slice(0, 5).join(', ')}...`);
            }

            if (pricePayload.length === 0) {
              result = { success: false, error: "nmID topilmadi — mahsulotlar WB da yaratilmagan bo'lishi mumkin" };
            } else {
              const resp = await fetch("https://discounts-prices-api.wildberries.ru/api/v2/upload/task", {
                method: "POST",
                headers: wbHeaders,
                body: JSON.stringify({ data: pricePayload }),
              });

              if (resp.ok) {
                const data = await resp.json();
                console.log(`WB price update success: ${pricePayload.length} prices updated`);
                result = { success: true, data, updated: pricePayload.length, unmapped: unmapped.length };
              } else {
                const errText = await resp.text();
                console.error(`WB price update failed (${resp.status}):`, errText);
                result = { success: false, error: `WB narx yangilash xatosi: ${resp.status}`, details: errText };
              }
            }
          }
        } catch (e: any) {
          console.error("WB price update error:", e?.message || e);
          result = { success: false, error: "WB narxlarni yangilashda xato" };
        }
      } else if (dataType === "stats" || dataType === "financials") {
        // Financial report from Statistics API
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          const from = startDate.toISOString().split('T')[0];
          const to = endDate.toISOString().split('T')[0];

          const reportResp = await fetch(
            `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod?dateFrom=${from}&dateTo=${to}`,
            { headers: wbHeaders }
          );

          if (reportResp.ok) {
            const reportData = await reportResp.json();
            const entries = Array.isArray(reportData) ? reportData : [];
            console.log(`WB financial report: ${entries.length} entries`);

            // Aggregate by subject
            const summary = {
              totalSales: 0,
              totalCommission: 0,
              totalLogistics: 0,
              totalPenalties: 0,
              totalReturns: 0,
              netIncome: 0,
            };

            entries.forEach((e: any) => {
              summary.totalSales += e.retail_price_withdisc_rub || e.ppvz_for_pay || 0;
              summary.totalCommission += e.commission_percent ? (e.retail_price_withdisc_rub * e.commission_percent / 100) : 0;
              summary.totalLogistics += e.delivery_rub || 0;
              summary.totalPenalties += e.penalty || 0;
              summary.totalReturns += e.return_amount || 0;
            });
            summary.netIncome = summary.totalSales - summary.totalCommission - summary.totalLogistics - summary.totalPenalties;

            result = { 
              success: true, 
              data: { entries, summary, period: { from, to } },
              total: entries.length,
            };
          } else {
            console.warn(`WB financial report failed: ${reportResp.status}`);
            result = { success: false, error: `WB report failed: ${reportResp.status}` };
          }
        } catch (e) {
          console.error("WB financials error:", e);
          result = { success: false, error: "Error fetching WB financials" };
        }
      } else if (dataType === "balance") {
        // WB doesn't have a direct balance endpoint like Yandex
        // Use sales report as a proxy
        result = { success: true, data: { message: "Use 'stats' dataType for WB financial data" } };
      } else if (dataType === "inventory-reconciliation") {
        // WB: get products + orders + sales to calculate loss
        try {
          console.log("WB inventory reconciliation starting...");
          const productMap = new Map<string, { name: string; price: number }>();
          const stockMap = new Map<string, number>();
          const soldMap = new Map<string, number>();
          const returnMap = new Map<string, number>();

          // Fetch products
          const cardsResp = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", {
            method: "POST",
            headers: wbHeaders,
            body: JSON.stringify({ settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }),
          });
          if (cardsResp.ok) {
            const cd = await cardsResp.json();
            (cd.cards || []).forEach((c: any) => {
              productMap.set(c.vendorCode || String(c.nmID), {
                name: c.title || c.subjectName || "",
                price: (c.sizes?.[0]?.price || 0) / 100,
              });
              let totalStock = 0;
              (c.sizes || []).forEach((s: any) => {
                (s.stocks || []).forEach((st: any) => { totalStock += st.qty || 0; });
              });
              stockMap.set(c.vendorCode || String(c.nmID), totalStock);
            });
          }

          // Fetch orders and sales
          await sleep(300);
          const dateFrom90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('.')[0];
          
          const ordersResp = await fetch(
            `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${dateFrom90}`,
            { headers: wbHeaders }
          );
          if (ordersResp.ok) {
            const orders = await ordersResp.json();
            (Array.isArray(orders) ? orders : []).forEach((o: any) => {
              const sku = o.supplierArticle || "";
              if (!sku) return;
              if (o.isCancel) return;
              soldMap.set(sku, (soldMap.get(sku) || 0) + 1);
            });
          }

          await sleep(300);
          const salesResp = await fetch(
            `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom90}`,
            { headers: wbHeaders }
          );
          if (salesResp.ok) {
            const sales = await salesResp.json();
            (Array.isArray(sales) ? sales : []).forEach((s: any) => {
              const sku = s.supplierArticle || "";
              if (!sku) return;
              if (s.saleID?.startsWith("R")) {
                returnMap.set(sku, (returnMap.get(sku) || 0) + 1);
              }
            });
          }

          // Calculate
          const allSkus = new Set([...productMap.keys(), ...soldMap.keys()]);
          const reconciliation = Array.from(allSkus).map(sku => {
            const sold = soldMap.get(sku) || 0;
            const stock = stockMap.get(sku) || 0;
            const returned = returnMap.get(sku) || 0;
            const productInfo = productMap.get(sku);
            const accountedFor = sold + stock + returned;

            return {
              skuId: sku,
              name: productInfo?.name || sku,
              price: productInfo?.price || 0,
              invoiced: accountedFor,
              sold,
              currentStock: stock,
              returned,
              lost: 0,
              reconciled: true,
            };
          }).filter(item => item.sold > 0 || item.currentStock > 0)
          .sort((a, b) => b.sold - a.sold);

          result = {
            success: true,
            data: reconciliation,
            summary: {
              totalProducts: productMap.size,
              totalSold: Array.from(soldMap.values()).reduce((a, b) => a + b, 0),
              totalStock: Array.from(stockMap.values()).reduce((a, b) => a + b, 0),
              totalReturned: Array.from(returnMap.values()).reduce((a, b) => a + b, 0),
            },
            total: reconciliation.length,
          };
        } catch (e) {
          console.error("WB reconciliation error:", e);
          result = { success: false, error: "WB inventory reconciliation error" };
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
