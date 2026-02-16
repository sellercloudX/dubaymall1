import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TASNIF_API = 'https://tasnif.soliq.uz/api/cls-api';

interface TasnifItem {
  mxikCode: string;
  groupName: string;
  className: string;
  positionName: string;
  subPositionName: string;
  attributeName: string;
  lgotaId: number;
}

// Search tasnif.soliq.uz with timeout
async function searchTasnif(keyword: string, lang = 'ru'): Promise<TasnifItem[]> {
  try {
    const url = `${TASNIF_API}/elasticsearch/search?search=${encodeURIComponent(keyword)}&size=15&page=0&lang=${lang}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(tid);
    
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.content || [];
  } catch {
    return [];
  }
}

// AI-powered MXIK lookup — uses knowledge of real MXIK codes + tasnif API as primary source
async function aiLookupMxik(
  productName: string,
  category?: string,
  description?: string,
  tasnifResults?: TasnifItem[]
): Promise<{
  mxik_code: string;
  mxik_name: string;
  name_ru?: string;
  vat_rate: number;
  confidence: number;
  alternatives: Array<{ code: string; name_uz: string; name_ru?: string; confidence: number }>;
}> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  let tasnifContext = '';
  if (tasnifResults && tasnifResults.length > 0) {
    tasnifContext = `\n\nQuyidagi natijalar tasnif.soliq.uz dan olingan rasmiy MXIK kodlar ro'yxati:
${tasnifResults.slice(0, 20).map((item, i) => 
  `${i + 1}. ${item.mxikCode} — ${[item.groupName, item.className, item.positionName, item.subPositionName, item.attributeName].filter(Boolean).join(' > ')}`
).join('\n')}

Yuqoridagi ro'yxatdan eng mosini tanlang. Agar ro'yxatda mos kod bo'lmasa, o'zingiz bilgan rasmiy MXIK kodini bering.`;
  }

  const prompt = `Siz O'zbekiston Soliq qo'mitasining MXIK (IKPU) kod tizimini mukammal biladigan mutaxassiz.
tasnif.soliq.uz saytidagi barcha MXIK kodlarni bilasiz.

Mahsulot: "${productName}"
${category ? `Kategoriya: "${category}"` : ''}
${description ? `Tavsif: "${description}"` : ''}
${tasnifContext}

MUHIM QOIDALAR:
1. MXIK kodi 17 raqamdan iborat bo'ladi (masalan: 10811001003000000)
2. Faqat tasnif.soliq.uz da mavjud bo'lgan HAQIQIY kodlarni bering
3. Mahsulotga AYNAN mos kelgan eng aniq kodni tanlang
4. Umumiy kodlardan foydalanmang — eng spetsifik kodni toping
5. Agar tasnif natijalarida mos kod bo'lsa, UNI tanlang

Masalan:
- Smartfon -> 06812001001000000 (Mobil telefonlar)
- Poyabzal -> 06401002001000000 (Poyafzallar)
- Kir yuvish mashinasi -> 10811001003000000 (Kir yuvish mashinalari)
- Changyutgich -> 10811001001000000 (Changyutgichlar)

Javobni FAQAT JSON formatida bering:
{
  "mxik_code": "17 raqamli kod",
  "mxik_name": "Mahsulot nomi o'zbek tilida",
  "name_ru": "Nomi rus tilida",
  "vat_rate": 12,
  "confidence": 85,
  "alternatives": [
    {"code": "17 raqamli kod", "name_uz": "Boshqa variant nomi", "name_ru": "Русское название", "confidence": 70}
  ]
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    const result = JSON.parse(match[0]);
    return {
      mxik_code: String(result.mxik_code || ''),
      mxik_name: result.mxik_name || productName,
      name_ru: result.name_ru || undefined,
      vat_rate: result.vat_rate ?? 12,
      confidence: Math.min(result.confidence || 70, 99),
      alternatives: (result.alternatives || []).slice(0, 5).map((a: any) => ({
        code: String(a.code || ''),
        name_uz: a.name_uz || '',
        name_ru: a.name_ru || undefined,
        confidence: Math.min(a.confidence || 50, 95),
      })),
    };
  }

  throw new Error('Failed to parse AI response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productName, category, description } = await req.json();
    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'productName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MXIK] Looking up:', productName);

    // Extract meaningful keywords (remove brand/model noise)
    const cleanName = productName
      .replace(/[^a-zA-Zа-яА-ЯёЁa-zA-Z\s]/g, ' ')
      .replace(/\b(для|с|и|в|на|от|из|к|по|без|до|за|не|ни|же|или|но|а|то|это)\b/gi, '')
      .trim();
    
    // Extract category-level keyword (first 2-3 meaningful words)
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    const searchTerms = [
      productName.slice(0, 50), // full name (truncated)
      words.slice(0, 3).join(' '), // first 3 words
      category || '',
    ].filter(Boolean);

    // Step 1: Try tasnif.soliq.uz API with multiple search terms
    const allResults: TasnifItem[] = [];
    for (const term of searchTerms) {
      if (!term) continue;
      const [ruRes, uzRes] = await Promise.all([
        searchTasnif(term, 'ru'),
        searchTasnif(term, 'uz'),
      ]);
      allResults.push(...ruRes, ...uzRes);
    }

    const unique = Array.from(new Map(allResults.map(i => [i.mxikCode, i])).values());
    console.log('[MXIK] Tasnif results:', unique.length, 'from', searchTerms.length, 'queries');

    // Step 2: AI determines best MXIK code (using tasnif results if available)
    const result = await aiLookupMxik(productName, category, description, unique.length > 0 ? unique : undefined);
    
    console.log('[MXIK] Result:', result.mxik_code, result.mxik_name, 'confidence:', result.confidence);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MXIK] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
