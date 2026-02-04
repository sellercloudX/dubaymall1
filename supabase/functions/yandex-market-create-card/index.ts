import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductData {
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
}

interface PricingData {
  costPrice: number;
  marketplaceCommission: number;
  logisticsCost: number;
  taxRate: number;
  targetProfit: number;
  recommendedPrice: number;
  netProfit: number;
}

// MXIK kodlar bazasi (eng ko'p ishlatiladigan kategoriyalar)
const MXIK_DATABASE: Record<string, { code: string; name_uz: string; name_ru: string }> = {
  "electronics": { code: "26301200", name_uz: "Elektron qurilmalar", name_ru: "Электронные устройства" },
  "phone": { code: "26301100", name_uz: "Mobil telefonlar", name_ru: "Мобильные телефоны" },
  "laptop": { code: "26201100", name_uz: "Noutbuklar", name_ru: "Ноутбуки" },
  "tablet": { code: "26201200", name_uz: "Planshetlar", name_ru: "Планшеты" },
  "headphones": { code: "26401100", name_uz: "Quloqchinlar", name_ru: "Наушники" },
  "speaker": { code: "26401200", name_uz: "Karnaylar", name_ru: "Колонки" },
  "watch": { code: "26521100", name_uz: "Soatlar", name_ru: "Часы" },
  "smartwatch": { code: "26521200", name_uz: "Aqlli soatlar", name_ru: "Умные часы" },
  "camera": { code: "26701100", name_uz: "Kameralar", name_ru: "Камеры" },
  "tv": { code: "26401300", name_uz: "Televizorlar", name_ru: "Телевизоры" },
  "refrigerator": { code: "27511100", name_uz: "Muzlatgichlar", name_ru: "Холодильники" },
  "washing_machine": { code: "27511200", name_uz: "Kir yuvish mashinalari", name_ru: "Стиральные машины" },
  "air_conditioner": { code: "28251100", name_uz: "Konditsionerlar", name_ru: "Кондиционеры" },
  "vacuum": { code: "27512100", name_uz: "Changyutgichlar", name_ru: "Пылесосы" },
  "iron": { code: "27512200", name_uz: "Dazmollar", name_ru: "Утюги" },
  "kettle": { code: "27512300", name_uz: "Choynaklar", name_ru: "Чайники" },
  "blender": { code: "27512400", name_uz: "Blenderlar", name_ru: "Блендеры" },
  "microwave": { code: "27512500", name_uz: "Mikroto'lqinli pechlar", name_ru: "Микроволновые печи" },
  "clothing": { code: "14201100", name_uz: "Kiyimlar", name_ru: "Одежда" },
  "shoes": { code: "15201100", name_uz: "Poyabzallar", name_ru: "Обувь" },
  "bag": { code: "15121100", name_uz: "Sumkalar", name_ru: "Сумки" },
  "cosmetics": { code: "20421100", name_uz: "Kosmetika", name_ru: "Косметика" },
  "perfume": { code: "20421200", name_uz: "Parfyumeriya", name_ru: "Парфюмерия" },
  "toys": { code: "32401100", name_uz: "O'yinchoqlar", name_ru: "Игрушки" },
  "sports": { code: "32301100", name_uz: "Sport anjomlari", name_ru: "Спортивные товары" },
  "furniture": { code: "31091100", name_uz: "Mebel", name_ru: "Мебель" },
  "tools": { code: "25731100", name_uz: "Asboblar", name_ru: "Инструменты" },
  "auto": { code: "29301100", name_uz: "Avtomobil ehtiyot qismlari", name_ru: "Автозапчасти" },
  "health": { code: "21201100", name_uz: "Salomatlik mahsulotlari", name_ru: "Товары для здоровья" },
  "massage": { code: "26601100", name_uz: "Massaj qurilmalari", name_ru: "Массажные устройства" },
  "food": { code: "10891100", name_uz: "Oziq-ovqat mahsulotlari", name_ru: "Продукты питания" },
  "pet": { code: "10921100", name_uz: "Hayvonlar uchun mahsulotlar", name_ru: "Товары для животных" },
  "books": { code: "58111100", name_uz: "Kitoblar", name_ru: "Книги" },
  "stationery": { code: "17231100", name_uz: "Kantselariya", name_ru: "Канцелярия" },
  "garden": { code: "01291100", name_uz: "Bog' mahsulotlari", name_ru: "Садовые товары" },
  "default": { code: "46901100", name_uz: "Boshqa tovarlar", name_ru: "Прочие товары" },
};

