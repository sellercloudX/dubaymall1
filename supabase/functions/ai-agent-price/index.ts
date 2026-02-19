import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const UZS_PER_RUB = 140;

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 420) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
        continue;
      }
      return response;
    } catch (e) {
      if (attempt < maxRetries - 1) { await sleep(1000 * (attempt + 1)); continue; }
      throw e;
    }
  }
  return fetch(url, options);
}

// ===== NARX FORMULASI =====
// Same formula used in partner dashboard (ABCAnalysis) for consistency
function calculateOptimalPrice(
  costPrice: number, commissionPercent: number, logisticsCost: number,
  targetMarginPercent: number = 12, taxPercent: number = 4
): { minPrice: number; recommendedPrice: number; maxPrice: number; marginPercent: number } {
  if (!costPrice || costPrice <= 0) return { minPrice: 0, recommendedPrice: 0, maxPrice: 0, marginPercent: 0 };

  const minDenom = 1 - (commissionPercent + taxPercent + 3) / 100;
  const recDenom = 1 - (commissionPercent + taxPercent + targetMarginPercent) / 100;
  const maxDenom = 1 - (commissionPercent + taxPercent + targetMarginPercent + 5) / 100;

  const minPrice = minDenom > 0.05 ? Math.ceil((costPrice + logisticsCost) / minDenom) : 0;
  const recommendedPrice = recDenom > 0.05 ? Math.ceil((costPrice + logisticsCost) / recDenom) : 0;
  const maxPrice = maxDenom > 0.05 ? Math.ceil((costPrice + logisticsCost) / maxDenom) : 0;
  
  const actualMargin = recommendedPrice > 0 
    ? ((recommendedPrice - costPrice - logisticsCost - (recommendedPrice * (commissionPercent + taxPercent) / 100)) / recommendedPrice) * 100 
    : 0;

  return { minPrice, recommendedPrice, maxPrice, marginPercent: Math.round(actualMargin * 10) / 10 };
}

// ===== Get Yandex businessId =====
async function resolveBusinessId(credentials: any, headers: Record<string, string>): Promise<string | null> {
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  return businessId || null;
}

