import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YANDEX_API = "https://api.partner.market.yandex.ru/v2";

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
  products?: ProductInput[];
}

// ============ HELPERS ============

function generateEAN13(): string {
  let code = "200";
  for (let i = 0; i < 9; i++) code += Math.floor(Math.random() * 10).toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  return code + ((10 - (sum % 10)) % 10).toString();
}

function generateSKU(name: string): string {
  const words = name.split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${rnd}-${ts}`;
}

function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function estimateDimensions(category: string) {
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

async function getYandexCredentials(supabase: any, userId: string) {
  const { data: connection } = await supabase
    .from("marketplace_connections").select("*")
    .eq("user_id", userId).eq("marketplace", "yandex").eq("is_active", true)
    .limit(1).single();
  if (!connection) return null;

  let apiKey = "", campaignId = "", businessId = "";
  if (connection.encrypted_credentials) {
    const { data, error } = await supabase.rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
    if (!error && data) {
      const c = data as any;
      apiKey = c.apiKey || ""; campaignId = c.campaignId || c.sellerId || ""; businessId = c.businessId || "";
    }
  } else {
    const c = connection.credentials as any;
    apiKey = c?.apiKey || ""; campaignId = c?.campaignId || c?.sellerId || ""; businessId = c?.businessId || "";
  }

  if (apiKey && campaignId && !businessId) {
    try {
      const resp = await fetch(`${YANDEX_API.replace('/v2', '')}/campaigns/${campaignId}`, {
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

// ============ FETCH CATEGORY PARAMETERS FROM YANDEX ============

async function fetchCategoryParameters(apiKey: string, categoryId: number): Promise<any[]> {
  try {
    const resp = await fetch(`${YANDEX_API}/category/${categoryId}/parameters`, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!resp.ok) {
      console.error(`Failed to fetch category params: ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const params = data.result?.parameters || [];
    console.log(`📋 Raw params count: ${params.length}`);
    return params;
  } catch (e) {
    console.error("Category params fetch error:", e);
    return [];
  }
}

// ============ AI OPTIMIZATION WITH CATEGORY PARAMETERS ============

