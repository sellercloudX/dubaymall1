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
    const { imageBase64, productName, productDescription, category } = await req.json();

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

    console.log("Generating visual infographic product image for:", productName, "category:", category);

    // Category-specific visual infographic styles - NO TEXT to avoid spelling errors
    const categoryPrompts: Record<string, string> = {
      // Cosmetics & Beauty
      "cosmetics": `Create a VISUAL MARKETPLACE INFOGRAPHIC for cosmetics product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product bottle/packaging on elegant white pedestal or platform
- Background: Soft gradient (pink/peach/cream) with bokeh effects
- Decorative elements: Fresh fruits (oranges, lemons), flower petals, water droplets, leaves
- Show product ingredients visually: citrus slices, vitamin capsules, honey drops
- Add lifestyle element: Beautiful model face/lips/skin in corner using the product
- Include: Glass serum droplets, golden particles, sparkles for luxury feel
- NO TEXT, NO WORDS, NO LETTERS - pure visual storytelling
AESTHETIC: Luxurious, feminine, fresh, natural ingredients visible`,

      // Electronics
      "electronics": `Create a VISUAL MARKETPLACE INFOGRAPHIC for electronics product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product displayed on sleek platform with dramatic lighting
- Background: Dark gradient (deep blue, black, silver) with tech glow effects
- Show multiple angles of the product in composition
- Add: Light trails, circuit patterns, neon accents, reflection effects
- Include visual size comparison if relevant (coin, hand silhouette)
- Add: Charging lightning bolt icon, battery visual, signal waves
- NO TEXT, NO WORDS, NO LETTERS - pure visual demonstration
AESTHETIC: Premium tech, futuristic, professional, high-end`,

      // Clothing & Fashion
      "clothing": `Create a VISUAL MARKETPLACE INFOGRAPHIC for fashion product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product displayed elegantly or worn by model
- Background: Clean neutral tones or lifestyle setting
- Show fabric texture close-up in corner
- Add: Hangers, fashion accessories, styling elements
- Include lifestyle context (outfit combination ideas)
- Multiple views: front, detail, styling suggestion
- NO TEXT, NO WORDS, NO LETTERS - pure visual presentation
AESTHETIC: Stylish, aspirational, editorial fashion photography`,

      // Food & Beverages
      "food": `Create a VISUAL MARKETPLACE INFOGRAPHIC for food product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product packaging with appetizing presentation
- Background: Warm, inviting colors with natural elements
- Show ingredients: fresh fruits, vegetables, grains around product
- Add: Steam effects, water droplets for freshness
- Include: Serving suggestion, recipe idea visualization
- Natural elements: wooden surface, leaves, raw ingredients
- NO TEXT, NO WORDS, NO LETTERS - pure appetite appeal
AESTHETIC: Fresh, organic, appetizing, trustworthy`,

      // Home & Kitchen
      "home": `Create a VISUAL MARKETPLACE INFOGRAPHIC for home product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product in beautiful home/lifestyle setting
- Background: Cozy interior, natural light
- Show product in use scenario
- Add: Complementary home decor elements
- Include size reference (hand, common objects)
- Multiple angles or before/after visual
- NO TEXT, NO WORDS, NO LETTERS - pure lifestyle visualization
AESTHETIC: Cozy, practical, aspirational home style`,

      // Default for any category
      "default": `Create a VISUAL MARKETPLACE INFOGRAPHIC for product.
COMPOSITION (NO TEXT - VISUAL ONLY):
- Main: Product prominently displayed on elegant platform/pedestal
- Background: Clean gradient with professional lighting
- Add lifestyle context and usage scenario
- Include decorative elements related to product category
- Show product from best angle with detail shots
- Add: Sparkles, light effects, reflections for premium feel
- NO TEXT, NO WORDS, NO LETTERS - pure visual selling
AESTHETIC: Professional, premium, sales-optimized visual`
    };

    // Determine which prompt to use based on category
    const categoryKey = category?.toLowerCase() || "default";
    const categoryPrompt = categoryPrompts[categoryKey] || categoryPrompts["default"];

    const prompt = `${categoryPrompt}

CRITICAL RULES:
- ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS on the image
- DO NOT add any text overlays, labels, badges with text, or typography
- Focus ONLY on beautiful visual composition
- Use icons/symbols ONLY if they have no text
- Make it look like a premium marketplace product photo collage
- The visual elements should tell the product story without any words
- Final image must be 100% text-free`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
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
        modalities: ["image", "text"]
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
      
      throw new Error("AI image generation failed");
    }

    const data = await response.json();
    console.log("AI response received");
    
    // Extract the generated image
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({ 
        enhancedImageBase64: generatedImage,
        message: "Image enhanced successfully"
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
