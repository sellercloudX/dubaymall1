import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: ContentRequest = await req.json();
    
    // Input validation
    const { productName, productDescription, category, brand, specifications, targetMarketplace, contentType, languages = ["uz", "ru"] } = request;

    if (!productName || typeof productName !== 'string' || productName.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid product name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (productDescription && (typeof productDescription !== 'string' || productDescription.length > 5000)) {
      return new Response(
        JSON.stringify({ error: "Invalid product description" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (category && (typeof category !== 'string' || category.length > 200)) {
      return new Response(
        JSON.stringify({ error: "Invalid category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (brand && (typeof brand !== 'string' || brand.length > 200)) {
      return new Response(
        JSON.stringify({ error: "Invalid brand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (contentType && !["seo", "description", "full"].includes(contentType)) {
      return new Response(
        JSON.stringify({ error: "Invalid content type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetMarketplace && !["yandex", "uzum", "wildberries", "ozon"].includes(targetMarketplace)) {
      return new Response(
        JSON.stringify({ error: "Invalid marketplace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    
    // Choose model based on content type
    const model = contentType === "seo" ? "claude-3-haiku-20240307" : "claude-3-5-sonnet-latest";
    
    console.log(`📝 Generating ${contentType} content using ${model} for user ${claimsData.claims.sub}`);

    if (!ANTHROPIC_API_KEY) {
      return await fallbackToLovableAI(request, corsHeaders);
    }

    const specsText = specifications 
      ? Object.entries(specifications).slice(0, 20).map(([k, v]) => `${String(k).slice(0, 50)}: ${String(v).slice(0, 100)}`).join(", ")
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
Product: ${productName.slice(0, 200)}
${brand ? `Brand: ${brand.slice(0, 100)}` : ""}
${category ? `Category: ${category.slice(0, 100)}` : ""}
${specsText ? `Specifications: ${specsText.slice(0, 500)}` : ""}
${productDescription ? `Base description: ${productDescription.slice(0, 500)}` : ""}

Generate:
1. SEO title (max 80 chars) in both UZ and RU
2. Meta description (max 160 chars) in both UZ and RU
3. 10 relevant keywords in both languages
4. Search-friendly bullet points (5 items) in both languages`
      : `Create compelling product descriptions for:
Product: ${productName.slice(0, 200)}
${brand ? `Brand: ${brand.slice(0, 100)}` : ""}
${category ? `Category: ${category.slice(0, 100)}` : ""}
${specsText ? `Specifications: ${specsText.slice(0, 500)}` : ""}
${productDescription ? `Base info: ${productDescription.slice(0, 500)}` : ""}

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
      console.error("Anthropic API error:", response.status);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Service busy, please try again" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return await fallbackToLovableAI(request, corsHeaders);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    
    if (!toolUse?.input) {
      console.error("Invalid AI response");
      return new Response(
        JSON.stringify({ error: "Content generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      JSON.stringify({ error: "Content generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback to Lovable AI
async function fallbackToLovableAI(request: ContentRequest, corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Service unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("⚠️ Falling back to Lovable AI for content generation");

  const { productName, productDescription, category, brand, contentType } = request;
  
  const prompt = contentType === "seo"
    ? `Generate SEO content for: ${productName?.slice(0, 200)}${brand ? ` by ${brand}` : ''}${category ? ` in ${category}` : ''}.
${productDescription ? `Description: ${productDescription.slice(0, 300)}` : ''}
Create optimized titles, keywords, and descriptions for e-commerce in Uzbek and Russian languages.`
    : `Generate product descriptions for: ${productName?.slice(0, 200)}${brand ? ` by ${brand}` : ''}${category ? ` in ${category}` : ''}.
${productDescription ? `Info: ${productDescription.slice(0, 300)}` : ''}
Create compelling marketing copy in Uzbek and Russian languages.`;

  const tools = contentType === "seo" ? [
    {
      type: "function",
      function: {
        name: "generate_seo_content",
        description: "Generate SEO optimized content in Uzbek and Russian",
        parameters: {
          type: "object",
          properties: {
            seoTitle: {
              type: "object",
              properties: { uz: { type: "string" }, ru: { type: "string" } },
              required: ["uz", "ru"]
            },
            metaDescription: {
              type: "object", 
              properties: { uz: { type: "string" }, ru: { type: "string" } },
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
        }
      }
    }
  ] : [
    {
      type: "function",
      function: {
        name: "generate_description_content",
        description: "Generate product descriptions in Uzbek and Russian",
        parameters: {
          type: "object",
          properties: {
            shortDescription: {
              type: "object",
              properties: { uz: { type: "string" }, ru: { type: "string" } },
              required: ["uz", "ru"]
            },
            fullDescription: {
              type: "object",
              properties: { uz: { type: "string" }, ru: { type: "string" } },
              required: ["uz", "ru"]
            },
            sellingPoints: {
              type: "object",
              properties: {
                uz: { type: "array", items: { type: "string" } },
                ru: { type: "array", items: { type: "string" } }
              },
              required: ["uz", "ru"]
            }
          },
          required: ["shortDescription", "fullDescription", "sellingPoints"]
        }
      }
    }
  ];

  const toolChoice = contentType === "seo" 
    ? { type: "function", function: { name: "generate_seo_content" } }
    : { type: "function", function: { name: "generate_description_content" } };

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional e-commerce copywriter fluent in Uzbek and Russian." },
          { role: "user", content: prompt }
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.log("⚠️ AI credits exhausted, using fallback content");
        return generateFallbackContent(request, corsHeaders);
      }
      
      // Return fallback content
      return generateFallbackContent(request, corsHeaders);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsedArgs = JSON.parse(toolCall.function.arguments);
      console.log("✅ Content generated with Lovable AI");
      return new Response(
        JSON.stringify({ ...parsedArgs, aiModel: "gemini-3-flash", contentType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If no tool call, try to parse content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return new Response(
          JSON.stringify({ ...JSON.parse(jsonMatch[0]), aiModel: "gemini-3-flash" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    return generateFallbackContent(request, corsHeaders);
  } catch (error) {
    console.error("Lovable AI fallback error:", error);
    return generateFallbackContent(request, corsHeaders);
  }
}

// Generate basic fallback content when AI fails
function generateFallbackContent(request: ContentRequest, corsHeaders: Record<string, string>) {
  const { productName, productDescription, contentType } = request;
    const name = (productName || "Mahsulot").slice(0, 200);
    const desc = (productDescription || name).slice(0, 500);
    
    console.log("📝 Generating fallback content for:", name);
  
  if (contentType === "seo") {
    return new Response(
      JSON.stringify({
          seoTitle: { 
            uz: `${name} - sifatli mahsulot`, 
            ru: `${name} - качественный товар` 
          },
          metaDescription: { 
            uz: `${name}. ${desc.slice(0, 120)}. Tez yetkazib berish.`, 
            ru: `${name}. ${desc.slice(0, 120)}. Быстрая доставка.` 
          },
          keywords: { 
            uz: [name, "sotib olish", "arzon", "sifatli", "yetkazib berish"], 
            ru: [name, "купить", "недорого", "качественный", "доставка"] 
          },
          bulletPoints: { 
            uz: ["Sifatli mahsulot", "Tez yetkazib berish", "Kafolat mavjud", "Qulay narx", "Original mahsulot"], 
            ru: ["Качественный товар", "Быстрая доставка", "Гарантия качества", "Выгодная цена", "Оригинальный товар"] 
          },
        aiModel: "fallback",
        contentType
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  return new Response(
    JSON.stringify({
        shortDescription: { 
          uz: `${name} - yuqori sifatli mahsulot. ${desc.slice(0, 100)}`, 
          ru: `${name} - товар высокого качества. ${desc.slice(0, 100)}` 
        },
        fullDescription: { 
          uz: `${name}\n\n${desc}\n\nBizning do'konimizda siz eng sifatli mahsulotlarni topishingiz mumkin. Barcha mahsulotlar sertifikatlangan va kafolatga ega. Tez yetkazib berish xizmati mavjud.`, 
          ru: `${name}\n\n${desc}\n\nВ нашем магазине вы найдете только качественные товары. Все товары сертифицированы и имеют гарантию. Быстрая доставка по всей стране.` 
        },
        sellingPoints: { 
          uz: ["Yuqori sifat kafolati", "Tez yetkazib berish", "Qulay to'lov usullari", "Professional xizmat", "Eng yaxshi narxlar"], 
          ru: ["Гарантия качества", "Быстрая доставка", "Удобные способы оплаты", "Профессиональный сервис", "Лучшие цены"] 
        },
      aiModel: "fallback",
      contentType
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
