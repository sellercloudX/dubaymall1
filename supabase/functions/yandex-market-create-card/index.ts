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
  nameRu?: string;
  description?: string;
  descriptionRu?: string;
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
  keywords?: string[];
  bulletPoints?: string[];
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
  skipImageGeneration?: boolean; // Cost optimization: reuse existing images for clones
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
  const ascii = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = (ascii || 'PROD').split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix || 'PROD'}-${rnd}-${ts}`;
}

function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ============ IMAGE PROXY ============

async function proxyImagesToStorage(
  supabase: any, userId: string, imageUrls: string[], supabaseUrl: string
): Promise<string[]> {
  const proxied: string[] = [];
  for (const url of imageUrls) {
    if (!url || typeof url !== 'string') continue;
    if (!url.startsWith('http')) continue;

    // Already our storage URL
    if (url.includes(supabaseUrl) && url.includes('/storage/v1/object/public/')) {
      proxied.push(url);
      continue;
    }

    // Block unsupported
    if (url.includes('dropbox.com') || url.includes('drive.google.com')) continue;

    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBot/1.0)', 'Accept': 'image/*' },
      });
      if (!resp.ok) { console.warn(`⚠️ Download failed (${resp.status}): ${url.substring(0, 60)}`); continue; }

      const ct = resp.headers.get('content-type') || 'image/jpeg';
      if (!ct.startsWith('image/')) continue;

      const data = await resp.arrayBuffer();
      if (data.byteLength < 1000) continue;

      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const ext = extMap[ct] || 'jpg';
      const fileName = `${userId}/ym-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;

      const { error } = await supabase.storage.from('product-images').upload(fileName, data, {
        contentType: ct, cacheControl: '31536000', upsert: false,
      });

      if (error) { console.error(`Upload err: ${error.message}`); proxied.push(url); continue; }

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        console.log(`✅ Proxied: ${url.substring(0, 40)} → storage`);
        proxied.push(urlData.publicUrl);
      }
    } catch (e) {
      console.error(`Proxy err: ${e}`);
    }
  }
  return proxied;
}

// ============ MXIK LOOKUP (AI-powered) ============