// ===== Fetch REAL Yandex tariffs =====
async function fetchYandexRealTariffs(
  campaignId: string, headers: Record<string, string>,
  products: Array<{ categoryId: number; price: number; offerId: string }>
): Promise<Map<string, { commissionPercent: number; logisticsCost: number }>> {
  const tariffMap = new Map<string, { commissionPercent: number; logisticsCost: number }>();
  if (products.length === 0) return tariffMap;

  for (let i = 0; i < products.length; i += 200) {
    const batch = products.slice(i, i + 200);
    const offersForCalc = batch.map(o => ({
      categoryId: (o.categoryId && o.categoryId > 0) ? o.categoryId : 91491,
      price: o.price || 0, length: 20, width: 15, height: 10, weight: 0.5,
    }));

    try {
      await sleep(500);
      const resp = await fetchWithRetry('https://api.partner.market.yandex.ru/v2/tariffs/calculate', {
        method: 'POST', headers,
        body: JSON.stringify({ parameters: { campaignId: Number(campaignId) }, offers: offersForCalc }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const results = data.result?.offers || [];
        results.forEach((t: any, idx: number) => {
          if (idx >= batch.length) return;
          const tariffs = t.tariffs || [];
          let commissionPercent = 0;
          let logisticsCost = 0;

          tariffs.forEach((tariff: any) => {
            const amount = tariff.amount || 0;
            const type = tariff.type || '';
            const params = tariff.parameters || [];
            const valueParam = params.find((p: any) => p.name === 'value');
            const valueType = params.find((p: any) => p.name === 'valueType');
            const isRelative = valueType?.value === 'relative';

            if (type === 'FEE' || type === 'AGENCY_COMMISSION' || type === 'PAYMENT_TRANSFER') {
              if (isRelative && valueParam?.value) commissionPercent += parseFloat(valueParam.value) || 0;
              else if (batch[idx].price > 0) commissionPercent += (amount / batch[idx].price) * 100;
            } else if (['DELIVERY_TO_CUSTOMER', 'CROSSREGIONAL_DELIVERY', 'EXPRESS_DELIVERY', 'MIDDLE_MILE', 'SORTING'].includes(type)) {
              logisticsCost += amount;
            }
          });

          tariffMap.set(batch[idx].offerId, {
            commissionPercent: Math.round(commissionPercent * 100) / 100,
            logisticsCost: Math.round(logisticsCost),
          });
        });
      }
    } catch (e) { console.error('Tariff calculation error:', e); }
  }
  return tariffMap;
}

// ===== Uzum commission by price tier (same as useMarketplaceTariffs) =====
function getUzumCommissionPercent(price: number): number {
  if (price <= 50000) return 20;
  if (price <= 200000) return 15;
  if (price <= 1000000) return 12;
  return 10;
}
function getUzumLogistics(price: number): number {
  if (price > 500000) return 20000;
  if (price > 100000) return 8000;
  return 4000;
}

// Fetch Yandex prices + real tariffs (DEDUPLICATED)
async function fetchYandexPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  const headers: Record<string, string> = { "Api-Key": apiKey, "Content-Type": "application/json" };

  const businessId = await resolveBusinessId(credentials, headers);
  if (!businessId) return [];

  // DEDUPLICATED fetch
  const seenOfferIds = new Set<string>();
  let allMappings: any[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const body: any = {};
    if (nextPageToken) body.page_token = nextPageToken;
    const resp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`,
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    if (!resp.ok) break;
    const data = await resp.json();
    for (const m of (data.result?.offerMappings || [])) {
      const oid = m.offer?.offerId;
      if (oid && !seenOfferIds.has(oid)) {
        seenOfferIds.add(oid);
        allMappings.push(m);
      }
    }
    nextPageToken = data.result?.paging?.nextPageToken;
    if (!nextPageToken) break;
    await sleep(300);
  }

  console.log(`Yandex price: fetched ${allMappings.length} unique mappings`);

  const productsForTariff = allMappings.map((entry: any) => {
    const offer = entry.offer || {};
    const mapping = entry.mapping || {};
    return {
      categoryId: mapping.marketCategoryId || 0,
      price: offer.basicPrice?.value || offer.price || 0,
      offerId: offer.offerId || '',
    };
  }).filter(p => p.price > 0);

  const realTariffs = campaignId 
    ? await fetchYandexRealTariffs(campaignId, headers, productsForTariff)
    : new Map();

  return allMappings.map((entry: any) => {
    const offer = entry.offer || {};
    const mapping = entry.mapping || {};
    const offerId = offer.offerId || '';
    const price = offer.basicPrice?.value || offer.price || 0;
    
    const realTariff = realTariffs.get(offerId);
    const commissionPercent = realTariff?.commissionPercent || 15;
    const rawLogistics = realTariff?.logisticsCost || 0;
    const currency = offer.basicPrice?.currencyId || 'UZS';
    const logisticsCost = currency === 'UZS' && rawLogistics > 0 && rawLogistics < 5000
      ? Math.round(rawLogistics * UZS_PER_RUB) : rawLogistics || 6000;
    
    const pictures = offer.pictures || [];
    return {
      offerId, sku: offerId, name: offer.name || '', price, currency,
      category: mapping.marketCategoryName || '', categoryId: mapping.marketCategoryId || 0,
      marketplace: 'yandex', commissionPercent, logisticsCost,
      hasRealTariff: !!realTariff, imageUrl: pictures[0] || null,
    };
  });
}

// Fetch WB prices (DEDUPLICATED)
async function fetchWBPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  const seenNmIDs = new Set<number>();
  let allCards: any[] = [];
  let cursor: any = { limit: 100 };
  for (let page = 0; page < 50; page++) {
    const resp = await fetchWithRetry(
      `https://content-api.wildberries.ru/content/v2/get/cards/list`,
      { method: 'POST', headers, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) }
    );
    if (!resp.ok) break;
    const data = await resp.json();
    const cards = data.cards || [];
    for (const card of cards) {
      if (card.nmID && !seenNmIDs.has(card.nmID)) {
        seenNmIDs.add(card.nmID);
        allCards.push(card);
      }
    }
    if (cards.length < 100) break;
    const lastCard = cards[cards.length - 1];
    cursor = { limit: 100, updatedAt: lastCard.updatedAt, nmID: lastCard.nmID };
    await sleep(300);
  }

  let priceMap = new Map<number, any>();
  try {
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const priceResp = await fetchWithRetry(
        `https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000&offset=${offset}`,
        { method: 'GET', headers }
      );
      if (!priceResp.ok) break;
      const priceData = await priceResp.json();
      const goods = priceData.data?.listGoods || [];
      for (const item of goods) {
        priceMap.set(item.nmID, {
          price: item.sizes?.[0]?.price || 0,
          discount: item.discount || 0,
          salePrice: item.sizes?.[0]?.discountedPrice || 0,
        });
      }
      if (goods.length < 1000) break;
      offset += 1000;
      await sleep(300);
    }
  } catch (e) { console.error("WB prices fetch error:", e); }

  return allCards.map(card => {
    const prices = priceMap.get(card.nmID) || {};
    const photos = card.photos || card.mediaFiles || [];
    const imageUrl = photos.length > 0 ? (photos[0]?.big || photos[0]?.c246x328 || photos[0]) : null;
    return {
      offerId: card.vendorCode || card.nmID?.toString() || '',
      sku: card.vendorCode || card.nmID?.toString() || '', nmID: card.nmID,
      name: card.title || card.vendorCode || '',
      price: prices.salePrice || prices.price || 0,
      originalPrice: prices.price || 0, discount: prices.discount || 0,
      currency: 'RUB', category: card.subjectName || '',
      marketplace: 'wildberries', commissionPercent: 15, logisticsCost: 50, imageUrl,
    };
  });
}

