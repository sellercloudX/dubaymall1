import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminPerm } = await supabase
      .from('admin_permissions')
      .select('is_super_admin, can_manage_users')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
      return new Response(JSON.stringify({ error: 'Admin ruxsati yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { message, partnerId, context } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'message kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI sozlanmagan' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build context about partner
    let partnerContext = '';
    if (partnerId) {
      const [profileRes, connectionsRes, costPricesRes, subsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone').eq('user_id', partnerId).maybeSingle(),
        supabase.from('marketplace_connections').select('marketplace, products_count, orders_count, total_revenue, is_active').eq('user_id', partnerId).eq('is_active', true),
        supabase.from('marketplace_cost_prices').select('marketplace, offer_id, cost_price').eq('user_id', partnerId).limit(50),
        supabase.from('sellercloud_subscriptions').select('plan_type, is_active, activated_until, commission_percent').eq('user_id', partnerId).order('created_at', { ascending: false }).limit(1),
      ]);

      const profile = profileRes.data;
      const connections = connectionsRes.data || [];
      const costPrices = costPricesRes.data || [];
      const sub = subsRes.data?.[0];

      partnerContext = `
TANLANGAN HAMKOR:
- Ism: ${profile?.full_name || 'Noma\'lum'}
- Telefon: ${profile?.phone || '—'}
- Obuna: ${sub?.plan_type || 'yo\'q'} (${sub?.is_active ? 'Faol' : 'Nofaol'})
- Marketplace ulanishlar: ${connections.map(c => `${c.marketplace} (${c.products_count} mahsulot, ${c.orders_count} buyurtma)`).join(', ') || 'yo\'q'}
- Tannarx kiritilgan: ${costPrices.length} ta mahsulot
`;
    }

    // Previous scan context
    let scanContext = '';
    if (context?.scanResults) {
      const results = context.scanResults;
      scanContext = `\nOXIRGI SKAN NATIJALARI:\n`;
      for (const r of results) {
        scanContext += `- ${r.marketplace}: ${r.totalProducts} mahsulot, o'rtacha ball ${r.avgScore}, ${r.criticalCount} kritik, ${r.warningCount} ogohlantirish\n`;
      }
    }
    if (context?.priceData) {
      scanContext += `\nNARX MA'LUMOTLARI:\n- Jami: ${context.priceData.summary?.totalProducts}, O'rtacha marja: ${context.priceData.summary?.avgMargin}%, Xavfli: ${context.priceData.summary?.riskyCount}\n`;
    }

    const systemPrompt = `Sen SellerCloudX AI Agent assistantisan. Admin bilan gaplashasan va marketplace hamkorlarini boshqarishda yordam berasan.

IMKONIYATLARING:
1. Kartochka audit — mahsulot kartochkalarini skanerlash va muammolarni aniqlash
2. Kartochka tuzatish — AI yordamida nom, tavsif, parametrlarni yaxshilash va API orqali marketplace'ga yuborish
3. Rasm tahlili — rasm sifatini baholash (0-100 ball)
4. Rasm generatsiya — AI orqali professional 1080x1440 rasm yaratish va marketplace'ga yuklash (yangi rasm 1-chi o'ringa)
5. Narx optimallashtirish — tannarx + harajatlar + 10-15% marja asosida optimal narx hisoblash
6. Narx qo'llash — marketplace API orqali narxlarni yangilash

NARX FORMULASI (muhim!):
OptimalNarx = (Tannarx + Logistika) / (1 - (Komissiya% + Soliq4% + MaqsadliMarja%))
- Joriy narxga nisbatan marja qo'shish XATO!
- Tannarx asosida absolyut hisoblash TO'G'RI
- Narxni juda ko'tarish = sotuv tushadi (raqobatchilar past narxda)
- Narxni juda tushirish = zarar

${partnerContext}
${scanContext}

Javobni o'zbek tilida ber. Aniq, qisqa va amaliy bo'l. Agar admin biror amal bajarishni so'rasa, qanday qadamlar kerakligini tushuntir.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...(context?.chatHistory || []),
          { role: "user", content: message },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'AI rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'AI kredit tugadi' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Javob yo\'q';

    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent chat error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
