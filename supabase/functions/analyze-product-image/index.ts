import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish", "Smartfonlar", "Kompyuterlar", "Audio"];

const SYSTEM_PROMPT = `You are a PROFESSIONAL E-COMMERCE PRODUCT ANALYST for Uzbekistan/CIS markets.
Identify the product from its IMAGE (like Google Lens). Include brand/model if visible.
Product names and descriptions MUST be in Uzbek language. Prices in UZS.
Categories: ${CATEGORIES.join(", ")}

Return JSON: { productName, description (3-5 sentences), category, suggestedPrice, brand, model, searchKeywords[], confidence (0-100) }`;

// PRIMARY: Google AI Studio (user's own key) → Lovable AI fallback
async function analyzeWithGemini(img: string): Promise<any | null> {
  const googleKey = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  // Extract base64 data
  let base64Data = img;
  let mimeType = "image/jpeg";
  if (img.startsWith("data:")) {
    const m = img.match(/^data:([^;]+);base64,(.+)$/);
    if (m) { mimeType = m[1]; base64Data = m[2]; }
  }

  const userPrompt = "Identify this product from its appearance. Return ONLY valid JSON.";

  // TRY 1: Google AI Studio (direct, no credit limits)
  if (googleKey) {
    try {
      console.log("🔍 PRIMARY: Google AI Studio (user key)...");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
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

      if (!res.ok) {
        const errBody = await res.text();
        console.error("Google AI Studio error:", res.status, errBody);
      } else {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const result = JSON.parse(match[0]);
            console.log("✅ Google AI Studio identified:", result.productName);
            return { ...result, aiModel: "google-ai-studio-gemini-2.5-flash" };
          }
        }
        console.log("⚠️ Google AI Studio: no JSON in response");
      }
    } catch (err) { console.error("Google AI Studio error:", err); }
  }

  // TRY 2: Lovable AI Gateway (fallback)
  if (lovableKey) {
    try {
      console.log("🔍 FALLBACK: Lovable AI (Gemini)...");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
        console.error("Lovable AI error:", res.status, errBody);
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
      console.log("✅ Lovable AI identified:", result.productName);
      return { ...result, aiModel: "lovable-gemini-2.5-flash" };
    } catch (err) { console.error("Lovable AI error:", err); return null; }
  }

  console.log("⚠️ No API keys configured for analysis");
  return null;
}

// FALLBACK 1: GPT-4o Vision
async function analyzeWithGPT4o(img: string): Promise<any | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) { console.log("⚠️ No OPENAI_API_KEY"); return null; }

  try {
    console.log("🔍 FALLBACK 1: GPT-4o Vision...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Identify this product from its appearance. Return ONLY valid JSON." },
            { type: "image_url", image_url: { url: img, detail: "high" } }
          ]}
        ],
        max_tokens: 1500
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("GPT-4o error:", res.status, errBody);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const result = JSON.parse(match[0]);
    console.log("✅ GPT-4o identified:", result.productName);
    return { ...result, aiModel: "gpt-4o-vision" };
  } catch (err) { console.error("GPT-4o error:", err); return null; }
}

// FALLBACK 2: Claude 3.5 Sonnet
async function analyzeWithClaude(img: string): Promise<any | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) { console.log("⚠️ No ANTHROPIC_API_KEY"); return null; }

  try {
    console.log("🔍 FALLBACK 2: Claude 3.5 Sonnet...");
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
            { type: "text", text: `${SYSTEM_PROMPT}\n\nIdentify this product. Return ONLY valid JSON.` }
          ]
        }]
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Claude error:", res.status, errBody);
      return null;
    }

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const result = JSON.parse(match[0]);
    console.log("✅ Claude identified:", result.productName);
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
    console.log("🔍 AI Priority: Gemini → GPT-4o → Claude");

    // PRIMARY: Gemini (Lovable AI)
    let result = await analyzeWithGemini(imageBase64);

    // If Gemini had a transient error, still try fallbacks
    if (result?.error) {
      console.log(`⚠️ Gemini returned ${result.error}, trying fallbacks...`);
      result = null;
    }

    // FALLBACK 1: GPT-4o
    if (!result) result = await analyzeWithGPT4o(imageBase64);

    // FALLBACK 2: Claude
    if (!result) result = await analyzeWithClaude(imageBase64);

    if (!result) {
      return new Response(JSON.stringify({ error: "Mahsulotni aniqlab bo'lmadi. Aniqroq rasm oling." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // CRITICAL: Normalize field names - AI may return productName instead of name
    const normalizedResult = {
      name: result.productName || result.name || "Noma'lum mahsulot",
      description: result.description || "",
      category: result.category || "Aksessuarlar",
      suggestedPrice: Number(result.suggestedPrice) || 100000,
      brand: result.brand || "",
      model: result.model || "",
      specifications: result.specifications || {},
      features: result.searchKeywords || result.features || [],
      confidence: result.confidence || 50,
      aiModel: result.aiModel,
    };

    console.log(`✅ Identified with ${normalizedResult.aiModel}: ${normalizedResult.name}`);
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
