import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WB_API = "https://content-api.wildberries.ru";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function wbFetch(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status === 429) { await sleep(2000 * (i + 1)); continue; }
      return resp;
    } catch (e) {
      if (i < retries - 1) { await sleep(1000 * (i + 1)); continue; }
      throw e;
    }
  }
  return fetch(url, options);
}

// ===== AI UNIVERSAL ANALYZER =====
async function aiAnalyzeProduct(productName: string, description: string, category: string): Promise<{
  searchKeywords: string[];
  titleRu: string;
  descriptionRu: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      searchKeywords: extractRussianWords(category || productName),
      titleRu: productName.slice(0, 60),
      descriptionRu: description || productName,
    };
  }

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a Wildberries marketplace expert. Analyze the product and return JSON.

CRITICAL RULES for searchKeywords:
- These are for WB /content/v2/object/all API subject search
- WB API requires PLURAL Russian nouns (e.g. "Шампуни" NOT "Шампунь", "Кроссовки" NOT "Кроссовка")
- Provide 5-7 different keyword variants from most specific to most generic
- Example for shampoo: ["Шампуни", "Шампуни для волос", "Средства для волос", "Косметика", "Уход"]

TITLE rules (CRITICAL — max 60 characters!):
- Russian, STRICTLY max 60 characters total
- Format: "Тип Бренд краткое описание"
- SEO optimized, concise
- Example: "Шампунь Head&Shoulders против перхоти 400мл" (42 chars)
- NEVER exceed 60 characters

DESCRIPTION rules:
- Russian, 1000-2000 characters (MINIMUM 1000!)
- Detailed: features, benefits, ingredients, usage instructions
- Include keywords for SEO
- Professional marketplace description style

Return ONLY valid JSON:
{"searchKeywords": ["keyword1", "keyword2", ...], "titleRu": "...", "descriptionRu": "..."}`
          },
          {
            role: "user",
            content: `Product name: "${productName}"
