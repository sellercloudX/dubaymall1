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
// One AI call analyzes product and returns ALL needed data
async function aiAnalyzeProduct(productName: string, description: string, category: string): Promise<{
  searchKeywords: string[];
  titleRu: string;
  descriptionRu: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      searchKeywords: extractRussianWords(category || productName),
      titleRu: productName.slice(0, 100),
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
- Include: exact category plural, parent category plural, generic type plural
- Example for shampoo: ["Шампуни", "Шампуни для волос", "Средства для волос", "Косметика", "Уход"]
- Example for sneakers: ["Кроссовки", "Кеды", "Спортивная обувь", "Обувь"]

TITLE rules:
- Russian, max 100 chars
- Format: "Тип товара Бренд описание, характеристика"
- SEO optimized for Wildberries search

DESCRIPTION rules:
- Russian, 500-2000 chars
- Detailed product features, benefits, usage

Return ONLY valid JSON:
{"searchKeywords": ["keyword1", "keyword2", ...], "titleRu": "...", "descriptionRu": "..."}`
          },
          {
            role: "user",
            content: `Product name: "${productName}"
Description: "${(description || '').substring(0, 1500)}"
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
        // Add fallback keywords from product name
        const nameWords = extractRussianWords(productName);
        const catWords = extractRussianWords(category || '');
        const allKeywords = [...keywords, ...catWords, ...nameWords].filter(Boolean);
        // Deduplicate
        const unique = [...new Set(allKeywords)];
        console.log(`AI analysis complete. Keywords: ${JSON.stringify(unique)}, Title: "${parsed.titleRu?.substring(0, 50)}..."`);
        return {
          searchKeywords: unique.length > 0 ? unique : ['Товар'],
          titleRu: (parsed.titleRu || productName).slice(0, 100),
          descriptionRu: (parsed.descriptionRu || description || productName).slice(0, 5000),
        };
      }
    }
  } catch (e) {
    console.error("AI analyze error:", e);
  }

  // Fallback
  const fallbackKw = [...extractRussianWords(category || ''), ...extractRussianWords(productName)];
  return {
    searchKeywords: fallbackKw.length > 0 ? fallbackKw : [productName.split(/\s+/)[0]],
    titleRu: productName.slice(0, 100),
    descriptionRu: (description || productName).slice(0, 5000),
  };
}

function extractRussianWords(text: string): string[] {
  return (text.match(/[а-яА-ЯёЁ]{3,}/g) || []).filter((w, i, a) => a.indexOf(w) === i);
}

// ===== FIND SUBJECT using AI-generated keywords =====
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
      if (!resp.ok) {
        const errText = await resp.text();
        console.log(`  → ${resp.status}: ${errText.substring(0, 100)}`);
        continue;
      }
      const data = await resp.json();
      subjects = data.data || [];
      console.log(`  → ${subjects.length} results`);
      if (subjects.length > 0) { usedKeyword = kw; break; }
    } catch (e) {
      console.warn(`Subject search error for "${kw}":`, e);
    }
  }

  if (subjects.length === 0) {
    console.error(`No subjects found for any keyword`);
    return null;
  }

  // AI selects best match
  if (LOVABLE_API_KEY && subjects.length > 1) {
    const subjectList = subjects.slice(0, 30).map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Return ONLY the subjectID number that best matches the product. No text, no explanation." },
            { role: "user", content: `Product: "${productName}"\n\nAvailable subjects:\n${subjectList}` },
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

  // Exact match or first result
  const kwLower = usedKeyword.toLowerCase();
  const exact = subjects.find((s: any) => (s.subjectName || "").toLowerCase() === kwLower);
  const result = exact || subjects[0];
  return { subjectID: result.subjectID, subjectName: result.subjectName, parentName: result.parentName };
}

