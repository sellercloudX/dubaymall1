import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WB_CONTENT_API = "https://content-api.wildberries.ru";
const WB_PRICES_API = "https://discounts-prices-api.wildberries.ru";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
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

// ===== STEP 1: Find subjectID using AI for accurate mapping =====
async function findSubjectId(apiKey: string, productName: string, category?: string): Promise<{ subjectID: number; subjectName: string; parentName: string } | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Use AI to extract the best search keyword in Russian
  let searchKeyword = "";
  if (LOVABLE_API_KEY) {
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Return ONLY one Russian keyword (1-2 words) that best describes the product TYPE/CATEGORY for Wildberries marketplace search. Examples: 'Фен' for hair dryers, 'Кроссовки' for sneakers, 'Крем' for cream. No explanation, just the word." },
            { role: "user", content: `Product: "${productName}"\nCategory: "${category || ''}"` },
          ],
          temperature: 0,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        searchKeyword = (aiData.choices?.[0]?.message?.content || "").trim().replace(/["""']/g, "");
      }
    } catch (e) { console.warn("AI keyword extraction error:", e); }
  }

  // Fallback: extract first meaningful Russian word
  if (!searchKeyword) {
    const russianWords = (category || productName).match(/[а-яА-ЯёЁ]{3,}/g) || [];
    searchKeyword = russianWords[0] || productName.split(/\s+/)[0];
  }

  console.log(`Subject search keyword: "${searchKeyword}"`);

  // Search WB subjects with fallback
  const searchVariants = [searchKeyword];
  // Add first word as fallback (e.g. "Фен-стайлер" → "Фен")
  const firstWord = searchKeyword.split(/[-\s]/)[0];
  if (firstWord && firstWord !== searchKeyword && firstWord.length >= 3) {
    searchVariants.push(firstWord);
  }
  // Also try category directly
  if (category) {
    const catWords = category.match(/[а-яА-ЯёЁ]{3,}/g) || [];
    if (catWords[0] && !searchVariants.includes(catWords[0])) {
      searchVariants.push(catWords[0]);
    }
  }

  let subjects: any[] = [];
  let usedKeyword = searchKeyword;
  try {
    for (const kw of searchVariants) {
      const resp = await fetchWithRetry(
        `${WB_CONTENT_API}/content/v2/object/all?name=${encodeURIComponent(kw)}&top=50&locale=ru`,
        { headers }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      subjects = data.data || [];
      if (subjects.length > 0) {
        usedKeyword = kw;
        console.log(`Found ${subjects.length} subjects with keyword: "${kw}"`);
        break;
      }
    }
    if (subjects.length === 0) return null;

    // Use AI to pick the best match
    if (LOVABLE_API_KEY && subjects.length > 1) {
      const subjectList = subjects.slice(0, 30).map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a Wildberries marketplace expert. Return ONLY the subjectID number that best matches the product. No text, no explanation, just the number." },
              { role: "user", content: `Product name: "${productName}"\nProduct category: "${category || 'unknown'}"\n\nAvailable Wildberries subjects:\n${subjectList}\n\nWhich subjectID is the best match?` },
            ],
            temperature: 0,
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const idStr = (aiData.choices?.[0]?.message?.content || "").trim();
          const id = parseInt(idStr);
          const found = subjects.find((s: any) => s.subjectID === id);
          if (found) {
            console.log(`AI selected subject: ${found.subjectName} (${id})`);
            return { subjectID: id, subjectName: found.subjectName, parentName: found.parentName };
          }
        }
      } catch (e) { console.warn("AI subject selection error:", e); }
    }

    // Fallback: best keyword match
    const kwLower = usedKeyword.toLowerCase();
    const exact = subjects.find((s: any) => (s.subjectName || "").toLowerCase() === kwLower);
    if (exact) return { subjectID: exact.subjectID, subjectName: exact.subjectName, parentName: exact.parentName };

    return { subjectID: subjects[0].subjectID, subjectName: subjects[0].subjectName, parentName: subjects[0].parentName };
  } catch (e) {
    console.error("Subject search error:", e);
    return null;
  }
}

// ===== STEP 2: Get characteristics for subject =====
async function getSubjectCharacteristics(apiKey: string, subjectID: number): Promise<any[]> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  try {
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/object/charcs/${subjectID}?locale=ru`, { headers });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.data || [];
  } catch (e) {
    console.error("Charcs error:", e);
    return [];
  }
}

// ===== STEP 3: AI fills characteristics in CORRECT WB format =====
// WB API requires: {"id": charcID, "value": [...] or number}
async function fillCharacteristicsWithAI(
  productName: string, description: string, category: string, charcs: any[]
): Promise<Array<{ id: number; value: any }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || charcs.length === 0) return [];

  // Prioritize: required > popular > others
  const requiredCharcs = charcs.filter((c: any) => c.required);
  const popularCharcs = charcs.filter((c: any) => c.popular && !c.required);
  const otherCharcs = charcs.filter((c: any) => !c.required && !c.popular).slice(0, 15);
  const allCharcs = [...requiredCharcs, ...popularCharcs, ...otherCharcs];

  const charcsList = allCharcs.map((c: any) => {
    const dictInfo = c.dictionary?.length ? ` ALLOWED VALUES: [${c.dictionary.slice(0, 15).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    const typeDesc = c.charcType === 1 ? 'string' : c.charcType === 4 ? 'number' : 'string';
    return `- charcID=${c.charcID}, name="${c.name}", type=${typeDesc}${req}${dictInfo}`;
  }).join('\n');

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You fill Wildberries product characteristics. Return ONLY valid JSON array.

CRITICAL FORMAT RULES:
- For string/text characteristics: {"id": <charcID>, "value": ["text value"]}
- For numeric characteristics: {"id": <charcID>, "value": 123}
- If ALLOWED VALUES are listed, you MUST use EXACTLY one of those values
- Fill ALL [REQUIRED] characteristics
- Fill as many popular characteristics as you can determine from the product info
- Return JSON array, no markdown, no explanation` },
          { role: "user", content: `Product: "${productName}"
Description: "${(description || '').substring(0, 800)}"
Category: "${category}"

Characteristics to fill:
${charcsList}` },
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
        // Validate: each item must have "id" (number) and "value"
        const validIds = new Set(charcs.map((c: any) => c.charcID));
        return parsed.filter((item: any) => {
          return typeof item.id === 'number' && validIds.has(item.id) && item.value !== undefined && item.value !== null;
        });
      }
    }
  } catch (e) { console.error("AI charcs error:", e); }
  return [];
}

// ===== STEP 4: Generate barcode via WB API =====
async function generateBarcode(apiKey: string): Promise<string | null> {
  try {
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/barcodes`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.[0] || null;
  } catch (e) {
    console.warn("Barcode generation error:", e);
    return null;
  }
}

// ===== STEP 5: Proxy images to storage =====
async function proxyImages(supabase: any, userId: string, images: string[]): Promise<string[]> {
  const proxied: string[] = [];
  for (const imgUrl of images.slice(0, 10)) {
    if (!imgUrl?.startsWith("http")) continue;
    try {
      const resp = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) continue;
      const ct = resp.headers.get("content-type") || "image/jpeg";
      if (!ct.startsWith("image/")) continue;
      const data = await resp.arrayBuffer();
      if (data.byteLength < 1000) continue;
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const fileName = `${userId}/wb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        if (urlData?.publicUrl) proxied.push(urlData.publicUrl);
      }
    } catch (e) { console.warn(`Image proxy failed: ${e}`); }
  }
  return proxied;
}

// ===== STEP 6: AI generates proper product title & description in Russian =====
async function generateProductContent(
  productName: string, description: string, category: string, subjectName: string
): Promise<{ title: string; desc: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { title: productName.slice(0, 100), desc: description || productName };

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a Wildberries SEO expert. Generate product title and description in Russian.

RULES FOR TITLE (max 100 chars):
- Include product type, brand (if any), key features
- Must be descriptive and SEO-friendly for Wildberries
- In Russian language
- Example: "Фен для волос профессиональный 2000 Вт с ионизацией, 2 скорости, 3 насадки"

RULES FOR DESCRIPTION (300-2000 chars):
- Detailed product description in Russian
- Include all key features, specifications, benefits
- SEO-optimized for Wildberries marketplace
- Structured with key selling points

Return JSON: {"title": "...", "description": "..."}` },
          { role: "user", content: `Product: "${productName}"\nOriginal description: "${(description || '').substring(0, 1000)}"\nWB Category: "${subjectName}"\nSource category: "${category}"` },
        ],
        temperature: 0.2,
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          title: (parsed.title || productName).slice(0, 100),
          desc: (parsed.description || description || productName).slice(0, 5000),
        };
      }
    }
  } catch (e) { console.warn("AI content generation error:", e); }

  return { title: productName.slice(0, 100), desc: (description || productName).slice(0, 5000) };
}

// ===== MAIN =====
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

    // Get WB credentials
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

    const { product, cloneMode, skipImageGeneration } = await req.json();
    console.log(`Creating WB card: "${product.name}"`);

    // STEP 1: Find subject
    const subject = await findSubjectId(apiKey, product.name, product.category);
    if (!subject) {
      return new Response(JSON.stringify({ success: false, error: "Kategoriya topilmadi. Mahsulot nomini aniqroq yozing." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Subject: ${subject.subjectName} (${subject.subjectID})`);

    // STEP 2: Get characteristics
    const charcs = await getSubjectCharacteristics(apiKey, subject.subjectID);
    console.log(`Characteristics: ${charcs.length} available, ${charcs.filter((c: any) => c.required).length} required`);

    // STEP 3: AI fills characteristics in CORRECT {"id": N, "value": ...} format
    const filledCharcs = await fillCharacteristicsWithAI(product.name, product.description || '', subject.subjectName, charcs);
    console.log(`AI filled ${filledCharcs.length} characteristics`);

    // STEP 4: Generate barcode
    const barcode = await generateBarcode(apiKey);
    console.log(`Barcode: ${barcode || 'failed'}`);

    // STEP 5: Proxy images
    const images = product.images || [];
    const proxiedImages = await proxyImages(supabase, user.id, images);
    console.log(`Proxied ${proxiedImages.length} images`);

    // STEP 6: Generate proper Russian title & description
    const content = await generateProductContent(
      product.name, product.description || '', product.category || '', subject.subjectName
    );
    console.log(`Title: "${content.title}"`);

    // Generate vendorCode
    const vendorCode = generateVendorCode(product.name);

    // ===== CURRENCY CONVERSION: UZS → RUB =====
    // Yandex prices are in UZS, WB needs RUB
    // Approximate rate: 1 RUB ≈ 140 UZS (updated periodically)
    const UZS_TO_RUB_RATE = 140;
    const rawPrice = Math.round(product.price || 0);
    const priceRUB = rawPrice > 10000 
      ? Math.round(rawPrice / UZS_TO_RUB_RATE) // UZS → RUB conversion
      : rawPrice; // Already in RUB or small enough
    console.log(`Price conversion: ${rawPrice} (source) → ${priceRUB} RUB`);

    // ===== BUILD CORRECT WB v2 PAYLOAD =====
    // mediaFiles MUST be included in upload payload for WB to index the card
    const variant: any = {
      vendorCode,
      title: content.title,
      description: stripHtml(content.desc),
      dimensions: {
        length: 20,
        width: 15,
        height: 10,
        weightBrutto: 0.5,
      },
      characteristics: filledCharcs,
      sizes: [{
        techSize: "0",
        wbSize: "",
        price: priceRUB > 0 ? priceRUB : undefined,
        skus: barcode ? [barcode] : undefined,
      }],
    };
    // Include images in initial payload - WB won't index without them
    if (proxiedImages.length > 0) {
      variant.mediaFiles = proxiedImages.slice(0, 10);
    }
    
    const cardPayload = [{ subjectID: subject.subjectID, variants: [variant] }];

    console.log(`Sending to WB API: subjectID=${subject.subjectID}, charcs=${filledCharcs.length}, images=${proxiedImages.length}, price=${priceRUB} RUB`);
    console.log(`Full payload:`, JSON.stringify(cardPayload).substring(0, 500));

    // Create card via Content API v2
    const wbResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(cardPayload),
    });

    const wbData = await wbResp.json();

    // Helper: check WB error list (GET endpoint)
    async function checkWbErrors(): Promise<any[]> {
      try {
        const errResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/error/list`, {
          headers: { Authorization: apiKey },
        });
        if (errResp.ok) {
          const errData = await errResp.json();
          return errData.data || [];
        }
      } catch (e) { /* ignore */ }
      return [];
    }

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData));
      await sleep(1000);
      const wbErrors = await checkWbErrors();
      console.log("WB error list:", JSON.stringify(wbErrors.slice(0, 5)));

      // Retry without characteristics if they cause issues
      if (JSON.stringify(wbData).includes("характеристик") || JSON.stringify(wbData).includes("characteristic") || JSON.stringify(wbData).includes("Invalid")) {
        console.log("Retrying with minimal payload...");
        const minimalPayload = [{
          subjectID: subject.subjectID,
          variants: [{
            vendorCode: vendorCode + "-R",
            title: content.title,
            description: stripHtml(content.desc),
            characteristics: [],
            sizes: [{ techSize: "0", wbSize: "", price: priceRUB > 0 ? priceRUB : undefined, skus: barcode ? [barcode] : undefined }],
          }],
        }];

        const retryResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(minimalPayload),
        });
        const retryData = await retryResp.json();

        if (!retryResp.ok || retryData.error) {
          return new Response(JSON.stringify({
            success: false, error: retryData?.errorText || "WB API xatosi",
            wbResponse: retryData, originalError: wbData, wbErrors,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({
          success: true, vendorCode: vendorCode + "-R", name: content.title,
          subjectID: subject.subjectID, subjectName: subject.subjectName,
          priceRUB, characteristics: 0, wbResponse: retryData,
          note: "Xususiyatlarsiz yaratildi, qo'lda to'ldiring",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData, wbErrors,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`✅ WB accepted card: ${vendorCode}, response: ${JSON.stringify(wbData)}`);

    // Wait and check for silent rejections
    await sleep(3000);
    const wbErrors = await checkWbErrors();
    const ourErrors = wbErrors.filter((e: any) => 
      e.vendorCode === vendorCode || 
      (JSON.stringify(e).includes(vendorCode))
    );
    
    if (ourErrors.length > 0) {
      const errorMsg = ourErrors.map((e: any) => 
        (e.errors || []).join(', ') || e.errorText || JSON.stringify(e)
      ).join('; ');
      console.error(`❌ WB silently rejected card: ${errorMsg}`);
      return new Response(JSON.stringify({
        success: false,
        error: `WB kartochkani rad etdi: ${errorMsg}`,
        wbErrors: ourErrors, vendorCode,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`No errors found for ${vendorCode} (${wbErrors.length} total errors in list)`);

    // Try to find nmID (images already sent in payload)
    let nmID: number | null = null;
    try {
      const listResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/get/cards/list`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }),
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        const cards = listData.cards || listData.data?.cards || [];
        const found = cards.find((c: any) => c.vendorCode === vendorCode);
        if (found?.nmID) {
          nmID = found.nmID;
          console.log(`Found nmID: ${nmID}`);
        } else {
          console.log(`nmID not found yet. ${cards.length} cards in list. Card indexing (1-5 min).`);
        }
      }
    } catch (e) { console.warn("Cards list error:", e); }

    return new Response(JSON.stringify({
      success: true, vendorCode, name: content.title,
      subjectID: subject.subjectID, subjectName: subject.subjectName,
      price: priceRUB, priceOriginal: rawPrice, currency: 'RUB',
      images: proxiedImages.length, nmID,
      characteristics: filledCharcs.length, barcode,
      wbResponse: wbData,
      note: nmID 
        ? `Kartochka yaratildi va rasmlar yuklandi (nmID: ${nmID})` 
        : 'Kartochka yaratildi. Rasmlar WB indekslashdan keyin qo\'shiladi (1-5 daqiqa).',
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Noma'lum xato",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function generateVendorCode(name: string): string {
  const ascii = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = (ascii || "PROD").split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SCX-${prefix || "PROD"}-${rnd}-${ts}`;
}

function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
