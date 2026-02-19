import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
// MinPrice = CostPrice / (1 - (Commission% + Tax% + TargetMargin%))
// Tax = 4% (O'zbekiston aylanma solig'i)
// TargetMargin = 10-15% (foydalanuvchi belgilagan yoki default)
function calculateOptimalPrice(
  costPrice: number,
  commissionPercent: number,
  logisticsCost: number,
  targetMarginPercent: number = 12,
  taxPercent: number = 4
): { minPrice: number; recommendedPrice: number; maxPrice: number; marginPercent: number } {
  if (!costPrice || costPrice <= 0) {
    return { minPrice: 0, recommendedPrice: 0, maxPrice: 0, marginPercent: 0 };
  }

  const totalDeductionPercent = (commissionPercent + taxPercent + targetMarginPercent) / 100;
  
  // Formula: SellingPrice = (CostPrice + Logistics) / (1 - totalDeduction%)
  const minPrice = Math.ceil((costPrice + logisticsCost) / (1 - (commissionPercent + taxPercent + 5) / 100)); // 5% minimal marja
  const recommendedPrice = Math.ceil((costPrice + logisticsCost) / (1 - totalDeductionPercent));
  const maxPrice = Math.ceil((costPrice + logisticsCost) / (1 - (commissionPercent + taxPercent + targetMarginPercent + 5) / 100));
  
  // Haqiqiy marja tekshiruvi
  const actualMargin = recommendedPrice > 0 
    ? ((recommendedPrice - costPrice - logisticsCost - (recommendedPrice * (commissionPercent + taxPercent) / 100)) / recommendedPrice) * 100 
    : 0;

  return {
    minPrice,
    recommendedPrice,
    maxPrice,
    marginPercent: Math.round(actualMargin * 10) / 10,
  };
}

// Fetch Yandex prices
async function fetchYandexPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) return [];

  // Fetch tariffs for commission rates
  let tariffMap = new Map<number, { commission: number; logistics: number }>();
  try {
    const tariffResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
      { method: 'POST', headers, body: JSON.stringify({ offerIds: [], withRecommendations: false }) }
    );
    // We'll get tariffs per-product below
  } catch (e) { console.error("Tariff fetch error:", e); }

  let allMappings: any[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const body: any = {};
    if (nextPageToken) body.page_token = nextPageToken;
    const resp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`,
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    if (!resp.ok) break;
    const data = await resp.json();
    allMappings.push(...(data.result?.offerMappings || []));
    nextPageToken = data.result?.paging?.nextPageToken;
    if (!nextPageToken) break;
    await sleep(300);
  }

  // Fetch tariffs per category
  const categoryTariffs = new Map<number, number>();
  const uniqueCategoryIds = [...new Set(allMappings.map(m => m.mapping?.marketCategoryId).filter(Boolean))];
  
  for (let i = 0; i < uniqueCategoryIds.length; i += 10) {
    const batch = uniqueCategoryIds.slice(i, i + 10);
    for (const catId of batch) {
      try {
        const tResp = await fetchWithRetry(
          `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
          { method: 'POST', headers, body: JSON.stringify({ filter: { categoryIds: [catId] }, limit: 1 }) }
        );
        if (tResp.ok) {
          const tData = await tResp.json();
          const mapping = tData.result?.offerMappings?.[0]?.mapping;
          if (mapping) {
            // Get commission from parameters if available
            const params = mapping.parameters || [];
            const feeParam = params.find((p: any) => p.name === 'FEE' || p.name === 'PAYMENT_TRANSFER');
            if (feeParam) categoryTariffs.set(catId, feeParam.value || 10);
          }
        }
      } catch (e) { /* skip */ }
    }
    await sleep(200);
  }

  return allMappings.map((entry: any) => {
    const offer = entry.offer || {};
    const mapping = entry.mapping || {};
    const catId = mapping.marketCategoryId || 0;
    const commission = categoryTariffs.get(catId) || 10; // Default 10% if unknown
    
    return {
      offerId: offer.offerId || '',
      name: offer.name || '',
      price: offer.basicPrice?.value || offer.price || 0,
      currency: offer.basicPrice?.currencyId || 'UZS',
      category: mapping.marketCategoryName || '',
      categoryId: catId,
      marketplace: 'yandex',
      commissionPercent: commission,
      logisticsCost: 4000, // Default Yandex logistics ~4000 UZS
    };
  });
}

