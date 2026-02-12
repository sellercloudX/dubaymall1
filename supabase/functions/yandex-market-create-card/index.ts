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
    ["phone", ["телефон", "phone", "смартфон", "iphone", "samsung galaxy", "galaxy"]],
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

// ============ IMAGE PROXY: Download external images → Upload to Supabase Storage ============

async function proxyImagesToStorage(
  supabase: any,
  userId: string,
  imageUrls: string[],
  supabaseUrl: string
): Promise<string[]> {
  const proxiedUrls: string[] = [];

  for (const url of imageUrls) {
    if (!url || typeof url !== 'string') continue;

    // If already a Supabase storage URL from this project, keep it
    if (url.includes(supabaseUrl) && url.includes('/storage/v1/object/public/')) {
      console.log(`🖼️ Already Supabase URL, keeping: ${url.substring(0, 80)}`);
      proxiedUrls.push(url);
      continue;
    }

    // Block obviously invalid URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    if (url.includes('dropbox.com') || url.includes('drive.google.com')) {
      console.warn(`⚠️ Skipping unsupported URL: ${url.substring(0, 60)}`);
      continue;
    }

    try {
      // Download the image
      console.log(`⬇️ Downloading: ${url.substring(0, 80)}...`);
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YandexMarketBot/1.0)',
          'Accept': 'image/*',
        },
      });

      if (!resp.ok) {
        console.warn(`⚠️ Failed to download (${resp.status}): ${url.substring(0, 60)}`);
        continue;
      }

      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        console.warn(`⚠️ Not an image (${contentType}): ${url.substring(0, 60)}`);
        continue;
      }

      const imageData = await resp.arrayBuffer();
      if (imageData.byteLength < 1000) {
        console.warn(`⚠️ Image too small (${imageData.byteLength}b): ${url.substring(0, 60)}`);
        continue;
      }

      // Determine extension from content-type
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif',
      };
      const ext = extMap[contentType] || 'jpg';
      const fileName = `${userId}/yandex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageData, {
          contentType,
          cacheControl: '31536000', // 1 year cache
          upsert: false,
        });

      if (uploadError) {
        console.error(`❌ Upload failed: ${uploadError.message}`);
        // Try with the original URL as fallback
        proxiedUrls.push(url);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData?.publicUrl;
      if (publicUrl) {
        console.log(`✅ Proxied: ${url.substring(0, 50)} → ${publicUrl.substring(0, 80)}`);
        proxiedUrls.push(publicUrl);
      } else {
        proxiedUrls.push(url); // fallback
      }
    } catch (e) {
      console.error(`❌ Proxy error for ${url.substring(0, 60)}:`, e);
      // Don't add broken URLs
    }
  }

  return proxiedUrls;
}

// ============ MXIK LOOKUP (IMPROVED) ============

async function lookupMXIK(supabase: any, name: string, category: string): Promise<{ code: string; name_uz: string }> {
  // Category-based defaults that are VALID in Yandex IKPU catalog
  const CATEGORY_IKPU: Record<string, { code: string; name_uz: string }> = {
    phone: { code: "84713012001000000", name_uz: "Uyali telefonlar (smartfonlar)" },
    laptop: { code: "84713049001000000", name_uz: "Portativ kompyuterlar" },
    tablet: { code: "84713012002000000", name_uz: "Planshet kompyuterlar" },
    headphones: { code: "85183000001000000", name_uz: "Quloqchinlar" },
    speaker: { code: "85182900001000000", name_uz: "Karnaylar" },
    smartwatch: { code: "91022900001000000", name_uz: "Aqlli soatlar" },
    watch: { code: "91022900002000000", name_uz: "Qo'l soatlari" },
    camera: { code: "85258019001000000", name_uz: "Foto va videokameralar" },
    tv: { code: "85287200001000000", name_uz: "Televizorlar" },
    clothing: { code: "62034990001000000", name_uz: "Kiyim-kechak" },
    shoes: { code: "64039900001000000", name_uz: "Poyabzallar" },
    bag: { code: "42029290001000000", name_uz: "Sumkalar" },
    cosmetics: { code: "33049900001000000", name_uz: "Kosmetika vositalari" },
    perfume: { code: "33030000001000000", name_uz: "Parfyumeriya" },
    toys: { code: "95030000001000000", name_uz: "O'yinchoqlar" },
    tools: { code: "82055900001000000", name_uz: "Asbob-uskunalar" },
    massage: { code: "90191010001000000", name_uz: "Massaj apparatlari" },
    default: { code: "85176200001000000", name_uz: "Boshqa elektron qurilmalar" },
  };

  // First try to find exact match in our DB
  try {
    const keywords = name.toLowerCase().replace(/[^\w\s\u0400-\u04FF]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    for (const kw of keywords) {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz')
        .or(`name_uz.ilike.%${kw}%,name_ru.ilike.%${kw}%`)
        .eq('is_active', true)
        .limit(1);
      if (data?.length) {
        console.log(`✅ MXIK found in DB: ${data[0].code} — ${data[0].name_uz}`);
        return data[0];
      }
    }
  } catch (e) {
    console.error('MXIK lookup failed:', e);
  }

  // Use category-specific valid IKPU code
  const fallback = CATEGORY_IKPU[category] || CATEGORY_IKPU.default;
  console.log(`📋 Using category IKPU: ${fallback.code} (${fallback.name_uz})`);
  return fallback;
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
    console.log(`📋 Category ${categoryId}: ${params.length} parameters available`);
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
  const requiredParams = categoryParams.filter((p: any) => p.required || p.constraintType === "REQUIRED");
  const recommendedParams = categoryParams.filter((p: any) => !p.required && p.constraintType !== "REQUIRED");

  // Build COMPLETE parameter list — show ALL to AI
  const formatParam = (p: any) => {
    let desc = `  - parameterId: ${p.id}, name: "${p.name}", type: ${p.type || "TEXT"}`;
    if (p.unit) desc += `, unit: "${p.unit}"`;
    if (p.values?.length) {
      const vals = p.values.slice(0, 20).map((v: any) => `{valueId:${v.id}, value:"${v.value}"}`).join(", ");
      desc += `\n    OPTIONS: [${vals}]`;
      if (p.values.length > 20) desc += ` ... +${p.values.length - 20} more`;
    }
    return desc;
  };

  const requiredList = requiredParams.map(formatParam).join("\n");
  // Show MORE recommended params to AI (up to 80)
  const recommendedList = recommendedParams.slice(0, 80).map(formatParam).join("\n");

  const prompt = `Sen Yandex Market uchun PROFESSIONAL kartochka yaratuvchi AI san. 
