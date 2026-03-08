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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reviewText, productName, rating, userName, tone, marketplace, isQuestion } = await req.json();

    if (!reviewText) {
      return new Response(JSON.stringify({ error: "reviewText is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanReview = String(reviewText).slice(0, 2000);
    const cleanUser = String(userName || "").slice(0, 100);
    const toneStyle = tone === "formal" ? "rasmiy va professional" : tone === "friendly" ? "samimiy va do'stona" : "qisqa va aniq";

    // Auto-detect language from review text
    const cyrillicCount = (cleanReview.match(/[а-яА-ЯёЁ]/g) || []).length;
    const latinCount = (cleanReview.match(/[a-zA-Z]/g) || []).length;
    const uzCyrillicSpecific = (cleanReview.match(/[ўқғҳ]/gi) || []).length;
    
    let detectedLang: string;
    let langInstruction: string;
    if (uzCyrillicSpecific > 0 || (latinCount > cyrillicCount && cleanReview.match(/[oʻ']/))) {
      detectedLang = "Uzbek";
      langInstruction = "O'zbek tilida javob yoz";
    } else if (cyrillicCount > latinCount) {
      detectedLang = "Russian";
      langInstruction = "Ответ напиши на русском языке";
    } else {
      detectedLang = "Uzbek";
      langInstruction = "O'zbek tilida javob yoz";
    }

    let prompt: string;

    if (isQuestion) {
      if (detectedLang === "Russian") {
        prompt = `Ты — профессиональный помощник продавца на маркетплейсе. Твоя задача — писать ответы на вопросы покупателей.

ВАЖНЫЕ ПРАВИЛА:
- ${langInstruction}
- Тон: ${tone === "formal" ? "официальный и профессиональный" : tone === "friendly" ? "дружелюбный и теплый" : "краткий и точный"}
- Глубоко проанализируй вопрос: что именно спрашивает покупатель? О каком товаре идёт речь?
- Называй товар как "наш товар" или "данный товар", НЕ используй артикул или SKU
- Если вопрос о характеристиках — дай полезный ответ на основе контекста
- Если вопрос о доставке, возврате, гарантии — напомни правила маркетплейса
- 2-4 предложения, не более 150 слов
- Не пиши спам или рекламу
- Верни ТОЛЬКО текст ответа

МАРКЕТПЛЕЙС: ${marketplace || "marketplace"}
${cleanUser ? `ПОКУПАТЕЛЬ: ${cleanUser}` : ""}

ВОПРОС:
"${cleanReview}"

ОТВЕТ:`;
      } else {
        prompt = `Sen marketplace sotuvchisi uchun xaridorlarning savollariga javob yozuvchi mutaxassis yordamchisan.

MUHIM QOIDALAR:
- ${langInstruction}
- Ohang: ${toneStyle}
- Savolni chuqur tahlil qil: xaridor nimani so'ramoqda? Qanday mahsulot haqida gap ketmoqda?
- Mahsulotni "mahsulotimiz" yoki "ushbu mahsulot" deb nomlang, SKU yoki artikul nomini ISHLATMANG
- Agar savol mahsulot xususiyatlari haqida bo'lsa, mavjud ma'lumotlardan foydalanib javob ber
- Agar savol yetkazib berish, qaytarish, kafolat haqida bo'lsa, marketplace qoidalarini eslatib o't
- 2-4 gap, 150 so'zdan oshmasin
- Spam yoki reklama yozma
- Faqat javob matnini qaytar

MARKETPLACE: ${marketplace || "marketplace"}
${cleanUser ? `XARIDOR: ${cleanUser}` : ""}

SAVOL MATNI:
"${cleanReview}"

JAVOB:`;
      }
    } else {
      // Review-specific prompt with rating-aware behavior
      if (detectedLang === "Russian") {
        let ratingGuidance = "";
        if (rating && rating >= 4) {
          ratingGuidance = `- Это ПОЛОЖИТЕЛЬНЫЙ отзыв (${rating}/5 звёзд). Искренне поблагодари покупателя. Вырази радость, что наш товар понравился. Пригласи за новыми покупками.`;
        } else if (rating && rating === 3) {
          ratingGuidance = `- Это СРЕДНИЙ отзыв (3/5 звёзд). Поблагодари за обратную связь. Спроси, как можно улучшить товар/сервис. Покажи готовность исправить недостатки.`;
        } else if (rating && rating <= 2) {
          ratingGuidance = `- Это НЕГАТИВНЫЙ отзыв (${rating}/5 звёзд). СНАЧАЛА ИСКРЕННЕ ИЗВИНИСЬ за неприятный опыт. Покажи, что мы делаем всё возможное для решения проблемы. Предложи гарантийную замену. Постарайся вернуть доверие покупателя.`;
        }

        prompt = `Ты — профессиональный помощник продавца на маркетплейсе. Твоя задача — писать ответы на отзывы покупателей.

ВАЖНЫЕ ПРАВИЛА:
- ${langInstruction}
- Тон: ${tone === "formal" ? "официальный и профессиональный" : tone === "friendly" ? "дружелюбный и теплый" : "краткий и точный"}
${ratingGuidance}
- ${cleanUser ? `Обращайся к покупателю "${cleanUser}"` : "Обращайся к покупателю уважительно"}
- Называй товар как "наш товар" или "данный товар", НЕ используй артикул или SKU
- 2-4 предложения, не более 150 слов
- Естественный текст, как будто написано человеком
- Не пиши спам или рекламу
- Верни ТОЛЬКО текст ответа, ничего лишнего

МАРКЕТПЛЕЙС: ${marketplace || "marketplace"}
ОЦЕНКА: ${rating || "N/A"}/5
ОТЗЫВ:
"${cleanReview}"

ОТВЕТ:`;
      } else {
        let ratingGuidance = "";
        if (rating && rating >= 4) {
          ratingGuidance = `- Bu IJOBIY sharh (${rating}/5 yulduz). Xaridorga samimiy minnatdorchilik bildir. Mahsulotimizdan mamnun bo'lgani uchun xursand ekanligingni bildir. Yana xarid qilishga taklif qil.`;
        } else if (rating && rating === 3) {
          ratingGuidance = `- Bu O'RTACHA sharh (3/5 yulduz). Fikr uchun rahmat de. Qanday qilib mahsulot/xizmatni yaxshilash mumkinligini so'ra. Kamchiliklarni tuzatishga tayyor ekanligingni bildir.`;
        } else if (rating && rating <= 2) {
          ratingGuidance = `- Bu SALBIY sharh (${rating}/5 yulduz). Avvalo noqulay tajriba uchun SAMIMIY UZR SO'RA. Muammoni hal qilish uchun barcha kuchimiz bilan harakat qilayotganimizni bildir. Kafolat yoki almashtirish imkoniyatini taklif qil. Xaridorning ishonchini qaytarishga intil.`;
        }

        prompt = `Sen marketplace sotuvchisi uchun sharhlarga javob yozuvchi professional yordamchisan.

MUHIM QOIDALAR:
- ${langInstruction}
- Ohang: ${toneStyle}
${ratingGuidance}
- ${cleanUser ? `Xaridorni "${cleanUser}" deb murojaat qil` : "Xaridorga hurmat bilan murojaat qil"}
- Mahsulotni "mahsulotimiz" yoki "ushbu mahsulot" deb nomlang, SKU yoki artikul nomini ISHLATMANG
- 2-4 gap, 150 so'zdan oshmasin
- Natural va inson tomonidan yozilgandek bo'lsin
- Spam yoki reklama yozma
- Faqat javob matnini qaytar, boshqa hech narsa qo'shma

MARKETPLACE: ${marketplace || "marketplace"}
BAHO: ${rating || "N/A"}/5
SHARH MATNI:
"${cleanReview}"

JAVOB:`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log AI usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      action_type: "review_reply",
      model_used: "gemini-2.5-flash",
      tokens_input: prompt.length,
      tokens_output: reply.length,
      metadata: { marketplace, rating, detectedLang, isQuestion },
    });

    return new Response(JSON.stringify({ success: true, reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ai-review-reply error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
