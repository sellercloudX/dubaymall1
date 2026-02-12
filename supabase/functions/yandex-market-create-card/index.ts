import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============ TYPES ============

interface ProductInput {
  name: string;
  description?: string;
  category?: string;
  price: number;
  costPrice: number;
  image?: string;
  images?: string[];
  sourceUrl?: string;
  brand?: string;
  color?: string;
  model?: string;
  barcode?: string;
  mxikCode?: string;
  mxikName?: string;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
}

interface PricingInput {
  costPrice: number;
  marketplaceCommission: number;
  logisticsCost: number;
  taxRate: number;
  targetProfit: number;
  recommendedPrice: number;
  netProfit: number;
}

interface CreateCardRequest {
  shopId?: string;
  product: ProductInput;
  pricing: PricingInput;
  // Batch mode: multiple products at once
  products?: ProductInput[];
}

// ============ HELPERS ============

/** Generate EAN-13 barcode (200-prefix = internal use) */
function generateEAN13(): string {
  let code = "200";
  for (let i = 0; i < 9; i++) code += Math.floor(Math.random() * 10).toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  return code + ((10 - (sum % 10)) % 10).toString();
}

/** Generate short SKU */
function generateSKU(name: string): string {
  const words = name.split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${rnd}-${ts}`;
}

/** Estimate package dimensions by category */
function estimateDimensions(category: string): { length: number; width: number; height: number; weight: number } {
  const dims: Record<string, { length: number; width: number; height: number; weight: number }> = {
    phone: { length: 18, width: 10, height: 6, weight: 0.3 },
    laptop: { length: 40, width: 30, height: 5, weight: 2.5 },
    tablet: { length: 28, width: 22, height: 4, weight: 0.8 },
    headphones: { length: 22, width: 18, height: 8, weight: 0.4 },
    speaker: { length: 25, width: 15, height: 15, weight: 1.2 },
    smartwatch: { length: 12, width: 10, height: 8, weight: 0.2 },
    watch: { length: 12, width: 10, height: 8, weight: 0.2 },
    camera: { length: 20, width: 15, height: 12, weight: 0.8 },
    tv: { length: 120, width: 75, height: 15, weight: 15 },
    clothing: { length: 35, width: 25, height: 5, weight: 0.4 },
    shoes: { length: 35, width: 22, height: 14, weight: 1 },
    bag: { length: 40, width: 30, height: 15, weight: 0.8 },
    cosmetics: { length: 15, width: 10, height: 8, weight: 0.15 },
    perfume: { length: 12, width: 8, height: 15, weight: 0.2 },
    toys: { length: 30, width: 25, height: 15, weight: 0.5 },
    tools: { length: 35, width: 25, height: 10, weight: 2 },
    massage: { length: 45, width: 35, height: 15, weight: 1.8 },
    default: { length: 30, width: 20, height: 15, weight: 1 },
  };
  return dims[category] || dims.default;
}

/** Detect product category from name */
function detectCategory(name: string, desc?: string): string {
  const text = `${name} ${desc || ""}`.toLowerCase();
  const map: [string, string[]][] = [
    ["massage", ["массаж", "massaj", "massager"]],
    ["phone", ["телефон", "phone", "смартфон", "iphone", "samsung galaxy"]],
    ["laptop", ["ноутбук", "laptop", "macbook"]],
    ["tablet", ["планшет", "tablet", "ipad"]],
    ["headphones", ["наушник", "headphone", "airpods", "quloqchin"]],
    ["speaker", ["колонк", "speaker", "karnay"]],
    ["smartwatch", ["смарт часы", "smart watch", "apple watch"]],
    ["watch", ["часы", "watch", "soat"]],
    ["camera", ["камер", "camera", "фотоаппарат"]],
    ["tv", ["телевизор", "tv", "televizor"]],
    ["clothing", ["одежд", "kiyim", "футболк", "штан", "платье", "куртк"]],
    ["shoes", ["обувь", "shoes", "poyabzal", "кроссовк"]],
    ["bag", ["сумк", "bag", "рюкзак"]],
    ["cosmetics", ["косметик", "cosmetic", "крем", "помад"]],
    ["perfume", ["парфюм", "perfume", "духи"]],
    ["toys", ["игруш", "toy", "o'yinchoq"]],
    ["tools", ["инструмент", "tool", "дрель", "молоток", "matkap"]],
  ];
  for (const [cat, keywords] of map) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return "default";
}

/** MXIK code lookup from database */
async function lookupMXIK(supabase: any, name: string): Promise<{ code: string; name_uz: string }> {
  const DEFAULT = { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
  try {
    const keywords = name.toLowerCase().replace(/[^\w\s\u0400-\u04FF]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    for (const kw of keywords) {
      const { data } = await supabase.from('mxik_codes').select('code, name_uz').or(`name_uz.ilike.%${kw}%,name_ru.ilike.%${kw}%`).eq('is_active', true).limit(1);
      if (data?.length) return data[0];
    }
  } catch (e) { console.error('MXIK lookup failed:', e); }
  return DEFAULT;
}

/** Yandex Market category IDs */
const YANDEX_CATEGORIES: Record<string, { id: number; name: string }> = {
  phone: { id: 91491, name: "Смартфоны" },
  laptop: { id: 91013, name: "Ноутбуки" },
  tablet: { id: 6427100, name: "Планшеты" },
  headphones: { id: 90555, name: "Наушники и гарнитуры" },
  speaker: { id: 90556, name: "Портативная акустика" },
  smartwatch: { id: 10498025, name: "Умные часы и браслеты" },
  watch: { id: 7811901, name: "Наручные часы" },
  camera: { id: 90606, name: "Фотоаппараты" },
  tv: { id: 90639, name: "Телевизоры" },
  clothing: { id: 7811873, name: "Одежда" },
  shoes: { id: 7811882, name: "Обувь" },
  bag: { id: 7812078, name: "Сумки" },
  cosmetics: { id: 90509, name: "Декоративная косметика" },
  perfume: { id: 90510, name: "Парфюмерия" },
  toys: { id: 90764, name: "Игрушки" },
  tools: { id: 90719, name: "Инструменты" },
  massage: { id: 966945, name: "Массажеры" },
  default: { id: 198119, name: "Электроника" },
};

/** Get Yandex credentials from user's marketplace_connections */
async function getYandexCredentials(supabase: any, userId: string): Promise<{
  apiKey: string; campaignId: string; businessId: string; shopId?: string;
} | null> {
  const { data: connection } = await supabase
    .from("marketplace_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("marketplace", "yandex")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!connection) return null;

  let apiKey = "", campaignId = "", businessId = "";

  if (connection.encrypted_credentials) {
    const { data, error } = await supabase.rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
    if (!error && data) {
      const c = data as any;
      apiKey = c.apiKey || "";
      campaignId = c.campaignId || c.sellerId || "";
      businessId = c.businessId || "";
    }
  } else {
    const c = connection.credentials as any;
    apiKey = c?.apiKey || "";
    campaignId = c?.campaignId || c?.sellerId || "";
    businessId = c?.businessId || "";
  }

  // Fallback: get businessId from campaign API
  if (apiKey && campaignId && !businessId) {
    try {
      const resp = await fetch(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, {
        headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      });
      if (resp.ok) {
        const d = await resp.json();
        businessId = d.campaign?.business?.id?.toString() || "";
      }
    } catch (e) { console.error("Failed to get businessId:", e); }
  }

  if (!apiKey || !businessId) return null;

  return { apiKey, campaignId, businessId, shopId: connection.shop_id };
}

/** AI-powered card optimization — fills all Excel template fields */
async function optimizeWithAI(
  product: ProductInput,
  categoryName: string,
  lovableApiKey: string
): Promise<any> {
  const prompt = `Sen Yandex Market uchun professional kartochka yaratuvchisan. 
Quyidagi mahsulot uchun BARCHA maydonlarni to'ldir. Javobni FAQAT JSON formatda ber.

Mahsulot: ${product.name}
Tavsif: ${product.description || "Yo'q"}
Kategoriya: ${categoryName}
Brend: ${product.brand || "Aniqlanmagan"}

Talablar:
1. name_ru: Ruscha nom — TIP + BREND + MODEL formatida, 50-60 belgi
2. name_uz: O'zbekcha nom (lotin) — xuddi shunday format
3. description_ru: Ruscha tavsif, 400-600 belgi, HTML teglarisiz, foydalanuvchiga foydali
4. description_uz: O'zbekcha tavsif (lotin), 300-500 belgi, HTML teglarisiz
5. vendor: Brend nomi (aniq)
6. vendorCode: Ishlab chiqaruvchi artikuli
7. manufacturerCountry: Ishlab chiqarilgan mamlakat (ruscha)
8. tags: 5-10 ta teglar (vergul bilan)
9. params: Kamida 8 ta xususiyat [{name, value}] formatida
10. warranty: Kafolat muddati (masalan, "1 yil")
11. shelfLife: Yaroqlilik muddati (agar tegishli bo'lsa)

MUHIM: HTML teglarini (<br/>, <br>, <p> va h.k.) ISHLATMA. Faqat oddiy matn.

JSON:
{
  "name_ru": "...",
  "name_uz": "...",
  "description_ru": "...",
  "description_uz": "...",
  "vendor": "...",
  "vendorCode": "...",
  "manufacturerCountry": "...",
  "tags": ["tag1", "tag2"],
  "params": [{"name": "Rang", "value": "..."}, {"name": "Material", "value": "..."}],
  "warranty": "1 yil",
  "shelfLife": null,
  "adult": false
}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      console.error("AI optimization failed:", resp.status);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("AI optimization error:", e);
  }
  return null;
}

