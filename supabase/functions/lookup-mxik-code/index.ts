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
  relevance?: number;
}

// ===== SYNONYM DICTIONARY =====
// Maps common product names to actual terms found in MXIK database
const SYNONYMS: Record<string, string[]> = {
  // Electronics
  'смартфон': ['сотовый телефон', 'мобильный', 'телефон'],
  'smartphone': ['сотовый телефон', 'мобильный', 'телефон'],
  'telefon': ['телефон', 'сотовый', 'мобильный'],
  'smartfon': ['телефон', 'сотовый', 'мобильный'],
  'iphone': ['сотовый телефон', 'мобильный', 'телефон'],
  'samsung': ['сотовый телефон', 'мобильный', 'телефон'],
  'xiaomi': ['сотовый телефон', 'мобильный', 'телефон'],
  'ноутбук': ['портативный компьютер', 'ноутбук', 'компьютер'],
  'noutbuk': ['ноутбук', 'компьютер', 'портативный'],
  'планшет': ['планшетный компьютер', 'планшет', 'компьютер'],
  'наушники': ['наушник', 'гарнитура', 'аудио'],
  'наушник': ['наушник', 'гарнитура', 'аудио'],
  'quloqchin': ['наушник', 'гарнитура'],
  'power bank': ['зарядное устройство', 'аккумулятор', 'батарея'],
  'zaryadka': ['зарядное устройство', 'адаптер'],
  'televizor': ['телевизор', 'монитор'],
  'monitor': ['монитор', 'дисплей', 'экран'],
  
  // Footwear
  'кроссовки': ['спортивная обувь', 'обувь спортивная', 'кроссовок'],
  'krossovka': ['спортивная обувь', 'обувь', 'кроссовок'],
  'poyabzal': ['обувь', 'ботинок', 'туфля'],
  'туфли': ['туфля', 'обувь', 'полуботинок'],
  'ботинки': ['ботинок', 'обувь', 'полуботинок'],
  'сапоги': ['сапог', 'обувь', 'ботинок'],
  'кеды': ['спортивная обувь', 'обувь', 'кроссовок'],
  'сандалии': ['сандалия', 'обувь летняя', 'обувь'],
  'шлёпки': ['обувь', 'тапочка', 'шлёпанец'],
  
  // Clothing
  'футболка': ['футболка', 'одежда трикотажная', 'майка'],
  'рубашка': ['рубашка', 'одежда', 'сорочка'],
  'ko\'ylak': ['рубашка', 'одежда', 'сорочка'],
  'джинсы': ['брюки', 'джинсы', 'одежда'],
  'shim': ['брюки', 'штаны', 'одежда'],
  'куртка': ['куртка', 'одежда верхняя', 'пальто'],
  'kurtka': ['куртка', 'одежда верхняя'],
  'ko\'ylak': ['платье', 'одежда'],
  'платье': ['платье', 'одежда', 'одежда женская'],
  
  // Cosmetics & Beauty
  'крем': ['крем', 'косметическое средство', 'косметика'],
  'krem': ['крем', 'косметическое средство'],
  'шампунь': ['шампунь', 'средство для волос', 'моющее'],
  'shampun': ['шампунь', 'средство для волос'],
  'помада': ['помада', 'косметика', 'косметическое средство'],
  'духи': ['духи', 'парфюмерия', 'туалетная вода'],
  'atir': ['духи', 'парфюмерия', 'туалетная вода'],
  'parfyum': ['духи', 'парфюмерия', 'одеколон'],
  
  // Depilation & Wax
  'воскоплав': ['воскоплав', 'депиляция', 'воск', 'нагреватель воска', 'косметическое оборудование'],
  'депиляция': ['депиляция', 'воскоплав', 'воск для депиляции', 'удаление волос', 'эпиляция'],
  'эпиляция': ['эпиляция', 'депиляция', 'воскоплав', 'удаление волос'],
  'воск': ['воск для депиляции', 'воскоплав', 'депиляция', 'косметический воск'],
  'depilyatsiya': ['депиляция', 'воскоплав', 'воск', 'удаление волос'],
  'voskoplav': ['воскоплав', 'депиляция', 'нагреватель воска'],
  'qozoncha': ['воскоплав', 'нагреватель', 'кастрюля', 'посуда'],
  'mum': ['воск', 'воскоплав', 'свеча'],
  'epilyatsiya': ['эпиляция', 'депиляция', 'воскоплав'],
  
  // Hair styling
  'фен': ['фен', 'фен для волос', 'сушилка для волос', 'бытовая техника'],
  'плойка': ['плойка', 'щипцы для волос', 'стайлер', 'завивка'],
  'утюжок': ['утюжок для волос', 'выпрямитель', 'стайлер'],
  
  // Manicure / Pedicure
  'маникюр': ['маникюрный набор', 'маникюр', 'ногтевой сервис'],
  'лак': ['лак для ногтей', 'маникюр', 'косметика'],
  
  // Home
  'пылесос': ['пылесос', 'бытовая техника', 'уборочная'],
  'changyutgich': ['пылесос', 'бытовая техника'],
  'холодильник': ['холодильник', 'бытовая техника', 'морозильник'],
  'muzlatgich': ['холодильник', 'бытовая техника'],
  'стиральная машина': ['стиральная машина', 'бытовая техника'],
  'kir yuvish mashinasi': ['стиральная машина', 'бытовая техника'],
  'утюг': ['утюг', 'бытовая техника', 'гладильный'],
  'dazmol': ['утюг', 'бытовая техника'],
  'чайник': ['чайник', 'электрочайник', 'бытовая техника'],
  'сковорода': ['сковорода', 'посуда', 'кухонная'],
  'кастрюля': ['кастрюля', 'посуда', 'кухонная'],
  
  // Food
  'чай': ['чай', 'чайный'],
  'кофе': ['кофе', 'кофейный'],
  'шоколад': ['шоколад', 'кондитерское изделие'],
  'мёд': ['мед', 'мёд натуральный'],
  
  // Kids
  'игрушка': ['игрушка', 'детская', 'игрушечный'],
  'o\'yinchoq': ['игрушка', 'детская'],
  'подгузник': ['подгузник', 'памперс', 'детское'],
  'taglik': ['подгузник', 'памперс'],
  
  // Bags
  'сумка': ['сумка', 'портфель', 'чехол'],
  'sumka': ['сумка', 'портфель', 'чехол'],
  'рюкзак': ['рюкзак', 'сумка', 'портфель'],
  'ryukzak': ['рюкзак', 'сумка'],
  'чемодан': ['чемодан', 'багаж', 'дорожная сумка'],
  'chamadan': ['чемодан', 'багаж'],
  
  // Auto
  'автомобиль': ['автомобиль', 'машина', 'транспортное средство'],
  'avtomobil': ['автомобиль', 'машина'],
  'шина': ['шина', 'покрышка', 'автомобильная'],
  
  // Sports
  'гантели': ['гантель', 'спортивный инвентарь', 'тренажер'],
  'тренажер': ['тренажер', 'спортивный инвентарь'],
  'мяч': ['мяч', 'спортивный'],
  
  // Other
  'часы': ['часы', 'наручные часы', 'хронометр'],
  'soat': ['часы', 'наручные часы'],
  'очки': ['очки', 'оптика', 'солнцезащитные'],
  'ko\'zoynak': ['очки', 'оптика'],
  'книга': ['книга', 'литература', 'издание'],
  'kitob': ['книга', 'литература'],
};