async function optimizeWithAI(
  product: ProductInput,
  categoryName: string,
  categoryParams: any[],
  lovableApiKey: string
): Promise<any> {
  // Separate params into groups for clarity
  const requiredParams = categoryParams.filter((p: any) => p.required || p.constraintType === "REQUIRED");
  const recommendedParams = categoryParams.filter((p: any) => !p.required && p.constraintType !== "REQUIRED");

  // Build DETAILED parameter list for AI - ALL parameters, not just 50
  const formatParam = (p: any) => {
    let desc = `  - parameterId: ${p.id}, name: "${p.name}", type: ${p.type || "TEXT"}`;
    if (p.unit) desc += `, unit: "${p.unit}"`;
    if (p.values?.length) {
      const vals = p.values.slice(0, 15).map((v: any) => `{valueId:${v.id}, value:"${v.value}"}`).join(", ");
      desc += `\n    OPTIONS: [${vals}]`;
      if (p.values.length > 15) desc += ` ... +${p.values.length - 15} more`;
    }
    return desc;
  };

  const requiredList = requiredParams.map(formatParam).join("\n");
  const recommendedList = recommendedParams.slice(0, 60).map(formatParam).join("\n");

  const prompt = `Sen Yandex Market uchun PROFESSIONAL kartochka yaratuvchi AI san. Sening vazifang — mahsulot kartochkasini 95+ ball sifatida yaratish.

MAHSULOT MA'LUMOTLARI:
- Nomi: ${product.name}
- Tavsif: ${product.description || "Tavsif yo'q — o'zing yoz!"}
- Kategoriya: ${categoryName}
- Brend: ${product.brand || "Mahsulot nomidan aniqla"}
- Rang: ${product.color || "Mahsulot nomidan aniqla"}
- Model: ${product.model || "Mahsulot nomidan aniqla"}
- Narx: ${product.price} UZS

════════════════════════════════════════
MAJBURIY PARAMETRLAR (BARCHASINI TO'LDIR!):
${requiredList || "Yo'q"}

TAVSIYA ETILGAN PARAMETRLAR (IMKON QADAR BARCHASINI TO'LDIR!):
${recommendedList || "Yo'q"}
════════════════════════════════════════

QOIDALAR:
1. name_ru: Ruscha SEO-nom. ANIQ FORMAT: "[Tovar turi] [Brend] [Model] [Asosiy xususiyatlar]"
   MINIMUM 60 belgi, MAKSIMUM 150 belgi.
   Misol: "Смартфон Samsung Galaxy A55 5G 8/128 ГБ, экран Super AMOLED 6.6\", камера 50 Мп, аккумулятор 5000 мАч, синий"

2. name_uz: O'zbekcha nom LOTIN alifbosida, xuddi shunday batafsil, 60-150 belgi.
   Misol: "Samsung Galaxy A55 5G smartfoni, 8/128 GB, Super AMOLED 6.6\" ekran, 50 MP kamera, 5000 mAh batareya, ko'k"

3. description_ru: Batafsil ruscha tavsif, 800-3000 belgi. HTML TEGLARISIZ!
   Tarkibi: Umumiy, Texnik xususiyatlar, Kamera, Batareya, Ekran, Qo'shimcha ma'lumot.

4. description_uz: O'zbekcha (LOTIN) batafsil tavsif, 600-2000 belgi. HTML TEGLARISIZ!

5. vendor: Brend nomi (Samsung, Apple, Xiaomi va h.k.)
6. vendorCode: Model artikuli (masalan "SM-A556E")
7. manufacturerCountry: Ishlab chiqarilgan mamlakat ruscha

8. parameterValues: *** ENG MUHIM QISM! ***
   Har bir parametr uchun:
   - Agar OPTIONS ro'yxati bo'lsa → valueId ishlatilsin (faqat ro'yxatdagi qiymatlardan!)
   - Agar TEXT turi bo'lsa → value ishlatilsin
   - Agar raqamli bo'lsa → value raqam sifatida berilsin
   
   *** BARCHA MAJBURIY PARAMETRLARNI TO'LDIR ***
   *** TAVSIYA ETILGANLARDAN HAM KAMIDA 20 TASINI TO'LDIR ***
   *** JAMI KAMIDA 25 TA PARAMETR BO'LISHI SHART ***

9. warranty: Kafolat (masalan "1 год")

JAVOB FAQAT JSON:
{
  "name_ru": "...",
  "name_uz": "...",
  "description_ru": "...",
  "description_uz": "...",
  "vendor": "...",
  "vendorCode": "...",
  "manufacturerCountry": "...",
  "parameterValues": [
    {"parameterId": 123, "valueId": 456},
    {"parameterId": 789, "value": "qiymat"}
  ],
  "warranty": "1 год",
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
        temperature: 0.2,
        max_tokens: 4000,
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
      const result = JSON.parse(jsonMatch[0]);
      console.log(`🤖 AI result: name_ru=${result.name_ru?.length}ch, name_uz=${result.name_uz?.length}ch, params=${result.parameterValues?.length}`);
      return result;
    }
  } catch (e) {
    console.error("AI optimization error:", e);
  }
  return null;
}

// ============ BUILD YANDEX OFFER ============

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
  // Collect ALL available images
  const allImages: string[] = [];
  if (product.images?.length) {
    for (const img of product.images) {
      if (img && typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
        allImages.push(img);
      }
    }
  }
  if (product.image && typeof product.image === 'string' && (product.image.startsWith('http://') || product.image.startsWith('https://')) && !allImages.includes(product.image)) {
    allImages.unshift(product.image);
  }
  const images = allImages.slice(0, 10);

  const name = stripHtml(ai?.name_ru || product.name);
  const description = stripHtml(ai?.description_ru || product.description || product.name);

  const offer: any = {
    offerId: sku,
    name: name.length >= 50 ? name.substring(0, 150) : name.padEnd(50, ' ').substring(0, 150),
    marketCategoryId: category.id,
    vendor: ai?.vendor || product.brand || "OEM",
    description: description.length >= 500 ? description.substring(0, 6000) : description.substring(0, 6000),
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
    commodityCodes: [
      {
        code: mxik.code,
        type: "IKPU_CODE",
      }
    ],
    type: "DEFAULT",
    adult: ai?.adult || false,
  };

  // Add images only if we have them
  if (images.length > 0) {
    offer.pictures = images;
  }

  // parameterValues — fill ALL params from AI
  if (ai?.parameterValues?.length) {
    offer.parameterValues = ai.parameterValues
      .filter((p: any) => p.parameterId && (p.value !== undefined || p.valueId !== undefined))
      .map((p: any) => {
        const pv: any = { parameterId: Number(p.parameterId) };
        if (p.valueId !== undefined) pv.valueId = Number(p.valueId);
        else if (p.value !== undefined) pv.value = String(p.value);
        if (p.unitId) pv.unitId = String(p.unitId);
        return pv;
      });
    console.log(`📊 Total parameterValues: ${offer.parameterValues.length}`);
  }

  // Warranty
  if (ai?.warranty) {
    const match = ai.warranty.match(/(\d+)\s*(yil|year|год|месяц|month|oy)/i);
    if (match) {
      const period = parseInt(match[1]);
      const isYear = /yil|year|год/i.test(match[2]);
      offer.guaranteePeriod = {
        timePeriod: isYear ? period * 12 : period,
        timeUnit: "MONTH",
      };
    }
  }

  // Clean undefined/null (but keep empty arrays if needed)
  for (const key of Object.keys(offer)) {
    const v = offer[key];
    if (v === undefined || v === null) {
      delete offer[key];
    }
  }

  return offer;
}

// ============ SEND O'ZBEK LANGUAGE CONTENT ============

async function sendUzbekContent(
  apiKey: string,
  businessId: string,
  offerId: string,
  nameUz: string,
  descriptionUz: string
): Promise<boolean> {
  if (!nameUz && !descriptionUz) return false;
  
  try {
    const offer: any = { offerId };
    if (nameUz) offer.name = stripHtml(nameUz).substring(0, 150);
    if (descriptionUz) offer.description = stripHtml(descriptionUz).substring(0, 6000);

    const resp = await fetch(
      `${YANDEX_API}/businesses/${businessId}/offer-mappings/update?language=UZ`,
      {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offerMappings: [{ offer }]
        }),
      }
    );
    
    if (resp.ok) {
      console.log(`✅ O'zbek content sent for ${offerId}`);
      return true;
    } else {
      const text = await resp.text();
      console.error(`❌ O'zbek content failed: ${resp.status}`, text);
      return false;
    }
  } catch (e) {
    console.error("O'zbek content error:", e);
    return false;
  }
}

