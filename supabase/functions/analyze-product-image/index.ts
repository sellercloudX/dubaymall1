import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use OpenAI GPT-4o Vision for best image analysis (10K RPM capacity)
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      // Fallback to Lovable AI if OpenAI not configured
      return await fallbackToLovableAI(imageBase64, corsHeaders);
    }

    console.log("🔍 Using OpenAI GPT-4o Vision for product analysis");

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
            content: `You are an expert product analyst for e-commerce in Uzbekistan and Russia.
Analyze product images with extreme precision and provide detailed structured information.
Always respond in the specified JSON format.
Prices should be in Uzbek Som (UZS) based on typical market prices.
Categories: Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat, Aksessuarlar, Qurilish`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this product image in detail:
1. Product name in Uzbek (accurate and descriptive)
2. Detailed description in Uzbek (3-5 sentences, highlighting key features)
3. Category from the list
4. Suggested retail price in UZS
5. Brand if visible
6. Key specifications (size, material, color, etc.)
7. Target audience
8. Condition assessment (new/used)

Return JSON only.`
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
              description: "Return structured product information",
              parameters: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Product name in Uzbek"
                  },
                  description: {
                    type: "string",
                    description: "Detailed product description in Uzbek (3-5 sentences)"
                  },
                  category: {
                    type: "string",
                    enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat", "Aksessuarlar", "Qurilish"],
                    description: "Product category"
                  },
                  suggestedPrice: {
                    type: "number",
                    description: "Suggested price in UZS"
                  },
                  brand: {
                    type: "string",
                    description: "Brand name if visible"
                  },
                  specifications: {
                    type: "object",
                    description: "Key product specifications",
                    properties: {
                      color: { type: "string" },
                      material: { type: "string" },
                      size: { type: "string" },
                      weight: { type: "string" }
                    }
                  },
                  targetAudience: {
                    type: "string",
                    description: "Target audience description"
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
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fallback to Lovable AI on error
      return await fallbackToLovableAI(imageBase64, corsHeaders);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("✅ OpenAI GPT-4o analysis complete:", result.name);

    return new Response(
      JSON.stringify({ ...result, aiModel: "gpt-4o-vision" }),
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

// Fallback function using Lovable AI
async function fallbackToLovableAI(imageBase64: string, corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("No AI API keys configured");
  }

  console.log("⚠️ Falling back to Lovable AI");

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
          content: `You are a product analysis assistant for an e-commerce platform in Uzbekistan. 
Analyze product images and provide structured information in JSON format.
Always respond in Uzbek language for name and description.
Suggest prices in Uzbek Som (UZS) based on typical market prices in Uzbekistan.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this product image and provide: 1) Product name in Uzbek, 2) Description in Uzbek, 3) Category, 4) Suggested price in UZS"
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
                category: { type: "string", enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat"] },
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
    throw new Error("AI analysis failed");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("Invalid AI response");
  }

  const result = JSON.parse(toolCall.function.arguments);
  return new Response(
    JSON.stringify({ ...result, aiModel: "gemini-2.5-flash" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