async function lookupMXIK(
  supabase: any, name: string, category?: string, lovableApiKey?: string
): Promise<{ code: string; name_uz: string }> {
  try {
    // Step 1: AI keyword extraction for better search
    let keywords: string[] = [];
    if (lovableApiKey) {
      try {
        const prompt = `Mahsulot: "${name}"${category ? ` (Kategoriya: ${category})` : ''}
Ushbu mahsulot uchun MXIK kodini topish uchun eng muhim kalit so'zlarni ajrating.
Faqat mahsulot TURINI aniqlaydigan umumiy so'zlarni bering (brend, model raqami, rang olib tashlang).
Masalan:
- "Estée Lauder Double Wear foundation" → ["tonal krem", "kosmetika", "pardoz vositasi", "yuz uchun krem"]
- "iPhone 15 Pro Max 256GB" → ["telefon", "smartfon", "mobil telefon"]
Javobni faqat JSON array: ["so'z1", "so'z2", ...]`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            temperature: 0, max_tokens: 150,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content?.trim() || "";
          const match = content.match(/\[.*\]/s);
          if (match) keywords = JSON.parse(match[0]).filter((k: string) => typeof k === 'string' && k.length > 1);
        }
      } catch (e) { console.error("AI MXIK keywords error:", e); }
    }

    // Fallback keywords
    if (keywords.length === 0) {
      keywords = name.toLowerCase().replace(/[^\w\s\u0400-\u04FFa-zA-Z'ʼ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    }
    console.log(`[MXIK] Keywords: ${keywords.join(', ')}`);

    // Step 2: Search with multiple keywords
    let matches: any[] = [];
    for (const kw of keywords.slice(0, 4)) {
      const { data } = await supabase.from('mxik_codes').select('code, name_uz, name_ru, group_name')
        .or(`name_uz.ilike.%${kw}%,name_ru.ilike.%${kw}%,group_name.ilike.%${kw}%`)
        .eq('is_active', true).limit(10);
      if (data) matches.push(...data);
    }

    // Deduplicate
    const unique = Array.from(new Map(matches.map(m => [m.code, m])).values());

    if (unique.length === 0) {
      console.warn("[MXIK] No matches found, using generic fallback");
      return { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
    }

    // Step 3: AI selects best match
    if (lovableApiKey && unique.length > 1) {
      try {
        const options = unique.slice(0, 10).map((m, i) =>
          `${i + 1}. ${m.code} — ${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''}`
        ).join('\n');
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Mahsulot: "${name}"
Quyidagilardan eng mos MXIK kodni tanla:
${options}
Javob faqat raqam (1-${Math.min(unique.length, 10)}):` }],
            temperature: 0, max_tokens: 10,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content?.trim() || "";
          const idx = parseInt(content.match(/\d+/)?.[0] || "1") - 1;
          if (idx >= 0 && idx < unique.length) {
            console.log(`[MXIK] AI selected: ${unique[idx].name_uz} (${unique[idx].code})`);
            return { code: unique[idx].code, name_uz: unique[idx].name_uz };
          }
        }
      } catch (e) { console.error("AI MXIK select error:", e); }
    }

    return { code: unique[0].code, name_uz: unique[0].name_uz };
  } catch (e) {
    console.error('MXIK lookup error:', e);
    return { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
  }
}

// ============ YANDEX CREDENTIALS ============

async function getYandexCredentials(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("marketplace_connections").select("*")
    .eq("user_id", userId).eq("marketplace", "yandex").eq("is_active", true).limit(1).single();
  if (!conn) return null;

  let apiKey = "", campaignId = "", businessId = "";
  if (conn.encrypted_credentials) {
    const { data, error } = await supabase.rpc("decrypt_credentials", { p_encrypted: conn.encrypted_credentials });
    if (!error && data) {
      const c = data as any;
      apiKey = c.apiKey || ""; campaignId = c.campaignId || c.sellerId || ""; businessId = c.businessId || "";
    }
  } else {
    const c = conn.credentials as any;
    apiKey = c?.apiKey || ""; campaignId = c?.campaignId || c?.sellerId || ""; businessId = c?.businessId || "";
  }

  if (apiKey && campaignId && !businessId) {
    try {
      const r = await fetch(`${YANDEX_API.replace('/v2', '')}/campaigns/${campaignId}`, {
        headers: { "Api-Key": apiKey },
      });
      if (r.ok) { const d = await r.json(); businessId = d.campaign?.business?.id?.toString() || ""; }
    } catch (e) {}
  }

  if (!apiKey || !businessId) return null;
  return { apiKey, campaignId, businessId, shopId: conn.shop_id };
}

// ============ STEP 1: GET LEAF CATEGORY FROM YANDEX CATEGORY TREE ============

async function findLeafCategory(
  apiKey: string, productName: string, productDesc: string, lovableApiKey: string
): Promise<{ id: number; name: string }> {
  // 1. Fetch category tree from Yandex
  console.log("📂 Fetching Yandex category tree...");
  let tree: any = null;
  try {
    const resp = await fetch(`${YANDEX_API}/categories/tree`, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ language: "RU" }),
    });
    if (resp.ok) {
      const data = await resp.json();
      tree = data.result;
    }
  } catch (e) {
    console.error("Category tree fetch error:", e);
  }

  if (!tree) {
    console.warn("⚠️ Could not fetch category tree, using fallback");
    return { id: 91491, name: "Смартфоны" };
  }

  // 2. Flatten tree to get all leaf categories (no children)
  const leaves: { id: number; name: string; path: string }[] = [];
  function collectLeaves(node: any, path: string) {
    const currentPath = path ? `${path} > ${node.name}` : node.name;
    if (!node.children || node.children.length === 0) {
      leaves.push({ id: node.id, name: node.name, path: currentPath });
    } else {
      for (const child of node.children) {
        if (child) collectLeaves(child, currentPath);
      }
    }
  }
  collectLeaves(tree, "");
  console.log(`📂 Found ${leaves.length} leaf categories`);

  // 3. Use AI to extract RUSSIAN search keywords from product name
  let searchKeywords: string[] = [];
  if (lovableApiKey) {
    try {
      const kwResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: `Mahsulot: "${productName}"
Tavsif: "${productDesc || ''}"

Bu mahsulotni Yandex Market kategoriyalarida topish uchun RUSCHA kalit so'zlar ber.
Faqat mahsulot TURINI bildiruvchi so'zlar (brend, model, rang emas).

Masalan:
- "Estée Lauder Double Wear foundation" → ["тональный крем", "тональное средство", "макияж", "косметика"]
- "iPhone 15 Pro" → ["смартфон", "мобильный телефон"]
- "Nike Air Max krossovka" → ["кроссовки", "спортивная обувь", "обувь"]

Javob FAQAT JSON array: ["so'z1", "so'z2", ...]` }],
          temperature: 0, max_tokens: 150,
        }),
      });
      if (kwResp.ok) {
        const kwData = await kwResp.json();
        const kwContent = kwData.choices?.[0]?.message?.content?.trim() || "";
        const kwMatch = kwContent.match(/\[.*\]/s);
        if (kwMatch) {
          searchKeywords = JSON.parse(kwMatch[0]).filter((k: string) => typeof k === 'string' && k.length > 1);
        }
      }
    } catch (e) {
      console.error("AI keyword extraction error:", e);
    }
  }

  // Fallback keywords from product name
  if (searchKeywords.length === 0) {
    searchKeywords = productName.toLowerCase().replace(/[^\w\s\u0400-\u04FF]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  }
  console.log(`📂 Search keywords: ${searchKeywords.join(', ')}`);

  // 4. Score categories by keyword matches
  const scored = leaves.map(leaf => {
    const leafText = `${leaf.name} ${leaf.path}`.toLowerCase();
    let score = 0;
    for (const kw of searchKeywords) {
      const kwLower = kw.toLowerCase();
      if (leafText.includes(kwLower)) score += 3;
      // Partial match
      if (kwLower.length > 4 && leafText.includes(kwLower.substring(0, kwLower.length - 2))) score += 1;
    }
    return { ...leaf, score };
  }).filter(l => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);

  if (scored.length === 0) {
    const sample = leaves.slice(0, 80);
    scored.push(...sample.map(l => ({ ...l, score: 0 })));
  }

  console.log(`📂 Top candidates: ${scored.slice(0, 5).map(c => `${c.name}(${c.id})`).join(', ')}`);

  // 5. Ask AI to select the best leaf category — use strong model for accuracy
  if (lovableApiKey && scored.length > 0) {
    const categoryList = scored.slice(0, 50).map(c => `ID:${c.id} — ${c.path}`).join("\n");
    
    const prompt = `VAZIFA: Mahsulotga ENG TO'G'RI Yandex Market kategoriyasini tanla.

MAHSULOT NOMI: "${productName}"
TAVSIF: "${productDesc || 'Yo\'q'}"

MUHIM QOIDALAR:
- Kategoriya mahsulot TURIGA aniq mos bo'lishi SHART
- "Par dazmol" va "Vakuum paketlash mashinasi" — BU BOSHQA NARSALAR!
- Mahsulot nomidagi kalit so'zlarni sinchiklab tahlil qil
- Masalan: "vakuumlovchi" → "Вакуумные упаковщики", "par dazmol" → "Парогенераторы"
- "foundation/tonal krem" → "Тональные средства", "lipstick" → "Губная помада"
- Agar mahsulot nomi ANIQ bir kategoriyaga to'g'ri kelsa, uni tanla

KATEGORIYALAR RO'YXATI:
${categoryList}

JAVOB: Faqat bitta ID raqam yoz, hech narsa qo'shma:`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_tokens: 50,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        const idMatch = content.match(/\d+/);
        if (idMatch) {
          const selectedId = parseInt(idMatch[0]);
          const found = scored.find(c => c.id === selectedId);
          if (found) {
            console.log(`✅ AI selected category: ${found.name} (${found.id}) — ${found.path}`);
            return { id: found.id, name: found.name };
          }
        }
      }
    } catch (e) {
      console.error("AI category selection error:", e);
    }
  }

  if (scored.length > 0) {
    return { id: scored[0].id, name: scored[0].name };
  }
  return { id: 91491, name: "Смартфоны" };
}

// ============ STEP 2: FETCH CATEGORY PARAMETERS ============

async function fetchCategoryParameters(apiKey: string, categoryId: number): Promise<any[]> {
  try {
    const resp = await fetch(`${YANDEX_API}/category/${categoryId}/parameters`, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!resp.ok) {
      console.error(`Params fetch failed: ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    return data.result?.parameters || [];
  } catch (e) {
    console.error("Params fetch error:", e);
    return [];
  }
}

// ============ STEP 3: AI FILLS ALL CONTENT + PARAMETERS ============

async function aiOptimize(
  product: ProductInput,
  categoryName: string,
  categoryParams: any[],
  lovableApiKey: string
): Promise<any> {
  // Filter out URL/PICKER type params — they require special URLs that AI can't generate
  const safeParams = categoryParams.filter((p: any) => {
    const type = (p.type || "").toUpperCase();
    if (type === "URL" || type === "PICKER") return false;
    if (p.name?.toLowerCase().includes("url")) return false;
    return true;
  });
  
  // ALL params — required, recommended, AND hidden ("Maydonlarni ko'rsatish" params)
  const allParams = safeParams; // Don't filter — fill EVERYTHING

  const formatParam = (p: any) => {
    let s = `  - id:${p.id}, "${p.name}", type:${p.type || "TEXT"}, required:${p.required || p.constraintType === "REQUIRED" ? "YES" : "no"}`;
    if (p.unit) s += `, unit:"${p.unit}"`;
    if (p.values?.length) {
      const vals = p.values.slice(0, 25).map((v: any) => `{id:${v.id},"${v.value}"}`).join(", ");
      s += `\n    OPTIONS:[${vals}]`;
      if (p.values.length > 25) s += ` +${p.values.length - 25}`;
    }
    return s;
  };

  console.log(`🤖 AI optimizing: ${allParams.length} TOTAL params (filling ALL including hidden)`);

  const prompt = `VAZIFA: Yandex Market kartochkasi uchun BARCHA ${allParams.length} ta parametrni to'ldir!
MAQSAD: MAKSIMAL ball olish. "Maydonlarni ko'rsatish" (Показать поля) ortidagi YASHIRIN parametrlar ham ALBATTA to'ldirilishi SHART!

MAHSULOT:
- Nom: ${product.name}
- Tavsif: ${product.description || "YO'Q — O'ZING YOZ!"}
- Kategoriya: ${categoryName}
- Brend: ${product.brand || "Nomdan aniqla"}
- Rang: ${product.color || "Nomdan aniqla"}
- Model: ${product.model || "Nomdan aniqla"}
- Narx: ${product.price} UZS

═══ BARCHA PARAMETRLAR — HAR BIRINI TO'LDIR! ═══
${allParams.map(formatParam).join("\n")}

QOIDALAR:
1. name_ru: Ruscha SEO-nom, 80-150 belgi. Format: "[Tur] [Brend] [Model] [Xususiyatlar], [rang]"
2. name_uz: O'zbekcha LOTIN, 80-150 belgi
3. description_ru: 800-3000 belgi ruscha tavsif. HTML TEGLARISIZ! Oddiy matn. 6+ paragraf.
4. description_uz: 600-2000 belgi o'zbekcha LOTIN tavsif. HTML TEGLARISIZ!
5. vendor: Aniq brend nomi
6. vendorCode: Model artikuli
7. manufacturerCountry: Ishlab chiqarilgan mamlakat (ruscha)
8. shelfLife: Yaroqlilik muddati (oy). Kosmetika=36, Oziq-ovqat=12, Elektronika bermang
9. lifeTime: Foydalanish muddati (oy). Kosmetika=36, Kiyim=24, Elektronika=60
10. parameterValues — MUHIM QOIDALAR:
   - OPTIONS bor parametr → valueId (raqam) tanla, eng mos variant
   - TEXT parametr → FAQAT qiymatni yoz! "Цвет: красный" XATO → "красный" TO'G'RI
   - NUMBER parametr → value raqam
   - BOOLEAN parametr → "true" yoki "false"
   
   *** JUDA MUHIM: HAR BIR ${allParams.length} ta parametrni to'ldir! ***
   *** BO'SH QOLDIRMA! Bilmasang — mahsulotga mos taxminiy qiymat yoz! ***
   *** Har bir parametr uchun FAQAT value YOKI valueId ber, ikkalasini emas! ***
11. warranty: "1 год" yoki "2 года"
12. weightDimensions — REAL o'lchamlar:
   - Kosmetika/parfyum: weight=0.05-0.3kg, 5x5x10 ~ 10x10x15 sm
   - Telefon: weight=0.15-0.25kg, 8x1x16 sm
   - Krossovka: weight=0.4-0.8kg, 35x25x12 sm  
   - Maishiy texnika (kichik): weight=0.5-3kg, 20x15x15 ~ 40x30x30 sm
   - KATTA qo'yma! Logistika narxi oshadi!

JAVOB FAQAT JSON:
{"name_ru":"...","name_uz":"...","description_ru":"...","description_uz":"...","vendor":"...","vendorCode":"...","manufacturerCountry":"...","shelfLife":null,"lifeTime":null,"parameterValues":[{"parameterId":123,"valueId":456},{"parameterId":789,"value":"qiymat"}],"warranty":"1 год","adult":false,"weightKg":0.15,"lengthCm":10,"widthCm":8,"heightCm":5}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 12000,
      }),
    });

    if (!resp.ok) { console.error("AI failed:", resp.status); return null; }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`🤖 AI: name_ru=${result.name_ru?.length}ch, desc=${result.description_ru?.length}ch, params=${result.parameterValues?.length}, weight=${result.weightKg}kg`);
      return result;
    }
  } catch (e) { console.error("AI error:", e); }
  return null;
}

