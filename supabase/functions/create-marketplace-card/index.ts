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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Rate limit: 5 requests per hour
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCount } = await adminSupabase
      .from('ai_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'create-marketplace-card')
      .gte('created_at', oneHourAgo);

    if ((recentCount || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 5 card creations per hour.' }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await adminSupabase.from('ai_usage_log').insert({
      user_id: userId, action_type: 'create-marketplace-card', model_used: 'multi-model-pipeline',
    });

    const rawRequest = await req.json();
    if (!rawRequest || typeof rawRequest !== 'object') {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validMPs = ['yandex', 'uzum', 'wildberries', 'ozon'];
    const imageBase64 = typeof rawRequest.imageBase64 === 'string' && rawRequest.imageBase64.length > 0 && rawRequest.imageBase64.length <= 10_000_000 ? rawRequest.imageBase64 : null;
    const costPrice = typeof rawRequest.costPrice === 'number' && Number.isFinite(rawRequest.costPrice) && rawRequest.costPrice >= 0 ? rawRequest.costPrice : undefined;
    const targetMargin = typeof rawRequest.targetMargin === 'number' && rawRequest.targetMargin >= 0 && rawRequest.targetMargin <= 500 ? rawRequest.targetMargin : 30;
    const targetMarketplaces = Array.isArray(rawRequest.targetMarketplaces)
      ? rawRequest.targetMarketplaces.filter((m: any) => typeof m === 'string' && validMPs.includes(m)).slice(0, 4)
      : ["yandex"];
    const generateInfographics = typeof rawRequest.generateInfographics === 'boolean' ? rawRequest.generateInfographics : true;
    const infographicCount = typeof rawRequest.infographicCount === 'number' && rawRequest.infographicCount >= 0 && rawRequest.infographicCount <= 10 ? rawRequest.infographicCount : 3;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Product image is required (max 10MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🚀 Starting marketplace card creation pipeline");

    const results: Record<string, any> = {
      status: "processing",
      steps: []
    };

    // Step 1: Analyze product image (REQUIRED — everything else depends on this)
    console.log("Step 1: Analyzing product image");
    const analysisResponse = await callEdgeFunction("analyze-product-image", { imageBase64 }, userAuthToken);

    if (!analysisResponse.ok) {
      const errBody = await analysisResponse.text().catch(() => 'Unknown');
      console.error("Analysis failed:", analysisResponse.status, errBody);
      throw new Error("Product analysis failed");
    }

    const productAnalysis = await analysisResponse.json();
    results.analysis = productAnalysis;
    results.steps.push({ step: "analysis", status: "completed", model: productAnalysis.aiModel });
    console.log("✅ Product analyzed:", productAnalysis.name);

    // Step 2 & 3: Run SEO + Description generation IN PARALLEL (saves ~10-15s)
    console.log("Step 2+3: Generating SEO + descriptions in parallel");
    const [seoResponse, descResponse] = await Promise.allSettled([
      callEdgeFunction("generate-product-content", {
        productName: productAnalysis.name,
        productDescription: productAnalysis.description,
        category: productAnalysis.category,
        brand: productAnalysis.brand,
        specifications: productAnalysis.specifications,
        targetMarketplace: targetMarketplaces[0],
        contentType: "seo",
        languages: ["uz", "ru"]
      }, userAuthToken),
      callEdgeFunction("generate-product-content", {
        productName: productAnalysis.name,
        productDescription: productAnalysis.description,
        category: productAnalysis.category,
        brand: productAnalysis.brand,
        specifications: productAnalysis.specifications,
        targetMarketplace: targetMarketplaces[0],
        contentType: "description",
        languages: ["uz", "ru"]
      }, userAuthToken),
    ]);

    let seoContent = null;
    if (seoResponse.status === 'fulfilled' && seoResponse.value.ok) {
      seoContent = await seoResponse.value.json();
      results.seo = seoContent;
      results.steps.push({ step: "seo", status: "completed", model: seoContent.aiModel });
      console.log("✅ SEO content generated");
    } else {
      results.steps.push({ step: "seo", status: "failed" });
      console.warn("⚠️ SEO generation failed");
    }

    let descriptions = null;
    if (descResponse.status === 'fulfilled' && descResponse.value.ok) {
      descriptions = await descResponse.value.json();
      results.descriptions = descriptions;
      results.steps.push({ step: "descriptions", status: "completed", model: descriptions.aiModel });
      console.log("✅ Descriptions generated");
    } else {
      results.steps.push({ step: "descriptions", status: "failed" });
      console.warn("⚠️ Description generation failed");
    }

    // Step 4: Generate infographics IN PARALLEL (if requested, max 3 to avoid timeout)
    if (generateInfographics) {
      const actualCount = Math.min(infographicCount, 3);
      console.log(`Step 4: Generating ${actualCount} infographics in parallel`);
      const styles = ["professional", "minimalist", "vibrant"];

      const infoResults = await Promise.allSettled(
        Array.from({ length: actualCount }, (_, i) =>
          callEdgeFunction("generate-infographic", {
            productImage: imageBase64,
            productName: productAnalysis.name,
            category: productAnalysis.category,
            style: styles[i % styles.length],
            count: 1
          }, userAuthToken).then(async (resp) => {
            if (!resp.ok) return null;
            const r = await resp.json();
            return r.images?.length > 0 ? { ...r.images[0], style: styles[i % styles.length] } : null;
          }).catch(() => null)
        )
      );

      const infographics = infoResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value != null)
        .map(r => r.value);

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

    // Step 6: Compile final card
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

async function callEdgeFunction(functionName: string, body: any, authToken?: string): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout per sub-call

  try {
    return await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Authorization": authToken || `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error(`⏱️ ${functionName} timed out after 55s`);
      return new Response(JSON.stringify({ error: "Timeout" }), { status: 504 });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
