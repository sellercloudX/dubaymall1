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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { productName, description, category, brand, price, specifications } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Preparing Uzum card for: ${productName}`);

    const systemPrompt = `Sen Uzum Market uchun professional tovar kartochkasi tayyorlovchi yordamchisan.

Quyidagi qoidalarga amal qil:
1. Nomi: "Tovar turi + brend + model + asosiy xususiyat" formatida. Kamida 3 so'z. Bosh harf bilan boshlansin.
2. Nom UZ (lotin) va RU (kirill) da bo'lsin.
3. Qisqa tavsif (1-2 gap) UZ va RU da.
4. To'liq tavsif (5-10 gap) UZ va RU da. Tovarning afzalliklari, ishlatish usuli, materiallar haqida.
5. Kamida 5 ta xususiyat (masalan: material, o'lcham, rang, ishlab chiqaruvchi, og'irlik).
6. Taqiqlangan so'zlar: "eng yaxshi", "arzon", "chegirma", "aksiya", "top", "hit", "original", "sifatli" kabi sub'ektiv so'zlar.

MUHIM: Faqat o'zbek lotin va rus kirill alifbosida yoz. HTML teglar ishlatma.`;

    const userPrompt = `Quyidagi mahsulot uchun Uzum Market kartochkasi tayyorla:

Mahsulot nomi: ${productName}
${description ? `Tavsif: ${description}` : ''}
${category ? `Kategoriya: ${category}` : ''}
${brand ? `Brend: ${brand}` : ''}
${price ? `Narx: ${price} so'm` : ''}
${specifications ? `Xususiyatlar: ${JSON.stringify(specifications)}` : ''}

Javobni quyidagi JSON formatda ber (faqat JSON, boshqa matn yo'q):`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "uzum_card_data",
              description: "Uzum Market uchun tayyor kartochka ma'lumotlari",
              parameters: {
                type: "object",
                properties: {
                  name_uz: { type: "string", description: "Tovar nomi o'zbek tilida (lotin)" },
                  name_ru: { type: "string", description: "Tovar nomi rus tilida (kirill)" },
                  short_description_uz: { type: "string", description: "Qisqa tavsif o'zbek tilida" },
                  short_description_ru: { type: "string", description: "Qisqa tavsif rus tilida" },
                  full_description_uz: { type: "string", description: "To'liq tavsif o'zbek tilida" },
                  full_description_ru: { type: "string", description: "To'liq tavsif rus tilida" },
                  brand: { type: "string", description: "Brend nomi" },
                  properties: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name_uz: { type: "string" },
                        name_ru: { type: "string" },
                        value_uz: { type: "string" },
                        value_ru: { type: "string" },
                      },
                      required: ["name_uz", "name_ru", "value_uz", "value_ru"],
                    },
                    description: "Tovar xususiyatlari (kamida 5 ta)",
                  },
                  seo_keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "SEO kalit so'zlar (5-10 ta)",
                  },
                },
                required: ["name_uz", "name_ru", "short_description_uz", "short_description_ru", "full_description_uz", "full_description_ru", "properties"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "uzum_card_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI so'rovlar chegarasi oshdi. Biroz kutib qayta urinib ko'ring." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI krediti tugadi." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    
    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const cardData = JSON.parse(toolCall.function.arguments);

    console.log("✅ Uzum card data prepared successfully");

    return new Response(
      JSON.stringify({ success: true, card: cardData }),
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