MAQSAD: Kartochka sifatini 95+ ballga olib chiqish. Har bir ball muhim!

MAHSULOT:
- Nomi: ${product.name}
- Tavsif: ${product.description || "Tavsif yo'q — MAHSULOT NOMIDAN TO'LIQ TAVSIF YOZ!"}
- Kategoriya: ${categoryName}
- Brend: ${product.brand || "Mahsulot nomidan aniqla"}
- Rang: ${product.color || "Mahsulot nomidan aniqla yoki 'черный' deb yoz"}
- Model: ${product.model || "Mahsulot nomidan aniqla"}
- Narx: ${product.price} UZS

════════════════════════════════════════════════════════
*** MAJBURIY PARAMETRLAR — HAR BIRINI TO'LDIR! ***
${requiredList || "Yo'q"}

*** TAVSIYA ETILGAN — IMKON QADAR BARCHASINI TO'LDIR! ***
${recommendedList || "Yo'q"}
════════════════════════════════════════════════════════

BALLAR TIZIMI (YANDEX):
- Asosiy xususiyatlar: 12 ball → BARCHA requiredlarni to'ldir
- Filtrlar uchun qo'shimcha: 8 ball → Kamida 15 ta recommended to'ldir
- Tovar haqida batafsil: 4 ball → Jami 20+ parametr to'ldir
- Rasmlar: 43 ball → Biz hal qilamiz
- Nom: 10 ball → 60-150 belgi SEO nom
- Tavsif: 20 ball → 800+ belgi professional tavsif

QOIDALAR:
1. name_ru: "[Tovar turi] [Brend] [Model] [Xususiyatlar], [rang]" formatida.
   MINIMUM 80 belgi. MAKSIMUM 150 belgi. 
   Misol: "Смартфон Samsung Galaxy A55 5G 128 ГБ, экран Super AMOLED 6.6 дюйм, камера 50 Мп, аккумулятор 5000 мАч, цвет синий"

2. name_uz: O'zbekcha LOTIN alifbosida, xuddi shunday batafsil, 80-150 belgi.
   
