import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductInput {
  name: string;
  description?: string;
  price: number;
  costPrice: number;
  images?: string[];
  category?: string;
  shopSku?: string;
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

    let shopId = "";
    if (conn.encrypted_credentials) {
      try {
        const { data } = await supabase.rpc("decrypt_credentials", {
          p_encrypted: conn.encrypted_credentials,
        });
        if (data) {
          shopId = (data as any).sellerId || "";
        }
      } catch { /* ignore */ }
    } else {
      shopId = (conn.credentials as any)?.sellerId || "";
    }
    if (!shopId) {
      shopId = (conn.account_info as any)?.shopId || (conn.account_info as any)?.sellerId || "";
    }

    const request = await req.json();
    const { product }: { product: ProductInput } = request;

    console.log(`Preparing Uzum card data for: "${product.name}", shopId: ${shopId}`);

    // Generate AI content for the card
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
            model: "google/gemini-2.5-flash-lite",
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

    // Proxy images to storage for persistence
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

    // NOTE: Uzum Seller OpenAPI does NOT have a product creation endpoint.
    // The API only supports: GET products, POST price changes, FBS orders, stocks, invoices.
    // We return prepared card data for manual upload or Chrome extension auto-fill.
    console.log("✅ Uzum card data prepared (API does not support product creation)");

    return new Response(
      JSON.stringify({
        success: true,
        method: "prepared",
        message: "Uzum API kartochka yaratishni qo'llab-quvvatlamaydi. Ma'lumotlar tayyor — Seller kabinetida qo'lda yuklang yoki Chrome kengaytmasidan foydalaning.",
        card: {
          ...cardContent,
          price: product.price,
          images: proxiedImages.length > 0 ? proxiedImages : images,
          shopId,
        },
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