/** Remove HTML tags from text */
function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Build Yandex offer-mappings/update payload */
function buildYandexOffer(
  product: ProductInput,
  ai: any,
  sku: string,
  barcode: string,
  category: { id: number; name: string },
  dims: { length: number; width: number; height: number; weight: number },
  mxik: { code: string; name_uz: string },
  price: number
): any {
  const images = (product.images || []).filter(img => img?.startsWith('http')).slice(0, 10);
  if (!images.length && product.image?.startsWith('http')) images.push(product.image);

  const name = stripHtml(ai?.name_ru || product.name);
  const description = stripHtml(ai?.description_ru || product.description || product.name);

  const offer: any = {
    offerId: sku,
    name: name.substring(0, 150),
    marketCategoryId: category.id,
    pictures: images,
    vendor: ai?.vendor || product.brand || "OEM",
    description: description.substring(0, 6000),
    barcodes: [barcode],
    vendorCode: ai?.vendorCode || sku,
    manufacturerCountries: [ai?.manufacturerCountry || "Китай"],
    weightDimensions: {
      length: product.dimensions?.length || dims.length,
      width: product.dimensions?.width || dims.width,
      height: product.dimensions?.height || dims.height,
      weight: product.weight || dims.weight,
    },
    basicPrice: {
      value: price,
      currencyId: "UZS",
    },
    customsCommodityCode: mxik.code,
    type: "DEFAULT",
    adult: ai?.adult || false,
  };

  // Tags
  if (ai?.tags?.length) {
    offer.tags = ai.tags.slice(0, 10);
  }

  // Parameters (xususiyatlar)
  if (ai?.params?.length) {
    offer.params = ai.params
      .filter((p: any) => p.name && p.value)
      .map((p: any) => ({ name: p.name, value: String(p.value) }))
      .slice(0, 30);
  }

  // Warranty
  if (ai?.warranty) {
    const match = ai.warranty.match(/(\d+)\s*(yil|year|месяц|month|oy)/i);
    if (match) {
      const period = parseInt(match[1]);
      const isYear = /yil|year/i.test(match[2]);
      offer.guaranteePeriod = {
        timePeriod: isYear ? period * 12 : period,
        timeUnit: "MONTH",
      };
    }
  }

  // Clean undefined/null/empty values
  for (const key of Object.keys(offer)) {
    const v = offer[key];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
      delete offer[key];
    }
  }

  return offer;
}