// Mahsulot turini aniqlash funksiyasi
function detectProductCategory(name: string, description?: string): string {
  const text = `${name} ${description || ""}`.toLowerCase();
  
  if (text.includes("массаж") || text.includes("massaj")) return "massage";
  if (text.includes("телефон") || text.includes("phone") || text.includes("смартфон") || text.includes("iphone") || text.includes("samsung galaxy")) return "phone";
  if (text.includes("ноутбук") || text.includes("laptop") || text.includes("macbook")) return "laptop";
  if (text.includes("планшет") || text.includes("tablet") || text.includes("ipad")) return "tablet";
  if (text.includes("наушник") || text.includes("headphone") || text.includes("airpods") || text.includes("quloqchin")) return "headphones";
  if (text.includes("колонк") || text.includes("speaker") || text.includes("karnay")) return "speaker";
  if (text.includes("смарт часы") || text.includes("smart watch") || text.includes("apple watch")) return "smartwatch";
  if (text.includes("часы") || text.includes("watch") || text.includes("soat")) return "watch";
  if (text.includes("камер") || text.includes("camera") || text.includes("фотоаппарат")) return "camera";
  if (text.includes("телевизор") || text.includes("tv") || text.includes("televizor")) return "tv";
  if (text.includes("холодильник") || text.includes("refrigerator") || text.includes("muzlatgich")) return "refrigerator";
  if (text.includes("стиральн") || text.includes("washing") || text.includes("kir yuvish")) return "washing_machine";
  if (text.includes("кондиционер") || text.includes("air conditioner") || text.includes("konditsioner")) return "air_conditioner";
  if (text.includes("пылесос") || text.includes("vacuum") || text.includes("changyutgich")) return "vacuum";
  if (text.includes("утюг") || text.includes("iron") || text.includes("dazmol")) return "iron";
  if (text.includes("чайник") || text.includes("kettle") || text.includes("choynak")) return "kettle";
  if (text.includes("блендер") || text.includes("blender")) return "blender";
  if (text.includes("микроволн") || text.includes("microwave")) return "microwave";
  if (text.includes("одежд") || text.includes("clothing") || text.includes("kiyim") || text.includes("футболк") || text.includes("штан") || text.includes("платье")) return "clothing";
  if (text.includes("обувь") || text.includes("shoes") || text.includes("poyabzal") || text.includes("кроссовк") || text.includes("туфл")) return "shoes";
  if (text.includes("сумк") || text.includes("bag") || text.includes("рюкзак")) return "bag";
  if (text.includes("косметик") || text.includes("cosmetic") || text.includes("крем") || text.includes("помад")) return "cosmetics";
  if (text.includes("парфюм") || text.includes("perfume") || text.includes("духи") || text.includes("туалетн")) return "perfume";
  if (text.includes("игруш") || text.includes("toy") || text.includes("o'yinchoq")) return "toys";
  if (text.includes("спорт") || text.includes("sport") || text.includes("фитнес")) return "sports";
  if (text.includes("мебель") || text.includes("furniture") || text.includes("стол") || text.includes("стул") || text.includes("шкаф")) return "furniture";
  if (text.includes("инструмент") || text.includes("tool") || text.includes("дрель") || text.includes("молоток")) return "tools";
  if (text.includes("авто") || text.includes("auto") || text.includes("машин") || text.includes("запчаст")) return "auto";
  if (text.includes("здоровь") || text.includes("health") || text.includes("медицин") || text.includes("витамин")) return "health";
  if (text.includes("книг") || text.includes("book") || text.includes("kitob")) return "books";
  if (text.includes("канцеляр") || text.includes("stationery") || text.includes("ручк") || text.includes("тетрад")) return "stationery";
  if (text.includes("сад") || text.includes("garden") || text.includes("растен") || text.includes("bog'")) return "garden";
  if (text.includes("корм") || text.includes("pet") || text.includes("животн") || text.includes("собак") || text.includes("кошк")) return "pet";
  if (text.includes("еда") || text.includes("food") || text.includes("продукт")) return "food";
  if (text.includes("электрон") || text.includes("electronic") || text.includes("гаджет")) return "electronics";
  
  return "default";
}

