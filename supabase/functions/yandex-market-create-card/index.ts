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
  barcode?: string;
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

// Yandex Market kategoriya ID lari (eng ko'p ishlatiladigan)
const YANDEX_CATEGORY_IDS: Record<string, { id: number; name: string }> = {
  "phone": { id: 91491, name: "Смартфоны" },
  "laptop": { id: 91013, name: "Ноутбуки" },
  "tablet": { id: 6427100, name: "Планшеты" },
  "headphones": { id: 90555, name: "Наушники и гарнитуры" },
  "speaker": { id: 90556, name: "Портативная акустика" },
  "smartwatch": { id: 10498025, name: "Умные часы и браслеты" },
  "watch": { id: 7811901, name: "Наручные часы" },
  "camera": { id: 90606, name: "Фотоаппараты" },
  "tv": { id: 90639, name: "Телевизоры" },
  "refrigerator": { id: 71639, name: "Холодильники" },
  "washing_machine": { id: 138608, name: "Стиральные машины" },
  "air_conditioner": { id: 90403, name: "Кондиционеры" },
  "vacuum": { id: 90564, name: "Пылесосы" },
  "iron": { id: 90567, name: "Утюги" },
  "kettle": { id: 90570, name: "Электрочайники" },
  "blender": { id: 90573, name: "Блендеры" },
  "microwave": { id: 90594, name: "Микроволновые печи" },
  "clothing": { id: 7811873, name: "Одежда" },
  "shoes": { id: 7811882, name: "Обувь" },
  "bag": { id: 7812078, name: "Сумки" },
  "cosmetics": { id: 90509, name: "Декоративная косметика" },
  "perfume": { id: 90510, name: "Парфюмерия" },
  "toys": { id: 90764, name: "Игрушки" },
  "sports": { id: 90660, name: "Спорттовары" },
  "furniture": { id: 90720, name: "Мебель" },
  "tools": { id: 90719, name: "Инструменты" },
  "auto": { id: 90461, name: "Автотовары" },
  "health": { id: 90690, name: "Товары для здоровья" },
  "massage": { id: 966945, name: "Массажеры" },
  "books": { id: 90829, name: "Книги" },
  "stationery": { id: 18057714, name: "Канцтовары" },
  "garden": { id: 90810, name: "Товары для сада" },
  "pet": { id: 90813, name: "Товары для животных" },
  "food": { id: 90817, name: "Продукты питания" },
  "electronics": { id: 198119, name: "Электроника" },
  "default": { id: 198119, name: "Электроника" },
};

// MXIK kodlar bazasi
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
  
  if (text.includes("массаж") || text.includes("massaj") || text.includes("massager")) return "massage";
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
  const words = name.split(/\s+/).slice(0, 2);
  const shortName = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const suffix = color ? color.substring(0, 3).toUpperCase() : 
                 model ? model.substring(0, 3).toUpperCase() : 
                 Math.random().toString(36).substring(2, 5).toUpperCase();
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${shortName}-${suffix}-${timestamp}`;
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

// EAN-13 shtrixkod generatsiyasi
function generateEAN13(): string {
  // 200-299 oralig'i ichki foydalanish uchun
  const prefix = "200";
  let code = prefix;
  for (let i = 0; i < 9; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  // Check digit hisoblash
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit.toString();
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

    // Rasmni tekshirish
    let productImages: string[] = [];
    if (product.images && product.images.length > 0) {
      productImages = product.images.filter(img => img && img.startsWith("http"));
    }
    if (product.image && product.image.startsWith("http")) {
      if (!productImages.includes(product.image)) {
        productImages.unshift(product.image);
      }
    }

    if (productImages.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Yandex Market uchun kamida 1 ta rasm URL kerak",
          errorCode: "NO_IMAGE_URL",
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

    console.log("🚀 Creating Yandex Market card for:", product.name);

    // Mahsulot kategoriyasini aniqlash
    const productCategory = detectProductCategory(product.name, product.description);
    const yandexCategory = YANDEX_CATEGORY_IDS[productCategory] || YANDEX_CATEGORY_IDS["default"];
    const mxikData = MXIK_DATABASE[productCategory] || MXIK_DATABASE["default"];
    const packageDimensions = estimatePackageDimensions(productCategory);
    const shortSKU = generateShortSKU(product.name, product.color, product.model);
    const barcode = product.barcode || generateEAN13();

    console.log("📦 Category:", productCategory, "Yandex ID:", yandexCategory.id, "SKU:", shortSKU);

    // AI orqali 100 ballik kartochka uchun to'liq optimizatsiya
    const optimizationPrompt = `Sen Yandex Market uchun professional e-commerce mutaxassisisan. 
Quyidagi mahsulot uchun 100 BALLIK SIFAT INDEKSIGA erishish uchun TO'LIQ kartochka ma'lumotlarini yarat.