// ============ BUILD OFFER ============

function buildOffer(
  product: ProductInput, ai: any, sku: string, barcode: string,
  category: { id: number; name: string },
  mxik: { code: string; name_uz: string },
  price: number, images: string[]
): any {
  const name = stripHtml(ai?.name_ru || product.name);
  let finalName = name.length >= 80 ? name : `${name}, ${category.name}`;
  finalName = finalName.substring(0, 150);

  const desc = stripHtml(ai?.description_ru || product.description || product.name);

  // Use AI-provided realistic dimensions, fallback to small defaults (not inflated!)
  const weight = ai?.weightKg || product.weight || 0.15;
  const length = ai?.lengthCm || product.dimensions?.length || 10;
  const width = ai?.widthCm || product.dimensions?.width || 8;
  const height = ai?.heightCm || product.dimensions?.height || 5;

  const offer: any = {
    offerId: sku,
    name: finalName,
    marketCategoryId: category.id,
    vendor: ai?.vendor || product.brand || "OEM",
    description: desc.substring(0, 6000),
    barcodes: [barcode],
    vendorCode: ai?.vendorCode || sku,
    manufacturerCountries: [ai?.manufacturerCountry || "Китай"],
    weightDimensions: { length, width, height, weight },
    basicPrice: { value: price, currencyId: "UZS" },
    type: "DEFAULT",
    adult: ai?.adult || false,
  };

  // IKPU
  if (mxik.code?.length === 17 && /^\d+$/.test(mxik.code)) {
    offer.commodityCodes = [{ code: mxik.code, type: "IKPU_CODE" }];
  }

  // Images
  if (images.length > 0) {
    offer.pictures = images.slice(0, 10);
    console.log(`🖼️ ${offer.pictures.length} images added`);
  }

  // Parameters — filter out picker/URL params and sanitize values
  const BLOCKED_PARAM_IDS = [40164890]; // Known picker URL params
  if (ai?.parameterValues?.length) {
    offer.parameterValues = ai.parameterValues
      .filter((p: any) => p.parameterId && (p.value !== undefined || p.valueId !== undefined))
      .filter((p: any) => !BLOCKED_PARAM_IDS.includes(Number(p.parameterId)))
      .map((p: any) => {
        const pv: any = { parameterId: Number(p.parameterId) };
        if (p.valueId !== undefined && p.valueId !== null) {
          pv.valueId = Number(p.valueId);
        } else if (p.value !== undefined) {
          // Strip "название: значение" format → keep only value part
          let val = String(p.value);
          // Remove patterns like "Название характеристики: " or "Цвет: "
          val = val.replace(/^[А-Яа-яA-Za-z\s\-()]+:\s*/u, '');
          // For numeric-looking values, ensure they're reasonable
          const numVal = parseFloat(val);
          if (!isNaN(numVal) && numVal < 1 && numVal >= 0) {
            val = "1"; // Minimum value fix for SPF, volume, etc.
          }
          pv.value = val;
        }
        if (p.unitId) pv.unitId = String(p.unitId);
        return pv;
      });
    console.log(`📊 ${offer.parameterValues.length} params (filtered & sanitized)`);
  }

  // Shelf life (Yaroqlilik muddati) — required for cosmetics, food, etc.
  if (ai?.shelfLife && ai.shelfLife > 0) {
    offer.shelfLife = { timePeriod: ai.shelfLife, timeUnit: "MONTH" };
  }
  // Life time (Foydalanish muddati)
  if (ai?.lifeTime && ai.lifeTime > 0) {
    offer.lifeTime = { timePeriod: ai.lifeTime, timeUnit: "MONTH" };
  }

  // Warranty
  if (ai?.warranty) {
    const m = ai.warranty.match(/(\d+)\s*(год|года|лет|year|месяц|month)/i);
    if (m) {
      const n = parseInt(m[1]);
      const isYear = /год|года|лет|year/i.test(m[2]);
      offer.guaranteePeriod = { timePeriod: isYear ? n * 12 : n, timeUnit: "MONTH" };
    }
  }

  return offer;
}

