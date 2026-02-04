import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentRequest {
  productName: string;
  productDescription?: string;
  category?: string;
  brand?: string;
  specifications?: Record<string, string>;
  targetMarketplace?: "yandex" | "uzum" | "wildberries" | "ozon";
  contentType: "seo" | "description" | "full";
  languages?: ("uz" | "ru")[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ContentRequest = await req.json();
    const { productName, productDescription, category, brand, specifications, targetMarketplace, contentType, languages = ["uz", "ru"] } = request;

    if (!productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    
    // Choose model based on content type
    // SEO: Claude Haiku (fast, cheap, 4K RPM)
    // Description: Claude Sonnet (best quality)
    const model = contentType === "seo" ? "claude-3-5-haiku-20241022" : "claude-3-5-sonnet-20241022";
    
    console.log(`📝 Generating ${contentType} content using ${model}`);

    if (!ANTHROPIC_API_KEY) {
      // Fallback to Lovable AI
      return await fallbackToLovableAI(request, corsHeaders);
    }

    const specsText = specifications 
      ? Object.entries(specifications).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";

    const systemPrompt = contentType === "seo" 
      ? `You are an SEO expert for e-commerce marketplaces in Central Asia and Russia.
Create optimized titles, keywords, and meta descriptions that rank well on ${targetMarketplace || "all marketplaces"}.
Focus on search intent, relevant keywords, and marketplace-specific best practices.
Always include both Uzbek and Russian versions.`
      : `You are a professional copywriter creating compelling product descriptions for e-commerce.
Write detailed, persuasive descriptions that highlight benefits and features.
Adapt tone and style for ${targetMarketplace || "general e-commerce"}.
Create authentic, native-sounding content in both Uzbek and Russian.`;

    const userPrompt = contentType === "seo"
      ? `Create SEO-optimized content for this product:
Product: ${productName}
${brand ? `Brand: ${brand}` : ""}
${category ? `Category: ${category}` : ""}
${specsText ? `Specifications: ${specsText}` : ""}
${productDescription ? `Base description: ${productDescription}` : ""}

Generate:
1. SEO title (max 80 chars) in both UZ and RU
2. Meta description (max 160 chars) in both UZ and RU
3. 10 relevant keywords in both languages
4. Search-friendly bullet points (5 items) in both languages`
      : `Create compelling product descriptions for:
Product: ${productName}
${brand ? `Brand: ${brand}` : ""}
${category ? `Category: ${category}` : ""}
${specsText ? `Specifications: ${specsText}` : ""}
${productDescription ? `Base info: ${productDescription}` : ""}

Generate detailed marketing descriptions in both Uzbek and Russian:
1. Short description (2-3 sentences) - hook the buyer
2. Full description (150-300 words) - detailed benefits and features
3. Key selling points (5 bullet points)
4. Usage/care instructions if applicable`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [
          { role: "user", content: userPrompt }
        ],
        system: systemPrompt,
        tools: [
          {
            name: "generate_content",
            description: "Return structured product content",
            input_schema: contentType === "seo" ? {
              type: "object",
              properties: {
                seoTitle: {
                  type: "object",
                  properties: {
                    uz: { type: "string" },
                    ru: { type: "string" }
                  },
                  required: ["uz", "ru"]
                },
                metaDescription: {
                  type: "object",
                  properties: {
                    uz: { type: "string" },
                    ru: { type: "string" }
                  },
                  required: ["uz", "ru"]
                },
                keywords: {
                  type: "object",
                  properties: {
                    uz: { type: "array", items: { type: "string" } },
                    ru: { type: "array", items: { type: "string" } }
                  },
                  required: ["uz", "ru"]
                },
                bulletPoints: {
                  type: "object",
                  properties: {
                    uz: { type: "array", items: { type: "string" } },
                    ru: { type: "array", items: { type: "string" } }
                  },
                  required: ["uz", "ru"]
                }
              },
              required: ["seoTitle", "metaDescription", "keywords", "bulletPoints"]
            } : {
              type: "object",
              properties: {
                shortDescription: {
                  type: "object",
                  properties: {
                    uz: { type: "string" },
                    ru: { type: "string" }
                  },
                  required: ["uz", "ru"]
                },
                fullDescription: {
                  type: "object",
                  properties: {
                    uz: { type: "string" },
                    ru: { type: "string" }
                  },
                  required: ["uz", "ru"]
                },
                sellingPoints: {
                  type: "object",
                  properties: {
                    uz: { type: "array", items: { type: "string" } },
                    ru: { type: "array", items: { type: "string" } }
                  },
                  required: ["uz", "ru"]
                },
                careInstructions: {
                  type: "object",
                  properties: {
                    uz: { type: "string" },
                    ru: { type: "string" }
                  }
                }
              },
              required: ["shortDescription", "fullDescription", "sellingPoints"]
            }
          }
        ],
        tool_choice: { type: "tool", name: "generate_content" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return await fallbackToLovableAI(request, corsHeaders);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    
    if (!toolUse?.input) {
      throw new Error("Invalid AI response");
    }

    console.log(`✅ Content generated with ${model}`);

    return new Response(
      JSON.stringify({ 
        ...toolUse.input, 
        aiModel: model,
        contentType 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback to Lovable AI
async function fallbackToLovableAI(request: ContentRequest, corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("No AI API keys configured");
  }

  console.log("⚠️ Falling back to Lovable AI for content generation");

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
          role: "user",
          content: `Generate ${request.contentType} content for product: ${request.productName}. 
          Return JSON with uz and ru versions of title, description, and keywords.`
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Content generation failed");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(
        JSON.stringify({ ...JSON.parse(jsonMatch[0]), aiModel: "gemini-2.5-flash" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {}
  
  return new Response(
    JSON.stringify({ 
      shortDescription: { uz: request.productName, ru: request.productName },
      aiModel: "gemini-2.5-flash"
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