Mahsulot:
- Nomi: ${product.name}
- Tavsif: ${product.description || 'Yo\'q'}
- Kategoriya: ${yandexCategory.name}
- Narx: ${pricing.recommendedPrice} RUB
- Brend: ${product.brand || 'Aniqlanmagan'}

100 BALLIK SIFAT INDEKSI UCHUN TALABLAR:
1. Nom: 50-60 belgi, TIP + BREND + MODEL + XUSUSIYAT formatida
2. Tavsif: 400-600 belgi, HTML teglari bilan, SEO kalit so'zlar
3. Xususiyatlar: Kamida 10 ta kategoriyaga xos parametr
4. Foydalanuvchi uchun foydali ma'lumotlar

MUHIM: Faqat JSON formatda javob ber:
{
  "name": "Optimallashtirilgan ruscha nom (50-60 belgi, Tip + Brend + Model + Xususiyat)",
  "description": "HTML formatlangan tavsif (400-600 belgi): <p>Asosiy tavsif</p><h3>Afzalliklar</h3><ul><li>Afzallik 1</li></ul><h3>Xususiyatlar</h3><ul><li>Xususiyat 1</li></ul>",
  "vendor": "Brend nomi (aniq yozing)",
  "vendorCode": "Ishlab chiqaruvchi artikuli",
  "model": "Model nomi/raqami",
  "manufacturerCountries": ["Ishlab chiqarilgan mamlakat"],
  "parameterValues": [
    {"parameterId": 0, "name": "Rang", "value": "Qora"},
    {"parameterId": 0, "name": "Material", "value": "Plastik"},
    {"parameterId": 0, "name": "Quvvat", "value": "100", "unitId": "Vt"},
    {"parameterId": 0, "name": "Kuchlanish", "value": "220", "unitId": "V"},
    {"parameterId": 0, "name": "Chastota", "value": "50", "unitId": "Gts"},
    {"parameterId": 0, "name": "Kafolat", "value": "12", "unitId": "oy"},
    {"parameterId": 0, "name": "Ishlab chiqaruvchi mamlakati", "value": "Xitoy"},
    {"parameterId": 0, "name": "Brend mamlakati", "value": "Xitoy"},
    {"parameterId": 0, "name": "Maqsad", "value": "Uy uchun"},
    {"parameterId": 0, "name": "Komplektatsiya", "value": "Mahsulot, Qo'llanma, Kafolat kartasi"}
  ],
  "warranty": {
    "period": 12,
    "unit": "MONTH"
  },
  "adult": false,
  "keywords": ["kalit1", "kalit2", "kalit3", "kalit4", "kalit5"]
}`;

    let optimizedData: any = {
      name: product.name,
      description: product.description || "",
      vendor: product.brand || "OEM",
      vendorCode: shortSKU,
      model: product.model || "",
      manufacturerCountries: ["Китай"],
      parameterValues: [],
      warranty: { period: 12, unit: "MONTH" },
      adult: false,
      keywords: []
    };
    
    if (LOVABLE_API_KEY) {
      try {
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
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            optimizedData = { ...optimizedData, ...parsed };
            console.log("✅ AI optimization successful");
          }
        }
      } catch (e) {
        console.error("AI optimization failed, using defaults:", e);
      }
    }

    // Business ID ni olish
    console.log("🔍 Getting business ID from campaign...");
    let businessId = YANDEX_CAMPAIGN_ID;
    
    try {
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
      
      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        businessId = campaignData.campaign?.business?.id?.toString() || YANDEX_CAMPAIGN_ID;
        console.log("✅ Business ID:", businessId);
      }
    } catch (e) {
      console.error("Failed to get business ID, using campaign ID:", e);
    }

    // ✅ TO'LIQ YANDEX MARKET API PAYLOAD (100 ballik sifat uchun)
    const yandexOffer: any = {
      // 1. MAJBURIY MAYDONLAR
      offerId: shortSKU,
      name: optimizedData.name,
      marketCategoryId: yandexCategory.id, // ✅ MUHIM! Kategoriya ID
      pictures: productImages.slice(0, 10),
      vendor: optimizedData.vendor,
      description: optimizedData.description,
      
      // 2. SHTRIXKOD (sifat uchun muhim)
      barcodes: [barcode],
      
      // 3. ISHLAB CHIQARUVCHI MA'LUMOTLARI
      vendorCode: optimizedData.vendorCode || shortSKU,
      manufacturerCountries: optimizedData.manufacturerCountries || ["Китай"],
      
      // 4. GABARTLAR VA VAZN (sm va kg formatda)
      weightDimensions: {
        length: packageDimensions.length,  // sm
        width: packageDimensions.width,    // sm
        height: packageDimensions.height,  // sm
        weight: packageDimensions.weight,  // kg (grammda emas!)
      },
      
      // 5. NARX (Yandex Market UZ = UZS valyutasi)
      basicPrice: {
        value: pricing.recommendedPrice,
        currencyId: "UZS",
      },
      
      // 6. KAFOLAT
      guaranteePeriod: optimizedData.warranty ? {
        timePeriod: optimizedData.warranty.period || 12,
        timeUnit: optimizedData.warranty.unit || "MONTH",
      } : undefined,
      
      // 7. TN VED KOD (MXIK)
      customsCommodityCode: mxikData.code,
      
      // 8. KATEGORIYA XUSUSIYATLARI (params - deprecated, lekin hali ishlaydi)
      params: optimizedData.parameterValues?.map((p: any) => ({
        name: p.name,
        value: p.value?.toString() || "",
        unit: p.unitId,
      })).filter((p: any) => p.name && p.value) || [],
      
      // 9. KATTALAR UCHUN
      adult: optimizedData.adult || false,
      
      // 10. TOVAR TURI
      type: "DEFAULT",
    };

    // Faqat to'ldirilgan maydonlarni yuborish
    Object.keys(yandexOffer).forEach(key => {
      if (yandexOffer[key] === undefined || yandexOffer[key] === null || 
          (Array.isArray(yandexOffer[key]) && yandexOffer[key].length === 0)) {
        delete yandexOffer[key];
      }
    });

    console.log("📤 Sending to Yandex Market API...");
    console.log("Offer:", JSON.stringify(yandexOffer, null, 2).substring(0, 1000));

    // ✅ TO'G'RI API ENDPOINT
    const yandexResponse = await fetch(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
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

    const responseText = await yandexResponse.text();
    let yandexResult: any;
    
    try {
      yandexResult = JSON.parse(responseText);
    } catch {
      yandexResult = { raw: responseText };
    }

    let cardUrl = `https://partner.market.yandex.ru/business/${businessId}/assortment`;
    let cardQuality = 0;
    let qualityBreakdown: any = {};

    if (yandexResponse.ok) {
      cardUrl = `https://partner.market.yandex.ru/business/${businessId}/assortment/offer/${encodeURIComponent(shortSKU)}`;
      
      // ✅ SIFAT INDEKSINI HISOBLASH (Yandex algoritmi asosida)
      qualityBreakdown = {
        name: optimizedData.name?.length >= 50 ? 15 : (optimizedData.name?.length >= 30 ? 10 : 5),
        description: optimizedData.description?.length >= 400 ? 15 : (optimizedData.description?.length >= 200 ? 10 : 5),
        pictures: productImages.length >= 5 ? 15 : (productImages.length >= 3 ? 10 : (productImages.length >= 1 ? 5 : 0)),
        category: yandexCategory.id !== 198119 ? 10 : 5, // Aniq kategoriya
        parameters: (optimizedData.parameterValues?.length || 0) >= 10 ? 15 : 
                    (optimizedData.parameterValues?.length || 0) >= 5 ? 10 : 5,
        weightDimensions: 10, // Har doim to'ldirilgan
        barcode: 5,
        vendor: optimizedData.vendor && optimizedData.vendor !== "OEM" ? 5 : 3,
        manufacturerCountry: 5,
        warranty: optimizedData.warranty ? 5 : 0,
      };
      
      cardQuality = Object.values(qualityBreakdown).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
      
      console.log("✅ Yandex API success! Quality:", cardQuality);
      console.log("📊 Quality breakdown:", qualityBreakdown);
    } else {
      console.error("❌ Yandex API error:", yandexResponse.status, responseText);
    }

    // Mahalliy bazaga saqlash
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: savedProduct, error: saveError } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        name: product.name,
        description: optimizedData.description || product.description,
        price: pricing.recommendedPrice,
        original_price: pricing.costPrice,
        source: "ai",
        source_url: product.sourceUrl,
        images: productImages,
        status: "active",
        specifications: {
          yandex_offer_id: shortSKU,
          yandex_business_id: businessId,
          yandex_category_id: yandexCategory.id,
          yandex_category_name: yandexCategory.name,
          yandex_status: yandexResponse.ok ? "success" : "error",
          yandex_card_quality: cardQuality,
          yandex_quality_breakdown: qualityBreakdown,
          barcode: barcode,
          mxik_code: mxikData.code,
          mxik_name: mxikData.name_uz,
          optimized_name: optimizedData.name,
          vendor: optimizedData.vendor,
          model: optimizedData.model,
          dimensions: packageDimensions,
          pricing: pricing,
          parameters_count: optimizedData.parameterValues?.length || 0,
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
        barcode: barcode,
        cardUrl: cardUrl,
        cardQuality: cardQuality,
        qualityBreakdown: qualityBreakdown,
        yandexCategoryId: yandexCategory.id,
        yandexCategoryName: yandexCategory.name,
        mxikCode: mxikData.code,
        mxikName: mxikData.name_uz,
        yandexResponse: yandexResult,
        localProduct: savedProduct,
        optimizedData: {
          name: optimizedData.name,
          description: optimizedData.description?.substring(0, 200) + "...",
          parameters_count: optimizedData.parameterValues?.length || 0,
        },
        dimensions: packageDimensions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Yandex Market card creation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
