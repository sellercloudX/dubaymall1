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

// ===== STEP 1: Find subjectID by product name =====
async function findSubjectId(apiKey: string, productName: string, category?: string): Promise<{ subjectID: number; subjectName: string; parentName: string } | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  // Extract meaningful keywords for search
  const searchText = category || productName;
  // Remove brand names, model numbers, and short words
  const keywords = searchText
    .replace(/[^а-яА-ЯёЁa-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^[A-Z0-9]+$/i.test(w))
    .slice(0, 3);

  // Try each keyword with the name filter
  for (const keyword of keywords) {
    try {
      const resp = await fetchWithRetry(
        `${WB_CONTENT_API}/content/v2/object/all?name=${encodeURIComponent(keyword)}&top=20&locale=ru`,
        { headers }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const subjects = data.data || [];
      if (subjects.length === 0) continue;

      // Score matches
      let bestMatch: any = null;
      let bestScore = 0;
      for (const subj of subjects) {
        const name = (subj.subjectName || '').toLowerCase();
        const parent = (subj.parentName || '').toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          const kwLower = kw.toLowerCase();
          if (name.includes(kwLower)) score += 3;
          if (parent.includes(kwLower)) score += 1;
        }
        // Prefer exact match
        if (name === keyword.toLowerCase()) score += 10;
        if (score > bestScore) { bestScore = score; bestMatch = subj; }
      }

      if (bestMatch && bestScore >= 3) {
        console.log(`Found subject: ${bestMatch.subjectName} (${bestMatch.subjectID}) score=${bestScore}`);
        return { subjectID: bestMatch.subjectID, subjectName: bestMatch.subjectName, parentName: bestMatch.parentName };
      }
    } catch (e) { console.warn(`Subject search error for "${keyword}":`, e); }
  }

  // AI fallback: search with first keyword, let AI pick
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    try {
      // Get a broader list
      const firstKw = keywords[0] || productName.split(/\s+/)[0];
      const resp = await fetchWithRetry(
        `${WB_CONTENT_API}/content/v2/object/all?name=${encodeURIComponent(firstKw)}&top=50&locale=ru`,
        { headers }
      );
      if (resp.ok) {
        const data = await resp.json();
        const subjects = data.data || [];
        if (subjects.length > 0) {
          const subjectList = subjects.map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Return ONLY the subjectID number. No text." },
                { role: "user", content: `Product: "${productName}"\nCategory: "${category || ''}"\n\nSubjects:\n${subjectList}` },
              ],
              temperature: 0,
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const id = parseInt(aiData.choices?.[0]?.message?.content?.trim());
            const found = subjects.find((s: any) => s.subjectID === id);
            if (found) {
              console.log(`AI selected subject: ${found.subjectName} (${id})`);
              return { subjectID: id, subjectName: found.subjectName, parentName: found.parentName };
            }
          }
          // Fallback: first result
          const first = subjects[0];
          console.log(`Fallback subject: ${first.subjectName} (${first.subjectID})`);
          return { subjectID: first.subjectID, subjectName: first.subjectName, parentName: first.parentName };
        }
      }
    } catch (e) { console.warn("AI subject search error:", e); }
  }

  return null;
}

// ===== STEP 2: Get characteristics for subject =====
async function getSubjectCharacteristics(apiKey: string, subjectID: number): Promise<any[]> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  try {
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/object/charcs/${subjectID}`, { headers });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.data || [];
  } catch (e) {
    console.error("Charcs error:", e);
    return [];
  }
}

// ===== STEP 3: AI fills characteristics =====
async function fillCharacteristicsWithAI(
  productName: string, description: string, category: string, charcs: any[]
): Promise<Record<string, any>[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || charcs.length === 0) return [];

  const requiredCharcs = charcs.filter((c: any) => c.required);
  const popularCharcs = charcs.filter((c: any) => c.popular && !c.required);
  const otherCharcs = charcs.filter((c: any) => !c.required && !c.popular).slice(0, 10);
  const allCharcs = [...requiredCharcs, ...popularCharcs, ...otherCharcs];

  const charcsList = allCharcs.map((c: any) => {
    const dictValues = c.dictionary?.length ? ` [${c.dictionary.slice(0, 10).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    return `- "${c.name}" (type: ${c.type || c.charcType}, charcID: ${c.charcID})${req}${dictValues}`;
  }).join('\n');

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return ONLY valid JSON array. No markdown, no explanation." },
          { role: "user", content: `Fill Wildberries product characteristics. Return JSON array of {"<charcName>": "<value>"} objects.

Product: "${productName}"
Description: "${(description || '').substring(0, 500)}"
Category: "${category}"

Characteristics:
${charcsList}

Rules:
1. Fill ALL [REQUIRED] characteristics
2. If dictionary values provided, use EXACTLY one of those values
3. For numeric values, return only numbers
4. Return JSON array: [{"Цвет": "белый"}, {"Модель": "FK-9900"}]
5. ONLY use characteristic names from the list` },
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
        const validNames = new Set(charcs.map((c: any) => c.name));
        return parsed.filter((item: any) => {
          const key = Object.keys(item)[0];
          return validNames.has(key);
        });
      }
    }
  } catch (e) { console.error("AI charcs error:", e); }
  return [];
}

