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

// AI-powered price recommendation
async function getAIPriceRecommendation(product: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Sen marketplace narx optimallashtirish ekspertisan. FAQAT JSON javob ber." },
          { role: "user", content: `Mahsulot: "${product.name}"
Kategoriya: ${product.category || 'Noma\'lum'}
Hozirgi narx: ${product.price} ${product.currency || 'UZS'}
Tannarx: ${product.costPrice || 'Noma\'lum'}
Raqobatchilar narxi: ${product.competitorPrices?.join(', ') || 'Ma\'lumot yo\'q'}

Optimal narx tavsiya qil. FAQAT JSON:
{
  "recommendedPrice": 150000,
  "minPrice": 120000,
  "maxPrice": 200000,
  "reasoning": "qisqa sabab",
  "marginPercent": 25,
  "priceAction": "increase|decrease|keep"
}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch (e) {
    console.error("AI price recommendation error:", e);
    return null;
  }
}

// Fetch Yandex product prices and competitor info
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

  // Fetch offers with prices
  let allMappings: any[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
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

  return allMappings.map((entry: any) => {
    const offer = entry.offer || {};
    const mapping = entry.mapping || {};
    return {
      offerId: offer.offerId || '',
      name: offer.name || '',
      price: offer.basicPrice?.value || offer.price || 0,
      currency: offer.basicPrice?.currencyId || 'RUR',
      category: mapping.marketCategoryName || '',
      marketplace: 'yandex',
    };
  });
}

// Fetch WB product prices
async function fetchWBPrices(credentials: any): Promise<any[]> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  let allCards: any[] = [];
  let cursor: any = { limit: 100 };
  for (let page = 0; page < 10; page++) {
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
  const nmIDs = allCards.map(c => c.nmID).filter(Boolean);
  let priceMap = new Map<number, any>();
  if (nmIDs.length > 0) {
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
  }

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
    };
  });
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
    const { partnerId, action } = body;

    if (!partnerId) {
      return new Response(JSON.stringify({ error: 'partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get marketplace connections
    const { data: connections } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', partnerId)
      .eq('is_active', true);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: 'Ulanish topilmadi' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get cost prices from DB
    const { data: costPrices } = await supabase
      .from('marketplace_cost_prices')
      .select('*')
      .eq('user_id', partnerId);

    const costMap = new Map<string, number>();
    for (const cp of (costPrices || [])) {
      costMap.set(`${cp.marketplace}-${cp.offer_id}`, cp.cost_price);
    }

    if (action === 'scan') {
      const allProducts: any[] = [];

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

          // Enrich with cost prices and calculate margins
          for (const p of products) {
            const costPrice = costMap.get(`${p.marketplace}-${p.offerId}`) || 0;
            const margin = costPrice > 0 && p.price > 0 ? Math.round(((p.price - costPrice) / p.price) * 100) : null;
            allProducts.push({
              ...p,
              costPrice,
              margin,
              isPriceRisky: margin !== null && margin < 15,
              isPriceLow: margin !== null && margin < 5,
            });
          }
        } catch (e) {
          console.error(`Price scan error for ${conn.marketplace}:`, e);
        }
      }

      // Summary stats
      const withCost = allProducts.filter(p => p.costPrice > 0);
      const avgMargin = withCost.length > 0 ? Math.round(withCost.reduce((s, p) => s + (p.margin || 0), 0) / withCost.length) : 0;
      const riskyCount = allProducts.filter(p => p.isPriceRisky).length;
      const lowCount = allProducts.filter(p => p.isPriceLow).length;

      return new Response(JSON.stringify({
        success: true,
        products: allProducts.sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100)),
        summary: {
          totalProducts: allProducts.length,
          withCostPrice: withCost.length,
          avgMargin,
          riskyCount,
          lowMarginCount: lowCount,
          noCostPrice: allProducts.length - withCost.length,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'recommend') {
      // AI price recommendation for specific products
      const { products } = body;
      const recommendations: any[] = [];

      for (const product of (products || []).slice(0, 10)) {
        const costPrice = costMap.get(`${product.marketplace}-${product.offerId}`) || product.costPrice || 0;
        const rec = await getAIPriceRecommendation({ ...product, costPrice });
        recommendations.push({
          offerId: product.offerId,
          name: product.name,
          currentPrice: product.price,
          costPrice,
          recommendation: rec,
        });
        await sleep(300);
      }

      return new Response(JSON.stringify({ success: true, recommendations }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'action kerak (scan | recommend)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent price error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