// ============ SEND UZBEK CONTENT ============

async function sendUzbekContent(apiKey: string, businessId: string, offerId: string, nameUz: string, descUz: string): Promise<boolean> {
  if (!nameUz && !descUz) return false;
  try {
    const offer: any = { offerId };
    if (nameUz) offer.name = stripHtml(nameUz).substring(0, 150);
    if (descUz) offer.description = stripHtml(descUz).substring(0, 6000);

    const resp = await fetch(`${YANDEX_API}/businesses/${businessId}/offer-mappings/update?language=UZ`, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ offerMappings: [{ offer }] }),
    });
    if (resp.ok) { console.log(`✅ UZ content sent`); return true; }
    else { console.error(`❌ UZ failed: ${resp.status}`); return false; }
  } catch (e) { console.error("UZ error:", e); return false; }
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user)
      return new Response(JSON.stringify({ error: "Auth failed" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const creds = await getYandexCredentials(supabase, user.id);
    if (!creds)
      return new Response(JSON.stringify({ error: "Yandex Market ulanmagan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: CreateCardRequest = await req.json();
    const products = body.products || [body.product];
    if (!products.length || !products[0])
      return new Response(JSON.stringify({ error: "Product required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let shopId = creds.shopId || body.shopId;
    if (!shopId || shopId === "sellercloud") {
      const { data: s } = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1).single();
      shopId = s?.id || null;
    }

    console.log(`🚀 Creating ${products.length} card(s) for ${user.id}`);
    const results: any[] = [];

    for (const product of products) {
      try {
        const pricing = body.pricing || {
          costPrice: product.costPrice || Math.round(product.price * 0.6),
          recommendedPrice: product.price,
          marketplaceCommission: Math.round(product.price * 0.15),
          logisticsCost: 3000, taxRate: 4,
          targetProfit: Math.round(product.price * 0.2),
          netProfit: Math.round(product.price * 0.2),
        };

        const sku = generateSKU(product.name);
        const barcode = product.barcode || generateEAN13();

        // ═══ STEP 1: Get source image for AI reference (NOT for card!) ═══
        const rawImgs: string[] = [];
        if (product.images?.length) rawImgs.push(...product.images);
        if (product.image && !rawImgs.includes(product.image)) rawImgs.unshift(product.image);
        
        // Proxy source images to storage (for AI reference only)
        const sourceImages = await proxyImagesToStorage(supabase, user.id, rawImgs, SUPABASE_URL);
        const sourceImg = sourceImages[0] || null; // First image = AI reference
        
        // CRITICAL: Don't use raw camera/gallery images on card!
        // Always generate fresh professional images using AI
        let images: string[] = [];
        
        // Cost optimization: skip image generation if cloning (reuse existing images)
        if (LOVABLE_KEY && !body.skipImageGeneration) {
          console.log(`🖼️ Generating 4 creative professional images (source ref: ${sourceImg ? 'yes' : 'no'})...`);
          const creativeAngles = [
            `Professional e-commerce HERO shot of "${product.name}" centered on pristine white background. Perfect studio lighting, soft diffused shadows. The product must fill 70% of frame. Ultra-sharp 4K quality, no text overlays.`,
            `Elegant LIFESTYLE photo of "${product.name}" in a beautiful, aspirational usage setting. Natural warm lighting, shallow depth of field, bokeh background. Show the product in context — on a vanity table, in a kitchen, on a desk, etc. depending on category.`,
            `Premium 45-DEGREE ANGLE studio shot of "${product.name}" on subtle gradient background (white to light gray). Dramatic rim lighting highlighting texture and build quality. Professional catalog photography.`,
            `DETAIL MACRO close-up of "${product.name}" showing premium texture, material quality, branding, key buttons or functional elements. Shallow depth of field, studio lighting on clean background.`,
          ];
          
          const imgPromises = creativeAngles.map((angle, i) => (async () => {
            try {
              const genBody: any = {
                model: "google/gemini-2.5-flash-image",
                modalities: ["image", "text"],
                messages: [{
                  role: "user",
                  content: sourceImg ? [
                    { type: "text", text: `You are an elite product photographer for a premium marketplace. Using this product as EXACT visual reference (same shape, color, brand, every detail must be IDENTICAL), create: ${angle}\n\nCRITICAL: The product must look 100% identical to the reference — same brand logo, same color, same shape. ONLY change the angle, background, and lighting. Do NOT add any text, watermarks, or labels to the image.` },
                    { type: "image_url", image_url: { url: sourceImg } }
                  ] : angle
                }],
              };
              
              const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify(genBody),
              });
              
              if (res.ok) {
                const data = await res.json();
                const imgData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                if (imgData && imgData.startsWith("data:image")) {
                  const base64 = imgData.split(",")[1];
                  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                  const fileName = `${user.id}/ym-gen-${Date.now()}-${i}.png`;
                  const { error } = await supabase.storage.from('product-images').upload(fileName, bytes, {
                    contentType: 'image/png', cacheControl: '31536000', upsert: false,
                  });
                  if (!error) {
                    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
                    if (urlData?.publicUrl) {
                      console.log(`✅ Generated creative image ${i + 1}: ${creativeAngles[i].substring(0, 30)}`);
                      return urlData.publicUrl;
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`Image gen ${i} error:`, e);
            }
            return null;
          })());
          
          const generatedImgs = await Promise.all(imgPromises);
          images = generatedImgs.filter(Boolean) as string[];
        } else if (body.skipImageGeneration) {
          console.log(`💰 Cost optimization: reusing ${sourceImages.length} images for clone`);
          images = sourceImages;
        }
        
        // If no images generated, fall back to source (better than nothing)
        if (images.length === 0 && sourceImages.length > 0) {
          console.warn("⚠️ No images generated, falling back to source images");
          images = sourceImages;
        }
        console.log(`🖼️ Total ${images.length} professional images ready`);

        // ═══ STEP 2: Find LEAF category from Yandex tree ═══
        const leafCat = await findLeafCategory(creds.apiKey, product.name, product.description || "", LOVABLE_KEY);
        console.log(`📂 Category: ${leafCat.name} (${leafCat.id})`);

        // ═══ STEP 3: Fetch category parameters ═══
        const params = await fetchCategoryParameters(creds.apiKey, leafCat.id);
        console.log(`📋 ${params.length} params for category ${leafCat.id}`);

        // ═══ STEP 4: AI optimization ═══
        let ai: any = null;
        if (LOVABLE_KEY) {
          ai = await aiOptimize(product, leafCat.name, params, LOVABLE_KEY);
        }

        // ═══ STEP 5: MXIK lookup (AI-powered) ═══
        const mxik = (product.mxikCode && product.mxikName)
          ? { code: product.mxikCode, name_uz: product.mxikName }
          : await lookupMXIK(supabase, product.name, product.category, LOVABLE_KEY);

        // ═══ STEP 6: Build & send offer ═══
        const offer = buildOffer(product, ai, sku, barcode, leafCat, mxik, pricing.recommendedPrice, images);

        console.log(`📤 Sending: ${offer.name?.substring(0, 60)} | cat:${leafCat.id} | params:${offer.parameterValues?.length || 0} | imgs:${offer.pictures?.length || 0}`);

        const yResp = await fetch(`${YANDEX_API}/businesses/${creds.businessId}/offer-mappings/update`, {
          method: "POST",
          headers: { "Api-Key": creds.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ offerMappings: [{ offer }] }),
        });

        const respText = await yResp.text();
        let yResult: any;
        try { yResult = JSON.parse(respText); } catch { yResult = { raw: respText }; }

        if (!yResp.ok) console.error(`❌ Yandex error (${yResp.status}):`, respText.substring(0, 300));

        // ═══ STEP 7: Uzbek content ═══
        let uzSent = false;
        if (yResp.ok && ai?.name_uz) {
          await new Promise(r => setTimeout(r, 300));
          uzSent = await sendUzbekContent(creds.apiKey, creds.businessId, sku, ai.name_uz, ai.description_uz);
        }

        // ═══ STEP 8: Save locally ═══
        let saved = null;
        if (shopId) {
          const { data, error } = await supabase.from("products").insert({
            shop_id: shopId, name: product.name,
            description: stripHtml(ai?.description_uz || ai?.description_ru || product.description || ""),
            price: pricing.recommendedPrice, original_price: pricing.costPrice,
            source: "ai" as any, source_url: product.sourceUrl,
            images: images.length > 0 ? images : (product.images || []),
            status: "draft" as any, mxik_code: mxik.code, mxik_name: mxik.name_uz,
            specifications: {
              yandex_offer_id: sku, yandex_business_id: creds.businessId,
              yandex_category_id: leafCat.id, yandex_category_name: leafCat.name,
              yandex_status: yResp.ok ? "success" : "error",
              barcode, vendor: offer.vendor, name_uz: ai?.name_uz, name_ru: ai?.name_ru,
              params_count: offer.parameterValues?.length || 0,
              images_count: images.length, uz_content_sent: uzSent,
            },
          }).select().single();
          if (!error) saved = data;
        }

        results.push({
          success: yResp.ok,
          offerId: sku, barcode,
          name: offer.name,
          nameUz: ai?.name_uz,
          cardUrl: `https://partner.market.yandex.ru/business/${creds.businessId}/assortment/offer/${encodeURIComponent(sku)}`,
          categoryId: leafCat.id,
          categoryName: leafCat.name,
          paramsCount: offer.parameterValues?.length || 0,
          imagesCount: offer.pictures?.length || 0,
          mxikCode: mxik.code,
          uzContentSent: uzSent,
          yandexResponse: yResult,
          localProductId: saved?.id,
          error: yResp.ok ? null : (yResult?.errors?.[0]?.message || `HTTP ${yResp.status}`),
        });

        console.log(`${yResp.ok ? "✅" : "❌"} Done: params=${offer.parameterValues?.length || 0}, imgs=${images.length}`);

        if (products.length > 1) await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error(`❌ Error:`, err);
        results.push({ success: false, name: product.name, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: results.every(r => r.success),
      total: results.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