// Qisqa SKU generatsiya qilish
function generateShortSKU(name: string, color?: string, model?: string): string {
  // Nomdan birinchi 2-3 so'zni olish
  const words = name.split(/\s+/).slice(0, 2);
  const shortName = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  
  // Rang yoki modelni qo'shish
  const suffix = color ? color.substring(0, 3).toUpperCase() : 
                 model ? model.substring(0, 3).toUpperCase() : 
                 Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${shortName}-${suffix}`;
}

// Realstik o'lchamlarni aniqlash
function estimatePackageDimensions(category: string): { length: number; width: number; height: number; weight: number } {
  const dimensions: Record<string, { length: number; width: number; height: number; weight: number }> = {
    "phone": { length: 18, width: 10, height: 6, weight: 0.3 },
    "laptop": { length: 40, width: 30, height: 5, weight: 2.5 },
    "tablet": { length: 28, width: 22, height: 4, weight: 0.8 },
    "headphones": { length: 22, width: 18, height: 8, weight: 0.4 },
    "speaker": { length: 25, width: 15, height: 15, weight: 1.2 },
    "smartwatch": { length: 12, width: 10, height: 8, weight: 0.2 },
    "watch": { length: 12, width: 10, height: 8, weight: 0.2 },
    "camera": { length: 20, width: 15, height: 12, weight: 0.8 },
    "tv": { length: 120, width: 75, height: 15, weight: 15 },
    "refrigerator": { length: 70, width: 65, height: 180, weight: 65 },
    "washing_machine": { length: 65, width: 60, height: 90, weight: 55 },
    "air_conditioner": { length: 90, width: 35, height: 30, weight: 12 },
    "vacuum": { length: 45, width: 35, height: 30, weight: 5 },
    "iron": { length: 32, width: 15, height: 15, weight: 1.5 },
    "kettle": { length: 25, width: 20, height: 25, weight: 1.2 },
    "blender": { length: 20, width: 18, height: 40, weight: 2 },
    "microwave": { length: 55, width: 45, height: 35, weight: 15 },
    "clothing": { length: 35, width: 25, height: 5, weight: 0.4 },
    "shoes": { length: 35, width: 22, height: 14, weight: 1 },
    "bag": { length: 40, width: 30, height: 15, weight: 0.8 },
    "cosmetics": { length: 15, width: 10, height: 8, weight: 0.15 },
    "perfume": { length: 12, width: 8, height: 15, weight: 0.2 },
    "toys": { length: 30, width: 25, height: 15, weight: 0.5 },
    "sports": { length: 50, width: 30, height: 20, weight: 2 },
    "furniture": { length: 100, width: 60, height: 40, weight: 20 },
    "tools": { length: 35, width: 25, height: 10, weight: 2 },
    "auto": { length: 30, width: 25, height: 15, weight: 1.5 },
    "health": { length: 20, width: 15, height: 10, weight: 0.3 },
    "massage": { length: 45, width: 35, height: 15, weight: 1.8 },
    "books": { length: 25, width: 18, height: 3, weight: 0.5 },
    "stationery": { length: 30, width: 22, height: 5, weight: 0.3 },
    "garden": { length: 40, width: 30, height: 25, weight: 3 },
    "pet": { length: 35, width: 25, height: 20, weight: 2 },
    "food": { length: 25, width: 20, height: 15, weight: 1 },
    "electronics": { length: 25, width: 20, height: 10, weight: 0.5 },
    "default": { length: 30, width: 20, height: 15, weight: 1 },
  };
  
  return dimensions[category] || dimensions["default"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopId, product, pricing } = await req.json() as {
      shopId: string;
      product: ProductData;
      pricing: PricingData;
    };

    if (!shopId || !product || !pricing) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rasmni tekshirish - URL bo'lishi kerak
    let productImages: string[] = [];
    if (product.images && product.images.length > 0) {
      productImages = product.images.filter(img => img.startsWith("http"));
    }
    if (product.image && product.image.startsWith("http")) {
      productImages.push(product.image);
    }

    if (productImages.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Yandex Market uchun kamida 1 ta rasm URL kerak (base64 emas)",
          errorCode: "NO_IMAGE_URL",
          message: "Mahsulot rasmini internet manzili ko'rinishida kiriting (https://...)"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const YANDEX_API_KEY = Deno.env.get("YANDEX_MARKET_API_KEY");
    const YANDEX_CAMPAIGN_ID = Deno.env.get("YANDEX_MARKET_CAMPAIGN_ID");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!YANDEX_API_KEY || !YANDEX_CAMPAIGN_ID) {
      return new Response(
        JSON.stringify({ error: "Yandex Market credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating Yandex Market card for:", product.name);

    // Mahsulot kategoriyasini aniqlash
    const productCategory = detectProductCategory(product.name, product.description);
    const mxikData = MXIK_DATABASE[productCategory];
    const packageDimensions = estimatePackageDimensions(productCategory);
    const shortSKU = generateShortSKU(product.name, product.color, product.model);

    console.log("Category:", productCategory, "MXIK:", mxikData.code, "SKU:", shortSKU);

    // AI orqali to'liq SEO optimizatsiya
    const optimizationPrompt = `Sen Yandex Market uchun professional e-commerce mutaxassisisan. Quyidagi mahsulot uchun TO'LIQ kartochka ma'lumotlarini yarat.

Mahsulot:
- Nomi: ${product.name}
- Tavsif: ${product.description || 'Tavsif yo\'q'}
- Kategoriya: ${productCategory}
- Narx: ${pricing.recommendedPrice} RUB
- Brend: ${product.brand || 'NoName'}

MUHIM: Yandex Market kartochka sifatini 100 ballga yetkazish uchun BARCHA maydonlarni to'ldir!

Faqat JSON formatda javob ber (boshqa matn yo'q):
{
  "name_ru": "SEO-optimallashtirilgan ruscha nom (max 150 belgi, kalit so'zlar bilan)",
  "name_uz": "O'zbekcha nom (max 150 belgi)",
  "description_ru": "Batafsil ruscha tavsif (500-1000 belgi, SEO kalit so'zlar, foydalari, xususiyatlari)",
  "description_uz": "Batafsil o'zbekcha tavsif (500-1000 belgi)",
  "vendor": "Brend nomi (agar aniq bo'lmasa 'OEM' yoki 'Generic')",
  "model": "Model raqami yoki nomi",
  "color": "Rang (ruscha)",
  "color_uz": "Rang (o'zbekcha)",
  "material": "Material (ruscha)",
  "country_of_origin": "Ishlab chiqarilgan mamlakat (2 harfli kod: CN, UZ, RU, TR, etc.)",
  "warranty_days": "Kafolat muddati (kunlarda, raqam)",
  "adult": false,
  "manufacturer_warranty": true,
  "features": [
    {"name": "Xususiyat nomi ruscha", "value": "Qiymati"},
    {"name": "Yana bir xususiyat", "value": "Qiymati"}
  ],
  "parameters": [
    {"name": "Quvvat", "value": "X Vt", "unit": "Vt"},
    {"name": "Kuchlanish", "value": "220", "unit": "V"},
    {"name": "Og'irlik", "value": "X", "unit": "kg"}
  ],
  "keywords": ["kalit1", "kalit2", "kalit3", "kalit4", "kalit5"],
  "benefits": ["Foyda 1 ruscha", "Foyda 2 ruscha", "Foyda 3 ruscha"],
  "usage_instructions": "Foydalanish bo'yicha qisqacha ko'rsatma ruscha",
  "package_contents": ["Mahsulot", "Qo'llanma", "Kafolat kartasi"]
}`;

    let optimizedData: any = {};
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: optimizationPrompt }],
        temperature: 0.3,
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          optimizedData = JSON.parse(jsonMatch[0]);
          console.log("AI optimization successful");
        }
      } catch (e) {
        console.error("Failed to parse AI optimization:", e);
      }
    }

    // Business ID ni olish
    console.log("Getting business ID from campaign...");
    const campaignResponse = await fetch(
      `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}`,
      {
        method: "GET",
        headers: {
          "Api-Key": YANDEX_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    
    let businessId = YANDEX_CAMPAIGN_ID;
    if (campaignResponse.ok) {
      const campaignData = await campaignResponse.json();
      businessId = campaignData.campaign?.business?.id || YANDEX_CAMPAIGN_ID;
      console.log("Business ID:", businessId);
    }

    // To'liq Yandex Market payload
    const yandexOffer = {
      offerId: shortSKU,
      name: optimizedData.name_ru || product.name,
      category: mxikData.name_ru,
      vendor: optimizedData.vendor || product.brand || "OEM",
      vendorCode: shortSKU,
      description: optimizedData.description_ru || product.description || "",
      
      // Rasmlar (faqat URL)
      pictures: productImages.slice(0, 10),
      
      // Narx
      basicPrice: {
        value: pricing.recommendedPrice,
        currencyId: "RUR",
      },
      
      // MXIK/IKPU kod
      customsCommodityCode: mxikData.code,
      
      // Ishlab chiqaruvchi ma'lumotlari
      manufacturer: optimizedData.vendor || "OEM",
      manufacturerCountries: [optimizedData.country_of_origin || "CN"],
      
      // O'lchamlar (sm va gramm)
      weightDimensions: {
        weight: packageDimensions.weight * 1000, // grammlarda
        length: packageDimensions.length, // sm
        width: packageDimensions.width,
        height: packageDimensions.height,
      },
      
      // Kafolat
      warranty: optimizedData.manufacturer_warranty ? {
        warrantyPeriod: optimizedData.warranty_days || 365,
        warrantyPeriodType: "DAY",
      } : undefined,
      
      // Qo'shimcha parametrlar
      params: [
        ...(optimizedData.parameters || []).map((p: any) => ({
          name: p.name,
          value: p.value,
          unit: p.unit,
        })),
        ...(optimizedData.features || []).map((f: any) => ({
          name: f.name,
          value: f.value,
        })),
        // Rang
        optimizedData.color ? { name: "Цвет", value: optimizedData.color } : null,
        // Material
        optimizedData.material ? { name: "Материал", value: optimizedData.material } : null,
        // Model
        optimizedData.model ? { name: "Модель", value: optimizedData.model } : null,
      ].filter(Boolean),
      
      // Batafsil tavsif (rich content)
      marketingDescription: optimizedData.benefits ? 
        `<h3>Преимущества</h3><ul>${optimizedData.benefits.map((b: string) => `<li>${b}</li>`).join("")}</ul>` +
        (optimizedData.usage_instructions ? `<h3>Использование</h3><p>${optimizedData.usage_instructions}</p>` : "") +
        (optimizedData.package_contents ? `<h3>Комплектация</h3><ul>${optimizedData.package_contents.map((c: string) => `<li>${c}</li>`).join("")}</ul>` : "")
        : undefined,
      
      // Kattalar uchun
      adult: optimizedData.adult || false,
      
      // Mavjudlik
      availability: "ACTIVE",
      
      // O'zbekcha ma'lumotlar (Yandex qo'llab-quvvatlasa)
      translations: {
        uz: {
          name: optimizedData.name_uz,
          description: optimizedData.description_uz,
          color: optimizedData.color_uz,
        }
      }
    };

    console.log("Sending to Yandex:", JSON.stringify(yandexOffer, null, 2).substring(0, 500));

    // Yandex API ga yuborish
    const yandexResponse = await fetch(
      `https://api.partner.market.yandex.ru/businesses/${businessId}/offer-mappings/update`,
      {
        method: "POST",
        headers: {
          "Api-Key": YANDEX_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offerMappings: [{
            offer: yandexOffer
          }]
        }),
      }
    );

    let yandexResult: any = { status: "error" };
    let cardUrl = `https://partner.market.yandex.ru/business/${businessId}/assortment`;
    let cardQuality = 31; // Default

    if (yandexResponse.ok) {
      yandexResult = await yandexResponse.json();
      cardUrl = `https://partner.market.yandex.ru/business/${businessId}/assortment/offer/${shortSKU}`;
      
      // Kartochka sifatini hisoblash (taxminiy)
      cardQuality = 30; // Bazaviy ball
      if (optimizedData.name_ru) cardQuality += 10;
      if (optimizedData.name_uz) cardQuality += 5;
      if (optimizedData.description_ru && optimizedData.description_ru.length > 300) cardQuality += 10;
      if (productImages.length >= 3) cardQuality += 10;
      if (optimizedData.parameters && optimizedData.parameters.length >= 3) cardQuality += 10;
      if (optimizedData.features && optimizedData.features.length >= 3) cardQuality += 10;
      if (mxikData.code !== "46901100") cardQuality += 5; // MXIK to'g'ri aniqlangan
      if (optimizedData.benefits) cardQuality += 5;
      if (optimizedData.package_contents) cardQuality += 5;
      
      console.log("Yandex API success, estimated quality:", cardQuality);
    } else {
      const errorText = await yandexResponse.text();
      console.error("Yandex API error:", yandexResponse.status, errorText);
      yandexResult = { status: "error", error: errorText };
    }

    // Mahalliy bazaga saqlash
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: savedProduct, error: saveError } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        name: product.name,
        description: optimizedData.description_ru || product.description,
        price: pricing.recommendedPrice,
        original_price: pricing.costPrice,
        source: "ai",
        source_url: product.sourceUrl,
        images: productImages,
        status: "active",
        specifications: {
          yandex_offer_id: shortSKU,
          yandex_status: yandexResult.status,
          yandex_card_quality: cardQuality,
          mxik_code: mxikData.code,
          mxik_name: mxikData.name_uz,
          optimized_name_ru: optimizedData.name_ru,
          optimized_name_uz: optimizedData.name_uz,
          description_uz: optimizedData.description_uz,
          vendor: optimizedData.vendor,
          model: optimizedData.model,
          color: optimizedData.color,
          dimensions: packageDimensions,
          pricing: pricing,
          parameters: optimizedData.parameters,
          features: optimizedData.features,
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save product locally:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: yandexResponse.ok,
        offerId: shortSKU,
        cardUrl: cardUrl,
        cardQuality: cardQuality,
        mxikCode: mxikData.code,
        mxikName: mxikData.name_uz,
        yandexResult: yandexResult,
        localProduct: savedProduct,
        optimizedData: {
          name_ru: optimizedData.name_ru,
          name_uz: optimizedData.name_uz,
          description_ru: optimizedData.description_ru?.substring(0, 200) + "...",
          description_uz: optimizedData.description_uz?.substring(0, 200) + "...",
          parameters_count: optimizedData.parameters?.length || 0,
          features_count: optimizedData.features?.length || 0,
        },
        dimensions: packageDimensions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Yandex Market card creation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
