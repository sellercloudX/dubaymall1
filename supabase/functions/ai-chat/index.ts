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

// System prompt focused on Dubay Mall platform and e-commerce
const PLATFORM_SYSTEM_PROMPT = `Siz Dubay Mall platformasining savdo yordamchi AI botisiz.

🎯 ASOSIY MAQSAD: Foydalanuvchilarga savdo qilishda, mahsulot sotishda va xarid qilishda yordam berish.

📌 DUBAY MALL PLATFORMASI HAQIDA:
- O'zbekistonning eng yirik onlayn savdo platformasi
- 50,000+ mahsulotlar, 5,000+ do'konlar
- O'zbek, Rus, Ingliz tillarida interfeys
- Payme, Click, Uzcard to'lov tizimlari

🛒 SOTUVCHILAR UCHUN:
- AI yordamida mahsulot qo'shish (rasm yuklash, avtomatik tavsif)
- Dropshipping - Xitoydan import qilish
- SellerCloudX - Uzum, WB, Ozon, Yandex integratsiyasi
- Moliya boshqaruvi va buyurtma kuzatuvi
- Komissiya: 3-8% (kategoriyaga qarab)

📢 BLOGGERLAR UCHUN:
- Affiliate dasturi - 10-25% komissiya
- Shaxsiy referral havolalar
- Real-time statistika
- Tez pul yechib olish

💡 SAVDO MASLAHATLARI:
- Mahsulot nomini qisqa va aniq yozing
- Sifatli rasmlar qo'ying (oq fon, yaxshi yorug'lik)
- Batafsil tavsif yozing
- Raqobatbardosh narx belgilang
- Tez javob bering va sifatli xizmat ko'rsating

QOIDALAR:
1. Faqat savdo, sotish va xarid qilish mavzularida yordam bering
2. Dubay Mall platformasi imkoniyatlarini targ'ib qiling
3. Aniq, qisqa va foydali javoblar bering
4. Agar bilmasangiz, bilmasligingizni ayting
5. Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering (UZ/RU/EN)
6. Har doim pozitiv va motivatsion bo'ling
7. Savdoni o'stirish bo'yicha maslahatlar bering`;

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

    // Build system prompt based on context
    let systemPrompt = PLATFORM_SYSTEM_PROMPT;

    if (context?.userRole === 'seller') {
      systemPrompt += `\n\n👤 KONTEKST: Foydalanuvchi SOTUVCHI. Unga quyidagilarda yordam bering:
- Do'kon boshqarish va optimizatsiya
- Mahsulot qo'shish va tahrirash
- Narx strategiyasi va raqobat tahlili
- Buyurtma va moliya boshqaruvi
- Affiliate dasturi orqali sotuvni oshirish`;
      if (context?.shopName) {
        systemPrompt += `\nUning do'koni: "${context.shopName.slice(0, 100)}"`;
      }
    } else if (context?.userRole === 'blogger') {
      systemPrompt += `\n\n👤 KONTEKST: Foydalanuvchi BLOGGER. Unga quyidagilarda yordam bering:
- Eng daromadli mahsulotlarni tanlash
- Affiliate havolalarni samarali tarqatish
- Auditoriyaga mos mahsulotlar tavsiyasi
- Komissiya hisobi va statistika
- Kontent yaratish maslahatlari`;
    } else {
      systemPrompt += `\n\n👤 KONTEKST: Foydalanuvchi XARIDOR. Unga quyidagilarda yordam bering:
- Mahsulot qidirish va tanlash
- Narxlarni solishtirish
- Xavfsiz xarid qilish
- Yetkazib berish haqida ma'lumot
- Sotuvchi yoki blogger bo'lish imkoniyatlari`;
    }

    // Try OpenAI first, then Claude, then Lovable AI as fallback
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let assistantMessage = '';
    let apiSuccess = false;

    // Try OpenAI GPT-4o-mini (fast and efficient)
    if (OPENAI_API_KEY && !apiSuccess) {
      try {
        console.log('Trying OpenAI API...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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
            console.log('OpenAI API success');
          }
        } else {
          console.error('OpenAI API error:', response.status);
        }
      } catch (err) {
        console.error('OpenAI API error:', err);
      }
    }

    // Try Claude as fallback
    if (ANTHROPIC_API_KEY && !apiSuccess) {
      try {
        console.log('Trying Anthropic Claude API...');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            system: systemPrompt,
            messages: messages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          assistantMessage = result.content?.[0]?.text || '';
          if (assistantMessage) {
            apiSuccess = true;
            console.log('Claude API success');
          }
        } else {
          console.error('Claude API error:', response.status);
        }
      } catch (err) {
        console.error('Claude API error:', err);
      }
    }

    // Try Lovable AI as final fallback
    if (LOVABLE_API_KEY && !apiSuccess) {
      try {
        console.log('Trying Lovable AI Gateway...');
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
