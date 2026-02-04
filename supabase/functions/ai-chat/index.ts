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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      if (context.userRole && !['seller', 'blogger', 'buyer', 'admin'].includes(context.userRole)) {
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service unavailable', success: false }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt based on context
    let systemPrompt = `Siz SuperEshop Hub platformasining yordamchi AI botisiz. 
Siz O'zbek, Rus va Ingliz tillarida javob bera olasiz. Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering.

SuperEshop Hub - bu O'zbekiston va Markaziy Osiyo uchun e-commerce platforma. 

Platformada quyidagi imkoniyatlar mavjud:
- Sotuvchilar uchun: Do'kon yaratish, mahsulot qo'shish (AI orqali, qo'lda, dropshipping import)
- Bloggerlar uchun: Affiliate dasturi, komissiya olish, mahsulotlarni reklama qilish
- Xaridorlar uchun: Marketplace, savatcha, buyurtma berish

Qoidalar:
1. Doim iltifat bilan javob bering
2. Aniq va qisqa javob bering
3. Agar bilmasangiz, bilmasligingizni ayting
4. Foydalanuvchiga yordam berishga harakat qiling`;

    if (context?.userRole === 'seller') {
      systemPrompt += `\n\nFoydalanuvchi sotuvchi. Unga do'kon boshqarish, mahsulot qo'shish, narx belgilash, affiliate dasturi haqida yordam bering.`;
      if (context?.shopName) {
        systemPrompt += `\nUning do'koni: ${context.shopName.slice(0, 100)}`;
      }
    } else if (context?.userRole === 'blogger') {
      systemPrompt += `\n\nFoydalanuvchi blogger. Unga affiliate dasturi, komissiya hisoblash, mahsulotlarni tanlash haqida yordam bering.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return new Response(JSON.stringify({ 
        message: 'Kechirasiz, hozir javob bera olmayapman. Keyinroq urinib ko\'ring.',
        success: false 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await response.json();
    const assistantMessage = aiResult.choices?.[0]?.message?.content || 'Kechirasiz, javob bera olmadim.';

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
