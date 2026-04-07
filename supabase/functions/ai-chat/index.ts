import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// System prompt focused on SellerCloudX platform
const PLATFORM_SYSTEM_PROMPT = `Siz SellerCloudX platformasining savdo yordamchi AI botisiz.

🎯 ASOSIY MAQSAD: Foydalanuvchilarga marketplace avtomatizatsiyasi, mahsulot boshqaruvi va analitika bo'yicha yordam berish.

📌 SELLERCLOUDX PLATFORMASI HAQIDA:
- O'zbekistonning #1 marketplace avtomatizatsiya platformasi
- Uzum, Yandex Market, Wildberries, Ozon integratsiyasi
- AI-quvvatli kartochka yaratish va optimallashtirish
- ABC-analiz, PnL hisoboti, narx optimallashtirish

🛒 IMKONIYATLAR:
- Multi-marketplace boshqaruv (bitta dashboard)
- AI Scanner Pro - rasm yuklash va avtomatik kontent yaratish
- Real-vaqt moliya va analitika
- Inventarizatsiya auditi va stok monitoring
- Narx himoyasi va smart narxlash
- Kartochka sifat auditi va SEO optimallashtirish

QOIDALAR:
1. Faqat marketplace savdo va avtomatizatsiya mavzularida yordam bering
2. SellerCloudX platformasi imkoniyatlarini targ'ib qiling
3. Aniq, qisqa va foydali javoblar bering
4. Agar bilmasangiz, bilmasligingizni ayting
5. Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering (UZ/RU/EN)
6. Har doim pozitiv va motivatsion bo'ling`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 30 requests per hour per user
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCount } = await adminSupabase
      .from('ai_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action_type', 'ai-chat')
      .gte('created_at', oneHourAgo);

    if ((recentCount || 0) >= 30) {
      return new Response(
        JSON.stringify({ error: 'Soatiga 30 ta so\'rov limiti. Keyinroq urinib ko\'ring.', success: false }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Billing check — AI Chat is now paid (3,000 UZS base)
    const { data: billingCheck } = await adminSupabase.rpc('check_feature_access', {
      p_user_id: user.id,
      p_feature_key: 'ai-chat',
    });

    const bc = billingCheck as any;
    if (bc && !bc.allowed) {
      return new Response(
        JSON.stringify({ 
          error: bc.error === 'insufficient_balance' 
            ? `Balans yetarli emas (${bc.balance?.toLocaleString() || 0} so'm). AI Chat narxi: ${bc.price?.toLocaleString() || 3000} so'm`
            : bc.message || 'Ruxsat berilmadi',
          billingError: bc.error,
          success: false 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct balance for AI Chat
    if (bc?.price > 0) {
      await adminSupabase.rpc('deduct_balance', {
        p_user_id: user.id,
        p_amount: bc.price,
        p_feature_key: 'ai-chat',
        p_description: 'AI Chat xabari',
      });
    }

    // Log usage
    await adminSupabase.from('ai_usage_log').insert({
      user_id: user.id,
      action_type: 'ai-chat',
      model_used: 'gemini-2.5-flash-lite',
    });

    const body = await req.json();
    
    // Input validation
    const messages = body.messages as ChatMessage[];
    const context = body.context as { userRole?: string; shopName?: string } | undefined;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message structure and limit
    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many messages', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: 'Invalid message role', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (typeof msg.content !== 'string' || msg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: 'Invalid message content', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate context
    if (context) {
      if (context.userRole && !['seller', 'admin'].includes(context.userRole)) {
        return new Response(
          JSON.stringify({ error: 'Invalid user role', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (context.shopName && (typeof context.shopName !== 'string' || context.shopName.length > 200)) {
        return new Response(
          JSON.stringify({ error: 'Invalid shop name', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build system prompt based on context
    let systemPrompt = PLATFORM_SYSTEM_PROMPT;

    if (context?.userRole === 'seller') {
      systemPrompt += `\n\n👤 KONTEKST: Foydalanuvchi SOTUVCHI. Unga quyidagilarda yordam bering:
- Marketplace boshqarish va optimizatsiya
- Mahsulot kartochkalarini yaratish va tahrirash
- Narx strategiyasi va raqobat tahlili
- Buyurtma va moliya boshqaruvi
- ABC-analiz va PnL hisobotlari
- Inventarizatsiya auditi`;
      if (context?.shopName) {
        systemPrompt += `\nUning do'koni: "${context.shopName.slice(0, 100)}"`;
      }
    } else {
      systemPrompt += `\n\n👤 KONTEKST: Foydalanuvchi SellerCloudX platformasidan foydalanmoqda. Marketplace avtomatizatsiya bo'yicha yordam bering.`;
    }

    // Cost-optimized: Lovable AI only (no OpenAI/Claude)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let assistantMessage = '';
    let apiSuccess = false;

    if (LOVABLE_API_KEY) {
      try {
        console.log('Using Lovable AI (gemini-2.5-flash-lite)...');
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          assistantMessage = result.choices?.[0]?.message?.content || '';
          if (assistantMessage) {
            apiSuccess = true;
            console.log('Lovable AI success');
          }
        } else {
          console.error('Lovable AI error:', response.status);
        }
      } catch (err) {
        console.error('Lovable AI error:', err);
      }
    }

    if (!apiSuccess || !assistantMessage) {
      console.error('All AI APIs failed');
      return new Response(JSON.stringify({ 
        message: 'Kechirasiz, hozir javob bera olmayapman. Keyinroq urinib ko\'ring.',
        success: false 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Chat error:', err);
    return new Response(JSON.stringify({ 
      message: 'Kechirasiz, hozir javob bera olmayapman. Keyinroq urinib ko\'ring.',
      success: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
