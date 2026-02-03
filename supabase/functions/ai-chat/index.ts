import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { messages, context } = await req.json() as { 
      messages: ChatMessage[]; 
      context?: { userRole?: string; shopName?: string };
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
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
        systemPrompt += `\nUning do'koni: ${context.shopName}`;
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
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error('AI xizmatida xatolik');
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
    const errorMessage = err instanceof Error ? err.message : 'Noma\'lum xatolik';
    console.error('Chat error:', errorMessage);
    return new Response(JSON.stringify({ 
      message: 'Kechirasiz, hozir javob bera olmayapman. Keyinroq urinib ko\'ring.',
      success: false,
      error: errorMessage 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