// Fetch WB prices
async function fetchWBPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  let allCards: any[] = [];
  let cursor: any = { limit: 100 };
  for (let page = 0; page < 20; page++) {
    const resp = await fetchWithRetry(
      `https://content-api.wildberries.ru/content/v2/get/cards/list`,
      { method: 'POST', headers, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) }
    );
    if (!resp.ok) break;
    const data = await resp.json();
    const cards = data.cards || [];
    allCards.push(...cards);
    if (cards.length < 100) break;
    const lastCard = cards[cards.length - 1];
    cursor = { limit: 100, updatedAt: lastCard.updatedAt, nmID: lastCard.nmID };
    await sleep(300);
  }

  // Get prices
  let priceMap = new Map<number, any>();
  try {
    const priceResp = await fetchWithRetry(
      `https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000`,
      { method: 'GET', headers }
    );
    if (priceResp.ok) {
      const priceData = await priceResp.json();
      for (const item of (priceData.data?.listGoods || [])) {
        priceMap.set(item.nmID, {
          price: item.sizes?.[0]?.price || 0,
          discount: item.discount || 0,
          salePrice: item.sizes?.[0]?.discountedPrice || 0,
        });
      }
    }
  } catch (e) { console.error("WB prices fetch error:", e); }

  return allCards.map(card => {
    const prices = priceMap.get(card.nmID) || {};
    return {
      offerId: card.vendorCode || card.nmID?.toString() || '',
      nmID: card.nmID,
      name: card.title || card.vendorCode || '',
      price: prices.salePrice || prices.price || 0,
      originalPrice: prices.price || 0,
      discount: prices.discount || 0,
      currency: 'RUB',
      category: card.subjectName || '',
      marketplace: 'wildberries',
      commissionPercent: 15, // WB average ~15%
      logisticsCost: 50, // ~50 RUB logistics
    };
  });
}

