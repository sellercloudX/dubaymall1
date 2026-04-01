import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YANDEX_API = "https://api.partner.market.yandex.ru";
const YANDEX_API_V2 = "https://api.partner.market.yandex.ru/v2";

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
  sourceMarketplace?: string;
  sourceCategory?: string;
  sourceCategoryId?: number;
  sourceSubject?: string;
  sourceParent?: string;
  sourceCharacteristics?: any[];
  shopSku?: string;
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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

function normalizeMxikCode(value?: string): string | null {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length === 17 ? digits : null;
}

function getMarketplaceHintKeywords(text: string): string[] {
  const t = text.toLowerCase();
  const hints: string[] = [];

  const mappings: Array<{ test: RegExp; values: string[] }> = [
    { test: /(qoplama|qoplamalar|chexol|чехол|case|cover)/i, values: ['чехол', 'чехлы', 'чехол для телефона', 'аксессуары для телефонов'] },
    { test: /(himoya shisha|himoya plyonka|защитн.*стекл|пленк)/i, values: ['защитное стекло', 'защитные стекла', 'защитная пленка'] },
    { test: /(quloqchin|naushnik|наушник|earbuds|гарнитур)/i, values: ['наушники', 'гарнитуры'] },
    { test: /(zaryad|заряд|adapter|адаптер|kabel|кабель|cable)/i, values: ['зарядные устройства', 'кабели', 'аксессуары для телефонов'] },
    { test: /(xotira karta|карта памяти|microsd|micro sd|sd card)/i, values: ['карты памяти', 'micro sd', 'флеш-карты'] },
    { test: /(telefon|smartfon|смартфон|iphone|samsung|honor|xiaomi)/i, values: ['смартфон', 'аксессуары для смартфонов'] },
  ];

  for (const rule of mappings) {
    if (rule.test.test(t)) {
      hints.push(...rule.values);
    }
  }

  return Array.from(new Set(hints));
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
      // Retry up to 2 times for flaky image downloads
      let resp: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          resp = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
              'Referer': url.includes('yandex') ? 'https://market.yandex.ru/' : url.includes('uzum') ? 'https://uzum.uz/' : url.includes('wildberries') ? 'https://www.wildberries.ru/' : 'https://google.com/',
            },
          });
          if (resp.ok) break;
          console.warn(`⚠️ Image download attempt ${attempt + 1} failed (${resp.status}): ${url.substring(0, 80)}`);
          if (attempt < 1) await new Promise(r => setTimeout(r, 500));
        } catch (fetchErr) {
          console.warn(`⚠️ Image fetch attempt ${attempt + 1} error: ${fetchErr}`);
          if (attempt < 1) await new Promise(r => setTimeout(r, 500));
        }
      }
      
      if (!resp || !resp.ok) {
        // Still use original URL as fallback — Yandex may access it directly
        proxied.push(url);
        continue;
      }

      const ct = resp.headers.get('content-type') || 'image/jpeg';
      if (!ct.startsWith('image/')) { proxied.push(url); continue; }

      const data = await resp.arrayBuffer();
      if (data.byteLength < 1000) { proxied.push(url); continue; }

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
      proxied.push(url); // Use original URL as fallback
    }
  }
  return proxied;
}

// ============ MXIK LOOKUP (AI-powered, category-aware) ============