// ===== GET & FILL CHARACTERISTICS =====
async function getAndFillCharacteristics(apiKey: string, subjectID: number, productName: string, description: string, category: string): Promise<Array<{ id: number; value: any }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Get characteristics schema
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

  if (!LOVABLE_API_KEY || charcs.length === 0) return [];

  // Select relevant characteristics
  const required = charcs.filter((c: any) => c.required);
  const popular = charcs.filter((c: any) => c.popular && !c.required);
  const other = charcs.filter((c: any) => !c.required && !c.popular).slice(0, 10);
  const selected = [...required, ...popular, ...other];

  const charcsList = selected.map((c: any) => {
    const dict = c.dictionary?.length ? ` ALLOWED_VALUES: [${c.dictionary.slice(0, 15).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
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
- Fill ALL [REQUIRED] fields
- Skip fields you cannot determine
- No markdown, no explanation, ONLY JSON array`
          },
          {
            role: "user",
            content: `Product: "${productName}"\nDescription: "${(description || '').substring(0, 800)}"\nCategory: "${category}"\n\nCharacteristics:\n${charcsList}`
          },
        ],
        temperature: 0.1,
      }),
    });
    if (!aiResp.ok) return [];
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\[[\s\S]*\])/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (Array.isArray(parsed)) {
        const validIds = new Set(charcs.map((c: any) => c.charcID));
        const result = parsed.filter((item: any) => typeof item.id === 'number' && validIds.has(item.id) && item.value !== undefined);
        console.log(`AI filled ${result.length}/${selected.length} characteristics`);
        return result;
      }
    }
  } catch (e) {
    console.error("AI charcs error:", e);
  }
  return [];
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
  for (const imgUrl of images.slice(0, 10)) {
    if (!imgUrl?.startsWith("http")) continue;
    try {
      const resp = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
      if (!resp.ok) continue;
      const ct = resp.headers.get("content-type") || "image/jpeg";
      if (!ct.startsWith("image/")) continue;
      const data = await resp.arrayBuffer();
      if (data.byteLength < 500) continue; // lowered threshold
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const fileName = `${userId}/wb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        if (urlData?.publicUrl) proxied.push(urlData.publicUrl);
      }
    } catch (e) { /* skip */ }
  }
  return proxied;
}

// ===== POLL FOR nmID (FIXED: use cursor-based listing without textSearch) =====
async function pollForNmID(apiKey: string, vendorCode: string, maxAttempts = 6): Promise<number | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep((attempt + 1) * 4000); // 4s, 8s, 12s, 16s, 20s, 24s

    try {
      // Use cards list without textSearch — filter by vendorCode manually
      // textSearch is unreliable for vendorCodes
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

      if (!listResp.ok) {
        console.log(`Poll ${attempt + 1}: API ${listResp.status}`);
        continue;
      }
      const listData = await listResp.json();
      const cards = listData.cards || listData.data?.cards || [];
      console.log(`Poll ${attempt + 1}/${maxAttempts}: ${cards.length} recent cards`);

      // Search by vendorCode in recent cards
      const found = cards.find((c: any) => c.vendorCode === vendorCode);
      if (found?.nmID) {
        console.log(`✅ nmID found: ${found.nmID} (attempt ${attempt + 1})`);
        return found.nmID;
      }
    } catch (e) {
      console.warn(`Poll error ${attempt + 1}:`, e);
    }
  }
  console.log(`⚠️ nmID not found after ${maxAttempts} attempts for ${vendorCode}`);
  return null;
}

// ===== UPLOAD IMAGES =====
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
    console.log(`Media save: ${resp.status}`, JSON.stringify(data).substring(0, 200));
    if (!resp.ok || data.error) {
      console.error(`Media save failed: ${data.errorText || JSON.stringify(data)}`);
      return false;
    }
    console.log(`✅ Images uploaded to nmID ${nmID}`);
    return true;
  } catch (e) {
    console.error("Media save error:", e);
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

    // Get WB API key
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

    // ===== STEP 1: AI analyzes product (one call for everything) =====
    console.log(`\n--- STEP 1: AI Analysis ---`);
    const [analysis, barcode] = await Promise.all([
      aiAnalyzeProduct(product.name, product.description || '', product.category || ''),
      generateBarcode(apiKey),
    ]);
    console.log(`Keywords: ${JSON.stringify(analysis.searchKeywords)}`);
    console.log(`Title: "${analysis.titleRu}"`);
    console.log(`Barcode: ${barcode || 'failed'}`);

    // ===== STEP 2: Find WB subject using AI keywords =====
    console.log(`\n--- STEP 2: Subject Search ---`);
    const subject = await findSubjectId(apiKey, analysis.searchKeywords, product.name);
    if (!subject) {
      return new Response(JSON.stringify({
        success: false,
        error: "Kategoriya topilmadi. WB bazasida mos kategoriya mavjud emas.",
        searchedKeywords: analysis.searchKeywords,
        hint: "Mahsulot nomini ruscha yoki boshqa formatda kiriting",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Subject: ${subject.parentName} > ${subject.subjectName} (${subject.subjectID})`);

    // ===== STEP 3: Get & fill characteristics + proxy images in parallel =====
    console.log(`\n--- STEP 3: Characteristics + Images ---`);
    const [filledCharcs, proxiedImages] = await Promise.all([
      getAndFillCharacteristics(apiKey, subject.subjectID, product.name, product.description || '', product.category || ''),
      proxyImages(supabase, user.id, product.images || []),
    ]);
    console.log(`Characteristics filled: ${filledCharcs.length}`);
    console.log(`Images proxied: ${proxiedImages.length}`);

    // ===== STEP 4: Build & send payload =====
    console.log(`\n--- STEP 4: Create Card ---`);
    const vendorCode = generateVendorCode(product.name);

    // Currency conversion: UZS → RUB
    const UZS_TO_RUB_RATE = 140;
    const rawPrice = Math.round(product.price || 0);
    const priceRUB = rawPrice > 10000 ? Math.round(rawPrice / UZS_TO_RUB_RATE) : rawPrice;
    console.log(`Price: ${rawPrice} → ${priceRUB} RUB`);

    const variant: any = {
      vendorCode,
      title: analysis.titleRu,
      dimensions: { length: 20, width: 15, height: 10, weightBrutto: 0.5 },
      characteristics: filledCharcs,
      sizes: [{
        techSize: "0",
        price: priceRUB > 0 ? priceRUB : undefined,
        skus: barcode ? [barcode] : undefined,
      }],
    };

    const payload = [{ subjectID: subject.subjectID, variants: [variant] }];
    console.log(`Payload: ${JSON.stringify(payload).substring(0, 500)}`);

    const wbResp = await wbFetch(`${WB_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const wbData = await wbResp.json();

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData));

      // Retry without characteristics
      if (JSON.stringify(wbData).match(/характеристик|characteristic|Invalid/i)) {
        console.log("Retrying without characteristics...");
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
        const retryNmID = await pollForNmID(apiKey, vendorCode + "-R", 6);
        let imagesUploaded = false;
        if (retryNmID && proxiedImages.length > 0) {
          imagesUploaded = await uploadMedia(apiKey, retryNmID, proxiedImages);
        }

        return new Response(JSON.stringify({
          success: true, vendorCode: vendorCode + "-R", name: analysis.titleRu,
          subjectID: subject.subjectID, subjectName: subject.subjectName,
          price: priceRUB, nmID: retryNmID, imagesUploaded,
          note: "Xususiyatlarsiz yaratildi" + (retryNmID ? ` (nmID: ${retryNmID})` : ''),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`✅ WB accepted card: ${vendorCode}`);

    // ===== STEP 5: Check async errors =====
    await sleep(3000);
    const { hasError, errors: wbErrors } = await checkWbErrors(apiKey, vendorCode);
    if (hasError) {
      const errorMsg = wbErrors.map((e: any) => (e.errors || []).join(', ') || e.errorText || JSON.stringify(e)).join('; ');
      console.error(`❌ WB async error: ${errorMsg}`);
      return new Response(JSON.stringify({
        success: false, error: `WB kartochkani rad etdi: ${errorMsg}`,
        wbErrors, vendorCode,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== STEP 6: Poll for nmID & upload images =====
    console.log(`\n--- STEP 6: Poll nmID ---`);
    const nmID = await pollForNmID(apiKey, vendorCode, 6);

    let imagesUploaded = false;
    if (nmID && proxiedImages.length > 0) {
      imagesUploaded = await uploadMedia(apiKey, nmID, proxiedImages);
    }

    console.log(`\n========= RESULT =========`);
    console.log(`vendorCode: ${vendorCode}, nmID: ${nmID}, images: ${imagesUploaded}`);

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
      nmID,
      characteristics: filledCharcs.length,
      barcode,
      wbResponse: wbData,
      note: nmID
        ? `Kartochka yaratildi${imagesUploaded ? ' va rasmlar yuklandi' : ''} (nmID: ${nmID})`
        : 'Kartochka yaratildi. nmID hali tayyor emas — rasmlar 5-10 daqiqadan keyin yuklanadi.',
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Noma'lum xato",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
