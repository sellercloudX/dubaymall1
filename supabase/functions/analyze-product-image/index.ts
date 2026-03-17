import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Expanded categories matching Yandex Market taxonomy
const CATEGORIES = [
  "Elektronika", "Smartfonlar", "Planshetlar", "Noutbuklar", "Kompyuterlar", "Audio", "Televizorlar",
  "Kiyim-kechak", "Erkaklar kiyimi", "Ayollar kiyimi", "Bolalar kiyimi", "Oyoq kiyim", "Aksessuarlar",
  "Go'zallik", "Parfyumeriya", "Kosmetika", "Soch parvarishi", "Teri parvarishi",
  "Uy-ro'zg'or", "Maishiy texnika", "Oshxona jihozlari", "Yoritish", "Mebel", "To'qimachilik",
  "Sport", "Sport kiyimi", "Fitnes jihozlari", "Velosipedlar",
  "Bolalar uchun", "O'yinchoqlar", "Bolalar ovqatlari", "Aravachalar",
  "Avtomobil", "Avtozapchastlar", "Avtokimyo", "Avtojihozlar",
  "Oziq-ovqat", "Ichimliklar", "Shirinliklar",
  "Qurilish", "Asboblar", "Santexnika", "Elektr jihozlari",
  "Salomatlik", "Dori-darmonlar", "Tibbiy asboblar", "Vitamiinlar",
  "Hayvonlar uchun", "Ozuqa", "Aksessuarlar",
  "Kitoblar", "O'quv qo'llanmalari",
  "Soatlar", "Zargarlik buyumlari",
];

const SYSTEM_PROMPT = `You are an EXPERT E-COMMERCE PRODUCT IDENTIFICATION SPECIALIST with Google Lens-level accuracy.
Your job: identify the EXACT product from its image with maximum precision.

CRITICAL IDENTIFICATION RULES:
1. LOOK AT THE PRODUCT ITSELF — identify the brand, model, and type from what is PHYSICALLY VISIBLE in the image.
2. DO NOT CONFUSE the product with what it is FOR. Example:
   - A PHONE CASE showing an iPhone picture is a CASE/CHEXOL, NOT an iPhone.
   - A laptop bag with a MacBook logo is a BAG, NOT a MacBook.
   - A screen protector for Samsung is a PROTECTOR, NOT a Samsung phone.
3. READ ALL TEXT on the product/packaging: brand names, model numbers, specifications.
4. If the product is an ACCESSORY (case, cover, protector, cable, charger), clearly state:
   - What the accessory IS (e.g., "silikon chexol", "himoya oynasi")
   - What device it is COMPATIBLE WITH (e.g., "iPhone 15 Pro uchun")
   - The accessory's OWN brand if visible
5. Pay attention to device COMPATIBILITY markers — a case labeled "iPhone 14" is for iPhone 14, even if the case shape looks similar to other models.
6. For electronics, identify the EXACT model from visible text, camera layout, size, design details.
7. If you see a product with packaging, prioritize info FROM THE PACKAGING (brand, model, specs).

OUTPUT RULES:
- Product name MUST be in Uzbek (Latin script)
- Description MUST be 3-5 sentences in Uzbek, detailed
- Prices in UZS (Uzbekistan so'm), realistic for Uzbekistan market
- Category from: ${CATEGORIES.join(", ")}
- specifications: include ALL visible details (material, color, size, weight, compatibility)
- confidence: 0-100 (be honest — if unclear, lower the score)

Return ONLY valid JSON:
{
  "productName": "mahsulot nomi (o'zbek, lotin) — aniq brend va model bilan",
  "description": "batafsil tavsif o'zbek tilida",
  "category": "aniq kategoriya",
  "suggestedPrice": 150000,
  "brand": "brend nomi (agar ko'rinsa)",
  "model": "model nomi (agar ko'rinsa)",
  "specifications": {"material": "...", "rang": "...", "moslik": "..."},
  "searchKeywords": ["keyword1", "keyword2"],
  "confidence": 85
}`;

