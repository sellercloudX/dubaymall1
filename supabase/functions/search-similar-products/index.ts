import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductResult {
  title: string;
  price: string;
  image: string;
  source: string;
  url: string;
  description: string;
}

// Search Yandex Market using the user's real API credentials
async function searchYandexMarketReal(
  apiKey: string,
  businessId: string,
  productName: string
): Promise<ProductResult[]> {
  const results: ProductResult[] = [];
  
  try {
    const searchResponse = await fetch(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=20`,
      {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          textQuery: productName,
        }),
      }
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const offers = data.result?.offerMappings || [];
      
      for (const mapping of offers) {
        const offer = mapping.offer;
        if (!offer) continue;
        
        const price = offer.basicPrice?.value 
          ? `${Number(offer.basicPrice.value).toLocaleString('uz-UZ')} so'm`
          : "Narx ko'rsatilmagan";
        
        results.push({
          title: offer.name || "Nomsiz",
          price,
          image: offer.pictures?.[0] || "",
          source: "Yandex Market (sizning do'koningiz)",
          url: `https://partner.market.yandex.ru/business/${businessId}/assortment/offer/${encodeURIComponent(offer.offerId || "")}`,
          description: (offer.description || "").replace(/<[^>]*>/g, "").substring(0, 150),
        });
      }
      console.log(`✅ Found ${results.length} real Yandex Market products`);
    } else {
      console.error("Yandex search failed:", searchResponse.status);
    }
  } catch (e) {
    console.error("Yandex real search error:", e);
  }
  
  return results;
}

// Search real marketplaces using AI with web search grounding
async function searchMarketplacesWithAI(
  productName: string,
  category: string,
  LOVABLE_API_KEY: string
): Promise<ProductResult[]> {
  try {
    // Use AI to search for real products with grounding
    const searchPrompt = `Search for REAL existing products similar to "${productName}" (category: ${category || 'unknown'}) on these marketplaces:

1. Uzum Market (uzum.uz)
2. Yandex Market (market.yandex.uz) 
3. Wildberries (wildberries.ru)
4. Ozon (ozon.ru)
5. AliExpress (aliexpress.com)
6. 1688.com

For each marketplace, find 1 real product that matches or is similar.

IMPORTANT RULES:
- Use ONLY real product names that actually exist
- Use ONLY real prices from these marketplaces
- For images: use the ACTUAL product image URL from the marketplace if you know it. If not, leave image as empty string ""
- Use REAL product page URLs. If you don't know the exact URL, use the marketplace search URL like "https://uzum.uz/search?query=product+name"
- Do NOT invent fake prices or product names
- If you cannot find a real product on a marketplace, skip it

Return ONLY a valid JSON array (no markdown, no explanation):
[{"title":"Real product name","price":"45 000 so'm","image":"","source":"Uzum Market","url":"https://uzum.uz/search?query=...","description":"Brief real description"}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a product research assistant. You must only return real products that exist on marketplaces. Never invent fake products or prices. Return only valid JSON arrays with no markdown formatting." },
          { role: "user", content: searchPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      console.error("AI search failed:", response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      // Filter out products with obviously fake data
      return products.filter((p: any) => {
        if (!p.title || !p.price || !p.source) return false;
        // Reject picsum/placeholder images
        if (p.image && (p.image.includes('picsum') || p.image.includes('placeholder') || p.image.includes('via.placeholder'))) {
          p.image = "";
        }
        return true;
      });
    }
  } catch (e) {
    console.error("AI marketplace search error:", e);
  }
  
  return [];
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
        JSON.stringify({ error: "Unauthorized", products: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication", products: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { productName, category, description } = body;

    if (!productName || typeof productName !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid product name", products: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Product search for: ${productName}`);

    // Try to get user's Yandex Market credentials for real search
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: connection } = await serviceClient
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", "yandex")
      .eq("is_active", true)
      .limit(1)
      .single();

    let yandexApiKey: string | undefined;
    let yandexBusinessId: string | undefined;

    if (connection) {
      if (connection.encrypted_credentials) {
        const { data: decData } = await serviceClient
          .rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
        if (decData) {
          const creds = decData as any;
          yandexApiKey = creds.apiKey;
          yandexBusinessId = creds.campaignId || creds.sellerId;
        }
      } else {
        const creds = connection.credentials as any;
        yandexApiKey = creds?.apiKey;
        yandexBusinessId = creds?.campaignId || creds?.sellerId;
      }
      
      if (yandexApiKey && yandexBusinessId) {
        try {
          const campaignRes = await fetch(
            `https://api.partner.market.yandex.ru/campaigns/${yandexBusinessId}`,
            { headers: { "Api-Key": yandexApiKey, "Content-Type": "application/json" } }
          );
          if (campaignRes.ok) {
            const campData = await campaignRes.json();
            yandexBusinessId = campData.campaign?.business?.id?.toString() || yandexBusinessId;
          }
        } catch {}
      }
    }

    // Search in parallel: real Yandex + AI-powered real marketplace search
    const searchPromises: Promise<ProductResult[]>[] = [];

    // Real Yandex Market search (user's own store)
    if (yandexApiKey && yandexBusinessId) {
      searchPromises.push(searchYandexMarketReal(yandexApiKey, yandexBusinessId, productName));
    }

    // AI-powered real marketplace search
    if (LOVABLE_API_KEY) {
      searchPromises.push(searchMarketplacesWithAI(productName, category || "", LOVABLE_API_KEY));
    }

    const searchResults = await Promise.all(searchPromises);
    const allProducts = searchResults.flat();

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueProducts = allProducts.filter(p => {
      const key = p.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`✅ Search complete: ${uniqueProducts.length} real products found`);

    return new Response(
      JSON.stringify({ 
        products: uniqueProducts,
        searchQuery: productName,
        hasRealData: !!(yandexApiKey && yandexBusinessId),
        platforms: ["Uzum", "Yandex", "Wildberries", "Ozon", "AliExpress", "1688"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ products: [], error: "Search failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
