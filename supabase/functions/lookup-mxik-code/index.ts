import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TASNIF_API = 'https://tasnif.soliq.uz/api/cls-api';

interface MxikDbRow {
  code: string;
  name_uz: string;
  name_ru: string | null;
  group_name: string | null;
  vat_rate: number | null;
}

// Category keyword mapping for better MXIK search
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'elektronika': ['электрон', 'аппарат', 'прибор', 'устройств'],
  'smartfonlar': ['телефон', 'смартфон', 'мобил', 'сотовый'],
  'kompyuterlar': ['компьютер', 'ноутбук', 'монитор', 'клавиатура'],
  'kosmetika': ['косметик', 'крем', 'помада', 'тушь', 'тени'],
  'parfyumeriya': ['парфюм', 'духи', 'туалет', 'одеколон', 'аромат'],
  'go\'zallik': ['косметик', 'красот', 'уход', 'гигиен'],
  'soch parvarishi': ['шампунь', 'бальзам', 'маска', 'сочлар'],
  'teri parvarishi': ['крем', 'лосьон', 'сыворотк', 'тоник'],
  'kiyim-kechak': ['одежд', 'кийим', 'текстил', 'трикотаж'],
  'oyoq kiyim': ['обувь', 'оёқ', 'кроссов', 'туфл', 'сапог'],
  'sport': ['спорт', 'тренажер', 'фитнес'],
  'oziq-ovqat': ['продукт', 'пищев', 'озиқ', 'овқат'],
  'uy-ro\'zg\'or': ['бытов', 'домашн', 'маиший', 'посуд'],
  'bolalar uchun': ['детск', 'болалар', 'игрушк'],
  'avtomobil': ['автомобил', 'авто', 'машин', 'транспорт'],
  'qurilish': ['строител', 'қурилиш', 'инструмент'],
  'salomatlik': ['медицин', 'здоров', 'лекарств', 'витамин'],
};

