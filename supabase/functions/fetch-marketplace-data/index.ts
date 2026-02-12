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
          // IMPORTANT: Yandex uses buyerTotal/buyerItemsTotal, NOT 'total'
          const pageOrders: YandexOrder[] = orders.map((order: any) => {
            const itemsTotal = order.buyerItemsTotal || order.itemsTotal || 0;
            const deliveryTotal = order.deliveryTotal || 0;
            const total = order.buyerTotal || order.buyerItemsTotalBeforeDiscount || (itemsTotal + deliveryTotal) || 0;
            
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
    } else if (dataType === "tariffs") {
        // Calculate real Yandex Market tariffs per product
        try {
          const offersForCalc = (tariffOffers || []).slice(0, 200).map((o: any) => ({
            categoryId: o.categoryId || 91491,
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
                
                tariffs.forEach((tariff: any) => {
                  const amount = tariff.amount || 0;
                  const type = tariff.type || '';
                  if (type === 'AGENCY_COMMISSION' || type === 'PAYMENT_TRANSFER') agencyCommission += amount;
                  else if (type === 'FEE') agencyCommission += amount;
                  else if (type === 'DELIVERY_TO_CUSTOMER' || type === 'CROSSREGIONAL_DELIVERY' || type === 'EXPRESS_DELIVERY' || type === 'MIDDLE_MILE') delivery += amount;
                  else if (type === 'SORTING') sorting += amount;
                  else other += amount;
                });
                
                return {
                  index: idx,
                  categoryId: offersForCalc[idx]?.categoryId,
                  price: offersForCalc[idx]?.price,
                  agencyCommission,
                  fulfillment,
                  delivery,
                  sorting,
                  other,
                  totalTariff: agencyCommission + fulfillment + delivery + sorting + other,
                  tariffPercent: offersForCalc[idx]?.price > 0 
                    ? ((agencyCommission + fulfillment + delivery + sorting + other) / offersForCalc[idx].price * 100)
                    : 0,
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
      const uzumHeaders = {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      };
      
      // Get shopId from credentials or account_info
      const uzumShopId = credentials.sellerId || 
                         (connection.account_info as any)?.shopId || 
                         (connection.account_info as any)?.sellerId;

      console.log(`Uzum API: dataType=${dataType}, shopId=${uzumShopId}`);

      if (dataType === "products") {
        // GET /v1/product/shop/{shopId}
        if (!uzumShopId) {
          result = { success: false, error: "Shop ID required for Uzum products" };
        } else {
          try {
            const response = await fetch(
              `${uzumBaseUrl}/v1/product/shop/${uzumShopId}`,
              { headers: uzumHeaders }
            );

            if (response.ok) {
              const data = await response.json();
              const productCards = data.payload?.productCards || data.payload || data.data || [];
              const items = Array.isArray(productCards) ? productCards : [];

              console.log(`Uzum: ${items.length} products found`);

              const products = items.map((card: any) => {
                // Each card may have multiple SKUs
                const skus = card.skuList || card.skus || [];
                const firstSku = skus[0] || {};
                const price = firstSku.fullPrice || firstSku.purchasePrice || card.price || 0;
                const stockCount = skus.reduce((sum: number, sku: any) => {
                  const amounts = sku.skuAmountList || sku.amounts || [];
                  return sum + amounts.reduce((s: number, a: any) => s + (a.amount || 0), 0);
                }, 0);
                
                const photos = card.photos || card.images || [];
                const pictures = photos.map((p: any) => p.photo?.url || p.url || p).filter(Boolean);

                return {
                  offerId: String(card.productId || card.id || firstSku.skuId || ''),
                  name: card.title || card.name || '',
                  price,
                  shopSku: String(firstSku.skuId || firstSku.barCode || card.productId || ''),
                  category: card.category?.title || card.categoryTitle || '',
                  marketCategoryId: card.category?.id || card.categoryId || 0,
                  pictures,
                  description: card.description || '',
                  availability: card.status?.title || card.moderationStatus || 'ACTIVE',
                  stockFBO: 0,
                  stockFBS: stockCount,
                  stockCount,
                };
              });

              result = {
                success: true,
                data: products,
                total: products.length,
              };
            } else {
              const errText = await response.text();
              console.error("Uzum products error:", response.status, errText);
              result = { success: false, error: `Uzum products failed: ${response.status}` };
            }
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
          const pageSize = 100;

          while (hasMore) {
            const params = new URLSearchParams({
              size: String(pageSize),
              page: String(page),
            });
            if (fromDate) params.append("dateFrom", fromDate);
            if (toDate) params.append("dateTo", toDate);
            if (status) params.append("status", status);

            const response = await fetch(
              `${uzumBaseUrl}/v2/fbs/orders?${params.toString()}`,
              { headers: uzumHeaders }
            );

            if (!response.ok) {
              console.error("Uzum orders error:", response.status);
              break;
            }

            const data = await response.json();
            const orders = data.payload?.fbsOrders || data.payload?.orders || data.payload || [];
            const orderList = Array.isArray(orders) ? orders : [];
            
            console.log(`Uzum orders page ${page}: ${orderList.length} orders`);

            const mapped = orderList.map((order: any) => {
              const items = order.items || order.orderItems || [];
              const itemsTotal = items.reduce((sum: number, item: any) => {
                return sum + ((item.price || item.amount || 0) * (item.quantity || item.count || 1));
              }, 0);

              return {
                id: order.orderId || order.id,
                status: order.status || 'UNKNOWN',
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
                items: items.map((item: any) => ({
                  offerId: String(item.productId || item.skuId || ''),
                  offerName: item.title || item.productTitle || item.name || '',
                  count: item.quantity || item.count || 1,
                  price: item.price || item.amount || 0,
                  priceUZS: item.price || item.amount || 0,
                })),
              };
            });

            allOrders = [...allOrders, ...mapped];

            if (orderList.length < pageSize || !fetchAll) {
              hasMore = false;
            } else {
              page++;
              await sleep(300);
            }
          }

          console.log(`Uzum total orders: ${allOrders.length}`);
          result = {
            success: true,
            data: allOrders,
            total: allOrders.length,
          };
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
        try {
          const [ordersRes, expensesRes] = await Promise.all([
            fetch(`${uzumBaseUrl}/v1/finance/orders`, { headers: uzumHeaders }),
            fetch(`${uzumBaseUrl}/v1/finance/expenses`, { headers: uzumHeaders }),
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

      } else if (dataType === "update-stocks") {
        // POST /v2/fbs/sku/stocks
        try {
          const { stockUpdates } = requestBody;
          
          if (!stockUpdates || stockUpdates.length === 0) {
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
                  skuAmountList: stockUpdates.map((s: any) => ({
                    skuId: s.skuId || s.offerId,
                    amount: s.amount || s.stock || 0,
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
