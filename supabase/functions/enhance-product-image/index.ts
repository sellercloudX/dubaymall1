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

    console.log("Generating infographic product image for:", productName, "category:", category);

    // Category-specific infographic styles
    const categoryPrompts: Record<string, string> = {
      // Cosmetics & Beauty
      "cosmetics": `Create a MARKETPLACE INFOGRAPHIC image for cosmetics product "${productName}".
STYLE: Like Wildberries/Ozon/Uzum marketplace product cards
MUST INCLUDE:
- Large lifestyle photo showing product in use (lips, face, skin application)
- Product packaging prominently displayed
- 3-4 key benefits with checkmark icons (e.g., "✓ Long-lasting", "✓ Moisturizing")
- "100% Original" or quality badge
- Soft pink/purple gradient background
- Product name and variant number
- Brand logo placement
AESTHETIC: Feminine, luxurious, clean typography`,

      // Electronics
      "electronics": `Create a MARKETPLACE INFOGRAPHIC image for electronics product "${productName}".
STYLE: Like Wildberries/Ozon/Uzum marketplace product cards
MUST INCLUDE:
- Product from multiple angles or with key feature callouts
- Technical specs highlighted (battery life, screen size, etc.)
- 3-4 key features with icons
- "Original" quality badge
- Dark/tech-inspired gradient background (blue, black, silver)
- Clean modern typography
AESTHETIC: Premium tech, professional, feature-focused`,

      // Clothing & Fashion
      "clothing": `Create a MARKETPLACE INFOGRAPHIC image for fashion product "${productName}".
STYLE: Like Wildberries/Ozon/Uzum marketplace product cards
MUST INCLUDE:
- Product worn by model or displayed elegantly
- Material/fabric callouts
- Size range indicator
- 3-4 key features (breathable, cotton, etc.)
- Lifestyle context
- Clean neutral or brand-colored background
AESTHETIC: Stylish, aspirational, clear product details`,

      // Food & Beverages
      "food": `Create a MARKETPLACE INFOGRAPHIC image for food product "${productName}".
STYLE: Like Wildberries/Ozon/Uzum marketplace product cards
MUST INCLUDE:
- Appetizing product presentation
- Ingredients or nutrition highlights
- "Natural", "Halal", "Fresh" badges as relevant
- 3-4 key benefits with icons
- Warm, appetizing color palette
- Product packaging clearly visible
AESTHETIC: Fresh, appetizing, trustworthy`,

      // Home & Kitchen
      "home": `Create a MARKETPLACE INFOGRAPHIC image for home product "${productName}".
STYLE: Like Wildberries/Ozon/Uzum marketplace product cards
MUST INCLUDE:
- Product in home context/lifestyle setting
- Dimensions or size comparison
- 3-4 key features with icons
- Quality/durability badges
- Clean, modern background
- Multiple product views if helpful
AESTHETIC: Cozy, practical, quality-focused`,

      // Default for any category
      "default": `Create a MARKETPLACE INFOGRAPHIC image for product "${productName}".
STYLE: Professional Wildberries/Ozon/Uzum marketplace product card
MUST INCLUDE:
- Product prominently displayed with lifestyle context
- 3-4 key benefits/features with checkmark or bullet icons
- "100% Original" quality badge
- Clean professional background with subtle gradient
- Clear product presentation from best angle
- Space for key selling points
AESTHETIC: Professional, trustworthy, sales-optimized`
    };

    // Determine which prompt to use based on category
    const categoryKey = category?.toLowerCase() || "default";
    const categoryPrompt = categoryPrompts[categoryKey] || categoryPrompts["default"];

    const prompt = `${categoryPrompt}

Product: "${productName}"
${productDescription ? `Description: ${productDescription}` : ''}

CRITICAL RULES:
- This must look like a professional MARKETPLACE INFOGRAPHIC, not just a product photo
- Include text overlays with features/benefits - USE CORRECT SPELLING in Russian or Uzbek (no typos!)
- Add visual badges and icons
- Make it sales-optimized for e-commerce
- The final image should make customers want to buy immediately
- IMPORTANT: Double-check all text for spelling accuracy before generating`;

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