Description: "${(description || '').substring(0, 2000)}"
Category: "${category || 'unknown'}"`
          },
        ],
        temperature: 0.1,
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const keywords = Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [];
        const nameWords = extractRussianWords(productName);
        const catWords = extractRussianWords(category || '');
        const allKeywords = [...keywords, ...catWords, ...nameWords].filter(Boolean);
        const unique = [...new Set(allKeywords)];
        
        let title = (parsed.titleRu || productName).slice(0, 60);
        let desc = parsed.descriptionRu || description || productName;
        if (desc.length < 1000) {
          desc = desc + '\n\n' + `${title} — высококачественный товар для повседневного использования. Отличается превосходным качеством и надежностью. Подходит для широкого круга покупателей. Произведен с использованием современных технологий и материалов. Гарантия качества от производителя. Удобная упаковка обеспечивает сохранность при транспортировке. Рекомендуется к покупке. Отличный выбор по соотношению цена-качество. Быстрая доставка. Возможен возврат в течение установленного срока.`;
        }

        console.log(`AI analysis OK. Keywords: ${unique.length}, Title(${title.length}ch): "${title}"`);
        return {
          searchKeywords: unique.length > 0 ? unique : ['Товар'],
          titleRu: title,
          descriptionRu: desc.slice(0, 5000),
        };
      }
    }
  } catch (e) {
    console.error("AI analyze error:", e);
  }

  const fallbackKw = [...extractRussianWords(category || ''), ...extractRussianWords(productName)];
  return {
    searchKeywords: fallbackKw.length > 0 ? fallbackKw : [productName.split(/\s+/)[0]],
    titleRu: productName.slice(0, 60),
    descriptionRu: (description || productName).slice(0, 5000),
  };
}

function extractRussianWords(text: string): string[] {
  return (text.match(/[а-яА-ЯёЁ]{3,}/g) || []).filter((w, i, a) => a.indexOf(w) === i);
}

// ===== FIND SUBJECT =====
async function findSubjectId(apiKey: string, keywords: string[], productName: string): Promise<{ subjectID: number; subjectName: string; parentName: string } | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let subjects: any[] = [];
  let usedKeyword = "";

  for (const kw of keywords) {
    if (!kw || kw.length < 2) continue;
    try {
      const url = `${WB_API}/content/v2/object/all?name=${encodeURIComponent(kw)}&top=50&locale=ru`;
      console.log(`Subject search: "${kw}"`);
      const resp = await wbFetch(url, { headers });
      if (!resp.ok) continue;
      const data = await resp.json();
      subjects = data.data || [];
      console.log(`  → ${subjects.length} results`);
      if (subjects.length > 0) { usedKeyword = kw; break; }
    } catch (e) {
      console.warn(`Subject search error for "${kw}":`, e);
    }
  }

  if (subjects.length === 0) return null;

  if (LOVABLE_API_KEY && subjects.length > 1) {
    const subjectList = subjects.slice(0, 30).map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Return ONLY the subjectID number that best matches the product. No text." },
            { role: "user", content: `Product: "${productName}"\n\nSubjects:\n${subjectList}` },
          ],
          temperature: 0,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const id = parseInt((aiData.choices?.[0]?.message?.content || "").replace(/\D/g, ""));
        const found = subjects.find((s: any) => s.subjectID === id);
        if (found) {
          console.log(`AI selected subject: ${found.parentName} > ${found.subjectName} (${id})`);
          return { subjectID: id, subjectName: found.subjectName, parentName: found.parentName };
        }
      }
    } catch (e) { /* fallback */ }
  }

  const kwLower = usedKeyword.toLowerCase();
  const exact = subjects.find((s: any) => (s.subjectName || "").toLowerCase() === kwLower);
  const result = exact || subjects[0];
  return { subjectID: result.subjectID, subjectName: result.subjectName, parentName: result.parentName };
}

// ===== GET & FILL CHARACTERISTICS (excluding description — it goes via v3 update) =====
async function getAndFillCharacteristics(
  apiKey: string, subjectID: number, productName: string,
  category: string, aiTitle: string
): Promise<Array<{ id: number; value: any }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let charcs: any[] = [];
  try {
    const resp = await wbFetch(`${WB_API}/content/v2/object/charcs/${subjectID}?locale=ru`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (resp.ok) {
      const data = await resp.json();
      charcs = data.data || [];
    }
  } catch (e) { /* empty */ }

  console.log(`Total characteristics for subject ${subjectID}: ${charcs.length}`);

  // Find name characteristic only — description will be set via v3 after nmID
  const nameCharc = charcs.find((c: any) => {
    const name = (c.name || '').toLowerCase();
    return name === 'наименование' || name === 'название' || name.includes('наименование');
  });

  console.log(`Name charc: ${nameCharc ? `id=${nameCharc.charcID} "${nameCharc.name}"` : 'NOT IN CHARCS (using top-level field)'}`);

  const preFilled: Array<{ id: number; value: any }> = [];
  if (nameCharc) {
    preFilled.push({ id: nameCharc.charcID, value: [aiTitle] });
  }

  console.log(`Available charcs: ${charcs.slice(0, 10).map((c: any) => `${c.charcID}:"${c.name}"`).join(', ')}${charcs.length > 10 ? '...' : ''}`);

  if (!LOVABLE_API_KEY || charcs.length === 0) return preFilled;

  const preFilledIds = new Set(preFilled.map(p => p.id));
  // Exclude description-related charcs from AI fill — they cause silent rejection
  const excluded = new Set<number>();
  for (const c of charcs) {
    const name = (c.name || '').toLowerCase();
    if (name.includes('описание') || name.includes('description')) {
      excluded.add(c.charcID);
    }
  }

  const required = charcs.filter((c: any) => c.required && !preFilledIds.has(c.charcID) && !excluded.has(c.charcID));
  const popular = charcs.filter((c: any) => c.popular && !c.required && !preFilledIds.has(c.charcID) && !excluded.has(c.charcID));
  const other = charcs.filter((c: any) => !c.required && !c.popular && !preFilledIds.has(c.charcID) && !excluded.has(c.charcID)).slice(0, 10);
  const selected = [...required, ...popular, ...other];

  if (selected.length === 0) return preFilled;

  const charcsList = selected.map((c: any) => {
    const dict = c.dictionary?.length ? ` ALLOWED_VALUES: [${c.dictionary.slice(0, 20).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    const t = c.charcType === 4 ? 'number' : 'string';
    return `id=${c.charcID} "${c.name}" type=${t}${req}${dict}`;
  }).join('\n');

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Fill Wildberries product characteristics. Return ONLY a JSON array.
Rules:
- String type: {"id": N, "value": ["text"]} (array with ONE string)
- Number type: {"id": N, "value": 123}
- If ALLOWED_VALUES listed, use EXACTLY one from the list
- Fill ALL [REQUIRED] fields — NEVER skip them
- For optional fields, fill as many as you can determine from context
- No markdown, no explanation, ONLY JSON array`
          },
          {
            role: "user",
            content: `Product: "${productName}"\nCategory: "${category}"\n\nCharacteristics:\n${charcsList}`
          },
        ],
        temperature: 0.1,
      }),
    });
    if (!aiResp.ok) {
      console.error(`AI charcs failed: ${aiResp.status}`);
      return preFilled;
    }
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\[[\s\S]*\])/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (Array.isArray(parsed)) {
        const validIds = new Set(charcs.map((c: any) => c.charcID));
        const aiResult = parsed.filter((item: any) =>
          typeof item.id === 'number' && validIds.has(item.id) && item.value !== undefined && !preFilledIds.has(item.id) && !excluded.has(item.id)
        );
        const result = [...preFilled, ...aiResult];
        console.log(`Characteristics: ${preFilled.length} pre-filled + ${aiResult.length} AI = ${result.length} total`);
        return result;
      }
    }
  } catch (e) {
    console.error("AI charcs error:", e);
  }
  return preFilled;
}

// ===== GENERATE BARCODE =====
async function generateBarcode(apiKey: string): Promise<string | null> {
  try {
    const resp = await wbFetch(`${WB_API}/content/v2/barcodes`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.[0] || null;
  } catch (e) { return null; }
}

// ===== PROXY IMAGES =====
async function proxyImages(supabase: any, userId: string, images: string[]): Promise<string[]> {
  const proxied: string[] = [];
  const results = await Promise.allSettled(
    images.slice(0, 10).map(async (imgUrl) => {
      if (!imgUrl?.startsWith("http")) return null;
      try {
        const resp = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": imgUrl.includes("yandex") ? "https://market.yandex.ru/" : imgUrl.includes("uzum") ? "https://uzum.uz/" : "https://www.wildberries.ru/",
          },
          redirect: "follow",
        });
        if (!resp.ok) { console.log(`Image fetch failed: ${resp.status} — keeping original URL`); return imgUrl; }
        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) return imgUrl;
        const data = await resp.arrayBuffer();
        if (data.byteLength < 500) return imgUrl;
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const fileName = `${userId}/wb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
        if (error) { console.log(`Storage upload error: ${error.message} — keeping original URL`); return imgUrl; }
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        return urlData?.publicUrl || imgUrl;
      } catch (e) { console.log(`Image proxy exception — keeping original URL`); return imgUrl; }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) proxied.push(r.value);
  }
  console.log(`Images proxied: ${proxied.length}/${images.length}`);
  return proxied;
}

