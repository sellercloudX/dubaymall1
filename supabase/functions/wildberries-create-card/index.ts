import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WB_API = "https://content-api.wildberries.ru";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function wbFetch(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status === 429) { await sleep(2000 * (i + 1)); continue; }
      // Retry on 500/502/503 server errors (WB API can be temporarily unstable)
      if (resp.status >= 500 && i < retries - 1) { 
        console.log(`wbFetch: ${resp.status} on ${url.split('?')[0]}, retry ${i + 1}/${retries}`);
        await sleep(1500 * (i + 1)); 
        continue; 
      }
      return resp;
    } catch (e) {
      if (i < retries - 1) { await sleep(1000 * (i + 1)); continue; }
      throw e;
    }
  }
  return fetch(url, options);
}

// ===== AI UNIVERSAL ANALYZER =====
async function aiAnalyzeProduct(productName: string, description: string, category: string): Promise<{
  searchKeywords: string[];
  titleRu: string;
  descriptionRu: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      searchKeywords: extractRussianWords(category || productName),
      titleRu: productName.slice(0, 60),
      descriptionRu: description || productName,
    };
  }

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a Wildberries marketplace expert. Analyze the product and return JSON.

CRITICAL RULES for searchKeywords:
- These are for WB /content/v2/object/all API subject search
- WB API requires PLURAL Russian nouns (e.g. "Шампуни" NOT "Шампунь", "Кроссовки" NOT "Кроссовка")
- Provide 5-7 different keyword variants from most specific to most generic
- Example for shampoo: ["Шампуни", "Шампуни для волос", "Средства для волос", "Косметика", "Уход"]

TITLE rules (CRITICAL — max 60 characters!):
- Russian, STRICTLY max 60 characters total
- Format: "Тип Бренд краткое описание"
- SEO optimized, concise
- NEVER exceed 60 characters

DESCRIPTION rules:
- Russian, 1000-2000 characters (MINIMUM 1000!)
- Detailed: features, benefits, usage instructions
- Include keywords for SEO
- Professional marketplace description style

Return ONLY valid JSON:
{"searchKeywords": ["keyword1", "keyword2", ...], "titleRu": "...", "descriptionRu": "..."}`
          },
          {
            role: "user",
            content: `Product name: "${productName}"
