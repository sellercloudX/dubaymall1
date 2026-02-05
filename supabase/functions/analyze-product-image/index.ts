import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== GPT-4o VISION - PRIMARY ANALYZER ====================
async function analyzeWithGPT4o(imageBase64: string): Promise<any | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.log("⚠️ OPENAI_API_KEY not configured");
    return null;
  }

  try {
    console.log("🔍 PRIMARY: Using OpenAI GPT-4o Vision for product analysis...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a PROFESSIONAL E-COMMERCE PRODUCT ANALYST specializing in Uzbekistan and CIS markets.

TASK: Identify the product from its IMAGE APPEARANCE (like Google Lens).

YOUR EXPERTISE:
- Accurate product identification from visual appearance
- Brand and model recognition from packaging, labels, design
- Market-appropriate pricing in Uzbek Som (UZS)
- SEO-optimized product naming

RESPONSE REQUIREMENTS:
- Product names must be in Uzbek language, professional and descriptive
- Include brand name if recognizable from the image
- Descriptions must be detailed (3-5 sentences) highlighting key selling points
- Prices must reflect realistic Uzbekistan market values in UZS

CATEGORY OPTIONS:
Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat, Aksessuarlar, Qurilish, Smartfonlar, Kompyuterlar, Audio`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `IDENTIFY THIS PRODUCT FROM ITS APPEARANCE (Google Lens style):

Look at the image and identify:
1. What product is this? (Brand, model if visible)
2. What category does it belong to?
3. What would be a fair market price in Uzbekistan?
4. Describe its key features

Return structured JSON with your analysis.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                  detail: "high"
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_product",
              description: "Return structured product information from visual analysis",
              parameters: {
                type: "object",
                properties: {
                  productName: {
                    type: "string",
                    description: "Professional product name in Uzbek language (include brand if visible)"
                  },
                  description: {
                    type: "string",
                    description: "Detailed product description in Uzbek (3-5 sentences)"
                  },
                  category: {
                    type: "string",
                    enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish", "Smartfonlar", "Kompyuterlar", "Audio"],
                    description: "Product category"
                  },
                  suggestedPrice: {
                    type: "number",
                    description: "Suggested retail price in UZS"
                  },
                  brand: {
                    type: "string",
                    description: "Brand name if visible on product"
                  },
                  model: {
                    type: "string",
                    description: "Model name/number if visible"
                  },
                  specifications: {
                    type: "object",
                    description: "Key product specifications",
                    properties: {
                      color: { type: "string" },
                      material: { type: "string" },
                      size: { type: "string" }
                    }
                  },
                  confidence: {
                    type: "number",
                    description: "Analysis confidence score 0-100"
                  },
                  searchKeywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Keywords for searching similar products online"
                  }
                },
                required: ["productName", "description", "category", "suggestedPrice"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "identify_product" } },
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GPT-4o API error:", response.status, errorText);
      if (response.status === 429) return { error: "rate_limited" };
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("Invalid GPT-4o response format");
      return null;
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("✅ GPT-4o Vision identified:", result.productName);
    return { ...result, aiModel: "gpt-4o-vision" };
  } catch (err) {
    console.error("GPT-4o Vision error:", err);
    return null;
  }
}

// ==================== CLAUDE 3.5 SONNET - FALLBACK ====================
async function analyzeWithClaude(imageBase64: string): Promise<any | null> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  
  if (!ANTHROPIC_API_KEY) {
    console.log("⚠️ ANTHROPIC_API_KEY not configured for fallback");
    return null;
  }

  try {
    console.log("🔍 FALLBACK: Using Claude 3.5 Sonnet for product analysis...");

    let mediaType = "image/jpeg";
    let base64Data = imageBase64;
    
    if (imageBase64.startsWith('data:')) {
      const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mediaType = matches[1];
        base64Data = matches[2];
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: "text",
                text: `IDENTIFY this product from its visual appearance (like Google Lens).

Return JSON with:
- productName: Professional product name in Uzbek (include brand if visible)
- description: 3-5 sentences in Uzbek about features
- category: One of [Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat, Aksessuarlar, Qurilish]
- suggestedPrice: Price in UZS (realistic Uzbekistan market value)
- brand: Brand name if visible
- model: Model name if visible
- searchKeywords: Array of keywords for searching similar products
- confidence: 0-100

Return ONLY valid JSON.`
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    console.log("✅ Claude identified:", result.productName);
    return { ...result, aiModel: "claude-3.5-sonnet" };
  } catch (err) {
    console.error("Claude fallback error:", err);
    return null;
  }
}

// ==================== GEMINI - LAST RESORT FALLBACK ====================
async function analyzeWithGemini(imageBase64: string): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log("🔍 LAST FALLBACK: Using Gemini for product identification...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are Google Lens - identify products from their visual appearance.
Always respond in Uzbek language for name and description.
Suggest prices in Uzbek Som (UZS).`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "IDENTIFY this product from its appearance. Return JSON with: productName, description, category, suggestedPrice, brand, searchKeywords"
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_product",
              description: "Return product identification results",
              parameters: {
                type: "object",
                properties: {
                  productName: { type: "string", description: "Product name in Uzbek" },
                  description: { type: "string", description: "Description in Uzbek" },
                  category: { type: "string", enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish"] },
                  suggestedPrice: { type: "number", description: "Price in UZS" },
                  brand: { type: "string" },
                  searchKeywords: { type: "array", items: { type: "string" } }
                },
                required: ["productName", "description", "category", "suggestedPrice"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "identify_product" } }
      }),
    });

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) return null;

    const result = JSON.parse(toolCall.function.arguments);
    console.log("✅ Gemini identified:", result.productName);
    return { ...result, aiModel: "gemini-2.5-flash" };
  } catch (err) {
    console.error("Gemini fallback error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { imageBase64, mode } = body;

    // Input validation
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base64 format
    if (!imageBase64.startsWith('data:image/') && !imageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit image size (roughly 10MB base64)
    if (imageBase64.length > 14000000) {
      return new Response(
        JSON.stringify({ error: "Image too large" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Google Lens mode: Identifying product for user ${user.id}`);
    console.log(`🤖 AI Priority: GPT-4o Vision → Claude 3.5 Sonnet → Gemini`);

    let result = null;

    // PRIMARY: GPT-4o Vision (best for visual recognition)
    result = await analyzeWithGPT4o(imageBase64);
    
    if (result?.error === "rate_limited") {
      return new Response(
        JSON.stringify({ error: "Service busy, please try again" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FALLBACK 1: Claude 3.5 Sonnet
    if (!result) {
      result = await analyzeWithClaude(imageBase64);
    }

    // FALLBACK 2: Gemini
    if (!result) {
      result = await analyzeWithGemini(imageBase64);
    }

    if (!result) {
      console.error("All AI models failed");
      return new Response(
        JSON.stringify({ error: "Could not identify product. Please try a clearer image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Product identified with ${result.aiModel}: ${result.productName}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