3. description_ru: *** JUDA MUHIM — 800+ belgi! ***
   Professional ruscha tavsif. Tarkib:
   - 1-paragraf: Umumiy tavsif (3-4 gap)
   - 2-paragraf: Ekran va dizayn
   - 3-paragraf: Protsessor va xotira
   - 4-paragraf: Kamera tizimi
   - 5-paragraf: Batareya va quvvatlash
   - 6-paragraf: Qo'shimcha imkoniyatlar
   *** HTML TEGLARISIZ! Faqat oddiy matn! ***

4. description_uz: O'zbekcha (LOTIN) batafsil tavsif, 600-2000 belgi. HTML TEGLARISIZ!

5. vendor: Aniq brend nomi
6. vendorCode: Aniq model artikuli (masalan "SM-A556E")
7. manufacturerCountry: Ishlab chiqarilgan mamlakat ruscha

8. parameterValues: *** ENG MUHIM! BALL SHUNGA BOG'LIQ! ***
   - Agar OPTIONS ro'yxati bo'lsa → valueId ishlatilsin (FAQAT ro'yxatdagi qiymatlardan!)
   - Agar TEXT/STRING turi bo'lsa → value ishlatilsin
   - Agar NUMBER turi bo'lsa → value RAQAM sifatida berilsin
   
   *** BARCHA MAJBURIY PARAMETRLARNI TO'LDIR — BU 12 BALL! ***
   *** TAVSIYA ETILGANLARDAN KAMIDA 25 TASINI TO'LDIR — BU 12 BALL! ***
   *** JAMI KAMIDA 30 TA PARAMETR BO'LISHI SHART ***
   
   Agar qiymatni bilmasang — TAXMINIY YOKI STANDART QIYMAT YOZ!
   Bo'sh qoldirma! Har bir parametr = ball!

9. warranty: "1 год" yoki "2 года"

JAVOB FAQAT JSON formatida, boshqa hech narsa yo'q:
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
        temperature: 0.1, // Lower temperature for more reliable structured output
        max_tokens: 6000, // More tokens for more parameters
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
      console.log(`🤖 AI: name_ru=${result.name_ru?.length}ch, name_uz=${result.name_uz?.length}ch, desc_ru=${result.description_ru?.length}ch, params=${result.parameterValues?.length}`);
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
  price: number,
  proxiedImages: string[]
): any {
  const name = stripHtml(ai?.name_ru || product.name);
  const description = stripHtml(ai?.description_ru || product.description || product.name);

  // Ensure name is 60-150 chars
  let finalName = name;
  if (finalName.length < 60) {
    // Pad with category info
    finalName = `${finalName}, ${category.name}`;
  }
  finalName = finalName.substring(0, 150);

  const offer: any = {
    offerId: sku,
    name: finalName,
    marketCategoryId: category.id,
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
    type: "DEFAULT",
    adult: ai?.adult || false,
  };

  // Add IKPU — only if code is valid (17 digits)
  if (mxik.code && mxik.code.length === 17 && /^\d+$/.test(mxik.code)) {
    offer.commodityCodes = [{ code: mxik.code, type: "IKPU_CODE" }];
    console.log(`✅ IKPU code: ${mxik.code}`);
  } else {
    console.warn(`⚠️ Invalid IKPU code skipped: ${mxik.code}`);
  }

  // Add PROXIED images — these are guaranteed accessible
  if (proxiedImages.length > 0) {
    offer.pictures = proxiedImages.slice(0, 10);
    console.log(`✅ ${offer.pictures.length} proxied images added`);
    offer.pictures.forEach((u: string, i: number) => console.log(`  🖼️ [${i}] ${u.substring(0, 100)}`));
  } else {
    console.warn('⚠️ NO images! This will cost ~35 quality points.');
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
    console.log(`📊 Parameters: ${offer.parameterValues.length}`);
  }

  // Warranty
  if (ai?.warranty) {
    const match = ai.warranty.match(/(\d+)\s*(yil|year|год|года|лет|месяц|month|oy)/i);
    if (match) {
      const period = parseInt(match[1]);
      const isYear = /yil|year|год|года|лет/i.test(match[2]);
      offer.guaranteePeriod = {
        timePeriod: isYear ? period * 12 : period,
        timeUnit: "MONTH",
      };
    }
  }

  // Clean undefined/null
  for (const key of Object.keys(offer)) {
    if (offer[key] === undefined || offer[key] === null) delete offer[key];
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
        headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ offerMappings: [{ offer }] }),
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

    console.log(`🚀 Creating ${productsList.length} Yandex card(s) for user ${user.id}`);

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

        // 3. MXIK lookup (improved with category)
        const mxik = (product.mxikCode && product.mxikName)
          ? { code: product.mxikCode, name_uz: product.mxikName }
          : await lookupMXIK(supabase, product.name, cat);

        // 4. *** PROXY ALL IMAGES THROUGH SUPABASE STORAGE ***
        const rawImages: string[] = [];
        if (product.images?.length) rawImages.push(...product.images);
        if (product.image && !rawImages.includes(product.image)) rawImages.unshift(product.image);
        
        console.log(`🖼️ Raw images: ${rawImages.length}`);
        const proxiedImages = await proxyImagesToStorage(supabase, user.id, rawImages, SUPABASE_URL);
        console.log(`🖼️ Proxied images: ${proxiedImages.length}`);

        // 5. Fetch Yandex category parameters
        console.log(`📋 Fetching params for ${yandexCat.name} (${yandexCat.id})...`);
        const categoryParams = await fetchCategoryParameters(creds.apiKey, yandexCat.id);

        // 6. AI optimization with category parameters
        let aiData: any = null;
        if (LOVABLE_API_KEY) {
          aiData = await optimizeWithAI(product, yandexCat.name, categoryParams, LOVABLE_API_KEY);
          if (aiData) {
            console.log(`✅ AI: name=${aiData.name_ru?.length}ch, desc=${aiData.description_ru?.length}ch, params=${aiData.parameterValues?.length}`);
          }
        }

        // 7. Estimate dimensions
        const dims = estimateDimensions(cat);

        // 8. Build offer payload with PROXIED images
        const offer = buildYandexOffer(
          product, aiData, sku, barcode, yandexCat, dims, mxik,
          pricing.recommendedPrice, proxiedImages
        );

        // 9. Send to Yandex Market API
        console.log(`📤 Sending "${offer.name?.substring(0, 60)}" — ${offer.parameterValues?.length || 0} params, ${offer.pictures?.length || 0} images`);
        
        const yandexResp = await fetch(
          `${YANDEX_API}/businesses/${creds.businessId}/offer-mappings/update`,
          {
            method: "POST",
            headers: { "Api-Key": creds.apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ offerMappings: [{ offer }] }),
          }
        );

        const respText = await yandexResp.text();
        let yandexResult: any;
        try { yandexResult = JSON.parse(respText); } catch { yandexResult = { raw: respText }; }

        if (!yandexResp.ok) {
          console.error(`❌ Yandex API error (${yandexResp.status}):`, respText.substring(0, 500));
        }

        // 10. Send O'zbek language content
        let uzSent = false;
        if (yandexResp.ok && aiData?.name_uz) {
          await new Promise(r => setTimeout(r, 300));
          uzSent = await sendUzbekContent(
            creds.apiKey, creds.businessId, sku,
            aiData.name_uz, aiData.description_uz
          );
        }

        // 11. Save to local DB
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
              images: proxiedImages.length > 0 ? proxiedImages : (product.images || []),
              status: "draft" as any,
              mxik_code: mxik.code,
              mxik_name: mxik.name_uz,
              specifications: {
                yandex_offer_id: sku,
                yandex_business_id: creds.businessId,
                yandex_category_id: yandexCat.id,
                yandex_category_name: yandexCat.name,
                yandex_status: yandexResp.ok ? "success" : "error",
                barcode,
                vendor: offer.vendor,
                dimensions: offer.weightDimensions,
                name_uz: aiData?.name_uz,
                name_ru: aiData?.name_ru,
                description_uz: aiData?.description_uz,
                params_count: offer.parameterValues?.length || 0,
                images_proxied: proxiedImages.length,
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
          paramsCount: offer.parameterValues?.length || 0,
          imagesCount: offer.pictures?.length || 0,
          imagesProxied: proxiedImages.length,
          mxikCode: mxik.code,
          mxikName: mxik.name_uz,
          uzContentSent: uzSent,
          category: yandexCat.name,
          yandexResponse: yandexResult,
          localProductId: savedProduct?.id,
          error: yandexResp.ok ? null : (yandexResult?.errors?.[0]?.message || yandexResult?.message || `HTTP ${yandexResp.status}`),
        });

        console.log(`${yandexResp.ok ? "✅" : "❌"} ${product.name}: params=${offer.parameterValues?.length || 0}, imgs=${offer.pictures?.length || 0}, uz=${uzSent}`);

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