// ============ QUALITY SCORE ============

function calculateQuality(offer: any, ai: any): { score: number; breakdown: Record<string, number> } {
  const nameLen = offer.name?.length || 0;
  const descLen = offer.description?.length || 0;
  const picCount = offer.pictures?.length || 0;
  const paramCount = offer.parameterValues?.length || 0;

  const b: Record<string, number> = {
    // Nom: 0/10 ball. 50+ belgi = 10 ball
    name: nameLen >= 50 ? 10 : nameLen >= 30 ? 5 : 0,
    // Brend: 0/checkmark
    brand: offer.vendor && offer.vendor !== "OEM" ? 5 : 0,
    // Tavsif: 0/20 ball. 500+ = 20, 200+ = 10
    description: descLen >= 500 ? 20 : descLen >= 200 ? 10 : descLen >= 100 ? 5 : 0,
    // Rasmlar: 0/43 ball (1 rasm = 24, 3+ = 27, 5+ = 35, oltita+ = 43)
    pictures: picCount >= 6 ? 43 : picCount >= 5 ? 35 : picCount >= 3 ? 27 : picCount >= 1 ? 24 : 0,
    // Asosiy xususiyatlar: 0/12 ball
    basicParams: paramCount >= 8 ? 12 : paramCount >= 5 ? 8 : paramCount >= 3 ? 5 : 0,
    // Filtr uchun qo'shimcha: 0/8 ball
    filterParams: paramCount >= 12 ? 8 : paramCount >= 8 ? 5 : 0,
    // Tovar haqida batafsil: 0/5 ball
    detailParams: paramCount >= 15 ? 5 : paramCount >= 12 ? 3 : 0,
    // IKPU: checkmark
    ikpu: offer.commodityCodes?.length ? 2 : 0,
    // O'lchamlar
    dimensions: offer.weightDimensions ? 2 : 0,
    // Shtrix-kod
    barcode: offer.barcodes?.length ? 2 : 0,
    // Kafolat
    warranty: offer.guaranteePeriod ? 2 : 0,
  };
  return { score: Object.values(b).reduce((a, v) => a + v, 0), breakdown: b };
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const creds = await getYandexCredentials(supabase, user.id);
    if (!creds) {
      return new Response(JSON.stringify({ error: "Yandex Market ulanmagan. Avval marketplace'ni ulang." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: CreateCardRequest = await req.json();
    const productsList = body.products || [body.product];
    if (!productsList.length || !productsList[0]) {
      return new Response(JSON.stringify({ error: "Product data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

        // 4. *** NEW: Fetch Yandex category parameters ***
        console.log(`📋 Fetching parameters for category ${yandexCat.id} (${yandexCat.name})...`);
        const categoryParams = await fetchCategoryParameters(creds.apiKey, yandexCat.id);
        console.log(`📋 Got ${categoryParams.length} parameters for category`);

        // 5. AI optimization WITH category parameters
        let aiData: any = null;
        if (LOVABLE_API_KEY) {
          aiData = await optimizeWithAI(product, yandexCat.name, categoryParams, LOVABLE_API_KEY);
          if (aiData) {
            console.log(`✅ AI filled: name=${aiData.name_ru?.length || 0} chars, params=${aiData.parameterValues?.length || 0}`);
          }
        }

        // 6. Estimate dimensions
        const dims = estimateDimensions(cat);

        // 7. Build offer payload
        const offer = buildYandexOffer(
          product, aiData, sku, barcode, yandexCat, dims, mxik,
          pricing.recommendedPrice
        );

        // 8. Send to Yandex Market API
        console.log(`📤 Sending "${offer.name}" to Yandex (${offer.parameterValues?.length || 0} params)...`);
        
        const yandexResp = await fetch(
          `${YANDEX_API}/businesses/${creds.businessId}/offer-mappings/update`,
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

        // 9. *** NEW: Send O'zbek language content ***
        let uzSent = false;
        if (yandexResp.ok && aiData?.name_uz) {
          await new Promise(r => setTimeout(r, 300)); // small delay
          uzSent = await sendUzbekContent(
            creds.apiKey, creds.businessId, sku,
            aiData.name_uz, aiData.description_uz
          );
        }

        const { score: quality, breakdown } = calculateQuality(offer, aiData);

        // 10. Save to local DB
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
                params_count: offer.parameterValues?.length || 0,
                uz_content_sent: uzSent,
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
          paramsCount: offer.parameterValues?.length || 0,
          uzContentSent: uzSent,
          yandexResponse: yandexResult,
          localProductId: savedProduct?.id,
          error: yandexResp.ok ? null : (yandexResult?.errors?.[0]?.message || yandexResult?.message || `HTTP ${yandexResp.status}`),
        });

        console.log(`${yandexResp.ok ? "✅" : "❌"} ${product.name}: quality=${quality}, params=${offer.parameterValues?.length || 0}, uz=${uzSent}`);

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