// ===== Fetch Uzum prices (DEDUPLICATED) =====
async function fetchUzumPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  if (!apiKey) return [];
  const baseUrl = "https://api-seller.uzum.uz/api/seller-openapi";
  const headers: Record<string, string> = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Discover shopId
  let shopId: string | null = credentials.sellerId || null;
  try {
    const shopsResp = await fetchWithRetry(`${baseUrl}/v1/shops`, { headers });
    if (shopsResp.ok) {
      const shopsData = await shopsResp.json();
      const shops = Array.isArray(shopsData) ? shopsData : (shopsData.payload || shopsData.data || []);
      const shopList = Array.isArray(shops) ? shops : [shops];
      if (shopList.length > 0) shopId = String(shopList[0].shopId || shopList[0].id || shopId);
    }
  } catch (e) { console.error('Uzum shops discovery:', e); }

  if (!shopId) return [];

  const seenIds = new Set<string>();
  const allProducts: any[] = [];

  for (let page = 0; page < 50; page++) {
    try {
      const params = new URLSearchParams({ size: '100', pageNumber: String(page) });
      const resp = await fetchWithRetry(`${baseUrl}/v1/product/shop/${shopId}?${params}`, { headers });
      if (!resp.ok) break;
      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data.payload || data.productCards || data.data || data.content || []);
      const list = Array.isArray(items) ? items : [];
      if (list.length === 0) break;

      for (const item of list) {
        const skus = item.skuList || item.skus || [];
        const firstSku = skus[0] || {};
        const productId = String(item.productId || item.id || firstSku.skuId || '');
        const offerId = firstSku.skuTitle || firstSku.barCode || firstSku.barcode || productId;
        
        if (!offerId || seenIds.has(offerId)) continue;
        seenIds.add(offerId);

        const price = firstSku.purchasePrice || firstSku.fullPrice || item.price || 0;
        const photos = item.photos || item.photoList || [];
        const imageUrl = photos.length > 0 ? photos[0] : null;
        const commissionPercent = getUzumCommissionPercent(price);
        const logisticsCost = getUzumLogistics(price);

        allProducts.push({
          offerId, sku: offerId, productId,
          name: item.title || item.name || '', price,
          currency: 'UZS', category: item.categoryTitle || item.category?.title || '',
          marketplace: 'uzum', commissionPercent, logisticsCost,
          hasRealTariff: false, imageUrl: imageUrl ? (typeof imageUrl === 'string' && !imageUrl.startsWith('http') ? `https://images.uzum.uz${imageUrl}` : imageUrl) : null,
        });
      }
      await sleep(500);
    } catch (e) {
      console.error(`Uzum price page ${page} error:`, e);
      break;
    }
  }

  console.log(`Uzum price: fetched ${allProducts.length} unique products`);
  return allProducts;
}

