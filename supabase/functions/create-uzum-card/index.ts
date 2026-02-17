import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductInput {
  name: string;
  description?: string;
  price: number;
  costPrice: number;
  images?: string[];
  category?: string;
}

interface CreateUzumCardRequest {
  product: ProductInput;
  cloneMode?: boolean;
  skipImageGeneration?: boolean;
}

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

    // Get Uzum credentials
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", "uzum")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "Uzum Market ulanmagan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiKey = "";
    let shopId = "";
    if (conn.encrypted_credentials) {
      const { data, error } = await supabase.rpc("decrypt_credentials", {
        p_encrypted: conn.encrypted_credentials,
      });
      if (!error && data) {
        apiKey = (data as any).apiKey || "";
        shopId = (data as any).sellerId || "";
      }
    } else {
      apiKey = (conn.credentials as any)?.apiKey || "";
      shopId = (conn.credentials as any)?.sellerId || "";
    }

    // Also try account_info for shopId
    if (!shopId) {
      shopId = (conn.account_info as any)?.shopId || (conn.account_info as any)?.sellerId || "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Uzum API kaliti yo'q" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: CreateUzumCardRequest = await req.json();
    const { product } = request;

    console.log(`Creating Uzum card: "${product.name}", shopId: ${shopId}`);

    const uzumBaseUrl = "https://api-seller.uzum.uz/api/seller-openapi";
    const uzumHeaders: Record<string, string> = {
      "Authorization": apiKey,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    // Discover shopId if not available
    if (!shopId) {
      try {
        const shopsResp = await fetch(`${uzumBaseUrl}/v1/shops`, { headers: uzumHeaders });
        if (shopsResp.ok) {
          const shopsData = await shopsResp.json();
          const shops = Array.isArray(shopsData) ? shopsData : (shopsData.payload || []);
          const shopList = Array.isArray(shops) ? shops : [shops];
          if (shopList.length > 0) {
            shopId = String(shopList[0].shopId || shopList[0].id || "");
            console.log(`Discovered shopId: ${shopId}`);
          }
        }
      } catch (e) {
        console.error("Shop discovery failed:", e);
      }
    }

    // Step 1: Generate AI content for Uzum card
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let cardContent: any = null;

    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `Sen Uzum Market uchun professional tovar kartochkasi tayyorlovchi yordamchisan.
Qoidalar:
1. Nomi lotin alifbosida (UZ), kamida 3 so'z
2. Tavsif UZ va RU da
3. Kamida 5 ta xususiyat
4. Taqiqlangan: "eng yaxshi", "arzon", "top", "hit", "original" kabi sub'ektiv so'zlar
5. HTML teglar ishlatma`,
              },
              {
                role: "user",
                content: `Mahsulot: ${product.name}
${product.description ? `Tavsif: ${product.description}` : ""}
${product.category ? `Kategoriya: ${product.category}` : ""}
Narx: ${product.price} so'm

JSON formatda quyidagilarni ber: name_uz, name_ru, description_uz, description_ru, properties (array of {name, value})`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "uzum_card",
                  description: "Uzum card data",
                  parameters: {
                    type: "object",
                    properties: {
                      name_uz: { type: "string" },
                      name_ru: { type: "string" },
                      description_uz: { type: "string" },
                      description_ru: { type: "string" },
                      properties: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            value: { type: "string" },
                          },
                          required: ["name", "value"],
                        },
                      },
                    },
                    required: ["name_uz", "name_ru", "description_uz", "description_ru", "properties"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "uzum_card" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            cardContent = JSON.parse(toolCall.function.arguments);
            console.log("AI content generated for Uzum card");
          }
        }
      } catch (e) {
        console.error("AI content generation failed:", e);
      }
    }

    // Fallback if AI failed
    if (!cardContent) {
      cardContent = {
        name_uz: product.name,
        name_ru: product.name,
        description_uz: product.description || product.name,
        description_ru: product.description || product.name,
        properties: [],
      };
    }

    // Step 2: Try Uzum Seller API product creation endpoints
    // Attempt 1: POST /v2/product (newer endpoint)
    // Attempt 2: POST /v1/product/shop/{shopId} (older endpoint)
    let uzumSuccess = false;
    let uzumResponse: any = null;
    let uzumError = "";

    // Proxy images to Supabase storage
    const images = product.images || [];
    const proxiedImages: string[] = [];
    for (const imgUrl of images.slice(0, 10)) {
      if (!imgUrl || !imgUrl.startsWith("http")) continue;
      try {
        const resp = await fetch(imgUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketBot/1.0)" },
        });
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) continue;
        const data = await resp.arrayBuffer();
        if (data.byteLength < 1000) continue;
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const fileName = `${user.id}/uzum-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
          if (urlData?.publicUrl) proxiedImages.push(urlData.publicUrl);
        }
      } catch (e) {
        console.warn(`Image proxy failed: ${e}`);
      }
    }

    // Try creating product via Uzum API
    const productPayload = {
      title: cardContent.name_uz || product.name,
      titleRu: cardContent.name_ru || product.name,
      description: cardContent.description_uz || product.description || "",
      descriptionRu: cardContent.description_ru || product.description || "",
      price: Math.round(product.price * 100), // Uzum uses tiyin
      images: proxiedImages.length > 0 ? proxiedImages : (images.length > 0 ? images : []),
      shopId: shopId ? Number(shopId) : undefined,
      characteristics: (cardContent.properties || []).map((p: any) => ({
        title: p.name,
        value: p.value,
      })),
    };

    // Attempt 1: /v2/product
    try {
      console.log("Trying Uzum POST /v2/product...");
      const resp = await fetch(`${uzumBaseUrl}/v2/product`, {
        method: "POST",
        headers: uzumHeaders,
        body: JSON.stringify(productPayload),
      });
      const respText = await resp.text();
      console.log(`Uzum /v2/product response: ${resp.status} ${respText.substring(0, 200)}`);
      
      if (resp.ok || resp.status === 201) {
        try { uzumResponse = JSON.parse(respText); } catch { uzumResponse = respText; }
        uzumSuccess = true;
      } else if (resp.status === 404 || resp.status === 405) {
        console.log("/v2/product not available, trying alternative...");
      } else {
        uzumError = respText.substring(0, 200);
      }
    } catch (e) {
      console.error("Uzum /v2/product error:", e);
    }

    // Attempt 2: /v1/product/shop/{shopId}
    if (!uzumSuccess && shopId) {
      try {
        console.log(`Trying Uzum POST /v1/product/shop/${shopId}...`);
        const resp = await fetch(`${uzumBaseUrl}/v1/product/shop/${shopId}`, {
          method: "POST",
          headers: uzumHeaders,
          body: JSON.stringify({
            title: cardContent.name_uz || product.name,
            description: cardContent.description_uz || "",
            price: product.price,
            photos: proxiedImages.length > 0 ? proxiedImages.map(url => ({ photoUrl: url })) : undefined,
          }),
        });
        const respText = await resp.text();
        console.log(`Uzum /v1/product response: ${resp.status} ${respText.substring(0, 200)}`);
        
        if (resp.ok || resp.status === 201) {
          try { uzumResponse = JSON.parse(respText); } catch { uzumResponse = respText; }
          uzumSuccess = true;
        } else {
          uzumError = respText.substring(0, 200);
        }
      } catch (e) {
        console.error("Uzum /v1/product error:", e);
      }
    }

    // Attempt 3: /v1/product-card (another possible endpoint)
    if (!uzumSuccess) {
      try {
        console.log("Trying Uzum POST /v1/product-card...");
        const resp = await fetch(`${uzumBaseUrl}/v1/product-card`, {
          method: "POST",
          headers: uzumHeaders,
          body: JSON.stringify({
            shopId: shopId ? Number(shopId) : undefined,
            title: cardContent.name_uz || product.name,
            titleRu: cardContent.name_ru || product.name,
            description: cardContent.description_uz || "",
            descriptionRu: cardContent.description_ru || "",
            price: product.price,
            photoUrls: proxiedImages.length > 0 ? proxiedImages : images,
          }),
        });
        const respText = await resp.text();
        console.log(`Uzum /v1/product-card response: ${resp.status} ${respText.substring(0, 200)}`);
        
        if (resp.ok || resp.status === 201) {
          try { uzumResponse = JSON.parse(respText); } catch { uzumResponse = respText; }
          uzumSuccess = true;
        }
      } catch (e) {
        console.error("Uzum /v1/product-card error:", e);
      }
    }

    if (uzumSuccess) {
      console.log("✅ Uzum card created via API");
      return new Response(
        JSON.stringify({
          success: true,
          method: "api",
          name: cardContent.name_uz || product.name,
          price: product.price,
          images: proxiedImages.length,
          uzumResponse,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // API creation not supported — return prepared card data for manual upload
    console.log("Uzum API card creation not available, returning prepared data");
    return new Response(
      JSON.stringify({
        success: true,
        method: "prepared",
        message: "Kartochka ma'lumotlari tayyor. Uzum Seller kabinetida qo'lda yuklab oling.",
        card: {
          ...cardContent,
          price: product.price,
          images: proxiedImages.length > 0 ? proxiedImages : images,
          shopId,
        },
        apiNote: uzumError || "Uzum Seller API hozircha kartochka yaratishni qo'llab-quvvatlamaydi",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Noma'lum xato",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
