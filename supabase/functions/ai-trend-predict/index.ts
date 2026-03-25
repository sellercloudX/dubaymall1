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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 per hour
    const { count } = await supabase
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action_type", "trend-prediction")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Soatiga 5 ta bashoratdan ortiq bo'lmaydi. Keyinroq urinib ko'ring." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { category, period = 14 } = await req.json();

    const categoryFilter = category ? `\nFAQAT "${category}" kategoriyasiga tegishli mahsulotlarni tahlil qil.` : '';
    const currentDate = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const prompt = `Sen professional e-commerce import/export analitikasan. Sening vazifang — Xitoydan O'zbekistonga import qilish uchun eng foydali va trendga chiqayotgan FIZIK MAHSULOTLARNI topish.

Hozirgi sana: ${currentDate} (${currentMonth})
Bashorat muddati: ${period} kun
${categoryFilter}

## SEN NIMA QILISHING KERAK:

1. HOZIRDA dunyo bozorida (Amazon, TikTok Shop, AliExpress, Temu) eng ko'p sotilayotgan, viral bo'layotgan yoki tez o'sish trendidagi FIZIK mahsulotlarni aniqla.

2. Bu mahsulotlarning O'zbekiston bozorida hali KAM tarqalgani yoki UMUMAN yo'qligini tekshir.

3. Har bir mahsulot uchun ANIQ XITOY OPTOM HAVOLALARNI ber — foydalanuvchi ssilkani bossa, 1688.com yoki alibaba.com saytida AYNAN SHU TURDAGI mahsulotni ko'rishi kerak.

## QOIDALAR:

- FAQAT Xitoydan import qilsa arziydigan mahsulotlar (elektronika, gadgetlar, uy-ro'zg'or buyumlari, aksessuarlar, go'zallik vositalari, sport anjomlari, bolalar uchun tovarlar, avto aksessuarlar)
- HECH QACHON oziq-ovqat, meva, sabzavot, jam, konserva, ichimlik taklif QILMA
- HECH QACHON dori-darmon, tibbiy asbob, kimyoviy moddalar taklif QILMA
- Har bir mahsulot uchun HAQIQIY bozor narxlarini ber (O'zbekiston so'mida)
- Xitoy optom narxini HAQIQIY ko'rsat (1688.com yoki Alibaba narxi asosida)
- O'zbekistonga yetkazib berish xarajatini hisobga ol (taxminan 3-5 USD/kg havo yo'li, 1-2 USD/kg temir yo'l)
- Import bojxona solig'i 12-30% oralig'ida ekanligini hisobga ol
- Kamida 8-10 ta TURLI kategoriyadan mahsulot ber

## HAVOLALAR QOIDASI (JUDA MUHIM):

1688.com havolasi: https://s.1688.com/selloffer/offer_search.htm?keywords=XITOYCHA_KALIT_SO'Z
- Kalit so'z ALBATTA XITOY TILIDA bo'lishi kerak (masalan: 无线耳机, 智能手表, LED灯带)
- URL encode qilingan bo'lishi kerak

Alibaba havolasi: https://www.alibaba.com/trade/search?SearchText=INGLIZCHA_KALIT_SO'Z
- Kalit so'z INGLIZ TILIDA bo'lishi kerak (masalan: wireless earbuds, smart watch, LED strip lights)

## MISOL MAHSULOTLAR (lekin bular emas, hozirgi trendlarni top):
- Smart gadgetlar (mini proyektor, portativ monitor, TWS quloqchin yangi modellari)
- TikTok'da viral bo'lgan uy buyumlari (LED chirog'lar, organayzerlar)
- Sport va salomatlik (smart soat aksessuarlari, fitness asboblar)
- Go'zallik texnologiyalari (mikrotokli yuz massajyor, LED maska)
- Bolalar uchun innovatsion o'yinchoqlar

Kamida 8-10 ta real trend mahsulotlarni aniqla va tavsiya qil.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Sen professional Xitoy-O'zbekiston import analitikasan. Faqat FIZIK, import qilsa arziydigan mahsulotlarni tavsiya qil. Oziq-ovqat, dori, kimyo TAQIQLANGAN. Har bir mahsulot uchun 1688.com (xitoycha kalit so'z bilan) va Alibaba (inglizcha kalit so'z bilan) havolalarini ALBATTA ber. Narxlar REAL bo'lishi kerak."
          },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "trend_predictions",
            description: "Import uchun trend mahsulotlar bashorati",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string", description: "Mahsulot nomi o'zbek tilida (masalan: Simsiz Bluetooth quloqchin TWS)" },
                      category: { type: "string", description: "Kategoriya (Elektronika, Uy jihozlari, Go'zallik, Sport va h.k.)" },
                      demand_score: { type: "number", description: "Talab darajasi 1-100 (100 = juda yuqori talab)" },
                      price_min: { type: "number", description: "O'zbekistonda sotish narxi MIN (so'mda)" },
                      price_max: { type: "number", description: "O'zbekistonda sotish narxi MAX (so'mda)" },
                      china_price_usd: { type: "number", description: "Xitoy optom narxi (USD da, 1 dona uchun)" },
                      monthly_sales_estimate: { type: "number", description: "O'zbekistonda oyiga taxminan necha dona sotilishi mumkin" },
                      net_profit_potential: { type: "number", description: "Sof foyda potentsiali so'mda (oylik, logistika va soliq chegirib)" },
                      competition_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      trend_direction: { type: "string", enum: ["tez_o'sish", "sekin_o'sish", "barqaror", "mavsumiy"] },
                      reason: { type: "string", description: "Nima uchun hozir trend (TikTok viral, Amazon bestseller, yangi texnologiya va h.k.)" },
                      best_time_to_enter: { type: "string", description: "Qachon bozorga kirish yaxshi" },
                      risk_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      global_trend_data: { type: "string", description: "Dunyo bozorida qanday trend: Amazon ranking, TikTok views, Google Trends" },
                      source_links: {
                        type: "array",
                        description: "Xitoy optom saytlaridan xarid qilish havolalari (kamida 2 ta: 1688.com va Alibaba)",
                        items: {
                          type: "object",
                          properties: {
                            platform: { type: "string", description: "1688.com, Alibaba, AliExpress" },
                            url: { type: "string", description: "To'liq havola (1688 uchun xitoycha, Alibaba uchun inglizcha kalit so'z)" },
                            price_range: { type: "string", description: "Optom narx oralig'i (masalan: $2.5-$8.0 / dona)" },
                          },
                          required: ["platform", "url", "price_range"],
                        },
                      },
                    },
                    required: ["product_name", "category", "demand_score", "price_min", "price_max", "china_price_usd", "monthly_sales_estimate", "net_profit_potential", "competition_level", "trend_direction", "reason", "source_links"],
                  },
                },
                market_summary: {
                  type: "object",
                  properties: {
                    overall_trend: { type: "string", description: "Umumiy bozor holati va trend yo'nalishi" },
                    hot_categories: { type: "array", items: { type: "string" }, description: "Eng issiq kategoriyalar" },
                    seasonal_factors: { type: "string", description: "Mavsumiy omillar va tavsiyalar" },
                    recommendation: { type: "string", description: "Yangi sotuvchilarga strategik tavsiya" },
                  },
                },
              },
              required: ["predictions", "market_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "trend_predictions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI xizmati band. Biroz kutib turing." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI kreditlari tugagan." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error: " + response.status);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let predictions: any = null;
    if (toolCall?.function?.arguments) {
      try {
        predictions = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        throw new Error("AI javobini o'qib bo'lmadi");
      }
    }

    if (!predictions?.predictions?.length) {
      throw new Error("AI natija bermadi, qaytadan urinib ko'ring");
    }

    // Log usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      action_type: "trend-prediction",
      model_used: "gemini-3-flash-preview",
      metadata: { category, period },
    });

    return new Response(JSON.stringify({
      success: true,
      ...predictions,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Trend prediction error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Noma'lum xatolik",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
