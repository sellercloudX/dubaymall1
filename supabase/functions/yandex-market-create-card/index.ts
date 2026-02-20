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
  cloneMode?: boolean; // Use cheaper AI models for cloning
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

// ============ STEP 3: AI FILLS ALL CONTENT + PARAMETERS (2-PASS) ============

async function aiOptimize(
  product: ProductInput,
  categoryName: string,
  categoryParams: any[],
  lovableApiKey: string,
  cloneMode: boolean = false
): Promise<any> {
  // Filter out URL/PICKER type params — they require special URLs that AI can't generate
  const safeParams = categoryParams.filter((p: any) => {
    const type = (p.type || "").toUpperCase();
    if (type === "URL" || type === "PICKER") return false;
    if (p.name?.toLowerCase().includes("url")) return false;
    return true;
  });
  
  const allParams = safeParams;

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

  console.log(`🤖 AI optimizing (2-pass): ${allParams.length} TOTAL params`);

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
1. name_ru: Ruscha SEO-nom, 80-150 belgi. Format: "[Tur] [Brend] [Model] [Xususiyatlar], [rang]". MAJBURIY!
2. name_uz: O'ZBEKCHA LOTIN yozuvida nom, 80-150 belgi. MAJBURIY! Bu KIRILL emas, LOTIN yozuvi! Masalan: "Tonal krem Estée Lauder Double Wear, to'q jigarrang". Ruscha so'zlar bo'lmasin!
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
   
   ⚠️⚠️⚠️ BITTA VARIANT QOIDASI ⚠️⚠️⚠️:
   - Har bir parametr uchun FAQAT BITTA qiymat ber!
   - Masalan rang uchun FAQAT bitta rang: "белый" yoki "черный" — ikkalasini berma!
   - O'lcham uchun FAQAT bitta o'lcham: "M" yoki "42" — bir nechtasini berma!
   - Bu BITTA VARIANT kartochkasi — variantlar kerak emas!
11. warranty: "1 год" yoki "2 года"
12. weightDimensions — REAL o'lchamlar:
   - Kosmetika/parfyum: weight=0.05-0.3kg, 5x5x10 ~ 10x10x15 sm
   - Telefon: weight=0.15-0.25kg, 8x1x16 sm
   - Krossovka: weight=0.4-0.8kg, 35x25x12 sm  
   - Maishiy texnika (kichik): weight=0.5-3kg, 20x15x15 ~ 40x30x30 sm
   - KATTA qo'yma! Logistika narxi oshadi!

JAVOB FAQAT JSON:
{"name_ru":"...","name_uz":"...","description_ru":"...","description_uz":"...","vendor":"...","vendorCode":"...","manufacturerCountry":"...","shelfLife":null,"lifeTime":null,"parameterValues":[{"parameterId":123,"valueId":456},{"parameterId":789,"value":"qiymat"}],"warranty":"1 год","adult":false,"weightKg":0.15,"lengthCm":10,"widthCm":8,"heightCm":5}`;

  // Use better model for first pass
  const aiModel = cloneMode ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";
  
  let result: any = null;
  
  // ═══ PASS 1: Initial AI fill ═══
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: cloneMode ? 8000 : 16000,
      }),
    });

    if (!resp.ok) { console.error("AI Pass 1 failed:", resp.status); return null; }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
      console.log(`🤖 Pass 1: name_ru=${result.name_ru?.length}ch, desc=${result.description_ru?.length}ch, params=${result.parameterValues?.length}, weight=${result.weightKg}kg`);
    }
  } catch (e) { console.error("AI Pass 1 error:", e); }
  
  if (!result) return null;

  // ═══ PASS 2: Find missing params and fill them ═══
  const filledParamIds = new Set(
    (result.parameterValues || []).map((p: any) => Number(p.parameterId))
  );
  const missingParams = allParams.filter((p: any) => !filledParamIds.has(Number(p.id)));
  
  if (missingParams.length > 0 && missingParams.length <= 80) {
    console.log(`🔄 Pass 2: ${missingParams.length} params bo'sh qoldi, to'ldirish...`);
    
    const pass2Prompt = `VAZIFA: Quyidagi ${missingParams.length} ta BO'SH parametrni to'ldir!
Bular birinchi bosqichda to'ldirilmagan parametrlar. HAR BIRINI ALBATTA to'ldir!

MAHSULOT: "${product.name}" — ${categoryName}
Brend: ${result.vendor || product.brand || "OEM"}

BO'SH PARAMETRLAR:
${missingParams.map(formatParam).join("\n")}

QOIDALAR:
- OPTIONS bor → valueId (raqam) tanla
- TEXT → FAQAT qiymat ("красный", "100 мл")
- NUMBER → raqam
- BOOLEAN → "true"/"false"
- Bilmasang ham — mahsulotga mos TAXMINIY qiymat yoz!

JAVOB FAQAT JSON array:
[{"parameterId":123,"valueId":456},{"parameterId":789,"value":"qiymat"}]`;

    try {
      const resp2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: pass2Prompt }],
          temperature: 0.1,
          max_tokens: 6000,
        }),
      });

      if (resp2.ok) {
        const data2 = await resp2.json();
        const content2 = data2.choices?.[0]?.message?.content || "";
        const arrMatch = content2.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const extraParams = JSON.parse(arrMatch[0]);
          if (Array.isArray(extraParams) && extraParams.length > 0) {
            result.parameterValues = [...(result.parameterValues || []), ...extraParams];
            console.log(`✅ Pass 2: +${extraParams.length} params to'ldirildi. Jami: ${result.parameterValues.length}`);
          }
        }
      }
    } catch (e) {
      console.error("AI Pass 2 error:", e);
    }
  } else if (missingParams.length === 0) {
    console.log(`✅ Pass 1 da barcha ${allParams.length} param to'ldirildi!`);
  } else {
    console.log(`⚠️ ${missingParams.length} param bo'sh qoldi (juda ko'p, pass 2 o'tkazildi)`);
  }

  return result;
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

  // Parameters — filter out picker/URL params, ensure SINGLE VALUES only (no multi-variant!)
  const BLOCKED_PARAM_IDS = [40164890]; // Known picker URL params
  if (ai?.parameterValues?.length) {
    // Track seen parameterIds to ensure ONLY ONE value per parameter (single variant!)
    const seenParamIds = new Set<number>();
    offer.parameterValues = ai.parameterValues
      .filter((p: any) => p.parameterId && (p.value !== undefined || p.valueId !== undefined))
      .filter((p: any) => !BLOCKED_PARAM_IDS.includes(Number(p.parameterId)))
      .filter((p: any) => {
        // CRITICAL: Only keep FIRST value for each parameter — prevents multi-variant creation
        const pid = Number(p.parameterId);
        if (seenParamIds.has(pid)) return false;
        seenParamIds.add(pid);
        return true;
      })
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
    console.log(`📊 ${offer.parameterValues.length} params (filtered, single-variant, sanitized)`);
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

        // ═══ STEP 1: Get source image for AI reference ONLY (NOT for card!) ═══
        const rawImgs: string[] = [];
        if (product.images?.length) rawImgs.push(...product.images);
        if (product.image && !rawImgs.includes(product.image)) rawImgs.unshift(product.image);
        
        // Proxy source images to storage (for AI reference ONLY — these are camera/gallery photos)
        const sourceImages = await proxyImagesToStorage(supabase, user.id, rawImgs, SUPABASE_URL);
        const sourceImg = sourceImages[0] || null; // First image = AI reference ONLY
        
        // CRITICAL: Don't use raw camera/gallery images on card!
        // Only AI-generated professional images will be used on the actual card
        let images: string[] = [];
        
        // Cost optimization: skip image generation if cloning (reuse existing images)
        if (LOVABLE_KEY && !body.skipImageGeneration) {
          // Determine category-specific marketplace card design style
          const catLower = (product.category || product.name || "").toLowerCase();
          let cardBg = "clean white-to-light-gray gradient";
          let cardAccent = "soft blue accent glow";
          let cardMood = "premium marketplace listing";
          
          if (catLower.includes("kosmetik") || catLower.includes("beauty") || catLower.includes("go'zallik") || catLower.includes("parfum") || catLower.includes("cream")) {
            cardBg = "soft rose-gold to cream gradient with subtle golden sparkle particles";
            cardAccent = "rose-gold shimmer and soft floral bokeh";
            cardMood = "luxury beauty brand advertisement, Sephora/Charlotte Tilbury level";
          } else if (catLower.includes("elektron") || catLower.includes("phone") || catLower.includes("smartfon") || catLower.includes("kompyuter") || catLower.includes("audio") || catLower.includes("tech")) {
            cardBg = "sleek dark charcoal-to-black gradient (#0a0a0a to #1a1a2e) with subtle electric blue ambient glow";
            cardAccent = "electric blue neon rim lighting and holographic shimmer";
            cardMood = "Apple/Samsung flagship device launch, futuristic premium tech";
          } else if (catLower.includes("kiyim") || catLower.includes("fashion") || catLower.includes("poyabzal") || catLower.includes("shoes")) {
            cardBg = "warm off-white to beige gradient with subtle fabric texture overlay";
            cardAccent = "warm gold accent lines and editorial composition";
            cardMood = "ZARA/H&M catalog photography, clean fashion editorial";
          } else if (catLower.includes("sport") || catLower.includes("fitness")) {
            cardBg = "dynamic dark gradient with energetic orange-red accent streaks";
            cardAccent = "fiery orange rim lighting and motion blur energy lines";
            cardMood = "Nike/Adidas campaign photography, dynamic and powerful";
          } else if (catLower.includes("bolalar") || catLower.includes("kids") || catLower.includes("baby") || catLower.includes("toy")) {
            cardBg = "soft cheerful pastel rainbow gradient (light blue, mint, soft yellow)";
            cardAccent = "bright playful shapes and confetti dots";
            cardMood = "safe, bright, parent-friendly, Mothercare quality";
          } else if (catLower.includes("oziq") || catLower.includes("food") || catLower.includes("ovqat") || catLower.includes("drink")) {
            cardBg = "warm appetizing gradient with subtle wooden surface texture";
            cardAccent = "warm amber lighting and freshness glow";
            cardMood = "premium food photography, appetizing and inviting";
          }

          console.log(`🖼️ Generating 4 Pinterest-style marketplace card images (${cardMood})...`);
          const creativeAngles = [
            `Create a PREMIUM MARKETPLACE CARD image: ${cardBg} background. Product "${product.name}" centered, fills 75% of frame. ${cardAccent} around the product edges. Professional three-point studio lighting with dramatic rim light. Subtle reflection beneath. Style: ${cardMood}. NO text, NO watermarks, NO labels overlaid on the image. Ultra-sharp 4K quality, 3:4 marketplace card ratio.`,
            `Create a LIFESTYLE MARKETPLACE CARD: ${cardBg} with subtle lifestyle elements (soft bokeh, ambient glow, aspirational setting). Product "${product.name}" slightly angled at 15 degrees for dynamic feel. Warm inviting lighting creating emotional connection and desire to purchase. ${cardAccent}. Style: ${cardMood}. NO text overlays. Premium marketplace listing quality.`,
            `Create a PREMIUM ANGLE MARKETPLACE CARD: ${cardBg}. Three-quarter angle perspective of "${product.name}" showing 3D depth. Dramatic rim lighting creating stunning silhouette edge highlight. Sophisticated composition with artistic negative space. ${cardAccent}. Style: ${cardMood}. NO text overlays. Luxury catalog quality.`,
            `Create a DETAIL SHOWCASE MARKETPLACE CARD: ${cardBg}. Close-up of "${product.name}" showing premium texture, material quality, branding details. Product fills 85% of frame. Bright even lighting emphasizing craftsmanship and quality. ${cardAccent}. Style: ${cardMood}. NO text overlays. Professional macro-style marketplace photography.`,
          ];
          
          const imgPromises = creativeAngles.map((angle, i) => (async () => {
            try {
              const genBody: any = {
                model: "google/gemini-3-pro-image-preview",
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
          console.log(`💰 Clone mode: source has ${sourceImages.length} images`);
          images = [...sourceImages];
          
          // If source has < 4 images, generate supplementary AI images to boost quality score
          if (images.length < 4 && LOVABLE_KEY) {
            const needed = 4 - images.length;
            console.log(`🖼️ Generating ${needed} supplementary images for clone quality boost...`);
            const supplementAngles = [
              `LIFESTYLE photo of "${product.name}" in elegant real-world setting, warm natural lighting, aspirational composition. NO text, NO labels. Ultra-sharp 4K, 3:4 ratio.`,
              `PREMIUM ANGLE photo of "${product.name}" at three-quarter perspective showing 3D depth, dramatic rim lighting, sophisticated composition. NO text. 4K quality, 3:4 ratio.`,
              `DETAIL CLOSE-UP of "${product.name}" showing texture, material quality, branding. Product fills 85% frame, bright even lighting. NO text. 4K, 3:4 ratio.`,
            ].slice(0, needed);
            
            const suppPromises = supplementAngles.map((angle, i) => (async () => {
              try {
                const refImg = sourceImages[0] || null;
                const genBody: any = {
                  model: "google/gemini-3-pro-image-preview",
                  modalities: ["image", "text"],
                  messages: [{
                    role: "user",
                    content: refImg ? [
                      { type: "text", text: `Using this product as EXACT visual reference (same shape, color, brand), create: ${angle}\nCRITICAL: Product must look identical to reference. Only change angle/background/lighting.` },
                      { type: "image_url", image_url: { url: refImg } }
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
                  if (imgData?.startsWith("data:image")) {
                    const base64 = imgData.split(",")[1];
                    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                    const fileName = `${user.id}/ym-supp-${Date.now()}-${i}.png`;
                    const { error } = await supabase.storage.from('product-images').upload(fileName, bytes, {
                      contentType: 'image/png', cacheControl: '31536000', upsert: false,
                    });
                    if (!error) {
                      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
                      if (urlData?.publicUrl) {
                        console.log(`✅ Supplementary image ${i + 1} generated`);
                        return urlData.publicUrl;
                      }
                    }
                  }
                }
              } catch (e) { console.error(`Supp image ${i} error:`, e); }
              return null;
            })());
            
            const suppResults = await Promise.all(suppPromises);
            images.push(...suppResults.filter(Boolean) as string[]);
            console.log(`📸 Clone total: ${images.length} images (${sourceImages.length} source + ${images.length - sourceImages.length} AI)`);
          }
        }
        
        // If no images at all, fall back to source
        if (images.length === 0 && sourceImages.length > 0) {
          console.warn("⚠️ No images, using source as fallback");
          images = sourceImages;
        }
        console.log(`🖼️ Total ${images.length} professional images ready`);

        // ═══ STEP 2: Find LEAF category from Yandex tree ═══
        // COST OPTIMIZATION: For clones, use cheaper Flash Lite for category detection
        const leafCat = await findLeafCategory(creds.apiKey, product.name, product.description || "", LOVABLE_KEY);
        console.log(`📂 Category: ${leafCat.name} (${leafCat.id})`);

        // ═══ STEP 3: Fetch category parameters ═══
        const params = await fetchCategoryParameters(creds.apiKey, leafCat.id);
        console.log(`📋 ${params.length} params for category ${leafCat.id}`);

        // ═══ STEP 4: AI optimization ═══
        let ai: any = null;
        if (LOVABLE_KEY) {
          const isClone = !!body.skipImageGeneration;
          if (isClone) {
            console.log(`💰 Clone mode: using Flash instead of Pro for AI optimization`);
          }
          ai = await aiOptimize(product, leafCat.name, params, LOVABLE_KEY, isClone);
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

        // ═══ STEP 7.5: Auto quality check ═══
        let qualityCheck: any = null;
        if (yResp.ok && LOVABLE_KEY) {
          try {
            console.log("🔍 Running auto quality check...");
            await new Promise(r => setTimeout(r, 1000));
            
            // Fetch the created offer to check quality
            const checkResp = await fetch(`${YANDEX_API}/businesses/${creds.businessId}/offer-mappings?offerIds=${encodeURIComponent(sku)}`, {
              method: "POST",
              headers: { "Api-Key": creds.apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ offerIds: [sku] }),
            });
            
            if (checkResp.ok) {
              const checkData = await checkResp.json();
              const offerMapping = checkData.result?.offerMappings?.[0];
              const cardStatus = offerMapping?.mapping?.status || offerMapping?.awaitingModerationMapping?.cardStatus || "UNKNOWN";
              const errors = offerMapping?.mapping?.errors || [];
              const warnings = offerMapping?.mapping?.warnings || [];
              
              qualityCheck = {
                status: cardStatus,
                errorsCount: errors.length,
                warningsCount: warnings.length,
                errors: errors.slice(0, 5).map((e: any) => e.message || e.code),
                warnings: warnings.slice(0, 5).map((w: any) => w.message || w.code),
              };
              
              console.log(`📊 Quality: status=${cardStatus}, errors=${errors.length}, warnings=${warnings.length}`);
              
              // Auto-fix errors by asking AI to correct and re-submitting
              if (errors.length > 0 && LOVABLE_KEY) {
                console.log("🔧 Auto-fixing errors:", errors.slice(0, 5).map((e: any) => e.message || e.code));
                try {
                  const errorMessages = errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join("\n");
                  const fixPrompt = `Yandex Market kartochkasida quyidagi xatolar topildi:
${errorMessages}

Joriy offer ma'lumotlari:
- name: ${offer.name}
- vendor: ${offer.vendor}
- vendorCode: ${offer.vendorCode}
- categoryId: ${leafCat.id} (${leafCat.name})
- parameterValues count: ${offer.parameterValues?.length || 0}
- shelfLife: ${JSON.stringify(offer.shelfLife)}
- lifeTime: ${JSON.stringify(offer.lifeTime)}
- weightDimensions: ${JSON.stringify(offer.weightDimensions)}

Xatolarni tuzatish uchun qaysi maydonlarni o'zgartirish kerak? Javob FAQAT JSON:
{"fixes": {"name": "yangi nom yoki null", "shelfLife": {"timePeriod": 36, "timeUnit": "MONTH"}, "lifeTime": {"timePeriod": 36, "timeUnit": "MONTH"}, "parameterValues": [{"parameterId": 123, "value": "qiymat"}], "vendor": "yangi vendor yoki null"}}
Faqat tuzatish kerak bo'lgan maydonlarni ber. null = o'zgartirma.`;

                  const fixResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [{ role: "user", content: fixPrompt }],
                      temperature: 0, max_tokens: 2000,
                    }),
                  });

                  if (fixResp.ok) {
                    const fixData = await fixResp.json();
                    const fixContent = fixData.choices?.[0]?.message?.content || "";
                    const fixMatch = fixContent.match(/\{[\s\S]*\}/);
                    if (fixMatch) {
                      const fixes = JSON.parse(fixMatch[0]).fixes || JSON.parse(fixMatch[0]);
                      console.log("🔧 AI fixes:", Object.keys(fixes));
                      
                      // Apply fixes to offer
                      if (fixes.name && fixes.name !== "null") offer.name = fixes.name;
                      if (fixes.vendor && fixes.vendor !== "null") offer.vendor = fixes.vendor;
                      if (fixes.shelfLife) offer.shelfLife = fixes.shelfLife;
                      if (fixes.lifeTime) offer.lifeTime = fixes.lifeTime;
                      if (fixes.parameterValues?.length) {
                        // Merge: replace existing or add new
                        const existingMap = new Map((offer.parameterValues || []).map((p: any) => [p.parameterId, p]));
                        for (const fp of fixes.parameterValues) {
                          existingMap.set(fp.parameterId, fp);
                        }
                        offer.parameterValues = Array.from(existingMap.values());
                      }

                      // Re-submit fixed offer
                      console.log("📤 Re-submitting fixed offer...");
                      const fixedResp = await fetch(`${YANDEX_API}/businesses/${creds.businessId}/offer-mappings/update`, {
                        method: "POST",
                        headers: { "Api-Key": creds.apiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({ offerMappings: [{ offer }] }),
                      });
                      
                      if (fixedResp.ok) {
                        console.log("✅ Auto-fix submitted successfully");
                        qualityCheck.autoFixed = true;
                        qualityCheck.fixedFields = Object.keys(fixes).filter(k => fixes[k] !== null && fixes[k] !== "null");
                      } else {
                        console.warn("⚠️ Auto-fix re-submission failed:", fixedResp.status);
                      }
                    }
                  }
                } catch (fixErr) {
                  console.warn("Auto-fix error:", fixErr);
                }
              }
            }
          } catch (e) {
            console.warn("Quality check failed:", e);
          }
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
          qualityCheck,
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