// ===== Apply prices to Yandex =====
async function applyYandexPrice(credentials: any, offerId: string, newPrice: number): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) return { success: false, message: 'Business ID topilmadi' };

  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-prices/updates`,
    {
      method: 'POST', headers,
      body: JSON.stringify({
        offers: [{ offerId, price: { value: newPrice, currencyId: 'RUR' } }]
      })
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: `Yandex narx yangilandi: ${newPrice} UZS` };
}

// ===== Apply prices to WB =====
async function applyWBPrice(credentials: any, nmID: number, newPrice: number): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const resp = await fetchWithRetry(
    `https://discounts-prices-api.wildberries.ru/api/v2/upload/task`,
    {
      method: 'POST', headers,
      body: JSON.stringify({ data: [{ nmID, price: newPrice }] })
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: `WB narx yangilandi: ${newPrice} RUB` };
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
    const { data: costPrices } = await supabase
      .from('marketplace_cost_prices')
      .select('*')
      .eq('user_id', partnerId);

    const costMap = new Map<string, number>();
    for (const cp of (costPrices || [])) {
      costMap.set(`${cp.marketplace}-${cp.offer_id}`, cp.cost_price);
    }

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
      const userTargetMargin = targetMargin || 12; // Default 12%

      for (const conn of connections) {
        try {
          let creds: any;
          if (conn.encrypted_credentials) {
            const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
            creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          } else {
            creds = conn.credentials || {};
          }

          let products: any[] = [];
          if (conn.marketplace === 'yandex') products = await fetchYandexPrices(creds);
          else if (conn.marketplace === 'wildberries') products = await fetchWBPrices(creds);

          for (const p of products) {
            const costPrice = costMap.get(`${p.marketplace}-${p.offerId}`) || 0;
            const commissionPercent = p.commissionPercent || 10;
            const logisticsCost = p.logisticsCost || 0;
            
            // Haqiqiy marja hisoblash: (Price - Cost - Logistics - Commission - Tax) / Price * 100
            let actualMargin: number | null = null;
            if (costPrice > 0 && p.price > 0) {
              const commission = p.price * commissionPercent / 100;
              const tax = p.price * 4 / 100; // 4% tax
              const netProfit = p.price - costPrice - logisticsCost - commission - tax;
              actualMargin = Math.round((netProfit / p.price) * 100);
            }

            // Optimal narx hisoblash
            const optimal = calculateOptimalPrice(costPrice, commissionPercent, logisticsCost, userTargetMargin);
            
            // Narx holati
            const isPriceHigh = costPrice > 0 && p.price > optimal.maxPrice; // Narx juda baland - sotuv tushadi
            const isPriceLow = costPrice > 0 && p.price < optimal.minPrice; // Narx past - zarar
            const isPriceRisky = costPrice > 0 && (actualMargin !== null && actualMargin < 5);

            allProducts.push({
              ...p,
              costPrice,
              margin: actualMargin,
              commissionPercent,
              logisticsCost,
              optimalPrice: optimal.recommendedPrice,
              minPrice: optimal.minPrice,
              maxPrice: optimal.maxPrice,
              optimalMargin: optimal.marginPercent,
              isPriceHigh, // Sotuv tushishi mumkin
              isPriceLow,  // Zarar
              isPriceRisky,
              priceAction: costPrice <= 0 ? 'no_cost' 
                : p.price < optimal.minPrice ? 'increase' 
                : p.price > optimal.maxPrice ? 'decrease' 
                : 'ok',
            });
          }
        } catch (e) {
          console.error(`Price scan error for ${conn.marketplace}:`, e);
        }
      }

      const withCost = allProducts.filter(p => p.costPrice > 0);
      const avgMargin = withCost.length > 0 ? Math.round(withCost.reduce((s, p) => s + (p.margin || 0), 0) / withCost.length) : 0;

      return new Response(JSON.stringify({
        success: true,
        products: allProducts.sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100)),
        summary: {
          totalProducts: allProducts.length,
          withCostPrice: withCost.length,
          avgMargin,
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

      for (const product of (products || []).slice(0, 30)) {
        const costPrice = costMap.get(`${product.marketplace}-${product.offerId}`) || product.costPrice || 0;
        const commissionPercent = product.commissionPercent || 10;
        const logisticsCost = product.logisticsCost || 0;
        const userMargin = targetMargin || 12;

        if (costPrice <= 0) {
          recommendations.push({
            offerId: product.offerId,
            name: product.name,
            currentPrice: product.price,
            marketplace: product.marketplace,
            nmID: product.nmID,
            costPrice: 0,
            recommendation: {
              recommendedPrice: 0,
              minPrice: 0,
              maxPrice: 0,
              reasoning: 'Tannarx kiritilmagan',
              marginPercent: 0,
              priceAction: 'no_cost',
            },
          });
          continue;
        }

        const optimal = calculateOptimalPrice(costPrice, commissionPercent, logisticsCost, userMargin);
        
        let priceAction: string;
        let reasoning: string;
        
        if (product.price < optimal.minPrice) {
          priceAction = 'increase';
          reasoning = `Joriy narx (${product.price}) minimal narxdan (${optimal.minPrice}) past. Zarar qilmoqdasiz. Narxni ${optimal.recommendedPrice} ga ko'taring.`;
        } else if (product.price > optimal.maxPrice) {
          priceAction = 'decrease';
          reasoning = `Joriy narx (${product.price}) juda baland. Raqobatchilar past narxda sotmoqda. Narxni ${optimal.recommendedPrice} ga tushiring - sotuv oshadi.`;
        } else {
          priceAction = 'keep';
          reasoning = `Narx optimal diapazon ichida (${optimal.minPrice}-${optimal.maxPrice}). Marja ${optimal.marginPercent}%.`;
        }

        recommendations.push({
          offerId: product.offerId,
          name: product.name,
          currentPrice: product.price,
          marketplace: product.marketplace,
          nmID: product.nmID,
          costPrice,
          recommendation: {
            recommendedPrice: optimal.recommendedPrice,
            minPrice: optimal.minPrice,
            maxPrice: optimal.maxPrice,
            reasoning,
            marginPercent: optimal.marginPercent,
            priceAction,
            commissionPercent,
            logisticsCost,
            taxPercent: 4,
            targetMargin: userMargin,
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
        return new Response(JSON.stringify({ error: 'priceUpdates kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let applied = 0;
      let failed = 0;
      const results: any[] = [];

      for (const update of priceUpdates.slice(0, 30)) {
        try {
          const creds = await getCredsForMarketplace(update.marketplace);
          if (!creds) {
            results.push({ offerId: update.offerId, success: false, message: 'Credentials topilmadi' });
            failed++;
            continue;
          }

          let result;
          if (update.marketplace === 'yandex') {
            result = await applyYandexPrice(creds, update.offerId, update.newPrice);
          } else if (update.marketplace === 'wildberries' && update.nmID) {
            result = await applyWBPrice(creds, update.nmID, update.newPrice);
          } else {
            result = { success: false, message: `${update.marketplace} qo'llab-quvvatlanmaydi` };
          }

          results.push({ offerId: update.offerId, ...result });
          if (result.success) applied++;
          else failed++;

          await sleep(500);
        } catch (e) {
          console.error(`Apply price error for ${update.offerId}:`, e);
          results.push({ offerId: update.offerId, success: false, message: (e as any).message || 'Xatolik' });
          failed++;
        }
      }

      return new Response(JSON.stringify({ success: true, applied, failed, results }), {
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
