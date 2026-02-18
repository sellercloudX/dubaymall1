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

// ===== STEP 1: Find subjectID =====
async function findSubjectId(apiKey: string, productName: string, category?: string): Promise<{ subjectID: number; subjectName: string; parentName: string } | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let searchKeyword = "";
  if (LOVABLE_API_KEY) {
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Return ONLY one Russian keyword (1-2 words) for Wildberries subject search. Examples: 'Фен' for hair dryers, 'Кроссовки' for sneakers. No explanation." },
            { role: "user", content: `Product: "${productName}"\nCategory: "${category || ''}"` },
          ],
          temperature: 0,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        searchKeyword = (aiData.choices?.[0]?.message?.content || "").trim().replace(/["""']/g, "");
      }
    } catch (e) { console.warn("AI keyword error:", e); }
  }

  if (!searchKeyword) {
    const russianWords = (category || productName).match(/[а-яА-ЯёЁ]{3,}/g) || [];
    searchKeyword = russianWords[0] || productName.split(/\s+/)[0];
  }
  console.log(`Subject search keyword: "${searchKeyword}"`);

  // Build multiple search variants for better matching
  const searchVariants: string[] = [searchKeyword];
  const firstWord = searchKeyword.split(/[-\s]/)[0];
  if (firstWord && firstWord !== searchKeyword && firstWord.length >= 3) searchVariants.push(firstWord);
  // Add category words as fallback
  if (category) {
    const catWords = category.match(/[а-яА-ЯёЁ]{3,}/g) || [];
    for (const cw of catWords) {
      if (!searchVariants.includes(cw)) searchVariants.push(cw);
    }
  }
  // Add all Russian words from product name as last resort
  const nameWords = productName.match(/[а-яА-ЯёЁ]{3,}/g) || [];
  for (const nw of nameWords) {
    if (!searchVariants.includes(nw) && searchVariants.length < 8) searchVariants.push(nw);
  }

  console.log(`Search variants: ${JSON.stringify(searchVariants)}`);

  let subjects: any[] = [];
  let usedKeyword = searchKeyword;
  try {
    for (const kw of searchVariants) {
      const url = `${WB_CONTENT_API}/content/v2/object/all?name=${encodeURIComponent(kw)}&top=50&locale=ru`;
      console.log(`Trying subject search: "${kw}"`);
      const resp = await fetchWithRetry(url, { headers });
      if (!resp.ok) {
        console.log(`Subject API returned ${resp.status} for "${kw}"`);
        const errText = await resp.text();
        console.log(`Response: ${errText.substring(0, 200)}`);
        continue;
      }
      const data = await resp.json();
      subjects = data.data || [];
      console.log(`"${kw}" → ${subjects.length} subjects found`);
      if (subjects.length > 0) { usedKeyword = kw; break; }
    }
    if (subjects.length === 0) {
      console.error(`No subjects found for any variant: ${JSON.stringify(searchVariants)}`);
      return null;
    }

    if (LOVABLE_API_KEY && subjects.length > 1) {
      const subjectList = subjects.slice(0, 30).map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Return ONLY the subjectID number. No text." },
              { role: "user", content: `Product: "${productName}"\nCategory: "${category || ''}"\n\nSubjects:\n${subjectList}` },
            ],
            temperature: 0,
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const id = parseInt((aiData.choices?.[0]?.message?.content || "").trim());
          const found = subjects.find((s: any) => s.subjectID === id);
          if (found) {
            console.log(`AI selected: ${found.subjectName} (${id})`);
            return { subjectID: id, subjectName: found.subjectName, parentName: found.parentName };
          }
        }
      } catch (e) { /* fallback */ }
    }

    const kwLower = usedKeyword.toLowerCase();
    const exact = subjects.find((s: any) => (s.subjectName || "").toLowerCase() === kwLower);
    if (exact) return { subjectID: exact.subjectID, subjectName: exact.subjectName, parentName: exact.parentName };
    return { subjectID: subjects[0].subjectID, subjectName: subjects[0].subjectName, parentName: subjects[0].parentName };
  } catch (e) {
    console.error("Subject search error:", e);
    return null;
  }
}

// ===== STEP 2: Get characteristics =====
async function getSubjectCharacteristics(apiKey: string, subjectID: number): Promise<any[]> {
  try {
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/object/charcs/${subjectID}?locale=ru`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.data || [];
  } catch (e) { return []; }
}

// ===== STEP 3: AI fills characteristics =====
async function fillCharacteristicsWithAI(
  productName: string, description: string, category: string, charcs: any[]
): Promise<Array<{ id: number; value: any }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || charcs.length === 0) return [];

  const requiredCharcs = charcs.filter((c: any) => c.required);
  const popularCharcs = charcs.filter((c: any) => c.popular && !c.required);
  const otherCharcs = charcs.filter((c: any) => !c.required && !c.popular).slice(0, 15);
  const allCharcs = [...requiredCharcs, ...popularCharcs, ...otherCharcs];

  const charcsList = allCharcs.map((c: any) => {
    const dictInfo = c.dictionary?.length ? ` ALLOWED: [${c.dictionary.slice(0, 15).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    const typeDesc = c.charcType === 4 ? 'number' : 'string';
    return `- id=${c.charcID}, name="${c.name}", type=${typeDesc}${req}${dictInfo}`;
  }).join('\n');

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Fill Wildberries characteristics. Return ONLY JSON array.
Rules:
- String: {"id": N, "value": ["text"]}  
- Number: {"id": N, "value": 123}
- If ALLOWED values listed, use EXACTLY one of them
- Fill ALL [REQUIRED] ones
- No markdown, no explanation` },
          { role: "user", content: `Product: "${productName}"\nDescription: "${(description || '').substring(0, 800)}"\nCategory: "${category}"\n\nCharacteristics:\n${charcsList}` },
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
        return parsed.filter((item: any) => typeof item.id === 'number' && validIds.has(item.id) && item.value !== undefined);
      }
    }
  } catch (e) { console.error("AI charcs error:", e); }
  return [];
}

// ===== STEP 4: Generate barcode =====
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
  } catch (e) { return null; }
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
    } catch (e) { /* skip */ }
  }
  return proxied;
}

// ===== STEP 6: AI generates Russian title =====
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
          { role: "system", content: `Generate Wildberries product title and description in Russian.
TITLE (max 100 chars): product type, brand, key features. SEO-friendly.
DESCRIPTION (300-2000 chars): detailed, structured.
Return JSON: {"title": "...", "description": "..."}` },
          { role: "user", content: `Product: "${productName}"\nDescription: "${(description || '').substring(0, 1000)}"\nWB Category: "${subjectName}"` },
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
        return { title: (parsed.title || productName).slice(0, 100), desc: (parsed.description || description || productName).slice(0, 5000) };
      }
    }
  } catch (e) { /* fallback */ }
  return { title: productName.slice(0, 100), desc: (description || productName).slice(0, 5000) };
}

// ===== STEP 7: Poll for nmID after card creation =====
async function pollForNmID(apiKey: string, vendorCode: string, maxAttempts = 5): Promise<number | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait progressively longer: 5s, 10s, 15s, 20s, 25s
    await sleep((attempt + 1) * 5000);
    
    try {
      const listResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/get/cards/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          settings: {
            cursor: { limit: 100 },
            filter: { withPhoto: -1, textSearch: vendorCode },
          },
        }),
      });
      
      if (!listResp.ok) continue;
      const listData = await listResp.json();
      const cards = listData.cards || listData.data?.cards || [];
      const found = cards.find((c: any) => c.vendorCode === vendorCode);
      
      if (found?.nmID) {
        console.log(`✅ nmID found: ${found.nmID} (attempt ${attempt + 1})`);
        return found.nmID;
      }
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}: nmID not found yet (${cards.length} cards)`);
    } catch (e) {
      console.warn(`Poll error attempt ${attempt + 1}:`, e);
    }
  }
  return null;
}

// ===== STEP 8: Upload images via /content/v3/media/save =====
async function uploadMediaByUrl(apiKey: string, nmID: number, imageUrls: string[]): Promise<boolean> {
  if (imageUrls.length === 0) return false;
  
  try {
    console.log(`Uploading ${imageUrls.length} images to nmID ${nmID} via /content/v3/media/save`);
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v3/media/save`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        nmId: nmID,
        data: imageUrls,
      }),
    });
    
    const data = await resp.json();
    console.log(`Media save response (${resp.status}):`, JSON.stringify(data).substring(0, 300));
    
    if (!resp.ok || data.error) {
      console.error(`Media save failed: ${data.errorText || JSON.stringify(data)}`);
      return false;
    }
    
    console.log(`✅ Images uploaded successfully to nmID ${nmID}`);
    return true;
  } catch (e) {
    console.error("Media save error:", e);
    return false;
  }
}

// ===== CHECK WB ASYNC ERRORS =====
async function checkWbErrors(apiKey: string, vendorCode: string): Promise<{ hasError: boolean; errors: any[] }> {
  try {
    const errResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/error/list`, {
      headers: { Authorization: apiKey },
    });
    if (!errResp.ok) return { hasError: false, errors: [] };
    const errData = await errResp.json();
    const allErrors = errData.data || [];
    const ourErrors = allErrors.filter((e: any) =>
      e.vendorCode === vendorCode || JSON.stringify(e).includes(vendorCode)
    );
    return { hasError: ourErrors.length > 0, errors: ourErrors };
  } catch (e) {
    return { hasError: false, errors: [] };
  }
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
      return new Response(JSON.stringify({ success: false, error: "Kategoriya topilmadi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Subject: ${subject.subjectName} (${subject.subjectID})`);

    // STEP 2: Get characteristics
    const charcs = await getSubjectCharacteristics(apiKey, subject.subjectID);
    const requiredCount = charcs.filter((c: any) => c.required).length;
    console.log(`Characteristics: ${charcs.length} total, ${requiredCount} required`);

    // STEP 3: AI fills characteristics
    const filledCharcs = await fillCharacteristicsWithAI(product.name, product.description || '', subject.subjectName, charcs);
    console.log(`AI filled ${filledCharcs.length} characteristics`);

    // STEP 4: Generate barcode
    const barcode = await generateBarcode(apiKey);
    console.log(`Barcode: ${barcode || 'failed'}`);

    // STEP 5: Proxy images (do this in parallel with content generation)
    const images = product.images || [];
    const [proxiedImages, content] = await Promise.all([
      proxyImages(supabase, user.id, images),
      generateProductContent(product.name, product.description || '', product.category || '', subject.subjectName),
    ]);
    console.log(`Proxied ${proxiedImages.length} images, title: "${content.title}"`);

    // Generate unique vendorCode
    const vendorCode = generateVendorCode(product.name);

    // Currency conversion: UZS → RUB
    const UZS_TO_RUB_RATE = 140;
    const rawPrice = Math.round(product.price || 0);
    const priceRUB = rawPrice > 10000 ? Math.round(rawPrice / UZS_TO_RUB_RATE) : rawPrice;
    console.log(`Price: ${rawPrice} → ${priceRUB} RUB`);

    // ===== BUILD WB v2 PAYLOAD =====
    // CRITICAL: /content/v2/cards/upload does NOT support mediaFiles!
    // Images MUST be uploaded separately via /content/v3/media/save after nmID is available
    const variant: any = {
      vendorCode,
      title: content.title,
      dimensions: { length: 20, width: 15, height: 10, weightBrutto: 0.5 },
      characteristics: filledCharcs,
      sizes: [{
        techSize: "0",
        price: priceRUB > 0 ? priceRUB : undefined,
        skus: barcode ? [barcode] : undefined,
      }],
    };

    const cardPayload = [{ subjectID: subject.subjectID, variants: [variant] }];
    console.log(`Sending to WB: subjectID=${subject.subjectID}, charcs=${filledCharcs.length}, price=${priceRUB} RUB`);
    console.log(`Payload:`, JSON.stringify(cardPayload).substring(0, 500));

    // Create card
    const wbResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(cardPayload),
    });
    const wbData = await wbResp.json();

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData));
      
      // Check if characteristics caused the error - retry without them
      const errorStr = JSON.stringify(wbData);
      if (errorStr.includes("характеристик") || errorStr.includes("characteristic") || errorStr.includes("Invalid")) {
        console.log("Retrying without characteristics...");
        const retryVariant: any = {
          vendorCode: vendorCode + "-R",
          title: content.title,
          dimensions: { length: 20, width: 15, height: 10, weightBrutto: 0.5 },
          characteristics: [],
          sizes: [{ techSize: "0", price: priceRUB > 0 ? priceRUB : undefined, skus: barcode ? [barcode] : undefined }],
        };
        const retryPayload = [{ subjectID: subject.subjectID, variants: [retryVariant] }];
        const retryResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
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
        
        // Retry succeeded — continue with modified vendorCode
        console.log("✅ Retry without charcs succeeded");
        // Poll and upload images for retry vendorCode
        const retryNmID = await pollForNmID(apiKey, vendorCode + "-R", 4);
        if (retryNmID && proxiedImages.length > 0) {
          await uploadMediaByUrl(apiKey, retryNmID, proxiedImages);
        }
        
        return new Response(JSON.stringify({
          success: true, vendorCode: vendorCode + "-R", name: content.title,
          subjectID: subject.subjectID, subjectName: subject.subjectName,
          price: priceRUB, nmID: retryNmID, images: proxiedImages.length,
          note: "Xususiyatlarsiz yaratildi" + (retryNmID ? `, rasmlar yuklandi (nmID: ${retryNmID})` : ', rasmlar keyinroq yuklanadi'),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      return new Response(JSON.stringify({
        success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`✅ WB accepted card: ${vendorCode}`);

    // Check for async errors after 3 seconds
    await sleep(3000);
    const { hasError, errors: wbErrors } = await checkWbErrors(apiKey, vendorCode);
    
    if (hasError) {
      const errorMsg = wbErrors.map((e: any) =>
        (e.errors || []).join(', ') || e.errorText || JSON.stringify(e)
      ).join('; ');
      console.error(`❌ WB async rejection: ${errorMsg}`);
      return new Response(JSON.stringify({
        success: false, error: `WB kartochkani rad etdi: ${errorMsg}`,
        wbErrors, vendorCode,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`No async errors for ${vendorCode}`);

    // ===== POLL FOR nmID =====
    console.log("Polling for nmID...");
    const nmID = await pollForNmID(apiKey, vendorCode, 5);

    // ===== UPLOAD IMAGES via /content/v3/media/save =====
    let imagesUploaded = false;
    if (nmID && proxiedImages.length > 0) {
      imagesUploaded = await uploadMediaByUrl(apiKey, nmID, proxiedImages);
    } else if (!nmID) {
      console.log("⚠️ nmID not found after polling. Images will need manual upload.");
    }

    return new Response(JSON.stringify({
      success: true, vendorCode, name: content.title,
      subjectID: subject.subjectID, subjectName: subject.subjectName,
      price: priceRUB, priceOriginal: rawPrice, currency: 'RUB',
      images: proxiedImages.length, imagesUploaded, nmID,
      characteristics: filledCharcs.length, barcode,
      wbResponse: wbData,
      note: nmID
        ? `Kartochka yaratildi${imagesUploaded ? ' va rasmlar yuklandi' : ''} (nmID: ${nmID})`
        : 'Kartochka yaratildi. nmID hali tayyor emas — rasmlar keyinroq yuklanadi (5-10 daqiqa).',
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