/** Calculate card quality score */
function calculateQuality(offer: any, ai: any): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {
    name: (offer.name?.length || 0) >= 50 ? 15 : (offer.name?.length || 0) >= 30 ? 10 : 5,
    description: (offer.description?.length || 0) >= 400 ? 15 : (offer.description?.length || 0) >= 200 ? 10 : 5,
    pictures: (offer.pictures?.length || 0) >= 5 ? 15 : (offer.pictures?.length || 0) >= 3 ? 10 : (offer.pictures?.length || 0) >= 1 ? 5 : 0,
    category: offer.marketCategoryId !== 198119 ? 10 : 5,
    parameters: (offer.params?.length || 0) >= 10 ? 15 : (offer.params?.length || 0) >= 5 ? 10 : 5,
    dimensions: offer.weightDimensions ? 10 : 0,
    barcode: offer.barcodes?.length ? 5 : 0,
    vendor: offer.vendor && offer.vendor !== "OEM" ? 5 : 3,
    country: offer.manufacturerCountries?.length ? 5 : 0,
    warranty: offer.guaranteePeriod ? 5 : 0,
  };
  return { score: Object.values(b).reduce((a, v) => a + v, 0), breakdown: b };
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Yandex credentials
    const creds = await getYandexCredentials(supabase, user.id);
    if (!creds) {
      return new Response(JSON.stringify({ error: "Yandex Market ulanmagan. Avval marketplace'ni ulang." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: CreateCardRequest = await req.json();

    // Support both single and batch mode
    const productsList = body.products || [body.product];
    if (!productsList.length || !productsList[0]) {
      return new Response(JSON.stringify({ error: "Product data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user's shop
    let shopId = creds.shopId || body.shopId;
    if (!shopId || shopId === "sellercloud") {
      const { data: userShop } = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1).single();
      shopId = userShop?.id || null;
    }

    console.log(`🚀 Creating ${productsList.length} Yandex Market card(s) for user ${user.id}`);

    const results: any[] = [];

    for (const product of productsList) {
      try {
        const pricing = body.pricing || {
          costPrice: product.costPrice || Math.round(product.price * 0.6),
          recommendedPrice: product.price,
          marketplaceCommission: Math.round(product.price * 0.15),
          logisticsCost: 3000,
          taxRate: 4,
          targetProfit: Math.round(product.price * 0.2),
          netProfit: Math.round(product.price * 0.2),
        };

        // 1. Detect category
        const cat = detectCategory(product.name, product.description);
        const yandexCat = YANDEX_CATEGORIES[cat] || YANDEX_CATEGORIES.default;

        // 2. Generate identifiers
        const sku = generateSKU(product.name);
        const barcode = product.barcode || generateEAN13();

        // 3. MXIK lookup
        const mxik = (product.mxikCode && product.mxikName)
          ? { code: product.mxikCode, name_uz: product.mxikName }
          : await lookupMXIK(supabase, product.name);

        // 4. AI optimization (fills all Excel template fields)
        let aiData: any = null;
        if (LOVABLE_API_KEY) {
          aiData = await optimizeWithAI(product, yandexCat.name, LOVABLE_API_KEY);
          if (aiData) console.log("✅ AI filled all fields for:", product.name);
        }

        // 5. Estimate dimensions
        const dims = estimateDimensions(cat);

        // 6. Build Yandex API payload
        const offer = buildYandexOffer(
          product, aiData, sku, barcode, yandexCat, dims, mxik,
          pricing.recommendedPrice
        );

        // 7. Send to Yandex Market API
        console.log(`📤 Sending "${offer.name}" to Yandex...`);
        
        const yandexResp = await fetch(
          `https://api.partner.market.yandex.ru/v2/businesses/${creds.businessId}/offer-mappings/update`,
          {
            method: "POST",
            headers: {
              "Api-Key": creds.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              offerMappings: [{ offer }]
            }),
          }
        );

        const respText = await yandexResp.text();
        let yandexResult: any;
        try { yandexResult = JSON.parse(respText); } catch { yandexResult = { raw: respText }; }

        const { score: quality, breakdown } = calculateQuality(offer, aiData);

        // 8. Save to local DB
        let savedProduct = null;
        if (shopId) {
          const { data, error: saveErr } = await supabase
            .from("products")
            .insert({
              shop_id: shopId,
              name: product.name,
              description: stripHtml(aiData?.description_uz || aiData?.description_ru || product.description || ""),
              price: pricing.recommendedPrice,
              original_price: pricing.costPrice,
              source: "ai" as any,
              source_url: product.sourceUrl,
              images: offer.pictures || [],
              status: "draft" as any,
              mxik_code: mxik.code,
              mxik_name: mxik.name_uz,
              specifications: {
                yandex_offer_id: sku,
                yandex_business_id: creds.businessId,
                yandex_category_id: yandexCat.id,
                yandex_category_name: yandexCat.name,
                yandex_status: yandexResp.ok ? "success" : "error",
                yandex_card_quality: quality,
                barcode,
                vendor: offer.vendor,
                dimensions: offer.weightDimensions,
                name_uz: aiData?.name_uz,
                name_ru: aiData?.name_ru,
                description_uz: aiData?.description_uz,
                tags: aiData?.tags,
                params_count: offer.params?.length || 0,
              },
            })
            .select()
            .single();

          if (!saveErr) savedProduct = data;
          else console.error("Local save error:", saveErr);
        }

        const cardUrl = yandexResp.ok
          ? `https://partner.market.yandex.ru/business/${creds.businessId}/assortment/offer/${encodeURIComponent(sku)}`
          : `https://partner.market.yandex.ru/business/${creds.businessId}/assortment`;

        results.push({
          success: yandexResp.ok,
          offerId: sku,
          barcode,
          name: offer.name,
          nameUz: aiData?.name_uz,
          cardUrl,
          cardQuality: quality,
          qualityBreakdown: breakdown,
          category: yandexCat.name,
          mxikCode: mxik.code,
          yandexResponse: yandexResult,
          localProductId: savedProduct?.id,
          error: yandexResp.ok ? null : (yandexResult?.errors?.[0]?.message || yandexResult?.message || `HTTP ${yandexResp.status}`),
        });

        console.log(`${yandexResp.ok ? "✅" : "❌"} ${product.name}: quality=${quality}, status=${yandexResp.status}`);

        // Rate limit: 500ms delay between products
        if (productsList.length > 1) {
          await new Promise(r => setTimeout(r, 500));
        }

      } catch (err: any) {
        console.error(`❌ Error processing "${product.name}":`, err);
        results.push({
          success: false,
          name: product.name,
          error: err.message || "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        total: results.length,
        successCount,
        failedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Card creation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