// Latin Uzbek → Cyrillic transliteration
const LATIN_TO_CYRILLIC: Record<string, string> = {
  "o'": 'ў', "g'": 'ғ', 'sh': 'ш', 'ch': 'ч', 'ng': 'нг', 'yo': 'ё', 'yu': 'ю', 'ya': 'я', 'ts': 'ц',
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'j': 'ж', 'z': 'з', 'i': 'и',
  'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р', 's': 'с',
  't': 'т', 'u': 'у', 'f': 'ф', 'x': 'х', 'q': 'қ', 'h': 'ҳ',
};

function latinToCyrillic(text: string): string {
  let result = '';
  let i = 0;
  const lower = text.toLowerCase();
  while (i < lower.length) {
    if (i + 1 < lower.length) {
      const two = lower.substring(i, i + 2);
      if (LATIN_TO_CYRILLIC[two]) { result += LATIN_TO_CYRILLIC[two]; i += 2; continue; }
    }
    const one = lower[i];
    result += LATIN_TO_CYRILLIC[one] || one;
    i++;
  }
  return result;
}

// Expand search term using synonyms
function expandSearchTerms(productName: string, category?: string): string[] {
  const terms: string[] = [];
  const lowerName = productName.toLowerCase().trim();
  const words = lowerName.split(/\s+/).filter(w => w.length > 2);
  
  // Check synonyms for full name and individual words
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      terms.push(...values);
    }
    for (const word of words) {
      if (word === key || (word.length > 3 && (word.includes(key) || key.includes(word)))) {
        terms.push(...values);
      }
    }
  }
  
  // Also transliterate Latin words to Cyrillic and check synonyms
  for (const word of words) {
    if (/[a-z]/.test(word)) {
      const cyrillic = latinToCyrillic(word);
      if (cyrillic !== word && cyrillic.length > 2) {
        terms.push(cyrillic);
        // Check synonyms for transliterated word
        for (const [key, values] of Object.entries(SYNONYMS)) {
          if (cyrillic.includes(key) || key.includes(cyrillic)) {
            terms.push(...values);
          }
        }
      }
    }
  }
  
  // Category-based terms
  if (category) {
    const catLower = category.toLowerCase();
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (catLower.includes(key)) {
        terms.push(...values);
      }
    }
  }
  
  return [...new Set(terms)].filter(Boolean);
}

