import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InfographicRequest {
  productImage: string; // base64 or URL
  productName: string;
  category?: string;
  style?: "professional" | "minimalist" | "vibrant" | "luxury" | "tech";
  backgroundColor?: string;
  count?: number; // how many variants to generate
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: InfographicRequest = await req.json();
    const { productImage, productName, category, style = "professional", backgroundColor, count = 1 } = request;

    if (!productImage) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    
    if (!REPLICATE_API_TOKEN) {
      // Fallback to Lovable AI image generation
      return await fallbackToLovableAI(request, corsHeaders);
    }

    console.log(`🎨 Generating ${count} infographic(s) using Flux Pro via Replicate`);

    // Map style to visual prompt modifiers
    const stylePrompts: Record<string, string> = {
      professional: "clean white background, professional product photography, soft studio lighting, subtle shadows, high-end commercial style",
      minimalist: "pure white background, minimal composition, elegant simplicity, premium feel, negative space",
      vibrant: "colorful gradient background, dynamic composition, energetic mood, eye-catching, bold colors",
      luxury: "dark elegant background, golden accents, premium lighting, sophisticated, high-end luxury brand aesthetic",
      tech: "futuristic tech background, blue neon accents, digital grid elements, modern technology aesthetic"
    };

    // Category-specific background suggestions
    const categoryBackgrounds: Record<string, string> = {
      "Elektronika": "tech gradient background with subtle circuit patterns",
      "Kiyim-kechak": "soft fabric texture background, fashion editorial style",
      "Go'zallik": "soft pink or gold bokeh background, beauty product photography",
      "Sport": "dynamic action background with motion blur effects",
      "Uy-ro'zg'or": "warm cozy home interior background",
      "Bolalar uchun": "playful colorful background with soft edges",
    };

    const bgPrompt = backgroundColor || categoryBackgrounds[category || ""] || stylePrompts[style];

    // Create the prompt for Flux Pro
    const prompt = `Professional e-commerce product infographic for marketplace listing.
Product: ${productName}
Style: ${bgPrompt}
Requirements:
- Product must be the main focus, perfectly centered
- Clean, professional background that enhances the product
- No text or watermarks on the image
- High resolution, sharp details
- Perfect for e-commerce marketplace thumbnail
- Magazine-quality product photography`;

    // Start Flux Pro generation via Replicate
    const predictions = [];
    
    for (let i = 0; i < count; i++) {
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-1.1-pro",
          input: {
            prompt: prompt + (i > 0 ? ` Variation ${i + 1} with slightly different composition.` : ""),
            image: productImage.startsWith("data:") ? productImage : undefined,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 2,
            prompt_upsampling: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Replicate API error:", response.status, errorText);
        continue;
      }

      const prediction = await response.json();
      predictions.push(prediction);
    }

    if (predictions.length === 0) {
      return await fallbackToLovableAI(request, corsHeaders);
    }

    // Poll for results
    const results = [];
    for (const prediction of predictions) {
      let result = prediction;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait

      while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          },
        });
        
        if (pollResponse.ok) {
          result = await pollResponse.json();
        }
        attempts++;
      }

      if (result.status === "succeeded" && result.output) {
        results.push({
          url: Array.isArray(result.output) ? result.output[0] : result.output,
          id: result.id
        });
      }
    }

    if (results.length === 0) {
      throw new Error("Image generation failed");
    }

    console.log(`✅ Generated ${results.length} infographic(s) with Flux Pro`);

    return new Response(
      JSON.stringify({ 
        images: results,
        aiModel: "flux-1.1-pro",
        style,
        count: results.length
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
async function fallbackToLovableAI(request: InfographicRequest, corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("No AI API keys configured");
  }

  console.log("⚠️ Falling back to Lovable AI for infographic generation");

  const stylePrompts: Record<string, string> = {
    professional: "clean white background, professional product photography",
    minimalist: "pure white background, minimal composition",
    vibrant: "colorful gradient background, dynamic composition",
    luxury: "dark elegant background, premium lighting",
    tech: "futuristic tech background, blue accents"
  };

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
          content: `Create a professional e-commerce product infographic for: ${request.productName}. Style: ${stylePrompts[request.style || "professional"]}. High quality product photography suitable for marketplace listing.`
        }
      ],
      modalities: ["image", "text"]
    }),
  });

  if (!response.ok) {
    throw new Error("Image generation failed");
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    throw new Error("No image generated");
  }

  return new Response(
    JSON.stringify({ 
      images: [{ url: imageUrl, id: "lovable-ai" }],
      aiModel: "gemini-2.5-flash-image",
      style: request.style,
      count: 1
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