async function lookupMXIK(
  supabase: any, name: string, category?: string, lovableApiKey?: string
): Promise<{ code: string; name_uz: string }> {
  try {
    // Step 1: AI keyword extraction + rule-based hints
    const contextText = `${name || ''} ${category || ''}`.trim();
    let keywords: string[] = getMarketplaceHintKeywords(contextText);

    if (lovableApiKey) {
      try {
        const prompt = `Mahsulot: "${name}"${category ? ` (Kategoriya: ${category})` : ''}

VAZIFA: Bu mahsulot uchun MXIK (IKPU) kodini topish uchun eng aniq kalit so'zlarni ajrating.

MUHIM QOIDALAR:
1. Faqat mahsulot TURINI aniqlaydigan so'zlarni bering
2. Brend nomi, model raqami, rang — OLIB TASHLANG
3. O'zbekcha va ruscha sinonimlarni bering
4. Kategoriyaga e'tibor bering — "чехол для телефона" va "водка" BUTUNLAY boshqa narsalar!

Masalan:
- "Чехол для iPhone 15 Pro Max" → ["чехол", "чехол для телефона", "telefon chexoli", "aksessuar", "аксессуар для телефона"]
- "Samsung Galaxy S24 Ultra 256GB" → ["telefon", "smartfon", "мобильный телефон", "смартфон"]
- "Шампунь Elseve 400ml" → ["шампунь", "shampun", "soch uchun vosita", "средство для волос"]

TAQIQLANGAN:
- Mahsulot turiga aloqasi bo'lmagan so'zlar
- Brend nomlari (Samsung, Apple, Xiaomi)
- Model raqamlari

Javobni faqat JSON array: ["so'z1", "so'z2", ...]`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0, max_tokens: 200,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content?.trim() || "";
          const match = content.match(/\[.*\]/s);
          if (match) {
            const aiKeywords = JSON.parse(match[0]).filter((k: string) => typeof k === 'string' && k.length > 1);
            keywords.push(...aiKeywords);
          }
        }
      } catch (e) { console.error("AI MXIK keywords error:", e); }
    }

    const noiseKeywords = new Set(['material', 'материал', 'материалы', 'покрытие', 'покрытия', 'товар', 'вещь']);
    keywords = Array.from(new Set(keywords.map(k => k.trim().toLowerCase()))).filter(k => k.length > 1 && !noiseKeywords.has(k));

    // Fallback keywords
    if (keywords.length === 0) {
      keywords = contextText.toLowerCase().replace(/[^\w\s\u0400-\u04FFa-zA-Z'ʼ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    }
    console.log(`[MXIK] Keywords: ${keywords.join(', ')}`);

    // Step 2: Search with multiple keywords + fuzzy RPC fallback
    let matches: any[] = [];
    for (const kw of keywords.slice(0, 6)) {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name')
        .or(`name_uz.ilike.%${kw}%,name_ru.ilike.%${kw}%,group_name.ilike.%${kw}%`)
        .eq('is_active', true)
        .limit(15);
      if (data) matches.push(...data);
    }

    if (matches.length < 8 && contextText) {
      try {
        const { data: fuzzyMatches } = await supabase.rpc('search_mxik_fuzzy', {
          p_search_term: contextText.slice(0, 200),
          p_limit: 25,
        });
        if (Array.isArray(fuzzyMatches)) {
          matches.push(...fuzzyMatches.map((m: any) => ({
            code: m.code,
            name_uz: m.name_uz,
            name_ru: m.name_ru,
            group_name: m.group_name,
          })));
        }
      } catch (rpcError) {
        console.error('[MXIK] fuzzy search error:', rpcError);
      }
    }

    // Deduplicate
    const unique = Array.from(new Map(matches.map(m => [m.code, m])).values());

    if (unique.length === 0) {
      console.warn("[MXIK] No matches found, using generic fallback");
      return { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
    }

    // Step 3: AI selects best match — use STRONGER model with detailed context
    if (lovableApiKey && unique.length > 1) {
      try {
        const options = unique.slice(0, 15).map((m, i) =>
          `${i + 1}. ${m.code} — ${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''}${m.group_name ? ` [${m.group_name}]` : ''}`
        ).join('\n');
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: `VAZIFA: Mahsulotga ENG TO'G'RI MXIK (IKPU) kodni tanla.

Mahsulot: "${name}"
${category ? `Kategoriya: "${category}"` : ''}

MUHIM QOIDALAR:
1. Mahsulot TURINI aniq solishtir — "чехол" = telefon aksessuari, "водка" = spirtli ichimlik — BULAR BOSHQA!
2. Kategoriya bo'yicha mos kelmaydigan kodlarni TANLAMA
3. Eng ANIQ mos keladigan kodni tanla
4. Agar hech biri MUTLAQO mos kelmasa, 0 yoz — LEKIN taxminiy mos kelsa TANLASH MAJBURIY!
5. DIQQAT: "alkogol", "tamaki", "dori-darmon", "qurol" kategoriyalariga KIRMAYDIGAN mahsulotlar uchun BU kategoriyalardagi kodlarni TANLAMA!
6. Mahsulot nomidagi ASOSIY so'zga e'tibor ber
7. YUMSHOQROQ BO'L — agar kod mahsulot TURIGA yaqin bo'lsa (masalan "kosmetika" kategoriyasidagi kod "kosmetik mahsulot" uchun), UNI TANLA!

Variantlar:
${options}

Javob faqat raqam (1-${Math.min(unique.length, 15)}) yoki 0 (MUTLAQO mos kelmasa):` }],
            temperature: 0, max_tokens: 10,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content?.trim() || "";
          const num = parseInt(content.match(/\d+/)?.[0] || "0");
          if (num === 0) {
            console.warn("[MXIK] AI rejected all options — trying broader search...");
            // Broader retry: use AI to suggest a Russian search term
            try {
              const broadResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [{ role: "user", content: `Mahsulot: "${name}". Bu mahsulotning UMUMIY toifa nomi ruscha nima? Faqat 1-2 so'z javob ber (masalan: "косметика", "обувь", "электроника", "одежда", "аксессуары", "бытовая техника"). Javob:` }],
                  temperature: 0, max_tokens: 20,
                }),
              });
              if (broadResp.ok) {
                const broadData = await broadResp.json();
                const broadTerm = (broadData.choices?.[0]?.message?.content?.trim() || "").replace(/[^а-яёА-ЯЁ\s]/g, '').trim();
                if (broadTerm && broadTerm.length > 2) {
                  console.log(`[MXIK] Broad search: "${broadTerm}"`);
                  const { data: broadMatches } = await supabase
                    .from('mxik_codes')
                    .select('code, name_uz, name_ru, group_name')
                    .or(`name_uz.ilike.%${broadTerm}%,name_ru.ilike.%${broadTerm}%,group_name.ilike.%${broadTerm}%`)
                    .eq('is_active', true)
                    .limit(5);
                  if (broadMatches?.length) {
                    console.log(`[MXIK] Broad search found ${broadMatches.length} matches, using first: ${broadMatches[0].name_uz}`);
                    return { code: broadMatches[0].code, name_uz: broadMatches[0].name_uz };
                  }
                }
              }
            } catch (e2) { console.error("[MXIK] Broad search error:", e2); }
            // Final fallback
            return { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
          }
          const idx = num - 1;
          if (idx >= 0 && idx < unique.length) {
            console.log(`[MXIK] AI selected: ${unique[idx].name_uz} (${unique[idx].code})`);
            return { code: unique[idx].code, name_uz: unique[idx].name_uz };
          }
        }
      } catch (e) { console.error("AI MXIK select error:", e); }
    }

    // Single result — still validate with AI
    if (lovableApiKey && unique.length === 1) {
      try {
        const m = unique[0];
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Mahsulot: "${name}"
MXIK: "${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''}"
Bu MXIK kodi shu mahsulotga mos keladimi? Javob faqat "ha" yoki "yo'q":` }],
            temperature: 0, max_tokens: 5,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const answer = (data.choices?.[0]?.message?.content?.trim() || "").toLowerCase();
          if (answer.includes("yo'q") || answer.includes("нет") || answer === "no") {
            console.warn(`[MXIK] AI rejected single match: ${m.name_uz} — using fallback`);
            return { code: "46901100001000000", name_uz: "Boshqa tovarlar" };
          }
        }
      } catch (e) { /* use the match */ }
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
      const r = await fetch(`${YANDEX_API}/campaigns/${campaignId}`, {
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
  apiKey: string, productName: string, productDesc: string, lovableApiKey: string,
  sourceCategory?: string, sourceMarketplace?: string,
  sourceSubject?: string, sourceParent?: string
): Promise<{ id: number; name: string }> {
  // 1. Fetch category tree from Yandex
  console.log("📂 Fetching Yandex category tree...");
  let tree: any = null;
  try {
    const resp = await fetch(`${YANDEX_API}/v2/categories/tree`, {
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
  // CRITICAL: Source subject from Uzum is in UZBEK (e.g. "Qoplamalar") — DON'T use it as keyword directly!
  // Only use sourceSubject as keyword if it contains Cyrillic (Russian) characters
  const initialHintKeywords = getMarketplaceHintKeywords(`${productName} ${sourceSubject || ''} ${sourceCategory || ''} ${sourceParent || ''}`);
  let searchKeywords: string[] = [...initialHintKeywords];
  
  const hasCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s);
  
  // Priority 1: Source subject/parent — ONLY if Russian (Cyrillic)
  if (sourceSubject && hasCyrillic(sourceSubject)) {
    searchKeywords.push(sourceSubject);
    console.log(`📂 Using source subject (RU): "${sourceSubject}"`);
  } else if (sourceSubject) {
    console.log(`📂 Skipping non-Russian source subject: "${sourceSubject}" — will use AI translation`);
  }
  if (sourceParent && sourceParent !== sourceSubject && hasCyrillic(sourceParent)) {
    searchKeywords.push(sourceParent);
    console.log(`📂 Using source parent (RU): "${sourceParent}"`);
  }
  
  // Priority 2: Source category (only if Russian)
  if (sourceCategory && !searchKeywords.includes(sourceCategory) && hasCyrillic(sourceCategory)) {
    searchKeywords.push(sourceCategory);
  }
  
  // Priority 3: AI keyword extraction — ALWAYS run, especially important when source is Uzbek
  if (lovableApiKey) {
    try {
      // Build context about source marketplace category
      const sourceInfo = sourceSubject 
        ? (hasCyrillic(sourceSubject) 
            ? `Manba marketplace kategoriyasi: "${sourceSubject}"` 
            : `Manba marketplace kategoriyasi (O'ZBEKCHA!): "${sourceSubject}" — buni RUSCHA tarjima qilib kalit so'z sifatida ber!`)
        : '';
      
      const kwResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: `Mahsulot: "${productName}"
Tavsif: "${productDesc || ''}"
${sourceInfo}
${sourceParent ? `Ota-kategoriya: "${sourceParent}"` : ''}
${sourceCategory ? `Kategoriya: "${sourceCategory}"` : ''}

Bu mahsulotni Yandex Market kategoriyalarida topish uchun RUSCHA kalit so'zlar ber.
MUHIM:
- Mahsulot NOMIGA qarab eng aniq RUSCHA kategoriya so'zlarini ber
- "Чехол для iPhone" → ["чехол", "чехол для телефона", "аксессуары для телефонов"]
- Agar manba kategoriyasi O'ZBEKCHA bo'lsa (masalan "Qoplamalar" = чехлы), uni RUSCHA tarjima qil!
- "Qoplamalar" = "Чехлы", "Quloqchinlar" = "Наушники", "Zaryadka" = "Зарядные устройства"
Faqat mahsulot TURINI bildiruvchi so'zlar (brend, model, rang emas).

Masalan:
- "Чехол для Samsung Galaxy S24" → ["чехол", "чехол для телефона", "аксессуары для смартфонов"]
- "Кроссовки Nike Air Max" → ["кроссовки", "спортивная обувь", "обувь"]
- "Шампунь Elseve 400ml" → ["шампунь", "средство для волос", "уход за волосами"]
- O'zbekcha "Qoplamalar" kategoriya → ["чехлы", "чехол", "аксессуары"]

Javob FAQAT JSON array: ["so'z1", "so'z2", ...]` }],
          temperature: 0, max_tokens: 150,
        }),
      });
      if (kwResp.ok) {
        const kwData = await kwResp.json();
        const kwContent = kwData.choices?.[0]?.message?.content?.trim() || "";
        const kwMatch = kwContent.match(/\[.*\]/s);
        if (kwMatch) {
          const aiKeywords = JSON.parse(kwMatch[0]).filter((k: string) => typeof k === 'string' && k.length > 1);
          // Add AI keywords that aren't already present
          for (const kw of aiKeywords) {
            if (!searchKeywords.includes(kw)) searchKeywords.push(kw);
          }
        }
      }
    } catch (e) {
      console.error("AI keyword extraction error:", e);
    }
  }

  // Normalize keywords: remove noise, add compact tokens from product name
  const noiseKeywords = new Set(['material', 'материал', 'материалы', 'покрытие', 'покрытия', 'товар', 'вещь', 'аксессуар']);
  const nameTokens = (productName.toLowerCase().match(/[а-яё]{3,}/g) || []).slice(0, 6);
  searchKeywords.push(...nameTokens);

  searchKeywords = Array.from(new Set(searchKeywords.map(k => k.trim().toLowerCase())))
    .filter(k => k.length > 1 && !noiseKeywords.has(k));

  // Fallback keywords from product name/context
  if (searchKeywords.length === 0) {
    searchKeywords = `${productName} ${sourceSubject || ''} ${sourceCategory || ''}`
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
  console.log(`📂 Search keywords: ${searchKeywords.join(', ')}`);

  // 4. Score categories by keyword matches
  const scored = leaves.map(leaf => {
    const leafText = `${leaf.name} ${leaf.path}`.toLowerCase();
    let score = 0;
    for (const kw of searchKeywords) {
      const kwLower = kw.toLowerCase();
      const isPhrase = kwLower.includes(' ');
      if (leafText.includes(kwLower)) score += isPhrase ? 5 : 3;
      // Partial match
      if (kwLower.length > 4 && leafText.includes(kwLower.substring(0, kwLower.length - 2))) score += isPhrase ? 2 : 1;
    }

    // Penalize obvious domain mismatches
    const phoneAccessoryIntent = searchKeywords.some(k => /чехол|смартфон|телефон|защитн|micro sd|карта памяти/.test(k));
    if (phoneAccessoryIntent && /авто|мебел|рычаг|сидень|магнитол/.test(leafText)) score -= 15;
    
    // Penalize auto-related categories for non-auto products
    const isAutoProduct = searchKeywords.some(k => /авто|машин|автомобил|car |vehicle/.test(k));
    if (!isAutoProduct && /автомагнитол|автомобил|авто аксессуар|автозвук/.test(leafText)) score -= 15;
    
    // Penalize hair/beauty products being matched to electronics/auto/construction
    const isHairProduct = searchKeywords.some(k => /волос|выпрямител|стайлер|утюжок|фен|укладк|шампун|мультистайлер|airwrap|щипц|плойк/.test(k));
    if (isHairProduct && /авто|магнитол|компьют|телефон|смартфон|строител|аккумулятор|сварочн|насадк/.test(leafText)) score -= 25;
    // Penalize construction tools being matched to beauty
    const isConstructionProduct = searchKeywords.some(k => /строител|сварочн|перфоратор|болгарк|дрель/.test(k));
    if (isConstructionProduct && /волос|красот|косметик|маникюр/.test(leafText)) score -= 25;
    
    // Boost exact category name matches
    for (const kw of searchKeywords) {
      if (leaf.name.toLowerCase() === kw) score += 10;
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
${sourceSubject ? `MANBA MARKETPLACE KATEGORIYASI: "${sourceSubject}" (${sourceMarketplace || 'unknown'})` : ''}
${sourceParent ? `MANBA OTA-KATEGORIYA: "${sourceParent}"` : ''}
${sourceCategory ? `MANBA KATEGORIYA: "${sourceCategory}" (${sourceMarketplace || 'unknown'})` : ''}

MUHIM QOIDALAR:
- Kategoriya mahsulot TURIGA aniq mos bo'lishi SHART
- MAHSULOT NOMIGA qarab kategoriyani tanla — bu eng ishonchli ma'lumot!
- "Чехол для Honor X9C" → Чехлы kategoriyasi
- "Беспроводные Bluetooth наушники" → Наушники kategoriyasi
${sourceSubject ? `- Manba kategoriya "${sourceSubject}" — agar o'zbekcha bo'lsa, RUSCHA tarjima qilib mos Yandex kategoriyani tanla` : ''}
- "Par dazmol" va "Vakuum paketlash mashinasi" — BU BOSHQA NARSALAR!
- Mahsulot nomidagi kalit so'zlarni sinchiklab tahlil qil
- Masalan: "vakuumlovchi" → "Вакуумные упаковщики", "par dazmol" → "Парогенераторы"
- Agar mahsulot nomi ANIQ bir kategoriyaga to'g'ri kelsa, uni tanla

KATEGORIYALAR RO'YXATI:
${categoryList}

JAVOB: Faqat bitta ID raqam yoz, hech narsa qo'shma:`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
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
    const resp = await fetch(`${YANDEX_API}/v2/category/${categoryId}/parameters`, {
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

// ═══ CATEGORY-SPECIFIC AI MANAGER ═══
// Each product category gets specialized parameter filling rules
function getCategorySpecificInstructions(categoryName: string, productName: string): string {
  const catLower = (categoryName || '').toLowerCase();
  const nameLower = (productName || '').toLowerCase();
  
  // ═══ PHONE CASES / ЧЕХЛЫ ═══
  if (catLower.includes('чехол') || catLower.includes('чехл') || nameLower.includes('чехол') || nameLower.includes('chexol') || nameLower.includes('case') || nameLower.includes('cover') || nameLower.includes('qoplama')) {
    // Extract phone model from product name
    const phoneModels: { pattern: RegExp; model: string; brand: string }[] = [
      // iPhone models
      { pattern: /iphone\s*16\s*pro\s*max/i, model: 'iPhone 16 Pro Max', brand: 'Apple' },
      { pattern: /iphone\s*16\s*pro/i, model: 'iPhone 16 Pro', brand: 'Apple' },
      { pattern: /iphone\s*16\s*plus/i, model: 'iPhone 16 Plus', brand: 'Apple' },
      { pattern: /iphone\s*16/i, model: 'iPhone 16', brand: 'Apple' },
      { pattern: /iphone\s*15\s*pro\s*max/i, model: 'iPhone 15 Pro Max', brand: 'Apple' },
      { pattern: /iphone\s*15\s*pro/i, model: 'iPhone 15 Pro', brand: 'Apple' },
      { pattern: /iphone\s*15\s*plus/i, model: 'iPhone 15 Plus', brand: 'Apple' },
      { pattern: /iphone\s*15/i, model: 'iPhone 15', brand: 'Apple' },
      { pattern: /iphone\s*14\s*pro\s*max/i, model: 'iPhone 14 Pro Max', brand: 'Apple' },
      { pattern: /iphone\s*14\s*pro/i, model: 'iPhone 14 Pro', brand: 'Apple' },
      { pattern: /iphone\s*14/i, model: 'iPhone 14', brand: 'Apple' },
      { pattern: /iphone\s*13\s*pro\s*max/i, model: 'iPhone 13 Pro Max', brand: 'Apple' },
      { pattern: /iphone\s*13\s*pro/i, model: 'iPhone 13 Pro', brand: 'Apple' },
      { pattern: /iphone\s*13/i, model: 'iPhone 13', brand: 'Apple' },
      // Samsung models
      { pattern: /galaxy\s*s2[45]\s*ultra/i, model: 'Galaxy S24 Ultra', brand: 'Samsung' },
      { pattern: /galaxy\s*s2[45]\s*plus/i, model: 'Galaxy S24+', brand: 'Samsung' },
      { pattern: /galaxy\s*s2[45]\b/i, model: 'Galaxy S24', brand: 'Samsung' },
      { pattern: /galaxy\s*a5[45]/i, model: 'Galaxy A54', brand: 'Samsung' },
      { pattern: /galaxy\s*a3[45]/i, model: 'Galaxy A34', brand: 'Samsung' },
      { pattern: /galaxy\s*a2[45]/i, model: 'Galaxy A24', brand: 'Samsung' },
      { pattern: /galaxy\s*a1[45]/i, model: 'Galaxy A14', brand: 'Samsung' },
      // Xiaomi / Redmi / POCO
      { pattern: /redmi\s*note\s*1[34]\s*pro\+?/i, model: 'Redmi Note 13 Pro', brand: 'Xiaomi' },
      { pattern: /redmi\s*note\s*1[34]/i, model: 'Redmi Note 13', brand: 'Xiaomi' },
      { pattern: /redmi\s*1[34]/i, model: 'Redmi 13', brand: 'Xiaomi' },
      { pattern: /poco\s*x[67]/i, model: 'POCO X6', brand: 'Xiaomi' },
      // Honor
      { pattern: /honor\s*x9[a-z]?\b/i, model: 'Honor X9', brand: 'Honor' },
      { pattern: /honor\s*x8[a-z]?\b/i, model: 'Honor X8', brand: 'Honor' },
      { pattern: /honor\s*x7[a-z]?\b/i, model: 'Honor X7', brand: 'Honor' },
      { pattern: /honor\s*90/i, model: 'Honor 90', brand: 'Honor' },
      // Tecno
      { pattern: /tecno\s*(spark|camon|pova|phantom)\s*\d+/i, model: '', brand: 'Tecno' },
    ];

    let detectedModel = '';
    let detectedBrand = '';
    for (const pm of phoneModels) {
      if (pm.pattern.test(productName)) {
        detectedModel = pm.model;
        detectedBrand = pm.brand;
        break;
      }
    }

    return `
═══ TELEFON CHEXOLI UCHUN MAXSUS QOIDALAR ═══
Bu mahsulot TELEFON CHEXOLI (чехол). Sifat ballini MAKSIMAL qilish uchun quyidagilarni ALBATTA to'ldir:

${detectedModel ? `🔍 ANIQLANGAN TELEFON MODELI: ${detectedModel} (${detectedBrand})
- "Совместимая модель" (Compatible model) → "${detectedModel}"
- "Совместимый бренд" → "${detectedBrand}"
- Nomda ALBATTA model ko'rsatilsin: "Чехол для ${detectedModel}"` : `
🔍 TELEFON MODELINI NOMDAN ANIQLA! Masalan:
- "...Honor X9C..." → model: "Honor X9C", brand: "Honor"
- "...iPhone 15 Pro Max..." → model: "iPhone 15 Pro Max", brand: "Apple"
- "...Galaxy S24 Ultra..." → model: "Galaxy S24 Ultra", brand: "Samsung"
`}

MAJBURIY TO'LDIRISH KERAK:
1. "Совместимая модель телефона" / "Совместимая модель" → ANIQ telefon modeli
2. "Совместимый бренд" → Telefon brendi (Apple, Samsung, Xiaomi, Honor...)
3. "Тип чехла" → Chexol turi (накладка, книжка, бампер, силиконовый...)
4. "Материал" → Chexol materiali (силикон, пластик, кожа, TPU...)
5. "Цвет товара" → Chexol rangi
6. "Особенности" → Maxsus xususiyatlar (противоударный, прозрачный, с MagSafe...)
7. "Дизайн" → Dizayn xususiyati (матовый, глянцевый, с рисунком...)

MUHIM:
- Agar nomda telefon modeli bo'lsa, UNI ALBATTA "Совместимая модель" ga yoz!
- name_ru formatida model ANIQ ko'rinsin: "Чехол силиконовый для Samsung Galaxy S24 Ultra, прозрачный"
- description_ru da chexolning barcha afzalliklari va telefon modeli bilan mosligi haqida yoz
`;
  }

  // ═══ SCREEN PROTECTORS / ЗАЩИТНЫЕ СТЕКЛА ═══
  if (catLower.includes('защитн') || catLower.includes('стекл') || catLower.includes('пленк') || nameLower.includes('himoya') || nameLower.includes('glass')) {
    return `
═══ HIMOYA SHISHA/PLYONKA UCHUN MAXSUS QOIDALAR ═══
MAJBURIY:
1. "Совместимая модель" → Telefon modeli ANIQ ko'rsat
2. "Совместимый бренд" → Telefon brendi
3. "Тип" → "защитное стекло" yoki "защитная пленка"
4. "Покрытие" → "глянцевое" yoki "матовое"
5. "Степень твёрдости" → "9H" (standart)
6. Nomda telefon modeli va turi ANIQ ko'rsat
`;
  }

  // ═══ EARPHONES / НАУШНИКИ ═══
  if (catLower.includes('наушник') || catLower.includes('гарнитур') || nameLower.includes('naushnik') || nameLower.includes('quloqchin') || nameLower.includes('earbuds')) {
    return `
═══ QULOQCHIN UCHUN MAXSUS QOIDALAR ═══
MAJBURIY:
1. "Тип подключения" → "беспроводные" yoki "проводные"
2. "Тип конструкции" → "вкладыши", "внутриканальные", "накладные"...
3. "Интерфейс подключения" → "Bluetooth", "3.5mm", "Type-C"...
4. "Микрофон" → "есть" yoki "нет"
5. "Время работы от аккумулятора" → soat
`;
  }

  // ═══ COSMETICS / КОСМЕТИКА ═══
  if (catLower.includes('космет') || catLower.includes('крем') || catLower.includes('парфюм') || catLower.includes('помад') || catLower.includes('тушь') || nameLower.includes('krem') || nameLower.includes('parfum')) {
    return `
═══ KOSMETIKA UCHUN MAXSUS QOIDALAR ═══
MAJBURIY:
1. "Объём" → ml yoki ml
2. "Тип кожи" → mos teri turi
3. "Эффект" → asosiy effekt
4. "Состав" → asosiy ingredientlar
5. "Страна производства" → ishlab chiqaruvchi mamlakat
6. shelfLife: ALBATTA 36 oy
`;
  }

  // ═══ CLOTHING / ОДЕЖДА ═══
  if (catLower.includes('одежд') || catLower.includes('платье') || catLower.includes('футболк') || catLower.includes('рубаш') || catLower.includes('куртк') || nameLower.includes('kiyim') || nameLower.includes('ko\'ylak')) {
    return `
═══ KIYIM UCHUN MAXSUS QOIDALAR ═══
MAJBURIY:
1. "Размер" → FAQAT BITTA o'lcham
2. "Материал" → mato turi
3. "Сезон" → fasl
4. "Пол" → jins (мужской/женский/унисекс)
5. "Страна производства" → ishlab chiqaruvchi mamlakat
`;
  }

  return ''; // No special instructions for other categories
}

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
  
  // ═══ CRITICAL: Filter out "Прочие характеристики" — ALWAYS leave empty ═══
  const allParams = safeParams.filter((p: any) => {
    const name = (p.name || '').toLowerCase();
    if (name.includes('прочие') || name.includes('прочее') || name.includes('другие характеристик') || name.includes('другое')) {
      console.log(`🚫 Skipping "Прочие характеристики" param: id=${p.id}, name="${p.name}"`);
      return false;
    }
    return true;
  });

  // ═══ SEPARATE REQUIRED vs RECOMMENDED (FILTER) vs OPTIONAL params ═══
  // REQUIRED = "Основные характеристики" (12 ball)
  // RECOMMENDED = "Фильтры" (8 ball) — Yandex uses these for search filters
  // OPTIONAL = everything else
  const isRequired = (p: any) => p.required === true || p.constraintType === "REQUIRED" || p.mandatory === true || p.importance === "REQUIRED" || p.constraint === "REQUIRED";
  const isRecommended = (p: any) => p.constraintType === "RECOMMENDED" || p.importance === "RECOMMENDED" || p.constraint === "RECOMMENDED" || p.filterGroup === true || p.isFilter === true || p.usedForFilter === true;
  let requiredParams = allParams.filter(isRequired);
  let recommendedParams = allParams.filter(p => !isRequired(p) && isRecommended(p));
  let optionalParams = allParams.filter(p => !isRequired(p) && !isRecommended(p));

  // ═══ HEURISTIC RECLASSIFICATION ═══
  // When Yandex API returns few required/recommended params, classify by param name
  // CRITICAL: Also trigger when filter (recommended) params are missing — needed for "Filtrlar uchun qo'shimcha xususiyatlar" section
  const needsHeuristic = (requiredParams.length + recommendedParams.length) < 3 
    || recommendedParams.length < 2 
    || (requiredParams.length < 5 && allParams.length > 10);
  
  if (needsHeuristic && allParams.length > 0) {
    console.log(`⚠️ API returned ${requiredParams.length} REQUIRED + ${recommendedParams.length} RECOMMENDED — applying heuristic classification`);
    
    // Common "Asosiy xususiyatlar" (main characteristics) param names
    const requiredNames = /^(тип|бренд|брэнд|торговая марка|марка|форма выпуска|вид|материал|состав|пол|возраст|размер|страна|назначение|цвет товара|цвет|вес|объем|объём|количество|комплектация|модель|серия|способ применения|диагональ|разрешение|мощность|напряжение|частота|температур|скорость|режим|питание|подключение|тип подключения|тип конструкции|формат|класс|категория|группа|тип товара|тип изделия|тип продукта|основной цвет)/i;
    
    // Common "Filtrlar uchun qo'shimcha xususiyatlar" (filter characteristics) — EXPANDED
    const filterNames = /^(особенности|содержит|не содержит|эффект|аромат|вкус|текстура|покрытие|тип кожи|тип волос|spf|водостойкость|гипоаллергенный|форм-фактор|интерфейс|технология|совместим|подходит для|сезон|стиль|узор|принт|застёжка|длина|ширина|высота|глубина|диаметр|плотность|жёсткость|функци|дополнительн|насадк|в комплект|комплект поставки|индикат|защит|управлени|дисплей|экран|ёмкость|аккумулятор|гарантия производител|максимальн|минимальн|уровень шума|потребляем|частота вращени|регулировк|таймер|автоотключени|число.*скорост|число.*режим|ионизаци|холодный обдув|складн|вращени|петля|крепл|вес.*товар|страна.*производ|срок.*службы|упаковк)/i;
    
    const newRequired: any[] = [];
    const newRecommended: any[] = [];
    const newOptional: any[] = [];
    
    // Keep existing classifications
    const classifiedIds = new Set<number>();
    for (const p of requiredParams) { newRequired.push(p); classifiedIds.add(Number(p.id)); }
    for (const p of recommendedParams) { newRecommended.push(p); classifiedIds.add(Number(p.id)); }
    
    for (const p of allParams) {
      if (classifiedIds.has(Number(p.id))) continue;
      const name = (p.name || '').trim();
      if (requiredNames.test(name)) {
        newRequired.push(p);
      } else if (filterNames.test(name)) {
        newRecommended.push(p);
      }
      // Unclassified params will be distributed below
    }
    
    // Distribute remaining unclassified params — ensure balanced split between REQUIRED and RECOMMENDED
    const unclassified = allParams.filter(p => {
      const id = Number(p.id);
      return !classifiedIds.has(id) && !newRequired.some(r => Number(r.id) === id) && !newRecommended.some(r => Number(r.id) === id);
    });
    
    // Target: at least 40% of total params should be RECOMMENDED (filters)
    const totalClassified = newRequired.length + newRecommended.length + unclassified.length;
    const targetRecommended = Math.max(Math.ceil(totalClassified * 0.4), 3);
    const recommendedDeficit = Math.max(0, targetRecommended - newRecommended.length);
    
    for (let i = 0; i < unclassified.length; i++) {
      const p = unclassified[i];
      if (newRequired.length < 12 && i < unclassified.length - recommendedDeficit) {
        newRequired.push(p);
      } else if (newRecommended.length < 15) {
        newRecommended.push(p);
      } else {
        newOptional.push(p);
      }
    }
    
    requiredParams = newRequired;
    recommendedParams = newRecommended;
    optionalParams = newOptional;
    console.log(`📊 Heuristic: ${requiredParams.length} REQUIRED, ${recommendedParams.length} RECOMMENDED, ${optionalParams.length} optional`);
  }

  const formatParam = (p: any) => {
    let s = `  - id:${p.id}, "${p.name}", type:${p.type || "TEXT"}`;
    if (p.unit) s += `, unit:"${p.unit}"`;
    if (p.values?.length) {
      const vals = p.values.slice(0, 15).map((v: any) => `{id:${v.id},"${v.value}"}`).join(", ");
      s += `\n    OPTIONS:[${vals}]`;
      if (p.values.length > 15) s += ` +${p.values.length - 15}`;
    }
    return s;
  };

  console.log(`🤖 AI optimizing: ${requiredParams.length} REQUIRED + ${recommendedParams.length} RECOMMENDED (filters) + ${optionalParams.length} optional = ${allParams.length} total`);

  const sourceCharacteristicsText = Array.isArray(product.sourceCharacteristics) && product.sourceCharacteristics.length > 0
    ? product.sourceCharacteristics
        .slice(0, 20)
        .map((ch: any) => `${ch.title || ch.name || ch.key || 'attr'}: ${ch.value || ch.values?.[0] || ''}`)
        .filter((s: string) => s && !s.endsWith(': '))
        .join('; ')
    : '';

  // Get category-specific AI instructions
  const categoryInstructions = getCategorySpecificInstructions(categoryName, product.name);

  const prompt = `VAZIFA: Yandex Market kartochkasi uchun BARCHA parametrlarni to'ldir!
MAQSAD: MAKSIMAL ball olish — 90+ ball!

MAHSULOT:
- Nom: ${product.name}
- Tavsif: ${product.description || "YO'Q — O'ZING YOZ!"}
- Kategoriya: ${categoryName}
${product.sourceCategory ? `- Manba marketplace kategoriyasi: ${product.sourceCategory}` : ''}
${sourceCharacteristicsText ? `- Manba xususiyatlari (Uzum/WB): ${sourceCharacteristicsText}` : ''}
- Brend: ${product.brand || "Nomdan aniqla"}
- Rang: ${product.color || "Nomdan aniqla"}
- Model: ${product.model || "Nomdan aniqla"}
- Narx: ${product.price} UZS
${categoryInstructions}

═══ UMUMIY QOIDALAR ═══
⛔ "ПРОЧИЕ ХАРАКТЕРИСТИКИ" / "ПРОЧЕЕ" degan parametrni HECH QACHON TO'LDIRMA!

═══════════════════════════════════════════════════════
⚠️⚠️⚠️ BIRINCHI NAVBATDA: "ASOSIY XUSUSIYATLAR" (${requiredParams.length} ta MAJBURIY parametr) — 12 BALL ⚠️⚠️⚠️
Bu parametrlar TO'LDIRILMASA kartochka sifati JUDA PAST bo'ladi! HAR BIRINI ALBATTA TO'LDIR!
"Maydonlarni ko'rsatish" tugmasi ortidagi YASHIRIN parametrlar HAM shu yerda!
Тип, Форма выпуска, Поводом работы, Назначение — BARCHASI MAJBURIY!
═══════════════════════════════════════════════════════
${requiredParams.map(formatParam).join("\n")}

═══ "FILTRLAR UCHUN QO'SHIMCHA XUSUSIYATLAR" (${recommendedParams.length} ta RECOMMENDED) — 8 BALL ═══
⚠️ Bu parametrlar FILTR sifatida ishlaydi! Qidiruv natijalarida chiqish uchun ALBATTA HAR BIRINI TO'LDIR!
Назначение, Особенности, Содержит, Не содержит, Объём, Цвет — BARCHASI FILTR!
${recommendedParams.map(formatParam).join("\n")}

═══ QO'SHIMCHA PARAMETRLAR (${optionalParams.length} ta) — IMKON QADAR TO'LDIR ═══
${optionalParams.map(formatParam).join("\n")}

QOIDALAR:
1. name_ru: Ruscha SEO-nom, 80-150 belgi. Format: "[Tur] [Brend] [Model] [Xususiyatlar], [rang]". MAJBURIY!
2. name_uz: O'ZBEKCHA LOTIN yozuvida nom, 80-150 belgi. MAJBURIY! Masalan: "Tonal krem Estée Lauder Double Wear, to'q jigarrang".
3. description_ru: 800-3000 belgi ruscha tavsif. HTML TEGLARISIZ! 6+ paragraf.
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
   
   *** JUDA MUHIM: ${requiredParams.length} ta MAJBURIY + ${recommendedParams.length} ta FILTR parametrni HAR BIRINI to'ldir! ***
   *** FILTR parametrlari to'ldirilmasa mahsulot qidiruv natijalarida CHIQMAYDI! ***
   *** Bilmasang — mahsulotga mos taxminiy qiymat yoz! ***
   *** Har bir parametr uchun FAQAT value YOKI valueId ber, ikkalasini emas! ***
   *** FAQAT BITTA qiymat ber har bir parametrga! ***
11. warranty: "1 год" yoki "2 года"
12. weightDimensions — REAL o'lchamlar:
   - Chexol: weight=0.03-0.08kg, 16x8x1 sm
   - Telefon: weight=0.15-0.25kg, 8x1x16 sm
   - Kosmetika: weight=0.05-0.3kg, 5x5x10 ~ 10x10x15 sm
   - Krossovka: weight=0.4-0.8kg, 35x25x12 sm

JAVOB FAQAT JSON:
{"name_ru":"...","name_uz":"...","description_ru":"...","description_uz":"...","vendor":"...","vendorCode":"...","manufacturerCountry":"...","shelfLife":null,"lifeTime":null,"parameterValues":[{"parameterId":123,"valueId":456},{"parameterId":789,"value":"qiymat"}],"warranty":"1 год","adult":false,"weightKg":0.15,"lengthCm":10,"widthCm":8,"heightCm":5}`;

  // Use stronger model for better parameter filling — Pro for accuracy
  const aiModel = "google/gemini-2.5-pro";
  
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
        max_tokens: cloneMode ? 12000 : 32000,
      }),
    });

    if (!resp.ok) { console.error("AI Pass 1 failed:", resp.status); return null; }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      try {
        result = JSON.parse(jsonStr);
      } catch (parseErr) {
        // Try to fix truncated JSON — find last valid parameterValues entry
        console.warn("AI Pass 1: JSON truncated, attempting repair...");
        // Close unclosed arrays and objects
        const lastValidBracket = jsonStr.lastIndexOf('}');
        if (lastValidBracket > 0) {
          let repaired = jsonStr.substring(0, lastValidBracket + 1);
          // Count open brackets
          const opens = (repaired.match(/\[/g) || []).length;
          const closes = (repaired.match(/\]/g) || []).length;
          const openBraces = (repaired.match(/\{/g) || []).length;
          const closeBraces = (repaired.match(/\}/g) || []).length;
          repaired += ']'.repeat(Math.max(0, opens - closes));
          repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));
          try {
            result = JSON.parse(repaired);
            console.log(`✅ Pass 1 JSON repaired successfully`);
          } catch (e2) {
            // Last resort: extract fields manually
            console.error("JSON repair failed, extracting fields manually...");
            result = {};
            const nameRuMatch = content.match(/"name_ru"\s*:\s*"([^"]+)"/);
            const nameUzMatch = content.match(/"name_uz"\s*:\s*"([^"]+)"/);
            const descMatch = content.match(/"description_ru"\s*:\s*"([\s\S]*?)(?:","description_uz|","vendor)/);
            const vendorMatch = content.match(/"vendor"\s*:\s*"([^"]+)"/);
            const countryMatch = content.match(/"manufacturerCountry"\s*:\s*"([^"]+)"/);
            if (nameRuMatch) result.name_ru = nameRuMatch[1];
            if (nameUzMatch) result.name_uz = nameUzMatch[1];
            if (descMatch) result.description_ru = descMatch[1];
            if (vendorMatch) result.vendor = vendorMatch[1];
            if (countryMatch) result.manufacturerCountry = countryMatch[1];
            // Try to extract parameterValues array
            const pvMatch = content.match(/"parameterValues"\s*:\s*\[([\s\S]*)/);
            if (pvMatch) {
              try {
                // Find last complete object in the array
                const pvContent = pvMatch[1];
                const lastObj = pvContent.lastIndexOf('}');
                if (lastObj > 0) {
                  const pvStr = '[' + pvContent.substring(0, lastObj + 1) + ']';
                  result.parameterValues = JSON.parse(pvStr);
                }
              } catch { result.parameterValues = []; }
            }
            console.log(`⚠️ Pass 1 manual extraction: params=${result.parameterValues?.length || 0}`);
          }
        }
      }
      if (result) {
        console.log(`🤖 Pass 1: name_ru=${result.name_ru?.length}ch, desc=${result.description_ru?.length}ch, params=${result.parameterValues?.length}, weight=${result.weightKg}kg`);
      }
    }
  } catch (e) { console.error("AI Pass 1 error:", e); }
  
  if (!result) return null;

  // ═══ PASS 2: Focus on MISSING REQUIRED + RECOMMENDED (FILTER) params ═══
  const filledParamIds = new Set(
    (result.parameterValues || []).map((p: any) => Number(p.parameterId))
  );
  
  const missingRequired = requiredParams.filter((p: any) => !filledParamIds.has(Number(p.id)));
  const missingRecommended = recommendedParams.filter((p: any) => !filledParamIds.has(Number(p.id)));
  const missingOptional = optionalParams.filter((p: any) => !filledParamIds.has(Number(p.id)));
  const allMissing = [...missingRequired, ...missingRecommended, ...missingOptional];
  
  console.log(`📊 Pass 1 natija: ${result.parameterValues?.length || 0} to'ldirildi. Bo'sh: ${missingRequired.length} MAJBURIY + ${missingRecommended.length} FILTR + ${missingOptional.length} optional`);
  
  if (allMissing.length > 0 && allMissing.length <= 120) {
    console.log(`🔄 Pass 2: ${missingRequired.length} MAJBURIY + ${missingRecommended.length} FILTR + ${missingOptional.length} optional to'ldirish...`);
    
    const pass2Prompt = `VAZIFA: Quyidagi BO'SH parametrlarni to'ldir!
Bu birinchi bosqichda to'ldirilMAGAN parametrlar. BALL oshirish uchun HAR BIRINI to'ldir!

⛔ "ПРОЧИЕ ХАРАКТЕРИСТИКИ" / "ПРОЧЕЕ" parametrni TO'LDIRMA!

MAHSULOT: "${product.name}" — ${categoryName}
Brend: ${result.vendor || product.brand || "OEM"}
${sourceCharacteristicsText ? `Manba xususiyatlari: ${sourceCharacteristicsText}` : ''}

${missingRequired.length > 0 ? `⚠️⚠️⚠️ MAJBURIY — "ASOSIY XUSUSIYATLAR" 12 BALL — HAR BIRINI ALBATTA TO'LDIR (${missingRequired.length} ta):
${missingRequired.map(formatParam).join("\n")}
` : ''}
${missingRecommended.length > 0 ? `⚠️ FILTRLAR — "QO'SHIMCHA XUSUSIYATLAR" 8 BALL — Qidiruvda chiqish uchun TO'LDIR (${missingRecommended.length} ta):
${missingRecommended.map(formatParam).join("\n")}
` : ''}
${missingOptional.length > 0 ? `QO'SHIMCHA (${missingOptional.length} ta):
${missingOptional.map(formatParam).join("\n")}
` : ''}

QOIDALAR:
- OPTIONS bor → valueId (raqam) tanla, eng mos
- TEXT → FAQAT qiymat ("красный", "100 мл"), nom:qiymat formatda BERMA
- NUMBER → raqam
- BOOLEAN → "true"/"false"
- Bilmasang — mahsulotga mos TAXMINIY qiymat yoz!
- BITTA parametr uchun FAQAT BITTA qiymat!

JAVOB FAQAT JSON array:
[{"parameterId":123,"valueId":456},{"parameterId":789,"value":"qiymat"}]`;

    try {
      const resp2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "user", content: pass2Prompt }],
          temperature: 0.1,
          max_tokens: 12000,
        }),
      });

      if (resp2.ok) {
        const data2 = await resp2.json();
        const content2 = data2.choices?.[0]?.message?.content || "";
        const arrMatch = content2.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          let extraParams: any[] = [];
          try {
            extraParams = JSON.parse(arrMatch[0]);
          } catch {
            // Try to repair truncated array
            const lastObj = arrMatch[0].lastIndexOf('}');
            if (lastObj > 0) {
              try { extraParams = JSON.parse(arrMatch[0].substring(0, lastObj + 1) + ']'); } catch {}
            }
          }
          if (Array.isArray(extraParams) && extraParams.length > 0) {
            result.parameterValues = [...(result.parameterValues || []), ...extraParams];
            console.log(`✅ Pass 2: +${extraParams.length} params. Jami: ${result.parameterValues.length}`);
          }
        }
      }
    } catch (e) {
      console.error("AI Pass 2 error:", e);
    }
    
    // ═══ PASS 3: If REQUIRED or RECOMMENDED params STILL missing, force-fill them ═══
    const filledAfterP2 = new Set(
      (result.parameterValues || []).map((p: any) => Number(p.parameterId))
    );
    const stillMissingRequired = requiredParams.filter((p: any) => !filledAfterP2.has(Number(p.id)));
    const stillMissingRecommended = recommendedParams.filter((p: any) => !filledAfterP2.has(Number(p.id)));
    const stillMissingHighPriority = [...stillMissingRequired, ...stillMissingRecommended];
    
    if (stillMissingHighPriority.length > 0) {
      console.log(`⚠️ Pass 3: ${stillMissingRequired.length} MAJBURIY + ${stillMissingRecommended.length} FILTR param hali bo'sh! Force-fill...`);
      
      const pass3Prompt = `FAQAT shu ${stillMissingHighPriority.length} ta parametrni to'ldir. Bu parametrlar TO'LDIRILMASA kartochka sifati JUDA PAST bo'ladi!
${stillMissingRequired.length > 0 ? `\n⚠️ MAJBURIY (12 BALL — "Asosiy xususiyatlar"):` : ''}
${stillMissingRecommended.length > 0 ? `⚠️ FILTR (8 BALL — "Qo'shimcha xususiyatlar"):` : ''}

Mahsulot: "${product.name}" (${categoryName})
Brend: ${result.vendor || product.brand || "OEM"}

HAR BIRINI ALBATTA TO'LDIR — BO'SH QOLDIRMA!:
${stillMissingHighPriority.map(formatParam).join("\n")}

QOIDALAR: OPTIONS bor → valueId raqam tanla. TEXT → faqat qiymat. Bilmasang taxminiy yoz!
JAVOB FAQAT JSON array: [{"parameterId":123,"valueId":456}]`;

      try {
        const resp3 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: pass3Prompt }],
            temperature: 0.2,
            max_tokens: 4000,
          }),
        });

        if (resp3.ok) {
          const data3 = await resp3.json();
          const content3 = data3.choices?.[0]?.message?.content || "";
          const arrMatch3 = content3.match(/\[[\s\S]*\]/);
          if (arrMatch3) {
            let p3Params: any[] = [];
            try {
              p3Params = JSON.parse(arrMatch3[0]);
            } catch {
              const lastObj = arrMatch3[0].lastIndexOf('}');
              if (lastObj > 0) {
                try { p3Params = JSON.parse(arrMatch3[0].substring(0, lastObj + 1) + ']'); } catch {}
              }
            }
            if (Array.isArray(p3Params) && p3Params.length > 0) {
              result.parameterValues = [...(result.parameterValues || []), ...p3Params];
              console.log(`✅ Pass 3: +${p3Params.length} MAJBURIY params. Jami: ${result.parameterValues.length}`);
            }
          }
        }
      } catch (e) {
        console.error("AI Pass 3 error:", e);
      }
    }
  } else if (allMissing.length === 0) {
    console.log(`✅ Pass 1 da barcha ${allParams.length} param to'ldirildi!`);
  } else {
    console.log(`⚠️ ${allMissing.length} param bo'sh qoldi (juda ko'p, pass 2 o'tkazildi)`);
  }
  
  // Final stats
  const finalFilled = new Set((result.parameterValues || []).map((p: any) => Number(p.parameterId)));
  const finalMissingReq = requiredParams.filter(p => !finalFilled.has(Number(p.id)));
  const finalMissingRec = recommendedParams.filter(p => !finalFilled.has(Number(p.id)));
  console.log(`📊 YAKUNIY: ${result.parameterValues?.length || 0}/${allParams.length} to'ldirildi. MAJBURIY bo'sh: ${finalMissingReq.length}/${requiredParams.length}, FILTR bo'sh: ${finalMissingRec.length}/${recommendedParams.length}`);
  if (finalMissingReq.length > 0) {
    console.log(`⚠️ Bo'sh MAJBURIY: ${finalMissingReq.map(p => `"${p.name}"(${p.id})`).join(', ')}`);
  }
  if (finalMissingRec.length > 0) {
    console.log(`⚠️ Bo'sh FILTR: ${finalMissingRec.map(p => `"${p.name}"(${p.id})`).join(', ')}`);
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

  // Parameters — filter out picker/URL params, "прочие характеристики", ensure SINGLE VALUES only
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

  // ALWAYS add shelfLife and lifeTime — many categories require these
  // If AI didn't provide them, use sensible defaults based on category
  const catLower = (category.name || "").toLowerCase();
  const isCosmetic = catLower.includes("космет") || catLower.includes("парфюм") || catLower.includes("крем") || catLower.includes("шампун") || catLower.includes("уход");
  const isFood = catLower.includes("продук") || catLower.includes("напит") || catLower.includes("еда") || catLower.includes("пищ");
  const isElectronics = catLower.includes("электр") || catLower.includes("техни") || catLower.includes("смарт") || catLower.includes("телефон") || catLower.includes("компьют");
  
  if (ai?.shelfLife && ai.shelfLife > 0) {
    offer.shelfLife = { timePeriod: ai.shelfLife, timeUnit: "MONTH" };
  } else if (isCosmetic) {
    offer.shelfLife = { timePeriod: 36, timeUnit: "MONTH" };
  } else if (isFood) {
    offer.shelfLife = { timePeriod: 12, timeUnit: "MONTH" };
  } else if (!isElectronics) {
    // Default for most non-electronics categories
    offer.shelfLife = { timePeriod: 36, timeUnit: "MONTH" };
  }
  
  if (ai?.lifeTime && ai.lifeTime > 0) {
    offer.lifeTime = { timePeriod: ai.lifeTime, timeUnit: "MONTH" };
  } else if (isCosmetic) {
    offer.lifeTime = { timePeriod: 36, timeUnit: "MONTH" };
  } else if (isElectronics) {
    offer.lifeTime = { timePeriod: 60, timeUnit: "MONTH" };
  } else {
    offer.lifeTime = { timePeriod: 24, timeUnit: "MONTH" };
  }

  // Warranty — always provide
  if (ai?.warranty) {
    const m = ai.warranty.match(/(\d+)\s*(год|года|лет|year|месяц|month)/i);
    if (m) {
      const n = parseInt(m[1]);
      const isYear = /год|года|лет|year/i.test(m[2]);
      offer.guaranteePeriod = { timePeriod: isYear ? n * 12 : n, timeUnit: "MONTH" };
    }
  } else {
    // Default warranty
    offer.guaranteePeriod = { timePeriod: isElectronics ? 12 : 6, timeUnit: "MONTH" };
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

    // ═══ BILLING CHECK (skip if called from scanner — scanner handles billing) ═══
    const skipBilling = !!body.skipBilling;
    const isClone = !!body.cloneMode || !!body.skipImageGeneration;
    const featureKey = isClone ? 'clone-to-yandex' : 'yandex-card-create';
    const productCount = products.length;
    let unitPrice = 0;
    let accessCheck: any = null;
    
    if (!skipBilling) {
      // Check access for first product (validates tier + balance)
      const { data: ac } = await supabase.rpc('check_feature_access', {
        p_user_id: user.id, p_feature_key: featureKey,
      });
      accessCheck = ac;
      
      if (accessCheck && !accessCheck.allowed) {
        const errorMsg = accessCheck.error === 'insufficient_balance' 
          ? `Balans yetarli emas. Balansni kamida 300,000 so'm to'ldiring. Joriy balans: ${accessCheck.balance?.toLocaleString()} so'm`
          : accessCheck.error === 'activation_required'
          ? 'Platformadan foydalanish uchun oylik aktivatsiya (99,000 so\'m) talab etiladi. Obuna bo\'limiga o\'ting.'
          : accessCheck.message || 'Ruxsat berilmadi';
        return new Response(JSON.stringify({ error: errorMsg, billingError: accessCheck.error }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      unitPrice = accessCheck?.price || 0;
      console.log(`💰 Billing: ${featureKey}, ${unitPrice} UZS x ${productCount}, tier: ${accessCheck?.tier}`);
    } else {
      console.log(`💰 Billing skipped (called from scanner pipeline)`);
    }

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

        // Preserve original SKU from source marketplace if provided
        const sku = product.shopSku || generateSKU(product.name);
        const barcode = product.barcode || generateEAN13();

        // ═══ PARALLEL PIPELINE: Images + Category + MXIK run concurrently ═══
        const rawImgs: string[] = [];
        if (product.images?.length) rawImgs.push(...product.images);
        
        // Proxy all images to storage first
        const sourceImages = await proxyImagesToStorage(supabase, user.id, rawImgs, SUPABASE_URL);
        
        // --- Define async tasks ---
        
        // Task A: Generate images (SellZen) — longest step (~60-90s)
        const imageTask = (async (): Promise<string[]> => {
          const shouldGenerateImages = (() => {
            if (body.cloneMode) return false;
            if (body.skipImageGeneration && sourceImages.length > 0) return false;
            if (body.skipImageGeneration && sourceImages.length === 0) return true;
            return true;
          })();
          
          if (!shouldGenerateImages) {
            console.log(`⚡ Using ${sourceImages.length} source images (skipImageGeneration=${body.skipImageGeneration}, cloneMode=${body.cloneMode})`);
            return [...sourceImages];
          }
          
          const SELLZEN_API_KEY = Deno.env.get("SELLZEN_API_KEY");
          const sourceImg = sourceImages[0] || null;
          const referenceImg = product.image || null;
          const imgSource = sourceImg || referenceImg;
          
          if (!SELLZEN_API_KEY) {
            console.warn("⚠️ SELLZEN_API_KEY not configured, using source images");
            return [...sourceImages];
          }
          if (!imgSource) return [...sourceImages];
          
          console.log("🎨 Generating images via SellZen API (parallel)...");
          
          let imgBase64: string | null = null;
          try {
            if (imgSource.startsWith('data:')) {
              imgBase64 = imgSource;
            } else {
              const imgResp = await fetch(imgSource, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'image/*,*/*;q=0.8',
                },
              });
              if (imgResp.ok) {
                const buffer = await imgResp.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                imgBase64 = `data:${contentType};base64,${btoa(binary)}`;
              }
            }
          } catch (e) {
            console.error("Image to base64 error:", e);
          }
          
          if (!imgBase64) return [...sourceImages];
          
          const catLower = (product.category || product.name || "").toLowerCase();
          let sellzenCategory = 'home';
          if (catLower.includes('elektr') || catLower.includes('techni') || catLower.includes('электрон') || catLower.includes('gadget') || catLower.includes('телефон') || catLower.includes('наушник') || catLower.includes('phone') || catLower.includes('audio') || catLower.includes('kompyuter')) sellzenCategory = 'electronics';
          else if (catLower.includes('kiyim') || catLower.includes('fashion') || catLower.includes('одежд') || catLower.includes('обувь') || catLower.includes('poyabzal')) sellzenCategory = 'clothing';
          else if (catLower.includes('kosmet') || catLower.includes('beauty') || catLower.includes('parfum') || catLower.includes('косметик') || catLower.includes('go\'zallik')) sellzenCategory = 'cosmetics';
          else if (catLower.includes('auto') || catLower.includes('mashina') || catLower.includes('avto') || catLower.includes('авто')) sellzenCategory = 'auto';
          else if (catLower.includes('sport') || catLower.includes('fitness') || catLower.includes('спорт')) sellzenCategory = 'sport';
          
          const SELLZEN_URL = "https://yyrlkbbnemimflbeddzq.supabase.co/functions/v1/webhook-generate";
          console.log(`🖼️ Generating SellZen v2 images (category=${sellzenCategory})...`);
          
          const result: string[] = [];
          try {
            const response = await fetch(SELLZEN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': SELLZEN_API_KEY },
              body: JSON.stringify({
                product_name: (product.name || 'Product').substring(0, 500),
                product_image_base64: imgBase64,
                category: sellzenCategory,
                marketplace: 'yandex',
                style: 'commercial',
                aspect_ratio: '3:4',
                target_width: 1080,
                target_height: 1440,
                orientation: 'portrait',
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.images?.length > 0) {
                for (let i = 0; i < data.images.length; i++) {
                  const img = data.images[i];
                  if (!img.image_url) continue;
                  try {
                    const dlResp = await fetch(img.image_url);
                    if (!dlResp.ok) { result.push(img.image_url); continue; }
                    const bytes = new Uint8Array(await dlResp.arrayBuffer());
                    
                    // ═══ PORTRAIT RESIZE: Programmatic 1080x1440 (3:4 ratio) ═══
                    let finalBytes = bytes;
                    let finalContentType = 'image/png';
                    try {
                      console.log(`🔄 Resizing SellZen image ${i} to 1080x1440 portrait (programmatic)...`);
                      const decoded = await Image.decode(bytes);
                      const srcW = decoded.width;
                      const srcH = decoded.height;
                      const TARGET_W = 1080;
                      const TARGET_H = 1440;
                      const dstRatio = TARGET_W / TARGET_H; // 0.75
                      const srcRatio = srcW / srcH;
                      
                      let cropped: any;
                      if (srcRatio > dstRatio) {
                        // Image is wider — crop sides
                        const newW = Math.round(srcH * dstRatio);
                        const offsetX = Math.round((srcW - newW) / 2);
                        cropped = decoded.crop(offsetX, 0, newW, srcH);
                      } else {
                        // Image is taller — crop top/bottom
                        const newH = Math.round(srcW / dstRatio);
                        const offsetY = Math.round((srcH - newH) / 2);
                        cropped = decoded.crop(0, offsetY, srcW, newH);
                      }
                      
                      const resized = cropped.resize(TARGET_W, TARGET_H);
                      finalBytes = await resized.encode(1); // PNG format (lossless)
                      finalContentType = 'image/png';
                      console.log(`✅ Image ${i} resized: ${srcW}x${srcH} → ${TARGET_W}x${TARGET_H} (portrait)`);
                    } catch (resizeErr) {
                      console.warn(`⚠️ Programmatic resize failed for image ${i}, using original:`, resizeErr);
                    }
                    
                    const ext = finalContentType.includes('jpeg') ? 'jpg' : 'png';
                    const fileName = `${user.id}/ym-sellzen-${Date.now()}-${i}.${ext}`;
                    const { error } = await supabase.storage.from('product-images').upload(fileName, finalBytes, {
                      contentType: finalContentType, cacheControl: '31536000', upsert: false,
                    });
                    if (!error) {
                      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
                      if (urlData?.publicUrl) {
                        console.log(`✅ SellZen v2 ${img.variant} image stored (portrait)`);
                        result.push(urlData.publicUrl);
                      }
                    } else {
                      result.push(img.image_url);
                    }
                  } catch (dlErr) {
                    console.warn(`SellZen image download error:`, dlErr);
                    result.push(img.image_url);
                  }
                }
                console.log(`✅ SellZen v2 generated ${result.length} portrait images`);
              } else {
                console.warn(`SellZen v2: no images returned`, data.error);
              }
            } else {
              const errText = await response.text();
              console.error(`SellZen v2 error ${response.status}: ${errText.substring(0, 200)}`);
            }
          } catch (e) {
            console.error('SellZen v2 exception:', e);
          }
          
          return result.length > 0 ? result : [...sourceImages];
        })();
        
        // Task B: Find LEAF category
        const categoryTask = findLeafCategory(
          creds.apiKey, product.name, product.description || "", LOVABLE_KEY,
          product.sourceCategory || product.category, product.sourceMarketplace,
          product.sourceSubject, product.sourceParent
        );
        
        // Task C: MXIK lookup
        const sourceMxikCode = normalizeMxikCode(product.mxikCode);
        const mxikSearchName = [product.name, product.model, product.brand].filter(Boolean).join(' ');
        const mxikSearchCategory = product.sourceSubject || product.sourceCategory || product.sourceParent || product.category;
        const mxikTask = sourceMxikCode
          ? Promise.resolve({ code: sourceMxikCode, name_uz: product.mxikName || 'Manba MXIK kodi' })
          : lookupMXIK(supabase, mxikSearchName || product.name, mxikSearchCategory, LOVABLE_KEY);
        
        // --- Run all three in parallel ---
        const [generatedImages, leafCat, mxik] = await Promise.all([imageTask, categoryTask, mxikTask]);
        let images = generatedImages;
        
        // If no images at all, fall back to source
        if (images.length === 0 && sourceImages.length > 0) {
          console.warn("⚠️ No AI images, using source as fallback");
          images = [...sourceImages];
        }
        console.log(`🖼️ Total ${images.length} images ready`);
        console.log(`📂 Category: ${leafCat.name} (${leafCat.id})`);

        // ═══ STEP 5b: Fetch category params & AI content fill ═══
        const categoryParams = await fetchCategoryParameters(creds.apiKey, leafCat.id);
        const ai = await aiOptimize(product, leafCat.name, categoryParams, LOVABLE_KEY, !!body.cloneMode);

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

        if (!yResp.ok) {
          console.error(`❌ Yandex error (${yResp.status}):`, respText.substring(0, 500));
          // Parse detailed error info for client
          const errDetail = yResult?.errors?.map((e: any) => e.message || e.code).join('; ') || respText.substring(0, 200);
          console.error(`❌ Error details: ${errDetail}`);
        }

        // ═══ STEP 7: Uzbek content ═══
        let uzSent = false;
        if (yResp.ok && ai?.name_uz) {
          await new Promise(r => setTimeout(r, 300));
          uzSent = await sendUzbekContent(creds.apiKey, creds.businessId, sku, ai.name_uz, ai.description_uz);
        }

        // ═══ STEP 7.5: Auto quality check + auto-fix (ALWAYS run, including clone mode) ═══
        let qualityCheck: any = null;
        if (yResp.ok && LOVABLE_KEY) {
          try {
            console.log("🔍 Running auto quality check...");
            await new Promise(r => setTimeout(r, 1000));
            
            const checkResp = await fetch(`${YANDEX_API}/businesses/${creds.businessId}/offer-mappings`, {
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
              
              // Auto-fix errors
              if (errors.length > 0 && LOVABLE_KEY) {
                console.log("🔧 Auto-fixing errors:", errors.slice(0, 5).map((e: any) => e.message || e.code));
                try {
                  const errorMessages = errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join("\n");
                  const fixPrompt = `Yandex Market kartochkasida quyidagi xatolar topildi:\n${errorMessages}\n\nJoriy offer:\n- name: ${offer.name}\n- vendor: ${offer.vendor}\n- categoryId: ${leafCat.id} (${leafCat.name})\n- shelfLife: ${JSON.stringify(offer.shelfLife)}\n- lifeTime: ${JSON.stringify(offer.lifeTime)}\n\nJavob FAQAT JSON:\n{"fixes": {"name": "yangi nom yoki null", "shelfLife": {"timePeriod": 36, "timeUnit": "MONTH"}, "lifeTime": {"timePeriod": 36, "timeUnit": "MONTH"}, "parameterValues": [{"parameterId": 123, "value": "qiymat"}], "vendor": "yangi vendor yoki null"}}`;
                  const fixResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: fixPrompt }], temperature: 0, max_tokens: 2000 }),
                  });
                  if (fixResp.ok) {
                    const fixData = await fixResp.json();
                    const fixContent = fixData.choices?.[0]?.message?.content || "";
                    const fixMatch = fixContent.match(/\{[\s\S]*\}/);
                    if (fixMatch) {
                      const fixes = JSON.parse(fixMatch[0]).fixes || JSON.parse(fixMatch[0]);
                      if (fixes.name && fixes.name !== "null") offer.name = fixes.name;
                      if (fixes.vendor && fixes.vendor !== "null") offer.vendor = fixes.vendor;
                      if (fixes.shelfLife) offer.shelfLife = fixes.shelfLife;
                      if (fixes.lifeTime) offer.lifeTime = fixes.lifeTime;
                      if (fixes.parameterValues?.length) {
                        const existingMap = new Map((offer.parameterValues || []).map((p: any) => [p.parameterId, p]));
                        for (const fp of fixes.parameterValues) existingMap.set(fp.parameterId, fp);
                        offer.parameterValues = Array.from(existingMap.values());
                      }
                      const fixedResp = await fetch(`${YANDEX_API}/businesses/${creds.businessId}/offer-mappings/update`, {
                        method: "POST",
                        headers: { "Api-Key": creds.apiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({ offerMappings: [{ offer }] }),
                      });
                      if (fixedResp.ok) { qualityCheck.autoFixed = true; qualityCheck.fixedFields = Object.keys(fixes).filter(k => fixes[k] !== null && fixes[k] !== "null"); }
                    }
                  }
                } catch (fixErr) { console.warn("Auto-fix error:", fixErr); }
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
          error: yResp.ok ? null : (yResult?.errors?.map((e: any) => e.message || e.code).join('; ') || `HTTP ${yResp.status}: ${respText.substring(0, 200)}`),
        });

        console.log(`${yResp.ok ? "✅" : "❌"} Done: params=${offer.parameterValues?.length || 0}, imgs=${images.length}`);

        if (products.length > 1) await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error(`❌ Error:`, err);
        results.push({ success: false, name: product.name, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    // ═══ BILLING DEDUCT (skip if scanner handles it) ═══
    if (!skipBilling) {
      if (unitPrice > 0 && successCount > 0) {
        for (let i = 0; i < successCount; i++) {
          await supabase.rpc('deduct_balance', {
            p_user_id: user.id,
            p_amount: unitPrice,
            p_feature_key: featureKey,
            p_description: `Yandex ${isClone ? 'klonlash' : 'kartochka yaratish'}: ${results.filter(r => r.success)[i]?.name?.substring(0, 50) || 'N/A'}`,
          });
        }
        console.log(`💰 Billed: ${unitPrice * successCount} UZS for ${successCount} cards`);
      } else if (accessCheck?.tier === 'elegant' && successCount > 0) {
        for (let i = 0; i < successCount; i++) {
          await supabase.from('elegant_usage').upsert(
            { user_id: user.id, feature_key: featureKey, usage_month: new Date().toISOString().slice(0, 7) + '-01', usage_count: (accessCheck.used || 0) + i + 1 },
            { onConflict: 'user_id,feature_key,usage_month' }
          );
        }
      }
    }

    return new Response(JSON.stringify({
      success: results.every(r => r.success),
      total: results.length,
      successCount,
      failedCount: results.filter(r => !r.success).length,
      results,
      billing: { featureKey, unitPrice, totalCharged: unitPrice * successCount, tier: accessCheck?.tier },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
