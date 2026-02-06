import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish", "Smartfonlar", "Kompyuterlar", "Audio"];

const SYSTEM_PROMPT = `You are a product identification expert for Uzbekistan market (like Google Lens).
Identify the product from its image. Return JSON with:
- productName: Professional name in Uzbek (include brand if visible)
- description: 3-5 sentences in Uzbek
- category: One of [${CATEGORIES.join(", ")}]
- suggestedPrice: Price in UZS
- brand: Brand if visible
- searchKeywords: Array of search keywords
- confidence: 0-100`;

async function analyzeWithGemini(imageBase64: string): Promise<any | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  try {
    console.log("🔍 Using Gemini for product identification...");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Identify this product. Return ONLY valid JSON." },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]}
        ],
        max_tokens: 1500
      }),
    });

    if (!res.ok) { console.error("Gemini error:", res.status); return null; }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    console.log("✅ Gemini identified:", result.productName);
    return { ...result, aiModel: "gemini-2.5-flash" };
  } catch (err) {
    console.error("Gemini error:", err);
    return null;
  }
}

async function analyzeWithGPT4o(imageBase64: string): Promise<any | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;

  try {
    console.log("🔍 Using GPT-4o Vision...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Identify this product. Return ONLY valid JSON." },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
          ]}
        ],
        max_tokens: 1500
      }),
    });

    if (!res.ok) {
      console.error("GPT-4o error:", res.status);
      return res.status === 429 ? { error: "rate_limited" } : null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    console.log("✅ GPT-4o identified:", result.productName);
    return { ...result, aiModel: "gpt-4o-vision" };
  } catch (err) {
    console.error("GPT-4o error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log("🔍 Analyzing product image...");

    // Try Gemini first (no extra API key needed), then GPT-4o
    let result = await analyzeWithGemini(imageBase64);

    if (!result) {
      result = await analyzeWithGPT4o(imageBase64);
    }

    if (result?.error === "rate_limited") {
      return new Response(JSON.stringify({ error: "Service busy, please try again" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!result) {
      return new Response(JSON.stringify({ error: "Could not identify product" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Analysis failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
