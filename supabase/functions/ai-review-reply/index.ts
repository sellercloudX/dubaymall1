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

    const { reviewText, productName, rating, userName, language, tone, marketplace } = await req.json();

    if (!reviewText) {
      return new Response(JSON.stringify({ error: "reviewText is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate inputs
    const cleanReview = String(reviewText).slice(0, 2000);
    const cleanProduct = String(productName || "").slice(0, 200);
    const cleanUser = String(userName || "Xaridor").slice(0, 100);
    const lang = language === "ru" ? "Russian" : "Uzbek";
    const toneStyle = tone === "formal" ? "rasmiy va professional" : tone === "friendly" ? "samimiy va do'stona" : "qisqa va aniq";

    // Build AI prompt
    const prompt = `Sen marketplace sotuvchisi uchun sharhlarga javob yozuvchi yordamchisan.

QOIDALAR:
- Javobni ${lang} tilida yoz
- Ohang: ${toneStyle}
- 2-4 gap, 150 so'zdan oshmasin
- Xaridorni ismi bilan murojaat qil (agar bor bo'lsa)
- ${rating && rating >= 4 ? "Ijobiy sharh uchun minnatdorchilik bildir, mahsulotni yana tavsiya qil" : ""}
- ${rating && rating <= 2 ? "Salbiy tajriba uchun uzr so'ra, muammoni hal qilishga tayyor ekanligingni bildir. Kafolatni eslatib o'tish mumkin." : ""}
- ${rating && rating === 3 ? "Fikr uchun rahmat de, mahsulotni yaxshilash uchun fikrlarini so'ra" : ""}
- Marketplace nomi: ${marketplace || "marketplace"}
- Spam yoki reklama yozma
- Faqat javob matnini qaytar, boshqa hech narsa qo'shma

MAHSULOT: ${cleanProduct}
XARIDOR: ${cleanUser}
BAHO: ${rating || "N/A"}/5
SHARH MATNI:
"${cleanReview}"

JAVOB:`;

    // Call Lovable AI (Gemini Flash for speed)
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
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API error:", aiResp.status, errText);
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
      model_used: "gemini-3-flash-preview",
      tokens_input: prompt.length,
      tokens_output: reply.length,
      metadata: { marketplace, rating, language },
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
