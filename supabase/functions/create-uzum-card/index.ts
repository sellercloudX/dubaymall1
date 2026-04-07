import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const request = await req.json();
    const { product, cloneMode } = request;

    if (!product?.name) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Uzum card v3: "${product.name}", clone=${!!cloneMode}`);

    // Get Uzum connection for shopId
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", "uzum")
      .eq("is_active", true)
      .limit(1)
      .single();

    let shopId = "";
    if (conn) {
      if (conn.encrypted_credentials) {
        try {
          const { data } = await supabase.rpc("decrypt_credentials", { p_encrypted: conn.encrypted_credentials });
          if (data) shopId = (data as any).sellerId || "";
        } catch { /* ignore */ }
      } else {
        shopId = (conn.credentials as any)?.sellerId || "";
      }
      if (!shopId) {
        shopId = (conn.account_info as any)?.shopId || (conn.account_info as any)?.sellerId || "";
      }
    }

    // ==========================================
    // STEP 1: AI — Generate comprehensive card data
    // ==========================================
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build rich context from source product
    const sourceContext = [];
    if (product.description) sourceContext.push(`Tavsif: ${product.description.slice(0, 2000)}`);
    if (product.category) sourceContext.push(`Kategoriya: ${product.category}`);
    if (product.brand) sourceContext.push(`Brend: ${product.brand}`);
    if (product.barcode) sourceContext.push(`Shtrix-kod: ${product.barcode}`);
    if (product.mxikCode) sourceContext.push(`MXIK: ${product.mxikCode}`);
    if (product.weight) sourceContext.push(`Og'irlik: ${product.weight} kg`);
    if (product.color) sourceContext.push(`Rang: ${product.color}`);
    if (product.model) sourceContext.push(`Model: ${product.model}`);
    if (product.sourceCharacteristics?.length > 0) {
      const chars = product.sourceCharacteristics.slice(0, 20).map((c: any) => {
        const name = c.name || c.title || c.key || '';
        const val = c.value || c.values?.[0] || '';
        return `${name}: ${val}`;
      }).filter(Boolean).join('; ');
      sourceContext.push(`Xususiyatlar: ${chars}`);
    }

    const systemPrompt = `Sen Uzum Market uchun PROFESSIONAL kartochka yaratuvchi AI yordamchisan.

QOIDALAR (Uzum moderatsiya talablari):
1. Nom formati: "Tovar turi + Brend + Model + Asosiy xususiyat" — kamida 3 so'z, bosh harf bilan
2. Nom UZ (lotin) va RU (kirill) da
3. Tavsif UZ va RU da — 5-10 gap, afzalliklari, materiallari, ishlatish usuli
4. TAQIQLANGAN so'zlar: "eng yaxshi", "arzon", "chegirma", "aksiya", "top", "hit", "original", "sifatli", "super", "ajoyib"
5. Emoji ishlatma, HTML teglar ishlatma
6. Faqat o'zbek lotin va rus kirill alifbosi
7. Kamida 8 ta xususiyat (material, rang, o'lcham, brend, model, ishlab chiqaruvchi mamlakat, og'irlik, etc.)
8. Agar MXIK kodi berilmagan bo'lsa, mahsulotga mos MXIK kodini taxmin qil
9. Barcode yo'q bo'lsa, EAN-13 formatida generatsiya qil
10. VGH (vesogabaritnyye xarakteristiki): balandlik, uzunlik, kenglik (sm), og'irlik (kg) ni to'ldir

MUHIM: Uzum moderatsiyasidan O'TISHI uchun barcha maydonlar MUKAMMAL to'ldirilishi shart!`;

    const userPrompt = `Mahsulot: ${product.name}
Narx: ${product.price || 0} so'm
${sourceContext.join('\n')}

MUKAMMAL kartochka tayyorla — barcha maydonlar to'ldirilsin:`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "uzum_card_full",
            description: "Uzum Market uchun to'liq kartochka ma'lumotlari",
            parameters: {
              type: "object",
              properties: {
                name_uz: { type: "string", description: "Tovar nomi o'zbek tilida (lotin alifbosi)" },
                name_ru: { type: "string", description: "Tovar nomi rus tilida (kirill)" },
                short_description_uz: { type: "string", description: "Qisqa tavsif UZ (1-2 gap)" },
                short_description_ru: { type: "string", description: "Qisqa tavsif RU (1-2 gap)" },
                full_description_uz: { type: "string", description: "To'liq tavsif UZ (5-10 gap)" },
                full_description_ru: { type: "string", description: "To'liq tavsif RU (5-10 gap)" },
                brand: { type: "string", description: "Brend nomi" },
                barcode: { type: "string", description: "EAN-13 shtrix-kod (13 raqam)" },
                mxik_code: { type: "string", description: "MXIK (IKPU) kodi" },
                mxik_name: { type: "string", description: "MXIK nomi" },
                weight_kg: { type: "number", description: "Og'irlik kg" },
                height_cm: { type: "number", description: "Balandlik sm" },
                length_cm: { type: "number", description: "Uzunlik sm" },
                width_cm: { type: "number", description: "Kenglik sm" },
                color: { type: "string", description: "Rang (rus tilida)" },
                material: { type: "string", description: "Material (rus tilida)" },
                country: { type: "string", description: "Ishlab chiqaruvchi mamlakat (rus tilida)" },
                category_path: {
                  type: "array",
                  items: { type: "string" },
                  description: "Kategoriya yo'li (masalan: ['Одежда', 'Женская одежда', 'Пижамы'])"
                },
                characteristics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Xususiyat nomi (ruscha)" },
                      value: { type: "string", description: "Xususiyat qiymati (ruscha)" },
                    },
                    required: ["name", "value"],
                  },
                  description: "Tovar xususiyatlari (kamida 8 ta)",
                },
                seo_keywords_uz: {
                  type: "array",
                  items: { type: "string" },
                  description: "SEO kalit so'zlar UZ (5-10 ta)"
                },
                seo_keywords_ru: {
                  type: "array",
                  items: { type: "string" },
                  description: "SEO kalit so'zlar RU (5-10 ta)"
                },
              },
              required: [
                "name_uz", "name_ru", "short_description_uz", "short_description_ru",
                "full_description_uz", "full_description_ru", "brand", "characteristics",
                "category_path", "weight_kg", "height_cm", "length_cm", "width_cm"
              ],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "uzum_card_full" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI limit oshdi, qayta urinib ko'ring" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI strukturli ma'lumot qaytarmadi");

    const cardData = JSON.parse(toolCall.function.arguments);
    console.log(`✅ AI card generated: name="${cardData.name_ru?.slice(0, 40)}", chars=${cardData.characteristics?.length || 0}`);

    // ==========================================
    // STEP 2: Override with source data (clone mode)
    // ==========================================
    if (cloneMode) {
      // Use source MXIK if available (more accurate than AI guess)
      if (product.mxikCode) cardData.mxik_code = product.mxikCode;
      if (product.mxikName) cardData.mxik_name = product.mxikName;
      // Use source barcode
      if (product.barcode) cardData.barcode = product.barcode;
      // Use source brand
      if (product.brand) cardData.brand = product.brand;
      console.log(`🔗 Clone overrides: mxik=${product.mxikCode || 'AI'}, barcode=${product.barcode || 'AI'}`);
    }

    // ==========================================
    // STEP 3: Proxy images to storage
    // ==========================================
    const images = (product.images || []).filter((u: string) => typeof u === 'string' && u.startsWith('http')).slice(0, 10);
    
    // Proxy images in parallel (up to 5 concurrent) with proper fallback
    const proxyOne = async (imgUrl: string): Promise<string> => {
      // Skip non-product images
      const lower = imgUrl.toLowerCase();
      if (lower.includes('static.uzum.uz') || lower.includes('/baner/') || lower.includes('/banner') || lower.includes('/promo/') || lower.includes('/logo')) {
        return ''; // skip
      }
      
      // Already our storage URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || '';
      if (imgUrl.includes(supabaseUrl) && imgUrl.includes('/storage/v1/object/public/')) {
        return imgUrl;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch(imgUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              "Referer": imgUrl.includes('uzum') ? 'https://uzum.uz/' : imgUrl.includes('yandex') ? 'https://market.yandex.ru/' : imgUrl.includes('wildberries') ? 'https://www.wildberries.ru/' : 'https://google.com/',
            },
          });
          if (!resp.ok) {
            if (attempt === 0) { await new Promise(r => setTimeout(r, 500)); continue; }
            return imgUrl; // fallback to original
          }
          const ct = resp.headers.get("content-type") || "image/jpeg";
          if (!ct.startsWith("image/")) return imgUrl;
          const data = await resp.arrayBuffer();
          if (data.byteLength < 1000) return imgUrl;
          const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
          const fileName = `${user.id}/uzum-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("product-images")
            .upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
            if (urlData?.publicUrl) return urlData.publicUrl;
          }
          return imgUrl; // fallback
        } catch (e) {
          if (attempt === 0) { await new Promise(r => setTimeout(r, 500)); continue; }
          console.warn(`Image proxy failed: ${e}`);
          return imgUrl; // fallback to original URL
        }
      }
      return imgUrl;
    };

    const proxiedResults = await Promise.allSettled(images.map(proxyOne));
    const proxiedImages = proxiedResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
      .map(r => r.value);

    // ==========================================
    // STEP 4: Build complete card payload for Chrome Extension
    // ==========================================
    const extensionPayload = {
      // Basic info
      titleUz: cardData.name_uz,
      titleRu: cardData.name_ru,
      shortDescriptionUz: cardData.short_description_uz,
      shortDescriptionRu: cardData.short_description_ru,
      descriptionUz: cardData.full_description_uz,
      descriptionRu: cardData.full_description_ru,
      
      // Pricing
      price: product.price,
      costPrice: product.costPrice,
      
      // Category path for tree navigation
      categoryPath: cardData.category_path || [],
      
      // Product identifiers
      brand: cardData.brand || '',
      barcode: cardData.barcode || product.barcode || '',
      mxikCode: cardData.mxik_code || product.mxikCode || '',
      mxikName: cardData.mxik_name || product.mxikName || '',
      sku: product.shopSku || '',
      
      // Dimensions (VGH)
      weight: cardData.weight_kg || product.weight || 0.5,
      height: cardData.height_cm || 10,
      length: cardData.length_cm || 20,
      width: cardData.width_cm || 15,
      
      // Characteristics
      color: cardData.color || product.color || '',
      material: cardData.material || '',
      country: cardData.country || "O'zbekiston",
      characteristics: cardData.characteristics || [],
      
      // Images
      images: proxiedImages.length > 0 ? proxiedImages : images,
      
      // SEO
      seoKeywordsUz: cardData.seo_keywords_uz || [],
      seoKeywordsRu: cardData.seo_keywords_ru || [],
      
      // Metadata
      shopId,
      sourceMarketplace: product.sourceMarketplace || '',
    };

    // Quality score
    let score = 0;
    if (extensionPayload.titleUz) score += 5;
    if (extensionPayload.titleRu) score += 5;
    if (extensionPayload.descriptionUz && extensionPayload.descriptionUz.length > 50) score += 10;
    if (extensionPayload.descriptionRu && extensionPayload.descriptionRu.length > 50) score += 10;
    if (extensionPayload.brand) score += 5;
    if (extensionPayload.barcode) score += 5;
    if (extensionPayload.mxikCode) score += 10;
    if (extensionPayload.images.length >= 3) score += 10;
    else if (extensionPayload.images.length >= 1) score += 5;
    if (extensionPayload.weight > 0) score += 5;
    if (extensionPayload.height > 0 && extensionPayload.length > 0 && extensionPayload.width > 0) score += 10;
    if (extensionPayload.characteristics.length >= 8) score += 15;
    else if (extensionPayload.characteristics.length >= 5) score += 10;
    if (extensionPayload.color) score += 5;
    if (extensionPayload.categoryPath.length >= 2) score += 5;

    console.log(`📊 Uzum card quality score: ${score}/100`);
    console.log(`📋 Filled: name✅ desc✅ brand=${!!extensionPayload.brand} barcode=${!!extensionPayload.barcode} mxik=${!!extensionPayload.mxikCode} chars=${extensionPayload.characteristics.length} imgs=${extensionPayload.images.length} vgh=${extensionPayload.weight}kg`);

    return new Response(
      JSON.stringify({
        success: true,
        method: "extension_autofill",
        qualityScore: score,
        message: `AI kontent tayyor (${score}/100 ball)! Chrome Extension orqali avtomatik to'ldiriladi.`,
        card: extensionPayload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Noma'lum xato" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