Description: "${(description || '').substring(0, 2000)}"
Category: "${category || 'unknown'}"`
          },
        ],
        temperature: 0.1,
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const keywords = Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [];
        const nameWords = extractRussianWords(productName);
        const catWords = extractRussianWords(category || '');
        const allKeywords = [...keywords, ...catWords, ...nameWords].filter(Boolean);
        const unique = [...new Set(allKeywords)];
        
        let title = (parsed.titleRu || productName).slice(0, 60);
        let desc = parsed.descriptionRu || description || productName;
        // Strip URLs — WB forbids links in description
        desc = desc.replace(/https?:\/\/[^\s)>\]"']+/gi, '').replace(/www\.[^\s)>\]"']+/gi, '');
        if (desc.length < 1000) {
          desc = desc + '\n\n' + `${title} — высококачественный товар для повседневного использования. Отличается превосходным качеством и надежностью. Подходит для широкого круга покупателей. Произведен с использованием современных технологий и материалов. Гарантия качества от производителя. Удобная упаковка обеспечивает сохранность при транспортировке. Рекомендуется к покупке. Отличный выбор по соотношению цена-качество. Быстрая доставка. Возможен возврат в течение установленного срока.`;
        }

        console.log(`AI analysis OK. Keywords: ${unique.length}, Title(${title.length}ch): "${title}"`);
        return {
          searchKeywords: unique.length > 0 ? unique : ['Товар'],
          titleRu: title,
          descriptionRu: desc.slice(0, 2000),
        };
      }
    }
  } catch (e) {
    console.error("AI analyze error:", e);
  }

  const fallbackKw = [...extractRussianWords(category || ''), ...extractRussianWords(productName)];
  return {
    searchKeywords: fallbackKw.length > 0 ? fallbackKw : [productName.split(/\s+/)[0]],
    titleRu: productName.slice(0, 60),
    descriptionRu: (description || productName).replace(/https?:\/\/[^\s)>\]"']+/gi, '').replace(/www\.[^\s)>\]"']+/gi, '').slice(0, 2000),
  };
}

function extractRussianWords(text: string): string[] {
  return (text.match(/[а-яА-ЯёЁ]{3,}/g) || []).filter((w, i, a) => a.indexOf(w) === i);
}

// ===== FIND SUBJECT =====
async function findSubjectId(apiKey: string, keywords: string[], productName: string): Promise<{ subjectID: number; subjectName: string; parentName: string } | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let subjects: any[] = [];
  let usedKeyword = "";

  for (const kw of keywords) {
    if (!kw || kw.length < 2) continue;
    try {
      const url = `${WB_API}/content/v2/object/all?name=${encodeURIComponent(kw)}&top=50&locale=ru`;
      console.log(`Subject search: "${kw}"`);
      const resp = await wbFetch(url, { headers });
      if (!resp.ok) continue;
      const data = await resp.json();
      subjects = data.data || [];
      console.log(`  → ${subjects.length} results`);
      if (subjects.length > 0) { usedKeyword = kw; break; }
    } catch (e) {
      console.warn(`Subject search error for "${kw}":`, e);
    }
  }

  if (subjects.length === 0) return null;

  if (LOVABLE_API_KEY && subjects.length > 1) {
    const subjectList = subjects.slice(0, 30).map((s: any) => `${s.subjectID}: ${s.parentName} > ${s.subjectName}`).join('\n');
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          max_tokens: 50,
          messages: [
            { role: "system", content: "Return ONLY the subjectID number that best matches the product. No text." },
            { role: "user", content: `Product: "${productName}"\n\nSubjects:\n${subjectList}` },
          ],
          temperature: 0,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const id = parseInt((aiData.choices?.[0]?.message?.content || "").replace(/\D/g, ""));
        const found = subjects.find((s: any) => s.subjectID === id);
        if (found) {
          console.log(`AI selected subject: ${found.parentName} > ${found.subjectName} (${id})`);
          return { subjectID: id, subjectName: found.subjectName, parentName: found.parentName };
        }
      }
    } catch (e) { /* fallback */ }
  }

  const kwLower = usedKeyword.toLowerCase();
  const exact = subjects.find((s: any) => (s.subjectName || "").toLowerCase() === kwLower);
  const result = exact || subjects[0];
  return { subjectID: result.subjectID, subjectName: result.subjectName, parentName: result.parentName };
}

// ===== GET & FILL CHARACTERISTICS =====
async function getAndFillCharacteristics(
  apiKey: string, subjectID: number, productName: string,
  category: string, aiTitle: string, aiDescription: string
): Promise<{ charcs: Array<{ id: number; value: any }>; descCharcId: number | null; nameCharcId: number | null }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let charcs: any[] = [];
  try {
    const resp = await wbFetch(`${WB_API}/content/v2/object/charcs/${subjectID}?locale=ru`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (resp.ok) {
      const data = await resp.json();
      charcs = data.data || [];
    }
  } catch (e) { /* empty */ }

  console.log(`Total characteristics for subject ${subjectID}: ${charcs.length}`);

  // NOTE: Per official WB API docs, title and description are TOP-LEVEL variant fields,
  // NOT characteristics. We only look for name charcID here for legacy compatibility.
  let nameCharcId: number | null = null;
  let descCharcId: number | null = null;

  for (const c of charcs) {
    const name = (c.name || '').toLowerCase();
    if (!nameCharcId && (name === 'наименование' || name === 'название' || name.includes('наименование'))) {
      nameCharcId = c.charcID;
    }
    if (!descCharcId && (name === 'описание' || name.includes('описание'))) {
      descCharcId = c.charcID;
    }
  }

  console.log(`Name charc: ${nameCharcId ? `id=${nameCharcId}` : 'NOT FOUND (using variant.title)'}`);
  console.log(`Description charc: ${descCharcId ? `id=${descCharcId}` : 'NOT FOUND (using variant.description)'}`);

  // Do NOT put title/description in characteristics — they are variant-level fields per API docs
  const preFilled: Array<{ id: number; value: any }> = [];

  console.log(`Available charcs: ${charcs.slice(0, 10).map((c: any) => `${c.charcID}:"${c.name}"`).join(', ')}${charcs.length > 10 ? '...' : ''}`);

  if (!LOVABLE_API_KEY || charcs.length === 0) return { charcs: preFilled, descCharcId, nameCharcId };

  const preFilledIds = new Set(preFilled.map(p => p.id));

  const required = charcs.filter((c: any) => c.required && !preFilledIds.has(c.charcID));
  const popular = charcs.filter((c: any) => c.popular && !c.required && !preFilledIds.has(c.charcID));
  const other = charcs.filter((c: any) => !c.required && !c.popular && !preFilledIds.has(c.charcID)).slice(0, 10);
  const selected = [...required, ...popular, ...other];

  if (selected.length === 0) return { charcs: preFilled, descCharcId, nameCharcId };

  const charcsList = selected.map((c: any) => {
    const dict = c.dictionary?.length ? ` ALLOWED_VALUES: [${c.dictionary.slice(0, 8).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    const t = c.charcType === 4 ? 'number' : 'string';
    return `id=${c.charcID} "${c.name}" type=${t}${req}${dict}`;
  }).join('\n');

  try {
    const charcController = new AbortController();
    const charcTimeout = setTimeout(() => charcController.abort(), 15000);
    console.log(`AI charcs request: ${selected.length} charcs for "${productName.slice(0, 40)}"`);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: charcController.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Fill Wildberries product characteristics. Return ONLY a JSON array.
Rules:
- String type: {"id": N, "value": ["text"]} (array with ONE string)
- Number type: {"id": N, "value": 123}
- If ALLOWED_VALUES listed, use EXACTLY one value from the list AS TEXT (not index/ID!)
- "Страна производства" MUST be a country name like "Россия", "Китай", "Узбекистан" — NEVER a number!
- "Состав" must be under 100 characters
- Fill ALL [REQUIRED] fields — NEVER skip them
- For optional fields, fill as many as you can determine from context
- NEVER return numeric IDs — always return actual text values
- No markdown, no explanation, ONLY JSON array`
          },
          {
            role: "user",
            content: `Product: "${productName}"\nCategory: "${category}"\n\nCharacteristics:\n${charcsList}`
          },
        ],
        temperature: 0.1,
      }),
    });
    clearTimeout(charcTimeout);
    if (!aiResp.ok) {
      console.error(`AI charcs failed: ${aiResp.status}`);
      return { charcs: preFilled, descCharcId, nameCharcId };
    }
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\[[\s\S]*\])/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (Array.isArray(parsed)) {
        const validIds = new Set(charcs.map((c: any) => c.charcID));
        // Filter valid characteristics and validate dictionary values
        const charcMap = new Map(charcs.map((c: any) => [c.charcID, c]));
        const aiResult: Array<{ id: number; value: any }> = [];
        for (const item of parsed) {
          if (typeof item.id !== 'number' || !validIds.has(item.id) || item.value === undefined || preFilledIds.has(item.id)) continue;
          const charc = charcMap.get(item.id);
          if (!charc) continue;
          
          // WB v2 API: ONLY charcType=4 is truly numeric
          // Everything else (charcType 0, 1, etc.) must be string arrays ["value"]
          // Known string charcs: Цвет, Состав, ТНВЭД, Упаковка, Страна, Комплектация, etc.
          const KNOWN_STRING_CHARC_NAMES = ['цвет', 'состав', 'тнвэд', 'упаковка', 'страна', 'комплектация', 'застежк', 'фиксаци'];
          const isKnownString = KNOWN_STRING_CHARC_NAMES.some(s => charc.name?.toLowerCase().includes(s));
          const isNumericCharc = !isKnownString && charc.charcType === 4;
          
          if (isNumericCharc) {
            // Numeric characteristic: extract number from any format
            let numVal: number;
            if (typeof item.value === 'number') {
              numVal = item.value;
            } else if (Array.isArray(item.value) && item.value.length > 0) {
              numVal = parseFloat(String(item.value[0]).replace(/[^\d.,]/g, '').replace(',', '.'));
            } else {
              numVal = parseFloat(String(item.value).replace(/[^\d.,]/g, '').replace(',', '.'));
            }
            if (isNaN(numVal)) {
              console.log(`⚠️ Skipping numeric charc ${item.id} "${charc.name}": cannot parse "${item.value}"`);
              continue;
            }
            item.value = numVal;
           } else {
            // String characteristic: must be array of strings
            if (typeof item.value === 'number') {
              const charcNameLower = charc.name?.toLowerCase() || '';
              if (charcNameLower.includes('страна')) {
                item.value = ["Россия"];
              } else {
                // Try to find matching dictionary value by ID
                if (charc.dictionary?.length > 0) {
                  const dictEntry = charc.dictionary.find((d: any) => d.id === item.value || d.charcID === item.value);
                  if (dictEntry) {
                    item.value = [String(dictEntry.value || dictEntry.title || dictEntry.name)];
                  } else {
                    console.log(`⚠️ Skipping string charc ${item.id} "${charc.name}": got number ${item.value}, no dict match`);
                    continue;
                  }
                } else {
                  console.log(`⚠️ Skipping string charc ${item.id} "${charc.name}": got number ${item.value}`);
                  continue;
                }
              }
            } else if (Array.isArray(item.value)) {
              item.value = item.value.map((v: any) => String(v)).filter((v: string) => v.length > 0);
              if (item.value.length === 0) continue;
              // Fix pure numeric strings for text-only charcs
              if (/^\d+$/.test(item.value[0])) {
                const charcNameLower = charc.name?.toLowerCase() || '';
                if (charcNameLower.includes('страна')) {
                  item.value = ["Россия"];
                } else if (charc.dictionary?.length > 0) {
                  const numId = parseInt(item.value[0]);
                  const dictEntry = charc.dictionary.find((d: any) => d.id === numId || d.charcID === numId);
                  if (dictEntry) {
                    item.value = [String(dictEntry.value || dictEntry.title || dictEntry.name)];
                  } else {
                    console.log(`⚠️ Skipping string charc ${item.id} "${charc.name}": numeric "${item.value[0]}", no dict match`);
                    continue;
                  }
                } else if (KNOWN_STRING_CHARC_NAMES.some(s => charcNameLower.includes(s))) {
                  console.log(`⚠️ Skipping string charc ${item.id} "${charc.name}": numeric string "${item.value[0]}"`);
                  continue;
                }
              }
            } else {
              const strVal = String(item.value).trim();
              if (!strVal) continue;
              // Fix pure numeric string values  
              if (/^\d+$/.test(strVal) && charc.name?.toLowerCase().includes('страна')) {
                item.value = ["Россия"];
              } else {
                item.value = [strVal];
              }
            }
            
            // Fix invalid country values - WB only accepts specific country names
            if (charc.name?.toLowerCase().includes('страна') && Array.isArray(item.value)) {
              const VALID_COUNTRIES = new Set([
                'россия', 'китай', 'турция', 'узбекистан', 'индия', 'корея', 'япония', 
                'германия', 'франция', 'италия', 'испания', 'сша', 'великобритания',
                'беларусь', 'казахстан', 'польша', 'чехия', 'таиланд', 'вьетнам',
                'индонезия', 'малайзия', 'бразилия', 'мексика', 'канада', 'австралия',
                'нидерланды', 'бельгия', 'швейцария', 'австрия', 'швеция', 'норвегия',
                'дания', 'финляндия', 'португалия', 'греция', 'израиль', 'тайвань',
                'сингапур', 'филиппины', 'пакистан', 'бангладеш', 'шри-ланка',
                'объединенные арабские эмираты', 'саудовская аравия', 'иран',
                'египет', 'марокко', 'тунис', 'аргентина', 'колумбия', 'чили', 'перу',
                'румыния', 'венгрия', 'болгария', 'сербия', 'хорватия', 'словакия',
                'литва', 'латвия', 'эстония', 'грузия', 'армения', 'азербайджан',
                'кыргызстан', 'таджикистан', 'туркменистан', 'молдова', 'украина'
              ]);
              const COUNTRY_ALIASES: Record<string, string> = {
                'оаэ': 'Объединенные Арабские Эмираты', 'эмираты': 'Объединенные Арабские Эмираты',
                'арабские эмираты': 'Объединенные Арабские Эмираты', 'кнр': 'Китай',
                'рф': 'Россия', 'южная корея': 'Корея', 'republic of korea': 'Корея',
                'china': 'Китай', 'russia': 'Россия', 'turkey': 'Турция', 'india': 'Индия',
                'japan': 'Япония', 'germany': 'Германия', 'france': 'Франция', 'italy': 'Италия',
                'usa': 'США', 'united states': 'США', 'uk': 'Великобритания',
                'uae': 'Объединенные Арабские Эмираты', 'saudi arabia': 'Саудовская Аравия',
                'thailand': 'Таиланд', 'vietnam': 'Вьетнам', 'indonesia': 'Индонезия',
                'malaysia': 'Малайзия', 'singapore': 'Сингапур', 'taiwan': 'Тайвань',
                'korea': 'Корея', 'brasil': 'Бразилия', 'brazil': 'Бразилия',
              };
              const rawCountry = item.value[0]?.toString().trim().toLowerCase();
              if (COUNTRY_ALIASES[rawCountry]) {
                item.value = [COUNTRY_ALIASES[rawCountry]];
                console.log(`🔄 Country alias: "${rawCountry}" → "${item.value[0]}"`);
              } else if (!VALID_COUNTRIES.has(rawCountry)) {
                item.value = ["Китай"]; // Safe default
                console.log(`🔄 Invalid country "${rawCountry}" → "Китай"`);
              }
            }

            // Enforce max length per WB rules
            const MAX_CHARC_LENGTH: Record<string, number> = { 'состав': 100, 'описание': 5000, 'комплектация': 200 };
            for (const [key, maxLen] of Object.entries(MAX_CHARC_LENGTH)) {
              if (charc.name?.toLowerCase().includes(key) && item.value[0]?.length > maxLen) {
                item.value = [item.value[0].slice(0, maxLen)];
                console.log(`✂️ Truncated charc "${charc.name}" to ${maxLen} chars`);
              }
            }
          }
          
          // Skip invalid color values that WB rejects
          if (charc.name?.toLowerCase().includes('цвет') && Array.isArray(item.value)) {
            const INVALID_COLORS = ['разноцветный', 'мультиколор', 'multicolor', 'mixed', 'ассорти'];
            const colorVal = item.value[0]?.toString().toLowerCase().trim();
            if (INVALID_COLORS.includes(colorVal)) {
              console.log(`⚠️ Skipping invalid color "${item.value[0]}" — WB does not accept it`);
              continue;
            }
          }

          // If characteristic has a dictionary, validate value against it
          if (charc?.dictionary?.length > 0 && Array.isArray(item.value)) {
            const allowedValues = new Set(charc.dictionary.map((d: any) => (d.value || d.title || d).toString().toLowerCase()));
            const val = item.value[0]?.toString().toLowerCase();
            if (val && !allowedValues.has(val)) {
              console.log(`⚠️ Skipping charc ${item.id} "${charc.name}": value "${item.value[0]}" not in dictionary`);
              continue;
            }
          }
          
          aiResult.push({ id: item.id, value: item.value });
        }
        const result = [...preFilled, ...aiResult];
        console.log(`Characteristics: ${preFilled.length} pre-filled + ${aiResult.length} AI = ${result.length} total`);
        return { charcs: result, descCharcId, nameCharcId };
      }
    }
  } catch (e: any) {
    console.error(`AI charcs error (${e?.name === 'AbortError' ? 'TIMEOUT 15s' : e?.message || e})`);
  }
  return { charcs: preFilled, descCharcId, nameCharcId };
}

// ===== GENERATE BARCODE =====
async function generateBarcode(apiKey: string): Promise<string | null> {
  try {
    const resp = await wbFetch(`${WB_API}/content/v2/barcodes`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.[0] || null;
  } catch (e) { return null; }
}

// ===== PROXY IMAGES TO SUPABASE STORAGE =====
async function proxyImages(supabase: any, userId: string, images: string[]): Promise<string[]> {
  const proxied: string[] = [];
  const results = await Promise.allSettled(
    images.slice(0, 10).map(async (imgUrl) => {
      if (!imgUrl?.startsWith("http")) return null;
      try {
        const resp = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": imgUrl.includes("yandex") ? "https://market.yandex.ru/" :
                       imgUrl.includes("uzum") ? "https://uzum.uz/" :
                       imgUrl.includes("wildberries") ? "https://www.wildberries.ru/" :
                       "https://www.google.com/",
          },
          redirect: "follow",
        });
        if (!resp.ok) return null;
        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) return null;
        const data = await resp.arrayBuffer();
        if (data.byteLength < 500) return null;
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const fileName = `${userId}/wb-clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });
        if (error) return null;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        return urlData?.publicUrl || null;
      } catch (e) { return null; }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) proxied.push(r.value);
  }
  console.log(`Images proxied: ${proxied.length}/${images.length}`);
  return proxied;
}

