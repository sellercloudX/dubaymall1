import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardRequest {
  imageBase64: string;
  costPrice?: number; // Tannarx
  targetMargin?: number; // % ustama
  targetMarketplaces?: ("yandex" | "uzum" | "wildberries" | "ozon")[];
  generateInfographics?: boolean;
  infographicCount?: number;
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

    // Store user's auth token to forward to sub-function calls
    const userAuthToken = authHeader;

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

    const userId = user.id;
    
    // Verify user has seller or admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (!roles?.some(r => r.role === "seller" || r.role === "admin")) {
      return new Response(
        JSON.stringify({ error: "Access denied - seller role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating marketplace card for user ${userId}`);

    const request: CardRequest = await req.json();
    const { 
      imageBase64, 
      costPrice, 
      targetMargin = 30, 
      targetMarketplaces = ["yandex"],
      generateInfographics = true,
      infographicCount = 6
    } = request;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🚀 Starting complete marketplace card creation pipeline");

    const results: Record<string, any> = {
      status: "processing",
      steps: []
    };

    // Step 1: Analyze product with GPT-4o Vision
    console.log("Step 1: Analyzing product image with GPT-4o Vision");
    const analysisResponse = await callEdgeFunction("analyze-product-image", { imageBase64 }, userAuthToken);
    
    if (!analysisResponse.ok) {
      throw new Error("Product analysis failed");
    }
    
    const productAnalysis = await analysisResponse.json();
    results.analysis = productAnalysis;
    results.steps.push({ step: "analysis", status: "completed", model: productAnalysis.aiModel });
    console.log("✅ Product analyzed:", productAnalysis.name);

    // Step 2: Generate SEO content with Claude Haiku
    console.log("Step 2: Generating SEO content with Claude Haiku");
    const seoResponse = await callEdgeFunction("generate-product-content", {
      productName: productAnalysis.name,
      productDescription: productAnalysis.description,
      category: productAnalysis.category,
      brand: productAnalysis.brand,
      specifications: productAnalysis.specifications,
      targetMarketplace: targetMarketplaces[0],
      contentType: "seo",
      languages: ["uz", "ru"]
    }, userAuthToken);

    let seoContent = null;
    if (seoResponse.ok) {
      seoContent = await seoResponse.json();
      results.seo = seoContent;
      results.steps.push({ step: "seo", status: "completed", model: seoContent.aiModel });
      console.log("✅ SEO content generated");
    } else {
      results.steps.push({ step: "seo", status: "failed" });
    }

    // Step 3: Generate detailed descriptions with Claude Sonnet
    console.log("Step 3: Generating descriptions with Claude Sonnet");
    const descResponse = await callEdgeFunction("generate-product-content", {
      productName: productAnalysis.name,
      productDescription: productAnalysis.description,
      category: productAnalysis.category,
      brand: productAnalysis.brand,
      specifications: productAnalysis.specifications,
      targetMarketplace: targetMarketplaces[0],
      contentType: "description",
      languages: ["uz", "ru"]
    }, userAuthToken);

    let descriptions = null;
    if (descResponse.ok) {
      descriptions = await descResponse.json();
      results.descriptions = descriptions;
      results.steps.push({ step: "descriptions", status: "completed", model: descriptions.aiModel });
      console.log("✅ Descriptions generated");
    } else {
      results.steps.push({ step: "descriptions", status: "failed" });
    }

    // Step 4: Generate infographics with Flux Pro (if requested)
    if (generateInfographics) {
      console.log(`Step 4: Generating ${infographicCount} infographics with Flux Pro`);
      const styles = ["professional", "minimalist", "vibrant", "luxury", "tech", "professional"];
      const infographics: any[] = [];

      for (let i = 0; i < Math.min(infographicCount, 6); i++) {
        try {
          const infoResponse = await callEdgeFunction("generate-infographic", {
            productImage: imageBase64,
            productName: productAnalysis.name,
            category: productAnalysis.category,
            style: styles[i % styles.length],
            count: 1
          });

          if (infoResponse.ok) {
            const infoResult = await infoResponse.json();
            if (infoResult.images?.length > 0) {
              infographics.push({
                ...infoResult.images[0],
                style: styles[i % styles.length]
              });
            }
          }
        } catch (e) {
          console.error(`Infographic ${i + 1} failed:`, e);
        }
      }

      results.infographics = infographics;
      results.steps.push({ 
        step: "infographics", 
        status: infographics.length > 0 ? "completed" : "failed",
        count: infographics.length
      });
      console.log(`✅ Generated ${infographics.length} infographics`);
    }

    // Step 5: Calculate pricing
    const suggestedPrice = productAnalysis.suggestedPrice || 100000;
    const calculatedPrice = costPrice 
      ? Math.round(costPrice * (1 + targetMargin / 100))
      : suggestedPrice;

    results.pricing = {
      costPrice: costPrice || null,
      suggestedPrice,
      calculatedPrice,
      margin: targetMargin,
      currency: "UZS"
    };
    results.steps.push({ step: "pricing", status: "completed" });

    // Step 6: Compile final card data
    results.card = {
      name: {
        uz: productAnalysis.name,
        ru: seoContent?.seoTitle?.ru || productAnalysis.name
      },
      description: {
        uz: descriptions?.fullDescription?.uz || productAnalysis.description,
        ru: descriptions?.fullDescription?.ru || productAnalysis.description
      },
      shortDescription: {
        uz: descriptions?.shortDescription?.uz || productAnalysis.description?.substring(0, 150),
        ru: descriptions?.shortDescription?.ru || productAnalysis.description?.substring(0, 150)
      },
      seoTitle: seoContent?.seoTitle,
      metaDescription: seoContent?.metaDescription,
      keywords: seoContent?.keywords,
      bulletPoints: seoContent?.bulletPoints || descriptions?.sellingPoints,
      category: productAnalysis.category,
      brand: productAnalysis.brand,
      specifications: productAnalysis.specifications,
      price: calculatedPrice,
      images: [
        imageBase64,
        ...(results.infographics?.map((i: any) => i.url) || [])
      ],
      targetMarketplaces
    };

    results.status = "completed";
    console.log("🎉 Marketplace card creation completed!");

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to call other edge functions
async function callEdgeFunction(functionName: string, body: any): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body)
  });
}
