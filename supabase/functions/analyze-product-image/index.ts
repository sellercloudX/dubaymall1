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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
Suggest prices in Uzbek Som (UZS) based on typical market prices in Uzbekistan.
Categories available: Elektronika, Kiyim-kechak, Uy-ro'zg'or, Sport, Go'zallik, Bolalar uchun, Avtomobil, Oziq-ovqat`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this product image and provide: 1) Product name in Uzbek, 2) Description in Uzbek (2-3 sentences), 3) Category from the list, 4) Suggested price in UZS"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
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
                    description: "Product description in Uzbek (2-3 sentences)"
                  },
                  category: {
                    type: "string",
                    enum: ["Elektronika", "Kiyim-kechak", "Uy-ro'zg'or", "Sport", "Go'zallik", "Bolalar uchun", "Avtomobil", "Oziq-ovqat"],
                    description: "Product category"
                  },
                  suggestedPrice: {
                    type: "number",
                    description: "Suggested price in UZS"
                  }
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
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
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