// ===== STEP 4: Proxy images to storage =====
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

    // STEP 3: AI fills characteristics
    const filledCharcs = await fillCharacteristicsWithAI(product.name, product.description || '', subject.subjectName, charcs);
    console.log(`AI filled ${filledCharcs.length} characteristics`);

    // STEP 4: Proxy images
    const images = product.images || [];
    const proxiedImages = await proxyImages(supabase, user.id, images);
    console.log(`Proxied ${proxiedImages.length} images`);

    // Generate vendorCode
    const vendorCode = generateVendorCode(product.name);

    // ===== BUILD CORRECT WB PAYLOAD =====
    // WB v2 cards/upload expects SINGLE array [{...}], NOT double [[{...}]]
    const cardPayload = [{
      subjectID: subject.subjectID,
      variants: [{
        vendorCode,
        title: product.name.slice(0, 100),
        description: stripHtml(product.description || product.name).slice(0, 5000),
        brand: "",
        sizes: [{ techSize: "0", wbSize: "" }],
        characteristics: filledCharcs,
        mediaFiles: proxiedImages.slice(0, 10),
      }],
    }];

    console.log(`Sending to WB API: subjectID=${subject.subjectID}, charcs=${filledCharcs.length}, images=${proxiedImages.length}`);

    // Create card via Content API v2
    const wbResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(cardPayload),
    });

    const wbData = await wbResp.json();

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData));

      // Retry without characteristics if they cause issues
      if (JSON.stringify(wbData).includes("характеристик") || JSON.stringify(wbData).includes("characteristic")) {
        console.log("Retrying without AI characteristics...");
        const simplePayload = [{
          subjectID: subject.subjectID,
          variants: [{
            vendorCode,
            title: product.name.slice(0, 100),
            description: stripHtml(product.description || product.name).slice(0, 5000),
            brand: "",
            sizes: [{ techSize: "0", wbSize: "" }],
            characteristics: [],
            mediaFiles: proxiedImages.slice(0, 10),
          }],
        }];

        const retryResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/upload`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(simplePayload),
        });
        const retryData = await retryResp.json();

        if (!retryResp.ok || retryData.error) {
          return new Response(JSON.stringify({
            success: false, error: retryData?.errorText || "WB API xatosi", wbResponse: retryData,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({
          success: true, vendorCode, name: product.name, subjectID: subject.subjectID,
          subjectName: subject.subjectName, images: proxiedImages.length, characteristics: 0,
          wbResponse: retryData, note: "Xususiyatlarsiz yaratildi, qo'lda to'ldiring",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`✅ Card created: ${vendorCode}, subject: ${subject.subjectName}`);

    // Set price after card creation
    if (product.price > 0) {
      await sleep(2000);
      try {
        const priceResp = await fetchWithRetry(`${WB_PRICES_API}/api/v2/upload/task`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ data: [{ vendorCode, price: Math.round(product.price) }] }),
        });
        if (priceResp.ok) console.log(`✅ Price set: ${product.price}`);
        else console.warn(`Price set failed: ${priceResp.status}`);
      } catch (e) { console.warn(`Price set error: ${e}`); }
    }

    return new Response(JSON.stringify({
      success: true, vendorCode, name: product.name,
      subjectID: subject.subjectID, subjectName: subject.subjectName,
      price: product.price, images: proxiedImages.length,
      characteristics: filledCharcs.length, wbResponse: wbData,
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