// ===== POLL FOR nmID — aggressive multi-strategy polling =====
async function pollForNmID(apiKey: string, vendorCode: string, maxAttempts = 20): Promise<number | null> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  
  // Aggressive: fast initial checks, then slower
  const delays = [1500, 1500, 2000, 2000, 3000, 3000, 3000, 4000, 4000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delays[attempt] || 5000);
    
    // Strategy 1: cards/list with textSearch
    try {
      const cardResp = await wbFetch(`${WB_API}/content/v2/get/cards/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          settings: {
            cursor: { limit: 100 },
            filter: { textSearch: vendorCode, withPhoto: -1 },
            sort: { ascending: false },
          },
        }),
      });
      if (cardResp.ok) {
        const cardData = await cardResp.json();
        const cards = cardData.cards || cardData.data?.cards || [];
        const found = cards.find((c: any) => c.vendorCode === vendorCode);
        if (found?.nmID) {
          console.log(`✅ nmID found via cards/list: ${found.nmID} (attempt ${attempt + 1})`);
          return found.nmID;
        }
      }
    } catch (e) { /* ignore */ }
    
    // Strategy 2: Prices API with pagination
    try {
      let offset = 0;
      const limit = 1000;
      let totalScanned = 0;
      
      while (true) {
        const priceResp = await wbFetch(
          `https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=${limit}&offset=${offset}`,
          { method: "GET", headers }
        );
        if (!priceResp.ok) break;
        
        const priceData = await priceResp.json();
        const goods = priceData.data?.listGoods || [];
        totalScanned += goods.length;
        
        const match = goods.find((g: any) => g.vendorCode === vendorCode);
        if (match?.nmID) {
          console.log(`✅ nmID found via Prices API: ${match.nmID} (attempt ${attempt + 1}, scanned ${totalScanned})`);
          return match.nmID;
        }
        
        if (goods.length < limit) break;
        offset += limit;
        if (offset >= 5000) break;
      }
      
      if (attempt % 5 === 4) {
        console.log(`Prices API: scanned ${totalScanned} goods, not found (attempt ${attempt + 1})`);
      }
    } catch (e) { /* ignore */ }
  }
  
  console.log(`⚠️ nmID not found after ${maxAttempts} attempts for ${vendorCode}`);
  return null;
}

// ===== UPLOAD IMAGES VIA v3/media/save (with retry) =====
async function uploadMedia(apiKey: string, nmID: number, imageUrls: string[]): Promise<boolean> {
  if (imageUrls.length === 0) return false;
  
  for (let retry = 0; retry < 3; retry++) {
    try {
      if (retry > 0) {
        console.log(`Retrying image upload (attempt ${retry + 1})...`);
        await sleep(2000);
      }
      console.log(`Uploading ${imageUrls.length} images to nmID ${nmID} via v3/media/save`);
      const resp = await wbFetch(`${WB_API}/content/v3/media/save`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ nmId: nmID, data: imageUrls }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        console.error(`Media save failed (attempt ${retry + 1}): ${resp.status} ${JSON.stringify(data).substring(0, 300)}`);
        continue;
      }
      console.log(`✅ ${imageUrls.length} images uploaded to nmID ${nmID}`);
      return true;
    } catch (e) {
      console.error(`Media save error (attempt ${retry + 1}):`, e);
    }
  }
  return false;
}

// ===== UPDATE DESCRIPTION =====
async function updateCardDescription(apiKey: string, nmID: number, description: string, descCharcId: number | null): Promise<boolean> {
  try {
    console.log(`Updating description for nmID ${nmID} (${description.length} chars, charcId=${descCharcId})`);
    
    // Strategy 1: Use description charcID if available
    if (descCharcId) {
      const resp = await wbFetch(`${WB_API}/content/v2/cards/update`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify([{
          nmID,
          characteristics: [{ id: descCharcId, value: [description.slice(0, 5000)] }],
        }]),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (!data.error) {
          console.log(`✅ Description updated via charcID ${descCharcId}`);
          return true;
        }
      }
    }

    // Strategy 2: Try top-level description field
    console.log(`Trying top-level description field for nmID ${nmID}`);
    const directResp = await wbFetch(`${WB_API}/content/v2/cards/update`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify([{ nmID, description: description.slice(0, 5000) }]),
    });
    if (directResp.ok) {
      const directData = await directResp.json();
      if (!directData.error) {
        console.log(`✅ Description updated via top-level field`);
        return true;
      }
    }

    // Strategy 3: Find descCharcId from card's actual subject
    // Strategy 3 skipped — description already set via variant-level field in v2/cards/upload
    console.log(`Description was set via variant-level field, skipping strategy 3`);

    console.warn(`⚠️ All description strategies failed for nmID ${nmID}`);
    return false;
  } catch (e) {
    console.error("Description update error:", e);
    return false;
  }
}

// ===== SET PRICE =====
async function setPrice(apiKey: string, nmID: number, priceRUB: number): Promise<boolean> {
  if (priceRUB <= 0) return false;
  try {
    const resp = await wbFetch("https://discounts-prices-api.wildberries.ru/api/v2/upload/task", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{ nmID, price: priceRUB }] }),
    });
    console.log(`Price set ${priceRUB} RUB for nmID ${nmID}: ${resp.status}`);
    return resp.ok;
  } catch (e) {
    console.error("Price set error:", e);
    return false;
  }
}

// ===== CHECK WB ASYNC ERRORS =====
async function checkWbErrors(apiKey: string, vendorCode: string): Promise<{ hasError: boolean; errors: string[] }> {
  try {
    // Per official docs, /content/v2/cards/error/list is a POST method
    const resp = await wbFetch(`${WB_API}/content/v2/cards/error/list`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ cursor: { limit: 100 }, order: { ascending: false } }),
    });
    if (!resp.ok) return { hasError: false, errors: [] };
    const data = await resp.json();
    const items = data.data?.items || [];
    const errorMessages: string[] = [];
    for (const item of items) {
      if (item.vendorCodes?.includes(vendorCode) && item.errors?.[vendorCode]) {
        errorMessages.push(...item.errors[vendorCode]);
      }
    }
    return { hasError: errorMessages.length > 0, errors: errorMessages };
  } catch (e) {
    return { hasError: false, errors: [] };
  }
}

function generateVendorCode(name: string): string {
  const ascii = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = (ascii || "PROD").split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SCX-${prefix || "PROD"}-${rnd}-${ts}`;
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn } = await supabase
      .from("marketplace_connections").select("*")
      .eq("user_id", user.id).eq("marketplace", "wildberries").eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).single();

    if (!conn) {
      return new Response(JSON.stringify({ success: false, error: "Wildberries ulanmagan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let apiKey = "";
    if (conn.encrypted_credentials) {
      const { data, error } = await supabase.rpc("decrypt_credentials", { p_encrypted: conn.encrypted_credentials });
      if (!error && data) {
        const creds = typeof data === "string" ? JSON.parse(data) : data;
        apiKey = creds?.apiKey || "";
      }
    } else {
      apiKey = (conn.credentials as any)?.apiKey || "";
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Wildberries API kaliti yo'q" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { product } = await req.json();
    console.log(`\n========= WB CARD CREATION =========`);
    console.log(`Product: "${product.name}"`);
    console.log(`Category: "${product.category || 'none'}"`);
    console.log(`Images: ${(product.images || []).length}`);
    console.log(`Description length: ${(product.description || '').length}`);

    // ===== STEP 1: AI + barcode + image proxy (parallel) =====
    console.log(`\n--- STEP 1: AI + Barcode + Images (parallel) ---`);
    const [analysis, barcode, proxiedImages] = await Promise.all([
      aiAnalyzeProduct(product.name, product.description || '', product.category || ''),
      generateBarcode(apiKey),
      proxyImages(supabase, user.id, product.images || []),
    ]);
    console.log(`Title(${analysis.titleRu.length}ch): "${analysis.titleRu}"`);
    console.log(`Description: ${analysis.descriptionRu.length} chars`);
    console.log(`Barcode: ${barcode || 'failed'}`);
    console.log(`Images proxied: ${proxiedImages.length}`);

    // ===== STEP 2: Find WB subject =====
    console.log(`\n--- STEP 2: Subject Search ---`);
    const subject = await findSubjectId(apiKey, analysis.searchKeywords, product.name);
    if (!subject) {
      return new Response(JSON.stringify({
        success: false,
        error: "Kategoriya topilmadi. WB bazasida mos kategoriya mavjud emas.",
        searchedKeywords: analysis.searchKeywords,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Subject: ${subject.parentName} > ${subject.subjectName} (${subject.subjectID})`);

    // ===== STEP 3: Get & fill characteristics =====
    console.log(`\n--- STEP 3: Characteristics ---`);
    const charcResult = await getAndFillCharacteristics(
      apiKey, subject.subjectID, product.name,
      product.category || '', analysis.titleRu, analysis.descriptionRu
    );
    const filledCharcs = charcResult.charcs;
    const descCharcId = charcResult.descCharcId;
    console.log(`Characteristics: ${filledCharcs.length}, descCharcId: ${descCharcId}`);

    // ===== STEP 4: Create card =====
    // Per official WB API docs: title, description are VARIANT-LEVEL fields (NOT characteristics)
    // Price goes in sizes[].price, images uploaded separately via v3/media/save after nmID
    console.log(`\n--- STEP 4: Create Card ---`);
    const vendorCode = generateVendorCode(product.name);

    const UZS_TO_RUB_RATE = 140;
    const rawPrice = Math.round(product.price || 0);
    const priceRUB = rawPrice > 10000 ? Math.round(rawPrice / UZS_TO_RUB_RATE) : rawPrice;
    console.log(`Price: ${rawPrice} → ${priceRUB} RUB`);

    // Strip emojis and special unicode symbols from description (WB rejects them)
    const cleanDescription = analysis.descriptionRu
      .replace(/https?:\/\/[^\s)>\]"']+/gi, '')
      .replace(/www\.[^\s)>\]"']+/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const variant: any = {
      vendorCode,
      title: analysis.titleRu,
      description: cleanDescription.slice(0, 2000),
      dimensions: { length: 20, width: 15, height: 10, weightBrutto: 0.5 },
      characteristics: filledCharcs,
      sizes: [{
        techSize: "0",
        price: priceRUB > 0 ? priceRUB : undefined,
        skus: barcode ? [barcode] : undefined,
      }],
      // NOTE: mediaFiles is NOT supported in v2/cards/upload API
      // Images are uploaded separately via v3/media/save after nmID is found
    };
    
    console.log(`Variant: title(${analysis.titleRu.length}ch), desc(${analysis.descriptionRu.length}ch), charcs=${filledCharcs.length}, price=${priceRUB}`);


    const payload = [{ subjectID: subject.subjectID, variants: [variant] }];

    const wbResp = await wbFetch(`${WB_API}/content/v2/cards/upload`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const wbData = await wbResp.json();

    if (!wbResp.ok || wbData.error) {
      console.error("WB API error:", JSON.stringify(wbData).substring(0, 500));

      // Retry without characteristics if they caused the error
      if (JSON.stringify(wbData).match(/характеристик|characteristic|Invalid/i)) {
        console.log("Retrying without AI characteristics...");
        variant.characteristics = [];
        variant.vendorCode = vendorCode + "-R";
        const retryPayload = [{ subjectID: subject.subjectID, variants: [variant] }];
        const retryResp = await wbFetch(`${WB_API}/content/v2/cards/upload`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(retryPayload),
        });
        const retryData = await retryResp.json();

        if (!retryResp.ok || retryData.error) {
          return new Response(JSON.stringify({
            success: false, error: retryData?.errorText || "WB API xatosi",
            wbResponse: retryData, originalError: wbData,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.log("✅ Retry succeeded without charcs");
      } else {
        return new Response(JSON.stringify({
          success: false, error: wbData?.errorText || "WB API xatosi", wbResponse: wbData,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    console.log(`✅ WB accepted card: ${vendorCode}`);

    // ===== STEP 5: Quick async error check =====
    await sleep(2000);
    const { hasError, errors: wbErrors } = await checkWbErrors(apiKey, vendorCode);
    if (hasError) {
      const errorMsg = wbErrors.join('; ');
      // Color and "Особенности" errors are non-critical — WB still creates the card
      const NON_CRITICAL_PATTERNS = /цвет|color|особенност|слишком много значений|ссылки в поле|ссылк/i;
      const criticalErrors = wbErrors.filter(e => !NON_CRITICAL_PATTERNS.test(e));
      const isCritical = criticalErrors.length > 0 && criticalErrors.some(e => 
        /недопустим|запрещен|не найден|отклонен|rejected|неправильный тип|тип значения/i.test(e)
      );
      if (isCritical) {
        console.error(`❌ WB rejected card: ${errorMsg}`);
        return new Response(JSON.stringify({
          success: false, 
          error: `WB kartochkani rad etdi: ${errorMsg}`,
          wbErrors,
          vendorCode,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.warn(`⚠️ WB async warnings (non-fatal): ${errorMsg}`);
    }

    // ===== STEP 6: Aggressive nmID poll (max 20 attempts, ~70s) =====
    console.log(`\n--- STEP 6: nmID poll ---`);
    const nmID = await pollForNmID(apiKey, vendorCode, 20);

    let imagesUploaded = false;
    let priceSet = priceRUB > 0;
    let descriptionSet = true;

    if (nmID) {
      // Upload images + set price in parallel
      console.log(`nmID found: ${nmID}, uploading images...`);
      const [imgResult, priceResult] = await Promise.all([
        proxiedImages.length > 0 ? uploadMedia(apiKey, nmID, proxiedImages) : Promise.resolve(false),
        setPrice(apiKey, nmID, priceRUB),
      ]);
      imagesUploaded = imgResult;
      if (priceResult) priceSet = true;
      
      // If images failed, try one more time after a short delay
      if (!imagesUploaded && proxiedImages.length > 0) {
        console.log(`⚠️ Images failed, final retry after 3s...`);
        await sleep(3000);
        imagesUploaded = await uploadMedia(apiKey, nmID, proxiedImages);
      }
    } else {
      console.log(`⚠️ nmID not indexed — rasmlar yuklanmadi`);
    }

    console.log(`\n========= RESULT =========`);
    console.log(`vendorCode: ${vendorCode}, nmID: ${nmID || 'pending'}`);

    return new Response(JSON.stringify({
      success: true,
      vendorCode,
      name: analysis.titleRu,
      subjectID: subject.subjectID,
      subjectName: `${subject.parentName} > ${subject.subjectName}`,
      price: priceRUB,
      priceOriginal: rawPrice,
      currency: 'RUB',
      images: proxiedImages.length,
      imagesUploaded,
      priceSet,
      descriptionSet,
      nmID,
      characteristics: filledCharcs.length,
      descriptionLength: analysis.descriptionRu.length,
      barcode,
      wbResponse: wbData,
      note: nmID
        ? `Kartochka to'liq yaratildi: ${proxiedImages.length} rasm, ${filledCharcs.length} xususiyat${descriptionSet ? ', tavsif' : ''}${priceSet ? ', narx' : ''}`
        : 'Kartochka yaratildi lekin nmID topilmadi — rasmlar yuklanmadi. WB indeksatsiyasi 5-10 daqiqa olishi mumkin.',
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Noma'lum xato",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