// ===== Apply prices to Yandex =====
async function applyYandexPrice(credentials: any, offerId: string, newPrice: number, currency: string = 'UZS'): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const headers: Record<string, string> = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const businessId = await resolveBusinessId(credentials, headers);
  if (!businessId) return { success: false, message: 'Business ID topilmadi' };

  const currencyId = currency === 'RUB' ? 'RUR' : currency || 'UZS';
  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-prices/updates`,
    { method: 'POST', headers, body: JSON.stringify({ offers: [{ offerId, price: { value: Math.round(newPrice), currencyId } }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: `Yandex narx yangilandi: ${Math.round(newPrice)} ${currencyId}` };
}

// ===== Apply prices to WB =====
async function applyWBPrice(credentials: any, nmID: number, newPrice: number): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const priceRub = Math.round(newPrice);
  const resp = await fetchWithRetry(
    `https://discounts-prices-api.wildberries.ru/api/v2/upload/task`,
    { method: 'POST', headers, body: JSON.stringify({ data: [{ nmID, price: priceRub }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: `WB narx yangilandi: ${priceRub} RUB` };
}

// ===== Apply prices to Uzum =====
async function applyUzumPrice(credentials: any, offerId: string, productId: string, newPrice: number): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  if (!apiKey) return { success: false, message: 'Uzum API key topilmadi' };
  
  const baseUrl = "https://api-seller.uzum.uz/api/seller-openapi";
  const headers: Record<string, string> = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Uzum price update via /v1/product/price
  try {
    const resp = await fetchWithRetry(`${baseUrl}/v1/product/price`, {
      method: 'POST', headers,
      body: JSON.stringify({ skuPriceList: [{ skuId: productId || offerId, price: Math.round(newPrice) }] }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, message: `Uzum: ${resp.status} - ${errText.substring(0, 200)}` };
    }
    return { success: true, message: `Uzum narx yangilandi: ${Math.round(newPrice)} UZS` };
  } catch (e) {
    return { success: false, message: `Uzum xato: ${(e as any).message}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminPerm } = await supabase
      .from('admin_permissions')
      .select('is_super_admin, can_manage_users')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
      return new Response(JSON.stringify({ error: 'Admin ruxsati yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { partnerId, action, targetMargin } = body;

    if (!partnerId) {
      return new Response(JSON.stringify({ error: 'partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: connections } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', partnerId)
      .eq('is_active', true);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: 'Ulanish topilmadi' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get cost prices
    const { data: costPrices } = await supabase.from('marketplace_cost_prices').select('*').eq('user_id', partnerId);
    const costMap = new Map<string, number>();
    for (const cp of (costPrices || [])) costMap.set(`${cp.marketplace}-${cp.offer_id}`, cp.cost_price);

    async function getCredsForMarketplace(mp: string): Promise<any> {
      const conn = connections!.find(c => c.marketplace === mp);
      if (!conn) return null;
      if (conn.encrypted_credentials) {
        const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
        return typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
      }
      return conn.credentials || {};
    }

    // ===== SCAN =====
    if (action === 'scan') {
      const allProducts: any[] = [];
      const userTargetMargin = targetMargin || 12;

      for (const conn of connections) {
        try {
          let creds: any;
          if (conn.encrypted_credentials) {
            const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
            creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          } else { creds = conn.credentials || {}; }

          let products: any[] = [];
          if (conn.marketplace === 'yandex') products = await fetchYandexPrices(creds);
          else if (conn.marketplace === 'wildberries') products = await fetchWBPrices(creds);
          else if (conn.marketplace === 'uzum') products = await fetchUzumPrices(creds);

          for (const p of products) {
            let costPrice = costMap.get(`${p.marketplace}-${p.offerId}`) || 0;
            
            // WB works in RUB, cost prices stored in UZS — convert
            if (p.marketplace === 'wildberries' && costPrice > 0 && p.currency === 'RUB') {
              costPrice = Math.round(costPrice / UZS_PER_RUB);
            }
            
            const commissionPercent = p.commissionPercent || 15;
            const logisticsCost = p.logisticsCost || (p.marketplace === 'wildberries' ? 50 : p.marketplace === 'uzum' ? 6000 : 6000);
            
            let actualMargin: number | null = null;
            if (costPrice > 0 && p.price > 0) {
              const commission = p.price * commissionPercent / 100;
              const tax = p.price * 4 / 100;
              const netProfit = p.price - costPrice - logisticsCost - commission - tax;
              actualMargin = Math.round((netProfit / p.price) * 100);
            }

            const optimal = calculateOptimalPrice(costPrice, commissionPercent, logisticsCost, userTargetMargin);
            
            let priceAction = 'ok';
            if (costPrice <= 0) priceAction = 'no_cost';
            else if (p.price < optimal.recommendedPrice * 0.97) priceAction = 'increase';
            else if (p.price > optimal.recommendedPrice * 1.05) priceAction = 'decrease';

            allProducts.push({
              ...p, costPrice, margin: actualMargin, commissionPercent, logisticsCost,
              optimalPrice: optimal.recommendedPrice, minPrice: optimal.minPrice, maxPrice: optimal.maxPrice,
              optimalMargin: optimal.marginPercent,
              isPriceHigh: priceAction === 'decrease', isPriceLow: priceAction === 'increase',
              isPriceRisky: costPrice > 0 && (actualMargin !== null && actualMargin < 5),
              sku: p.sku || p.offerId, imageUrl: p.imageUrl || null, priceAction,
            });
          }
        } catch (e) { console.error(`Price scan error for ${conn.marketplace}:`, e); }
      }

      const withCost = allProducts.filter(p => p.costPrice > 0);
      const avgMargin = withCost.length > 0 ? Math.round(withCost.reduce((s, p) => s + (p.margin || 0), 0) / withCost.length) : 0;

      return new Response(JSON.stringify({
        success: true,
        products: allProducts.sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100)),
        summary: {
          totalProducts: allProducts.length, withCostPrice: withCost.length, avgMargin,
          riskyCount: allProducts.filter(p => p.isPriceLow || p.isPriceRisky).length,
          highPriceCount: allProducts.filter(p => p.isPriceHigh).length,
          lowMarginCount: allProducts.filter(p => p.isPriceLow).length,
          noCostPrice: allProducts.length - withCost.length,
          needsAdjustment: allProducts.filter(p => p.priceAction !== 'ok' && p.priceAction !== 'no_cost').length,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== RECOMMEND =====
    if (action === 'recommend') {
      const { products } = body;
      const recommendations: any[] = [];
      const userMargin = targetMargin || 12;

      for (const product of (products || []).slice(0, 100)) {
        let costPrice = costMap.get(`${product.marketplace}-${product.offerId}`) || product.costPrice || 0;
        if (product.marketplace === 'wildberries' && costPrice > 0 && costPrice > 1000) {
          costPrice = Math.round(costPrice / UZS_PER_RUB);
        }
        
        const commissionPercent = product.commissionPercent || 15;
        const logisticsCost = product.logisticsCost || (product.marketplace === 'wildberries' ? 50 : product.marketplace === 'uzum' ? 6000 : 6000);

        if (costPrice <= 0) {
          recommendations.push({
            offerId: product.offerId, name: product.name, currentPrice: product.price,
            marketplace: product.marketplace, nmID: product.nmID, productId: product.productId,
            costPrice: 0,
            recommendation: { recommendedPrice: 0, minPrice: 0, maxPrice: 0, reasoning: 'Tannarx kiritilmagan', marginPercent: 0, priceAction: 'no_cost' },
          });
          continue;
        }

        const optimal = calculateOptimalPrice(costPrice, commissionPercent, logisticsCost, userMargin);
        let priceAction: string, reasoning: string;
        
        if (product.price < optimal.recommendedPrice * 0.97) {
          priceAction = 'increase';
          reasoning = `Joriy narx (${product.price.toLocaleString()}) tavsiya narxdan (${optimal.recommendedPrice.toLocaleString()}) past — ${userMargin}% marja uchun ko'tarish kerak. [Tannarx: ${costPrice.toLocaleString()}, Komissiya: ${commissionPercent}%, Logistika: ${logisticsCost.toLocaleString()}, Soliq: 4%]`;
        } else if (product.price > optimal.recommendedPrice * 1.05) {
          priceAction = 'decrease';
          reasoning = `Joriy narx (${product.price.toLocaleString()}) tavsiya narxdan (${optimal.recommendedPrice.toLocaleString()}) ancha yuqori — sotuv tushishi mumkin. [Marja: ${optimal.marginPercent}%]`;
        } else {
          priceAction = 'keep';
          reasoning = `Narx optimal diapazonda (${optimal.minPrice.toLocaleString()}-${optimal.maxPrice.toLocaleString()}). Marja: ${optimal.marginPercent}%.`;
        }

        recommendations.push({
          offerId: product.offerId, name: product.name, currentPrice: product.price,
          marketplace: product.marketplace, nmID: product.nmID, productId: product.productId,
          costPrice,
          recommendation: {
            recommendedPrice: optimal.recommendedPrice, minPrice: optimal.minPrice, maxPrice: optimal.maxPrice,
            reasoning, marginPercent: optimal.marginPercent, priceAction,
            commissionPercent, logisticsCost, taxPercent: 4, targetMargin: userMargin,
          },
        });
      }

      return new Response(JSON.stringify({ success: true, recommendations }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== APPLY PRICES =====
    if (action === 'apply') {
      const { priceUpdates } = body;
      if (!priceUpdates?.length) {
        return new Response(JSON.stringify({ error: 'priceUpdates kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let applied = 0, failed = 0;
      const results: any[] = [];
      const credCache = new Map<string, any>();
      
      for (let i = 0; i < priceUpdates.length; i++) {
        const update = priceUpdates[i];
        try {
          if (!credCache.has(update.marketplace)) {
            const creds = await getCredsForMarketplace(update.marketplace);
            credCache.set(update.marketplace, creds);
          }
          const creds = credCache.get(update.marketplace);
          if (!creds) { results.push({ offerId: update.offerId, success: false, message: 'Credentials topilmadi' }); failed++; continue; }

          let result;
          if (update.marketplace === 'yandex') {
            result = await applyYandexPrice(creds, update.offerId, update.newPrice, update.currency || 'UZS');
          } else if (update.marketplace === 'wildberries' && update.nmID) {
            result = await applyWBPrice(creds, update.nmID, update.newPrice);
          } else if (update.marketplace === 'uzum') {
            result = await applyUzumPrice(creds, update.offerId, update.productId || update.offerId, update.newPrice);
          } else {
            result = { success: false, message: `${update.marketplace} qo'llab-quvvatlanmaydi` };
          }

          results.push({ offerId: update.offerId, ...result });
          if (result.success) applied++; else failed++;
          if (i < priceUpdates.length - 1) await sleep(300);
        } catch (e) {
          console.error(`Apply price error for ${update.offerId}:`, e);
          results.push({ offerId: update.offerId, success: false, message: (e as any).message || 'Xatolik' });
          failed++;
        }
      }

      return new Response(JSON.stringify({ success: true, applied, failed, total: priceUpdates.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'action kerak (scan | recommend | apply)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent price error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
