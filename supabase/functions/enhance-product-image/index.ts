import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const { imageBase64, productName, productDescription, category } = body;

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

    if (productName && (typeof productName !== 'string' || productName.length > 500)) {
      return new Response(
        JSON.stringify({ error: "Invalid product name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (category && (typeof category !== 'string' || category.length > 100)) {
      return new Response(
        JSON.stringify({ error: "Invalid category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enhancing product image for user ${claimsData.claims.sub}:`, productName?.slice(0, 50), "category:", category?.slice(0, 30));

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
    const categoryKey = category?.toLowerCase().slice(0, 50) || "default";
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
      console.error("AI Gateway error:", response.status);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Service busy, please try again" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Image enhancement failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");
    
    // Extract the enhanced image
    const enhancedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!enhancedImage) {
      console.error("No image in response");
      return new Response(
        JSON.stringify({ error: "Image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      JSON.stringify({ error: "Image enhancement failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