// Create a service_role client for MXIK DB queries (bypasses RLS for speed)
function getMxikClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Fast ILIKE search (uses GIN indexes, much faster than trigram on 273K rows)
async function ilikeSearch(db: any, term: string, limit = 10): Promise<MxikDbRow[]> {
  if (term.length < 3) return [];
  try {
    const { data } = await db
      .from('mxik_codes')
      .select('code, name_uz, name_ru, group_name, vat_rate')
      .or(`name_uz.ilike.%${term}%,name_ru.ilike.%${term}%,group_name.ilike.%${term}%`)
      .eq('is_active', true)
      .limit(limit);
    return data || [];
  } catch { return []; }
}

// ===== STEP 1: Search local DB with synonyms =====
async function searchLocalDB(
  productName: string,
  category?: string
): Promise<MxikDbRow[]> {
  const db = getMxikClient();
  const synonymTerms = expandSearchTerms(productName, category).slice(0, 5);
  
  // Run all searches in parallel
  const searches = [
    ...synonymTerms.map(t => ilikeSearch(db, t, 10)),
  ];
  
  // Also search category
  if (category) searches.push(ilikeSearch(db, category, 8));

  const results = (await Promise.all(searches)).flat();

  // Deduplicate by code
  const byCode = new Map<string, MxikDbRow>();
  for (const r of results) byCode.set(r.code, r);

  const unique = Array.from(byCode.values()).slice(0, 25);
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

  const candidates: Array<{ code: string; name_uz: string; name_ru?: string; source: string; relevance?: number }> = [];

  for (const r of dbResults) {
    candidates.push({ code: r.code, name_uz: r.name_uz, name_ru: r.name_ru || undefined, source: 'database', relevance: r.relevance });
  }

  for (const t of tasnifResults) {
    const fullName = [t.groupName, t.className, t.positionName, t.subPositionName, t.attributeName]
      .filter(Boolean).join(' > ');
    if (!candidates.some(c => c.code === t.mxikCode)) {
      candidates.push({ code: t.mxikCode, name_uz: fullName, source: 'tasnif' });
    }
  }

  if (candidates.length === 0) {
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

  // Build candidate list for AI with relevance scores
  const candidateList = candidates.slice(0, 30).map((c, i) => {
    const relStr = c.relevance ? ` (relevance: ${(c.relevance * 100).toFixed(0)}%)` : '';
    return `${i + 1}. ${c.code} — ${c.name_uz}${c.name_ru ? ` | ${c.name_ru}` : ''}${relStr} [${c.source}]`;
  }).join('\n');

  const prompt = `Mahsulot: "${productName}"
${category ? `Kategoriya: "${category}"` : ''}
${description ? `Tavsif: "${description}"` : ''}

Quyidagi RO'YXATDAN eng mos MXIK kodini tanlang.
MUHIM QOIDALAR:
1. Faqat shu ro'yxatdagi kodlardan birini tanlang! O'zingizdan kod to'qib chiqarmang!
2. Mahsulot TURINI to'g'ri aniqlang! Masalan: "воскоплав" = depilatsiya jihozi, "apteka dori vositasi" EMAS!
3. Kosmetika va go'zallik mahsulotlarini DORI-DARMON yoki FARMATSEVTIKA bilan adashtirmang!
4. Mahsulot nomi va tavsifiga qarab aniq kategoriyani tanlang.
5. "Лекарственный", "фармацевтический", "медицинский" so'zlari bor kodlarni FAQAT haqiqiy dori mahsulotlari uchun tanlang!

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
        { role: 'system', content: 'Sen MXIK kod mutaxassisizan. FAQAT berilgan ro\'yxatdagi kodlardan tanlaysan. Yangi kod to\'qib chiqarma. MUHIM: Kosmetika/go\'zallik mahsulotlarini (krem, shampun, vosk, depilyatsiya, parfyum) HECH QACHON dori-darmon yoki farmatsevtika kategoriyasiga qo\'yma! Mahsulot turini ANIQ farqla! JSON formatda javob ber.' },
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

    // STEP 1: Search local database with fuzzy RPC + synonyms
    const dbResults = await searchLocalDB(productName, category);

    // STEP 2: Search tasnif.soliq.uz API (parallel with synonym expansion)
    const synonymTerms = expandSearchTerms(productName, category);
    const searchTerms = [
      productName.slice(0, 50),
      ...synonymTerms.slice(0, 3),
      category || '',
    ].filter(Boolean);

    const allTasnif: any[] = [];
    for (const term of searchTerms) {
      if (!term || term.length < 2) continue;
      const [ruRes, uzRes] = await Promise.all([
        searchTasnif(term, 'ru'),
        searchTasnif(term, 'uz'),
      ]);
      allTasnif.push(...ruRes, ...uzRes);
      if (allTasnif.length >= 30) break;
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