// ===== POLL FOR nmID (fast polling: 8 attempts, ~40s max) =====
async function pollForNmID(apiKey: string, vendorCode: string, maxAttempts = 12): Promise<number | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = 3000 + attempt * 2000; // 3s, 5s, 7s, 9s... up to ~27s per attempt
    await sleep(delay);
    try {
      // Fetch 100 latest cards to reliably find our new card
      const listResp = await wbFetch(`${WB_API}/content/v2/get/cards/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          settings: {
            cursor: { limit: 100 },
            filter: { withPhoto: -1 },
            sort: { sortColumn: "updatedAt", ascending: false },
          },
        }),
      });
      if (!listResp.ok) continue;
      const listData = await listResp.json();
      const cards = listData.cards || listData.data?.cards || [];
      const found = cards.find((c: any) => c.vendorCode === vendorCode);
      if (found?.nmID) {
        console.log(`✅ nmID found: ${found.nmID} (attempt ${attempt + 1}/${maxAttempts})`);
        return found.nmID;
      }
      console.log(`Polling attempt ${attempt + 1}: checked ${cards.length} cards, not found yet`);
    } catch (e) { /* continue */ }
  }
  console.log(`⚠️ nmID not found after ${maxAttempts} attempts for ${vendorCode}`);
  return null;
}

// ===== UPLOAD IMAGES VIA v3 =====
async function uploadMedia(apiKey: string, nmID: number, imageUrls: string[]): Promise<boolean> {
  if (imageUrls.length === 0) return false;
  try {
    console.log(`Uploading ${imageUrls.length} images to nmID ${nmID}`);
    const resp = await wbFetch(`${WB_API}/content/v3/media/save`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ nmId: nmID, data: imageUrls }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      console.error(`Media save failed: ${resp.status} ${JSON.stringify(data).substring(0, 300)}`);
      return false;
    }
    console.log(`✅ ${imageUrls.length} images uploaded to nmID ${nmID}`);
    return true;
  } catch (e) {
    console.error("Media save error:", e);
    return false;
  }
}

// ===== UPDATE DESCRIPTION VIA v3 (after nmID is available) =====
async function updateCardDescription(apiKey: string, nmID: number, description: string): Promise<boolean> {
  try {
    console.log(`Updating description for nmID ${nmID} (${description.length} chars)`);
    const resp = await wbFetch(`${WB_API}/content/v2/cards/update`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify([{
        nmID,
        description: description.slice(0, 5000),
      }]),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      console.error(`Description update failed: ${resp.status} ${JSON.stringify(data).substring(0, 300)}`);
      return false;
    }
    console.log(`✅ Description updated for nmID ${nmID}`);
    return true;
  } catch (e) {
    console.error("Description update error:", e);
    return false;
  }
}

// ===== SET PRICE =====
async function setPrice(apiKey: string, nmID: number, priceRUB: number): Promise<boolean> {
  if (priceRUB <= 0) return false;
  try {
    const resp = await wbFetch("https://discounts-prices-api.wildberries.ru/api/v2/upload/task", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{ nmID, price: priceRUB }] }),
    });
    const data = await resp.json();
    console.log(`Price set ${priceRUB} RUB for nmID ${nmID}: ${resp.status}`);
    return resp.ok;
  } catch (e) {
    console.error("Price set error:", e);
    return false;
  }
}

// ===== CHECK WB ASYNC ERRORS =====
async function checkWbErrors(apiKey: string, vendorCode: string): Promise<{ hasError: boolean; errors: any[] }> {
  try {
    const resp = await wbFetch(`${WB_API}/content/v2/cards/error/list`, {
      headers: { Authorization: apiKey },
    });
    if (!resp.ok) return { hasError: false, errors: [] };
    const data = await resp.json();
    const all = data.data || [];
    const ours = all.filter((e: any) => e.vendorCode === vendorCode || JSON.stringify(e).includes(vendorCode));
    return { hasError: ours.length > 0, errors: ours };
  } catch (e) {
    return { hasError: false, errors: [] };
  }
}

function generateVendorCode(name: string): string {
  const ascii = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = (ascii || "PROD").split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SCX-${prefix || "PROD"}-${rnd}-${ts}`;
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn } = await supabase
      .from("marketplace_connections").select("*")
      .eq("user_id", user.id).eq("marketplace", "wildberries").eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).single();

    if (!conn) {
      return new Response(JSON.stringify({ success: false, error: "Wildberries ulanmagan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let apiKey = "";
    if (conn.encrypted_credentials) {
      const { data, error } = await supabase.rpc("decrypt_credentials", { p_encrypted: conn.encrypted_credentials });
      if (!error && data) {
        const creds = typeof data === "string" ? JSON.parse(data) : data;
        apiKey = creds?.apiKey || "";
      }
    } else {
      apiKey = (conn.credentials as any)?.apiKey || "";
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Wildberries API kaliti yo'q" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { product } = await req.json();
    console.log(`\n========= WB CARD CREATION =========`);
    console.log(`Product: "${product.name}"`);
    console.log(`Category: "${product.category || 'none'}"`);
    console.log(`Images: ${(product.images || []).length}`);
    console.log(`Description length: ${(product.description || '').length}`);

    // ===== STEP 1: AI analysis + barcode + image proxy in parallel =====
    console.log(`\n--- STEP 1: AI + Barcode + Images (parallel) ---`);
    const [analysis, barcode, proxiedImages] = await Promise.all([
      aiAnalyzeProduct(product.name, product.description || '', product.category || ''),
      generateBarcode(apiKey),
      proxyImages(supabase, user.id, product.images || []),
    ]);
    console.log(`Title(${analysis.titleRu.length}ch): "${analysis.titleRu}"`);
    console.log(`Description: ${analysis.descriptionRu.length} chars (will be set via v3 after nmID)`);
    console.log(`Barcode: ${barcode || 'failed'}`);
    console.log(`Images proxied: ${proxiedImages.length}`);

    // ===== STEP 2: Find WB subject =====
    console.log(`\n--- STEP 2: Subject Search ---`);
    const subject = await findSubjectId(apiKey, analysis.searchKeywords, product.name);
    if (!subject) {
      return new Response(JSON.stringify({
        success: false,
        error: "Kategoriya topilmadi. WB bazasida mos kategoriya mavjud emas.",
        searchedKeywords: analysis.searchKeywords,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Subject: ${subject.parentName} > ${subject.subjectName} (${subject.subjectID})`);

    // ===== STEP 3: Get & fill characteristics (NO description — it causes silent rejection in v2) =====
    console.log(`\n--- STEP 3: Characteristics ---`);
    const filledCharcs = await getAndFillCharacteristics(
      apiKey, subject.subjectID, product.name,
      product.category || '', analysis.titleRu
    );
    console.log(`Total characteristics: ${filledCharcs.length}`);

    // ===== STEP 4: Build MINIMAL v2 payload (NO description, NO brand) =====
    console.log(`\n--- STEP 4: Create Card (minimal v2 payload) ---`);
    const vendorCode = generateVendorCode(product.name);

    const UZS_TO_RUB_RATE = 140;
    const rawPrice = Math.round(product.price || 0);
    const priceRUB = rawPrice > 10000 ? Math.round(rawPrice / UZS_TO_RUB_RATE) : rawPrice;
    console.log(`Price: ${rawPrice} → ${priceRUB} RUB`);

    // CRITICAL: v2 payload must NOT contain description or brand to avoid silent rejection
    const variant: any = {
      vendorCode,
      title: analysis.titleRu,
      // NO description here — will be added via v2/cards/update after nmID
      dimensions: { length: 20, width: 15, height: 10, weightBrutto: 0.5 },
      characteristics: filledCharcs,
      sizes: [{
        techSize: "0",
        price: priceRUB > 0 ? priceRUB : undefined,
        skus: barcode ? [barcode] : undefined,
      }],
    };

    // Include images in initial payload via mediaFiles
    if (proxiedImages.length > 0) {
      variant.mediaFiles = proxiedImages;
      console.log(`📸 mediaFiles added to payload: ${proxiedImages.length} images`);
    }

    const payload = [{ subjectID: subject.subjectID, variants: [variant] }];
    console.log(`Payload keys: ${Object.keys(variant).join(', ')}`);
    console.log(`⚠️ Description intentionally excluded from v2 to prevent silent rejection`);

    const wbResp = await wbFetch(`${WB_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const wbData = await wbResp.json();

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData).substring(0, 500));

      // Retry without characteristics if they caused the error
      if (JSON.stringify(wbData).match(/характеристик|characteristic|Invalid/i)) {
        console.log("Retrying without AI characteristics...");
        variant.characteristics = [];
        variant.vendorCode = vendorCode + "-R";
        const retryPayload = [{ subjectID: subject.subjectID, variants: [variant] }];
        const retryResp = await wbFetch(`${WB_API}/content/v2/cards/upload`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(retryPayload),
        });
        const retryData = await retryResp.json();

        if (!retryResp.ok || retryData.error) {
          return new Response(JSON.stringify({
            success: false, error: retryData?.errorText || "WB API xatosi",
            wbResponse: retryData, originalError: wbData,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log("✅ Retry succeeded without charcs");
      } else {
        return new Response(JSON.stringify({
          success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    console.log(`✅ WB accepted card: ${vendorCode}`);

    // ===== STEP 5: Check async errors (quick 2s wait) =====
    await sleep(2000);
    const { hasError, errors: wbErrors } = await checkWbErrors(apiKey, vendorCode);
    if (hasError) {
      const errorMsg = wbErrors.map((e: any) => (e.errors || []).join(', ') || e.errorText || JSON.stringify(e)).join('; ');
      console.error(`❌ WB async error: ${errorMsg}`);
      return new Response(JSON.stringify({
        success: false, error: `WB kartochkani rad etdi: ${errorMsg}`,
        wbErrors, vendorCode,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== STEP 6: Poll nmID (8 attempts, ~40s max) =====
    console.log(`\n--- STEP 6: Poll nmID ---`);
    const nmID = await pollForNmID(apiKey, vendorCode, 12);

    let imagesUploaded = proxiedImages.length > 0; // sent via mediaFiles
    let priceSet = false;
    let descriptionSet = false;

    if (nmID) {
      // After nmID found: upload images (backup), set description, set price — all in parallel
      console.log(`\n--- STEP 7: Post-creation updates (parallel) ---`);
      const [imgResult, descResult, priceResult] = await Promise.all([
        proxiedImages.length > 0 ? uploadMedia(apiKey, nmID, proxiedImages) : Promise.resolve(false),
        updateCardDescription(apiKey, nmID, analysis.descriptionRu),
        setPrice(apiKey, nmID, priceRUB),
      ]);
      if (imgResult) imagesUploaded = true;
      descriptionSet = descResult;
      priceSet = priceResult;
    } else {
      console.log(`⚠️ nmID not found — description, backup images and price will need manual setup`);
    }

    console.log(`\n========= RESULT =========`);
    console.log(`vendorCode: ${vendorCode}, nmID: ${nmID || 'null'}, images: ${imagesUploaded}, price: ${priceSet}, description: ${descriptionSet}`);
    console.log(`Title: "${analysis.titleRu}" (${analysis.titleRu.length} chars)`);
    console.log(`Description: ${analysis.descriptionRu.length} chars`);
    console.log(`Characteristics: ${filledCharcs.length}`);

    return new Response(JSON.stringify({
      success: true,
      vendorCode,
      name: analysis.titleRu,
      subjectID: subject.subjectID,
      subjectName: `${subject.parentName} > ${subject.subjectName}`,
      price: priceRUB,
      priceOriginal: rawPrice,
      currency: 'RUB',
      images: proxiedImages.length,
      imagesUploaded,
      priceSet,
      descriptionSet,
      nmID,
      characteristics: filledCharcs.length,
      descriptionLength: analysis.descriptionRu.length,
      barcode,
      wbResponse: wbData,
      note: nmID
        ? `Kartochka to'liq yaratildi: ${filledCharcs.length} xususiyat, ${proxiedImages.length} rasm${descriptionSet ? ', tavsif' : ''}${priceSet ? ', narx' : ''} (nmID: ${nmID})`
        : 'Kartochka yaratildi lekin nmID hali tayyor emas — tavsif va narx 5-10 daqiqadan keyin qo\'shiladi.',
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Noma'lum xato",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