// PRIMARY: Google AI Studio → Lovable AI fallback
async function analyzeWithGemini(img: string): Promise<any | null> {
  const googleKey = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  let base64Data = img;
  let mimeType = "image/jpeg";
  if (img.startsWith("data:")) {
    const m = img.match(/^data:([^;]+);base64,(.+)$/);
    if (m) { mimeType = m[1]; base64Data = m[2]; }
  }

  const userPrompt = "Identify this product PRECISELY from its appearance. IMPORTANT: If this is an accessory (case, cover, protector, cable), identify it as an ACCESSORY and note what device it is for — do NOT identify it as the device itself. Read ALL text on the product and packaging. Include brand, model, color, material, compatibility. Return ONLY valid JSON.";

  // TRY 1: Google AI Studio
  if (googleKey) {
    try {
      console.log("🔍 PRIMARY: Google AI Studio...");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{
              parts: [
                { text: userPrompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }]
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const result = JSON.parse(match[0]);
            console.log("✅ Google AI Studio:", result.productName);
            return { ...result, aiModel: "google-ai-studio-gemini-2.5-flash" };
          }
        }
      } else {
        const errBody = await res.text();
        console.error("Google AI Studio error:", res.status, errBody.substring(0, 200));
      }
    } catch (err) { console.error("Google AI Studio error:", err); }
  }

  // TRY 2: Lovable AI Gateway
  if (lovableKey) {
    try {
      console.log("🔍 FALLBACK: Lovable AI...");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: img } }
            ]}
          ],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("Lovable AI error:", res.status, errBody.substring(0, 200));
        if (res.status === 429) return { error: "rate_limited" };
        if (res.status === 402) return { error: "payment_required" };
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;

      const result = JSON.parse(match[0]);
      console.log("✅ Lovable AI:", result.productName);
      return { ...result, aiModel: "lovable-gemini-2.5-flash" };
    } catch (err) { console.error("Lovable AI error:", err); return null; }
  }

  return null;
}

// FALLBACK 1: GPT-4o Vision
async function analyzeWithGPT4o(img: string): Promise<any | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;

  try {
    console.log("🔍 FALLBACK 1: GPT-4o...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Identify this product precisely. Return ONLY valid JSON." },
            { type: "image_url", image_url: { url: img, detail: "high" } }
          ]}
        ],
        max_tokens: 1500
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const result = JSON.parse(match[0]);
    return { ...result, aiModel: "gpt-4o-vision" };
  } catch (err) { console.error("GPT-4o error:", err); return null; }
}

// FALLBACK 2: Claude 3.5 Sonnet
async function analyzeWithClaude(img: string): Promise<any | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;

  try {
    console.log("🔍 FALLBACK 2: Claude...");
    let mediaType = "image/jpeg";
    let base64Data = img;
    
    if (img.startsWith("data:")) {
      const m = img.match(/^data:([^;]+);base64,(.+)$/);
      if (m) { mediaType = m[1]; base64Data = m[2]; }
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: `${SYSTEM_PROMPT}\n\nIdentify this product precisely. Return ONLY valid JSON.` }
          ]
        }]
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const result = JSON.parse(match[0]);
    return { ...result, aiModel: "claude-3.5-sonnet" };
  } catch (err) { console.error("Claude error:", err); return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (imageBase64.length > 14000000) {
      return new Response(JSON.stringify({ error: "Image too large" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📸 Image size: ${(imageBase64.length / 1024).toFixed(0)}KB`);

    let result = await analyzeWithGemini(imageBase64);

    if (result?.error) {
      console.log(`⚠️ Gemini: ${result.error}, trying fallbacks...`);
      result = null;
    }

    if (!result) result = await analyzeWithGPT4o(imageBase64);
    if (!result) result = await analyzeWithClaude(imageBase64);

    if (!result) {
      return new Response(JSON.stringify({ error: "Mahsulotni aniqlab bo'lmadi. Aniqroq rasm oling." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate category against known list
    let category = result.category || "Aksessuarlar";
    if (!CATEGORIES.includes(category)) {
      // Try partial match
      const match = CATEGORIES.find(c => c.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(c.toLowerCase()));
      category = match || "Aksessuarlar";
    }

    const normalizedResult = {
      name: result.productName || result.name || "Noma'lum mahsulot",
      description: result.description || "",
      category,
      suggestedPrice: Number(result.suggestedPrice) || 100000,
      brand: result.brand || "",
      model: result.model || "",
      specifications: result.specifications || {},
      features: result.searchKeywords || result.features || [],
      confidence: result.confidence || 50,
      aiModel: result.aiModel,
    };

    console.log(`✅ ${normalizedResult.aiModel}: ${normalizedResult.name} [${normalizedResult.category}]`);
    return new Response(JSON.stringify(normalizedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Tahlil xatosi" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
