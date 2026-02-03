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

    console.log("Enhancing product image for:", productName, "category:", category);

    // Category-specific background and styling - KEEPING THE EXACT PRODUCT
    const categoryStyles: Record<string, string> = {
      // Cosmetics & Beauty
      "cosmetics": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background and add decorative elements AROUND the product:
- Replace background with: soft pink/peach gradient with subtle bokeh
- Add around product: scattered flower petals, citrus slices, water droplets
- Add lighting: soft glow, sparkles, golden particles
- The PRODUCT ITSELF must remain EXACTLY as shown - same bottle, same packaging, same angle
DO NOT replace or redraw the product - only enhance the surroundings`,

      // Electronics  
      "electronics": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background and add visual effects AROUND the product:
- Replace background with: dark gradient (blue/black) with tech glow
- Add around product: light trails, subtle circuit patterns, neon accents
- Add lighting: dramatic side lighting, reflection on surface below
- The PRODUCT ITSELF must remain EXACTLY as shown - same device, same angle
DO NOT replace or redraw the product - only enhance the surroundings`,

      // Clothing & Fashion
      "clothing": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background and styling AROUND the product:
- Replace background with: clean studio backdrop or lifestyle setting
- Add: soft natural lighting, subtle shadows for depth
- The PRODUCT ITSELF must remain EXACTLY as shown - same fabric, same color
DO NOT replace or redraw the product - only enhance the surroundings`,

      // Food & Beverages
      "food": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background and add elements AROUND the product:
- Replace background with: warm, appetizing setting (wooden surface, natural light)
- Add around product: fresh ingredients related to the product, leaves, natural elements
- Add: steam effect if warm product, water droplets for freshness
- The PRODUCT ITSELF must remain EXACTLY as shown
DO NOT replace or redraw the product - only enhance the surroundings`,

      // Home & Kitchen
      "home": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background to lifestyle setting:
- Replace background with: cozy home interior, natural light from window
- Add: complementary decor elements around the product
- The PRODUCT ITSELF must remain EXACTLY as shown
DO NOT replace or redraw the product - only enhance the surroundings`,

      // Default
      "default": `EDIT this image: KEEP THE EXACT SAME PRODUCT visible in the photo unchanged.
ONLY change the background and add professional lighting:
- Replace background with: clean gradient, professional studio lighting
- Add: soft shadows, subtle reflections, elegant platform/surface
- The PRODUCT ITSELF must remain EXACTLY as shown - same shape, same color, same details
DO NOT replace or redraw the product - only enhance the surroundings`
    };

    // Determine style based on category
    const categoryKey = category?.toLowerCase() || "default";
    const stylePrompt = categoryStyles[categoryKey] || categoryStyles["default"];

    const prompt = `${stylePrompt}

CRITICAL INSTRUCTIONS:
1. The EXACT product from this image must be preserved - DO NOT change the product itself
2. DO NOT generate a different or similar product - use THIS EXACT product
3. Only modify: background, lighting, decorative elements AROUND the product
4. NO TEXT, NO WORDS, NO LETTERS anywhere on the image
5. The product should look like it was professionally photographed for a marketplace
6. Think of this as removing the background and placing the SAME product on a better set

OUTPUT: A professional marketplace photo with the SAME EXACT product on enhanced background`;

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
      
      throw new Error("AI image enhancement failed");
    }

    const data = await response.json();
    console.log("AI response received");
    
    // Extract the enhanced image
    const enhancedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!enhancedImage) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({ 
        enhancedImageBase64: enhancedImage,
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
