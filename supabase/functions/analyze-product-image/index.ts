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

// PRIMARY: GPT-4o Vision
async function analyzeWithGPT4o(img: string): Promise<any | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) { console.log("⚠️ No OPENAI_API_KEY"); return null; }

  try {
    console.log("🔍 PRIMARY: GPT-4o Vision...");
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
      console.error("GPT-4o error:", res.status);
      return res.status === 429 ? { error: "rate_limited" } : null;
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

// FALLBACK 1: Claude 3.5 Sonnet
async function analyzeWithClaude(img: string): Promise<any | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) { console.log("⚠️ No ANTHROPIC_API_KEY"); return null; }

  try {
    console.log("🔍 FALLBACK: Claude 3.5 Sonnet...");
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

    if (!res.ok) { console.error("Claude error:", res.status); return null; }

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

    console.log("🔍 AI Priority: GPT-4o → Claude 3.5 Sonnet");

    // PRIMARY: GPT-4o Vision
    let result = await analyzeWithGPT4o(imageBase64);

    if (result?.error === "rate_limited") {
      return new Response(JSON.stringify({ error: "Service busy, please try again" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // FALLBACK: Claude 3.5 Sonnet
    if (!result) result = await analyzeWithClaude(imageBase64);

    if (!result) {
      return new Response(JSON.stringify({ error: "Could not identify product. Try a clearer image." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`✅ Identified with ${result.aiModel}: ${result.productName}`);
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
