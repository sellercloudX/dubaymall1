import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== GPT-4o VISION - PRIMARY ANALYZER ====================
// Best vision model for accurate product recognition
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

YOUR EXPERTISE:
- Accurate product identification from images
- Market-appropriate pricing in Uzbek Som (UZS)
- SEO-optimized product naming and descriptions
- Category classification for marketplaces (Uzum, Yandex Market)

RESPONSE REQUIREMENTS:
- Product names must be in Uzbek language, professional and descriptive
- Descriptions must be detailed (3-5 sentences) highlighting key selling points
- Prices must reflect realistic Uzbekistan market values in UZS
- Always identify brand if visible on product
- Provide accurate specifications (color, material, size, weight)

CATEGORY OPTIONS:
Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat, Aksessuarlar, Qurilish, Smartfonlar, Kompyuterlar, Audio`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `ANALYZE THIS PRODUCT IMAGE IN DETAIL:

1. PRODUCT NAME (Uzbek): Create a professional, SEO-optimized product name
2. DESCRIPTION (Uzbek): Write 3-5 sentences highlighting key features and benefits
3. CATEGORY: Select the most accurate category
4. PRICE (UZS): Suggest realistic market price in Uzbek Som
5. BRAND: Identify if visible
6. SPECIFICATIONS: Extract color, material, size, weight if detectable
7. TARGET AUDIENCE: Who would buy this product?
8. CONDITION: new/used/refurbished
9. CONFIDENCE: Your confidence level 0-100%

Return structured JSON only.`
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
              name: "analyze_product",
              description: "Return structured product information from image analysis",
              parameters: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Professional product name in Uzbek language"
                  },
                  description: {
                    type: "string",
                    description: "Detailed product description in Uzbek (3-5 sentences)"
                  },
                  category: {
                    type: "string",
                    enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish", "Smartfonlar", "Kompyuterlar", "Audio"],
                    description: "Product category for marketplace"
                  },
                  suggestedPrice: {
                    type: "number",
                    description: "Suggested retail price in UZS"
                  },
                  brand: {
                    type: "string",
                    description: "Brand name if visible on product"
                  },
                  specifications: {
                    type: "object",
                    description: "Key product specifications",
                    properties: {
                      color: { type: "string", description: "Product color" },
                      material: { type: "string", description: "Main material" },
                      size: { type: "string", description: "Size or dimensions" },
                      weight: { type: "string", description: "Weight if estimable" }
                    }
                  },
                  targetAudience: {
                    type: "string",
                    description: "Target customer description"
                  },
                  condition: {
                    type: "string",
                    enum: ["new", "used", "refurbished"],
                    description: "Product condition"
                  },
                  confidence: {
                    type: "number",
                    description: "Analysis confidence score 0-100"
                  }
                },
                required: ["name", "description", "category", "suggestedPrice"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_product" } },
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GPT-4o API error:", response.status, errorText);
      
      if (response.status === 429) {
        return { error: "rate_limited" };
      }
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("Invalid GPT-4o response format");
      return null;
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("✅ GPT-4o Vision analysis complete:", result.name);
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

    // Extract base64 data and media type
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
                text: `Analyze this product image for e-commerce in Uzbekistan.

Return JSON with these fields:
- name: Product name in Uzbek (professional, SEO-optimized)
- description: 3-5 sentences in Uzbek about features and benefits
- category: One of [Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat, Aksessuarlar, Qurilish]
- suggestedPrice: Price in UZS (realistic Uzbekistan market value)
- brand: Brand name if visible
- specifications: {color, material, size, weight}
- targetAudience: Who would buy this
- condition: new/used/refurbished
- confidence: 0-100

Return ONLY valid JSON, no other text.`
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
    
    if (!content) {
      console.error("Invalid Claude response");
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response");
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log("✅ Claude 3.5 Sonnet analysis complete:", result.name);
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
    console.log("🔍 LAST FALLBACK: Using Gemini for product analysis...");

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
            content: `You are a product analysis assistant for e-commerce in Uzbekistan. 
Analyze product images and provide structured information.
Always respond in Uzbek language for name and description.
Suggest prices in Uzbek Som (UZS).`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this product and return JSON with: name, description, category, suggestedPrice, brand, specifications, condition"
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
              name: "analyze_product",
              description: "Return structured product information",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string", enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish"] },
                  suggestedPrice: { type: "number" }
                },
                required: ["name", "description", "category", "suggestedPrice"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_product" } }
      }),
    });

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return null;
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("✅ Gemini analysis complete:", result.name);
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
    // Authentication check
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();

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

    console.log(`🔍 Analyzing product image for user ${claimsData.claims.sub}`);
    console.log(`🤖 AI Priority: GPT-4o Vision → Claude 3.5 Sonnet → Gemini`);

    let result = null;

    // PRIMARY: Try GPT-4o Vision first (best for product recognition)
    result = await analyzeWithGPT4o(imageBase64);
    
    // Check for rate limiting
    if (result?.error === "rate_limited") {
      return new Response(
        JSON.stringify({ error: "Service busy, please try again" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FALLBACK 1: Try Claude 3.5 Sonnet
    if (!result) {
      result = await analyzeWithClaude(imageBase64);
    }

    // FALLBACK 2: Try Gemini (last resort)
    if (!result) {
      result = await analyzeWithGemini(imageBase64);
    }

    if (!result) {
      console.error("All AI models failed for product analysis");
      return new Response(
        JSON.stringify({ error: "Analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Product analysis complete with ${result.aiModel}`);

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