// ===== STEP 1: Search local mxik_codes database =====
async function searchLocalDB(
  supabase: any,
  productName: string,
  category?: string
): Promise<MxikDbRow[]> {
  const results: MxikDbRow[] = [];

  // Build search terms — prioritize category keywords for MXIK matching
  const searchTerms: string[] = [];
  
  // Add category-specific keywords first (best for MXIK matching)
  if (category) {
    const catLower = category.toLowerCase();
    for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (catLower.includes(key) || key.includes(catLower)) {
        searchTerms.push(...keywords);
        break;
      }
    }
    searchTerms.push(category);
  }
  
  // Extract meaningful words from product name
  const cleanName = productName
    .replace(/[^a-zA-Zа-яА-ЯёЁўқғҳ\s'-]/g, ' ')
    .replace(/\b(для|с|и|в|на|от|из|к|по|без|до|за|не|ни|же|или|но|а|то|это|the|a|an|of|for|with|uchun|va|bilan|dan|ga|ning|ml|мл|г|g|шт|pcs)\b/gi, '')
    .trim();
  
  const words = cleanName.split(/\s+/).filter(w => w.length > 2);
  searchTerms.push(...words.slice(0, 6));

  // Deduplicate
  const uniqueTerms = [...new Set(searchTerms)].filter(Boolean);

  // Try ILIKE search with each term
  for (const term of uniqueTerms) {
    if (term.length < 3) continue;
    try {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name, vat_rate')
        .or(`name_uz.ilike.%${term}%,name_ru.ilike.%${term}%,group_name.ilike.%${term}%`)
        .eq('is_active', true)
        .limit(15);
      if (data?.length) results.push(...data);
    } catch (e) {
      console.log(`[MXIK DB] Search failed for "${term}"`);
    }
    if (results.length >= 30) break;
  }

  // Full-text search fallback
  if (results.length === 0 && words.length > 0) {
    const searchQuery = words.slice(0, 3).join(' & ');
    try {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name, vat_rate')
        .textSearch('search_vector', searchQuery, { type: 'plain' })
        .eq('is_active', true)
        .limit(20);
      if (data?.length) results.push(...data);
    } catch (e) {
      console.log('[MXIK DB] Full-text search failed');
    }
  }

  const unique = Array.from(new Map(results.map(r => [r.code, r])).values());
  console.log(`[MXIK DB] Found ${unique.length} results for: "${productName.substring(0, 50)}"`);
  return unique;
}

// ===== STEP 2: Search tasnif.soliq.uz API =====
async function searchTasnif(keyword: string, lang = 'ru'): Promise<any[]> {
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

// ===== STEP 3: AI selects best code =====
async function aiSelectBestCode(
  productName: string,
  category: string | undefined,
  description: string | undefined,
  dbResults: MxikDbRow[],
  tasnifResults: any[]
): Promise<{
  mxik_code: string;
  mxik_name: string;
  name_ru?: string;
  vat_rate: number;
  confidence: number;
  alternatives: Array<{ code: string; name_uz: string; name_ru?: string; confidence: number }>;
}> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const candidates: Array<{ code: string; name_uz: string; name_ru?: string; source: string }> = [];

  for (const r of dbResults) {
    candidates.push({ code: r.code, name_uz: r.name_uz, name_ru: r.name_ru || undefined, source: 'database' });
  }

  for (const t of tasnifResults) {
    const fullName = [t.groupName, t.className, t.positionName, t.subPositionName, t.attributeName]
      .filter(Boolean).join(' > ');
    if (!candidates.some(c => c.code === t.mxikCode)) {
      candidates.push({ code: t.mxikCode, name_uz: fullName, source: 'tasnif' });
    }
  }

  if (candidates.length === 0) {
    // AI fallback — generate likely code
    console.log('[MXIK] No candidates, using AI fallback');
    
    const fallbackResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Sen O\'zbekiston MXIK (IKPU) kod mutaxassisizan. Mahsulot nomi va kategoriyasi asosida eng mos MXIK kodni taklif qil. MXIK kodlar 17 xonali raqam. Faqat JSON javob ber.' },
          { role: 'user', content: `Mahsulot: "${productName}"\n${category ? `Kategoriya: "${category}"` : ''}\n${description ? `Tavsif: "${description}"` : ''}\n\nEng mos MXIK kodni 17 xonali formatda taklif qil.\nJSON: {"mxik_code":"17_digit_code","mxik_name":"nomi","vat_rate":12,"confidence":50}` },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });
    
    if (fallbackResp.ok) {
      const fbData = await fallbackResp.json();
      const fbContent = fbData.choices?.[0]?.message?.content?.trim() || '';
      const fbMatch = fbContent.match(/\{[\s\S]*\}/);
      if (fbMatch) {
        const fbResult = JSON.parse(fbMatch[0]);
        const code = String(fbResult.mxik_code || '').replace(/\D/g, '').padEnd(17, '0').slice(0, 17);
        return {
          mxik_code: code,
          mxik_name: fbResult.mxik_name || productName,
          vat_rate: fbResult.vat_rate ?? 12,
          confidence: Math.min(fbResult.confidence || 40, 60),
          alternatives: [],
        };
      }
    }
    
    return {
      mxik_code: '06912001001000000',
      mxik_name: 'Boshqa tayyor mahsulotlar',
      vat_rate: 12,
      confidence: 20,
      alternatives: [],
    };
  }

  const candidateList = candidates.slice(0, 30).map((c, i) =>
    `${i + 1}. ${c.code} — ${c.name_uz}${c.name_ru ? ` (${c.name_ru})` : ''} [${c.source}]`
  ).join('\n');

  const prompt = `Mahsulot: "${productName}"
${category ? `Kategoriya: "${category}"` : ''}
${description ? `Tavsif: "${description}"` : ''}

Quyidagi RO'YXATDAN eng mos MXIK kodini tanlang.
MUHIM: Faqat shu ro'yxatdagi kodlardan birini tanlang! O'zingizdan kod to'qib chiqarmang!

${candidateList}

JSON:
{
  "selected_index": 1,
  "mxik_code": "ro'yxatdagi kod",
  "mxik_name": "nomi",
  "name_ru": "ruscha nomi",
  "vat_rate": 12,
  "confidence": 90,
  "alternatives": [{"index": 2, "code": "kod", "name_uz": "nomi", "confidence": 75}]
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Sen MXIK kod mutaxassisizan. FAQAT berilgan ro\'yxatdagi kodlardan tanlaysan. Yangi kod to\'qib chiqarma. JSON formatda javob ber.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 400,
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    const result = JSON.parse(match[0]);
    const selectedCode = String(result.mxik_code || '');

    const isValid = candidates.some(c => c.code === selectedCode);
    if (!isValid && candidates.length > 0) {
      console.warn(`[MXIK] AI returned invalid code ${selectedCode}, using first candidate`);
      const fallback = candidates[0];
      return {
        mxik_code: fallback.code,
        mxik_name: fallback.name_uz,
        name_ru: fallback.name_ru,
        vat_rate: 12,
        confidence: 60,
        alternatives: candidates.slice(1, 4).map(c => ({
          code: c.code, name_uz: c.name_uz, name_ru: c.name_ru, confidence: 50,
        })),
      };
    }

    return {
      mxik_code: selectedCode,
      mxik_name: result.mxik_name || productName,
      name_ru: result.name_ru || undefined,
      vat_rate: result.vat_rate ?? 12,
      confidence: Math.min(result.confidence || 70, 99),
      alternatives: (result.alternatives || []).slice(0, 5)
        .map((a: any) => {
          const altCode = String(a.code || '');
          if (!candidates.some(c => c.code === altCode)) return null;
          return { code: altCode, name_uz: a.name_uz || '', name_ru: a.name_ru, confidence: Math.min(a.confidence || 50, 95) };
        })
        .filter(Boolean),
    };
  }

  const fallback = candidates[0];
  return {
    mxik_code: fallback.code,
    mxik_name: fallback.name_uz,
    name_ru: fallback.name_ru,
    vat_rate: 12,
    confidence: 50,
    alternatives: candidates.slice(1, 4).map(c => ({
      code: c.code, name_uz: c.name_uz, name_ru: c.name_ru, confidence: 40,
    })),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productName, category, description } = await req.json();
    if (!productName) {
      return new Response(JSON.stringify({ error: 'productName is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[MXIK] Looking up:', productName, category ? `(${category})` : '');

    // STEP 1: Search local database
    const dbResults = await searchLocalDB(supabase, productName, category);

    // STEP 2: Search tasnif.soliq.uz API
    const cleanName = productName
      .replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, ' ')
      .replace(/\b(для|с|и|в|на|от|из|к|по|без|до|за|не|ни|же|или|но|а|то|это)\b/gi, '')
      .trim();
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    
    // Also add category keywords to tasnif search
    const categoryTerms: string[] = [];
    if (category) {
      const catLower = category.toLowerCase();
      for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (catLower.includes(key) || key.includes(catLower)) {
          categoryTerms.push(...keywords.slice(0, 2));
          break;
        }
      }
    }
    
    const searchTerms = [
      ...categoryTerms,
      productName.slice(0, 50),
      words.slice(0, 3).join(' '),
      words.slice(0, 2).join(' '),
      words[0] || '',
      category || '',
    ].filter(Boolean);

    const allTasnif: any[] = [];
    for (const term of searchTerms) {
      if (!term) continue;
      const [ruRes, uzRes] = await Promise.all([
        searchTasnif(term, 'ru'),
        searchTasnif(term, 'uz'),
      ]);
      allTasnif.push(...ruRes, ...uzRes);
      if (allTasnif.length >= 30) break; // Don't over-search
    }
    const uniqueTasnif = Array.from(new Map(allTasnif.map(i => [i.mxikCode, i])).values());

    console.log(`[MXIK] DB: ${dbResults.length}, Tasnif: ${uniqueTasnif.length}`);

    // STEP 3: AI selects best code
    const result = await aiSelectBestCode(productName, category, description, dbResults, uniqueTasnif);

    console.log('[MXIK] Result:', result.mxik_code, result.mxik_name, 'confidence:', result.confidence);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MXIK] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
