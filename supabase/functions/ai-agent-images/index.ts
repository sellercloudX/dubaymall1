import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 420) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
        continue;
      }
      return response;
    } catch (e) {
      if (attempt < maxRetries - 1) { await sleep(1000 * (attempt + 1)); continue; }
      throw e;
    }
  }
  return fetch(url, options);
}

// =====================================================
// STOP WORDS — taqiqlangan sub'ektiv/reklama so'zlari
// =====================================================
const STOP_WORDS = [
  'eng yaxshi', 'лучший', 'best', 'arzon', 'дешёвый', 'cheap',
  'chegirma', 'скидка', 'discount', 'aksiya', 'акция', 'sale',
  'top', 'hit', 'хит', 'original', 'оригинал', 'sifatli', 'качественный',
  'quality', 'premium quality', 'super', 'mega', 'exclusive', 'эксклюзив',
  'number 1', '№1', '#1', 'guaranteed', 'гарантированно', 'kafolat',
  'free', 'бесплатно', 'bepul', 'wow', 'amazing', 'perfect',
  'идеальный', 'mukammal', 'unique', 'уникальный', 'noyob',
  'mashxur', 'mashhur', 'машхур', 'популярный', 'popular', 'famous',
  'top seller', 'top product', 'bestseller', 'бестселлер', 'хит продаж',
];

function sanitizeStopWords(text: string): string {
  let result = text;
  for (const word of STOP_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
  }
  return result;
}

// =====================================================
// CATEGORY STYLE MAP — Pinterest-level design direction
// =====================================================
const CATEGORY_STYLES: Record<string, {
  visual_style: string;
  background_style: string;
  color_palette: string;
  prompt_addition: string;
}> = {
  perfume: {
    visual_style: "Luxury perfume editorial photography — Dior Sauvage / Chanel campaign level",
    background_style: "Deep moody gradient (navy-to-charcoal or dark blue-to-black) with bokeh light particles, glass reflections, and decorative flowers (white peonies, jasmine, orchids) arranged artistically",
    color_palette: "Deep navy, midnight blue, champagne gold, pearl white, matte black",
    prompt_addition: `PERFUME-SPECIFIC PINTEREST RULES:
- Background: Rich moody dark blue/navy gradient with soft bokeh particles and decorative white/pastel flowers
- Lighting: Dramatic side-lighting with glass reflections and lens flare accents
- Product placement: Bottle prominently displayed with cap visible, slight 15° angle
- Typography: Elegant serif font for product name (large), sans-serif for feature badges
- Feature badges: Rounded pill-shaped badges with frosted glass effect (e.g. "Стойкий аромат", "Длинный шлейф", "48 часов стойкость")  
- Volume badge: Circle badge at bottom with volume (e.g. "50 мл", "100 мл") with rotating text border
- Decorative elements: Scattered flower petals, water droplets on glass surface, golden sparkle accents
- Mood: Sensual, sophisticated, magazine-cover quality
- NO plain backgrounds, NO flat colors, NO generic templates`,
  },
  beauty: {
    visual_style: "High-end beauty campaign — Clinique / La Roche-Posay editorial",
    background_style: "Soft luminous pastel gradient (blush pink-to-cream or lavender-to-white) with shimmer particles and soft petal accents",
    color_palette: "Blush pink, pearl white, soft gold, lavender, cream",
    prompt_addition: `BEAUTY-SPECIFIC PINTEREST RULES:
- Background: Soft dreamy pastel gradient with light shimmer/glitter particles
- Lighting: Soft beauty lighting — even, flattering, no harsh shadows
- Product: Center-focused with soft reflection underneath, pristine clean look
- Typography: Modern elegant sans-serif, feminine styling
- Feature badges: Soft rounded badges with glass-morphism effect on pastel backgrounds
- Decorative: Rose petals, water drops, pearl accents, soft fabric drapes
- Mood: Clean, fresh, luxurious self-care
- NO harsh contrasts, NO dark backgrounds, NO masculine elements`,
  },
  electronics: {
    visual_style: "Modern tech product launch — Apple / Samsung campaign style",
    background_style: "Dark gradient (charcoal-to-black or deep blue-to-dark) with subtle tech grid lines and blue glow accents",
    color_palette: "Deep charcoal, electric blue, silver metallic, pure white accent",
    prompt_addition: `ELECTRONICS-SPECIFIC PINTEREST RULES:
- Background: Dark sleek gradient with subtle geometric grid or circuit pattern
- Lighting: Dramatic edge-lighting highlighting product contours, blue/white rim light
- Product: Hero shot with slight perspective angle, floating shadow effect
- Typography: Bold modern sans-serif (tech feel), specs in clean monospace
- Feature badges: Sharp-cornered badges with neon/electric blue glow borders
- Spec highlights: Key specs in large bold numbers (e.g. "4K", "120Hz", "5000 mAh")
- Mood: Cutting-edge, innovative, powerful
- NO pastel colors, NO floral elements, NO romantic styling`,
  },
  fashion: {
    visual_style: "Lifestyle fashion editorial — Zara / H&M lookbook",
    background_style: "Warm neutral gradient (beige-to-cream or sand-to-ivory) with fabric texture hints",
    color_palette: "Warm beige, sand, ivory, soft caramel, muted olive",
    prompt_addition: `FASHION-SPECIFIC PINTEREST RULES:
- Background: Warm neutral tones with subtle fabric/linen texture
- Lighting: Natural soft window-light feel, warm color temperature
- Product: Lifestyle presentation (laid flat or styled on minimal surface)
- Typography: Trendy mix of serif headline + clean sans-serif details
- Feature badges: Minimalist rounded rectangles with warm neutral tones
- Fabric/material call-outs: "100% хлопок", "Натуральная кожа" in elegant styling
- Mood: Effortless chic, Instagram-worthy, modern lifestyle
- NO neon colors, NO tech elements, NO dark moody backgrounds`,
  },
  household: {
    visual_style: "Fresh clean lifestyle — Method / Mrs. Meyer's campaign",
    background_style: "Bright clean gradient (white-to-light blue or mint-to-white) with water splash or freshness cues",
    color_palette: "Fresh mint, clean white, sky blue, bright green, ocean teal",
    prompt_addition: `HOUSEHOLD-SPECIFIC PINTEREST RULES:
- Background: Bright airy gradient with water droplets or bubble accents
- Lighting: High-key bright lighting, ultra clean feel
- Product: Clean product shot with water splash or freshness visual
- Typography: Clean rounded sans-serif, friendly and trustworthy
- Feature badges: Round or oval badges with fresh blue/green tones
- Trust indicators: "Безопасно для детей", "Экологичный" with leaf/water icons
- Mood: Fresh, trustworthy, family-safe
- NO dark tones, NO luxury styling, NO complex compositions`,
  },
  food: {
    visual_style: "Appetizing food photography — Whole Foods / premium packaging",
    background_style: "Warm natural backdrop (rustic wood, marble surface, or warm gradient) with ingredient scatter",
    color_palette: "Warm amber, natural green, rich brown, appetizing red, golden honey",
    prompt_addition: `FOOD-SPECIFIC PINTEREST RULES:
- Background: Warm rustic surface (wood, marble, stone) or warm gradient with ingredient scatter
- Lighting: Warm golden-hour style lighting, appetizing glow
- Product: Slightly angled, packaging clearly visible, some ingredients scattered artistically
- Typography: Warm rounded font, handwritten accent text
- Feature badges: Organic-shaped badges with natural tones (kraft paper look)
- Call-outs: "Натуральный состав", "Без ГМО" with leaf/wheat icons
- Mood: Mouth-watering, natural, wholesome
- NO cold blue tones, NO tech aesthetics, NO sterile look`,
  },
  kids: {
    visual_style: "Playful colorful — Fisher-Price / LEGO campaign energy",
    background_style: "Bright playful gradient with confetti, stars, or balloon accents",
    color_palette: "Sunny yellow, sky blue, candy pink, grass green, bright orange",
    prompt_addition: `KIDS-SPECIFIC PINTEREST RULES:
- Background: Bright cheerful multi-color gradient with playful elements (stars, confetti, clouds)
- Lighting: Bright even lighting, happy and energetic
- Product: Fun angle, playful composition, surrounded by colorful accents
- Typography: Rounded bubbly font, playful and readable
- Feature badges: Fun-shaped badges (star, cloud, circle) with bright fills
- Safety call-outs: "Безопасно для детей", "От 3+ лет" with child-friendly icons
- Mood: Fun, safe, exciting, parent-approved
- NO dark colors, NO serious styling, NO minimalism`,
  },
  sport: {
    visual_style: "Dynamic fitness advertising — Nike / Under Armour energy",
    background_style: "Bold energetic gradient (dark-to-vibrant) with motion blur and energy lines",
    color_palette: "Power black, energy red, electric green, dynamic orange, metallic silver",
    prompt_addition: `SPORT-SPECIFIC PINTEREST RULES:
- Background: Bold dark-to-vibrant gradient with speed lines or energy particles
- Lighting: Dramatic high-contrast, strong rim light
- Product: Dynamic angle suggesting motion, powerful composition
- Typography: Ultra-bold condensed sans-serif, high-impact
- Feature badges: Sharp angular badges with bold colors
- Performance specs: "Дышащий материал", "Ультра лёгкий" with dynamic styling
- Mood: Powerful, motivating, performance-driven
- NO soft pastels, NO romantic elements, NO delicate styling`,
  },
  default: {
    visual_style: "Professional marketplace advertising — clean commercial",
    background_style: "Clean gradient (light gray-to-white or subtle blue-to-white) with professional studio feel",
    color_palette: "Professional blue, clean white, subtle gray, accent gold",
    prompt_addition: `DEFAULT PROFESSIONAL RULES:
- Background: Clean studio gradient, professional and versatile
- Lighting: Even professional studio lighting
- Product: Clean centered composition with soft shadow
- Typography: Modern clean sans-serif
- Feature badges: Rounded rectangle badges with professional colors
- Mood: Trustworthy, professional, marketplace-ready
- NO overly creative backgrounds, NO category-specific themes`,
  },
};

function getCategoryStyle(category: string): typeof CATEGORY_STYLES.default {
  const cat = (category || '').toLowerCase();
  if (cat.includes('parfum') || cat.includes('perfum') || cat.includes('atir') || cat.includes('духи') || cat.includes('парфюм') || cat.includes('fragrance') || cat.includes('eau de')) return CATEGORY_STYLES.perfume;
  if (cat.includes('kosmet') || cat.includes('beauty') || cat.includes('косметик') || cat.includes('go\'zal') || cat.includes('крем') || cat.includes('уход')) return CATEGORY_STYLES.beauty;
  if (cat.includes('elektr') || cat.includes('techni') || cat.includes('gadget') || cat.includes('электрон') || cat.includes('texnik') || cat.includes('телефон') || cat.includes('наушник')) return CATEGORY_STYLES.electronics;
  if (cat.includes('kiyim') || cat.includes('fashion') || cat.includes('одежд') || cat.includes('мода') || cat.includes('обувь') || cat.includes('poyabzal') || cat.includes('сумк')) return CATEGORY_STYLES.fashion;
  if (cat.includes('tozala') || cat.includes('household') || cat.includes('бытов') || cat.includes('чист') || cat.includes('uy')) return CATEGORY_STYLES.household;
  if (cat.includes('oziq') || cat.includes('food') || cat.includes('еда') || cat.includes('продукт') || cat.includes('ovqat')) return CATEGORY_STYLES.food;
  if (cat.includes('bolalar') || cat.includes('kids') || cat.includes('детск') || cat.includes('игруш') || cat.includes('o\'yinchoq')) return CATEGORY_STYLES.kids;
  if (cat.includes('sport') || cat.includes('спорт') || cat.includes('fitness') || cat.includes('fitnes')) return CATEGORY_STYLES.sport;
  return CATEGORY_STYLES.default;
}

// =====================================================
// STEP 1: Product + Category Detection (GPT-4o Vision)
// =====================================================
async function detectProductCategory(imageUrl: string, apiKey: string): Promise<any> {
  console.log("🔍 STEP 1: Product & Category Detection (GPT-4o Vision)...");

  let imageContent: any;
  if (imageUrl.startsWith('data:')) {
    imageContent = { type: "image_url", image_url: { url: imageUrl, detail: "high" } };
  } else {
    imageContent = { type: "image_url", image_url: { url: imageUrl, detail: "high" } };
  }

  const resp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `You are a professional e-commerce visual classifier.

Analyze this product image and determine:
1. Main product category
2. Sub-category
3. Target audience
4. Market positioning (budget / mid-range / premium)
5. Recommended advertising style
6. Recommended background style
7. Recommended color palette
8. Product name (best guess in Russian/Uzbek)
9. Key selling features (3-5 items)

Return ONLY valid JSON:
{
  "category": "",
  "sub_category": "",
  "target_audience": "",
  "positioning": "",
  "visual_style": "",
  "background_style": "",
  "color_palette": "",
  "product_name": "",
  "key_features": []
}` },
          imageContent
        ]
      }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    console.error(`GPT-4o Vision detection failed: ${resp.status}`);
    return null;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`✅ STEP 1 Done: category="${result.category}", positioning="${result.positioning}"`);
      return result;
    }
  } catch (e) {
    console.error("JSON parse error in detection:", e);
  }
  return null;
}

// =====================================================
// STEP 2: Image Quality Scan (GPT-4o Vision)
// =====================================================
async function scanImageQuality(imageUrl: string, apiKey: string): Promise<any> {
  console.log("🔎 STEP 2: Image Quality Scan (GPT-4o Vision)...");

  const resp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Analyze this product image for marketplace compliance.

Check:
- Background quality (clean, professional?)
- Lighting (even, no harsh shadows?)
- Sharpness (crisp details?)
- Object centering (product centered?)
- Shadow quality (natural, soft?)
- Brand visibility (labels readable?)
- Commercial readiness (marketplace-ready?)

Return ONLY valid JSON:
{
  "background": "good/poor/acceptable",
  "lighting": "good/poor/acceptable",
  "sharpness": "good/poor/acceptable",
  "composition": "good/poor/acceptable",
  "issues": ["list of specific issues"],
  "compliance_score": 0-100,
  "fix_required": true/false
}` },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
        ]
      }],
      max_tokens: 400,
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    console.error(`Quality scan failed: ${resp.status}`);
    return { compliance_score: 50, fix_required: true, issues: ["Scan failed"] };
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`✅ STEP 2 Done: score=${result.compliance_score}, fix_required=${result.fix_required}`);
      return result;
    }
  } catch (e) {
    console.error("JSON parse error in quality scan:", e);
  }
  return { compliance_score: 50, fix_required: true, issues: ["Parse error"] };
}

// =====================================================
// STEP 3: Auto Image Fix (OpenAI gpt-image-1)
// =====================================================
async function autoFixImage(imageUrl: string, issues: string[], apiKey: string): Promise<string | null> {
  console.log("🔧 STEP 3: Auto Image Fix (OpenAI gpt-image-1)...");
  console.log(`Issues to fix: ${issues.join(', ')}`);

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) {
    console.error("Failed to download image for fixing");
    return null;
  }

  const fixPrompt = `Transform this product photo into a professional marketplace-ready image.

Fix these specific issues: ${issues.join('; ')}

Requirements:
- Clean white or category-appropriate background
- Improve sharpness and clarity
- Fix lighting to be even and professional
- Center the product perfectly
- Add soft realistic shadow underneath
- Maintain real proportions — do NOT distort the product
- The product itself must remain PIXEL-PERFECT UNCHANGED (same shape, colors, labels, brand text, packaging)
- Commercial studio quality result
- No artificial or AI-generated look
- No text, watermarks, or decorative elements added
- Resolution: 1080x1440 portrait orientation`;

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), "product.png");
  formData.append("model", "gpt-image-1");
  formData.append("prompt", fixPrompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "high");

  const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Auto fix failed (${resp.status}): ${errText.substring(0, 300)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log("✅ STEP 3 Done: Image fixed"); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log("✅ STEP 3 Done: Image fixed (URL)"); return url; }
  return null;
}

// =====================================================
// STEP 4: Category-Based Marketplace Card (OpenAI gpt-image-1)
// =====================================================
async function generateMarketplaceCard(
  imageUrl: string,
  detection: any,
  categoryStyle: typeof CATEGORY_STYLES.default,
  apiKey: string,
  variationSeed: number = 0
): Promise<string | null> {
  console.log("🎨 STEP 4: Category-Based Marketplace Card Generation...");

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) {
    console.error("Failed to download image for card generation");
    return null;
  }

  const productName = sanitizeStopWords(detection?.product_name || 'Product');
  const rawFeatures = detection?.key_features?.slice(0, 5)?.join(', ') || 'Yuqori sifat, Tez yetkazib berish';
  const cleanFeatures = sanitizeStopWords(rawFeatures);
  const category = detection?.category || '';
  const positioning = detection?.positioning || 'mid-range';

  // Anti-repetition: vary layout based on seed
  const layoutVariations = [
    "Product on the LEFT side (40%), feature badges floating on the RIGHT (60%). Large headline at TOP-LEFT. Volume/price badge at BOTTOM-RIGHT.",
    "Product CENTERED (50%), feature badges arranged in a curved arc AROUND the product. Decorative elements fill corners. Brand badge at TOP-LEFT.",
    "Product at RIGHT side (45%), large bold headline and stacked feature badges on LEFT. Category-specific decorative border.",
    "Product BOTTOM-CENTER (50%), dramatic headline at TOP spanning full width. Feature badges as horizontal strip in MIDDLE section.",
    "Product at LEFT-CENTER with dramatic 15° tilt, feature list as vertical stack on RIGHT with icons. Circular volume badge at BOTTOM-LEFT.",
    "Split composition: TOP 40% is bold headline + decorative bg, BOTTOM 60% is product + feature badges arranged around it.",
  ];
  const layoutHint = layoutVariations[variationSeed % layoutVariations.length];

  // Badge text — NO stop words, neutral descriptors only
  const badgeText = positioning === 'premium' ? '⭐ TANLOV' : '📦 YANGI';

  const cardPrompt = `You are an elite commercial graphic designer creating a HIGH-CONVERTING Pinterest/Behance-level marketplace product infographic.

FORMAT: 1080x1440 vertical (3:4 portrait ratio).

═══════════════════════════════════
PRODUCT INTELLIGENCE
═══════════════════════════════════
Product: ${productName}
Category: ${category}
Positioning: ${positioning}
Key features: ${cleanFeatures}
Badge: ${badgeText}

═══════════════════════════════════
VISUAL DIRECTION (CATEGORY-SPECIFIC)
═══════════════════════════════════
Style: ${categoryStyle.visual_style}
Background: ${categoryStyle.background_style}  
Palette: ${categoryStyle.color_palette}

${categoryStyle.prompt_addition}

═══════════════════════════════════
LAYOUT COMPOSITION
═══════════════════════════════════
${layoutHint}

═══════════════════════════════════
MANDATORY DESIGN RULES
═══════════════════════════════════
1. PRODUCT INTEGRITY: The product from the reference photo must remain 100% PIXEL-PERFECT — same shape, colors, labels, brand logos, packaging. DO NOT modify, redraw, or reinterpret the product.

2. BACKGROUND: Rich, layered, category-themed background (NEVER plain white, NEVER flat solid color). Use gradients, bokeh, decorative elements (flowers, particles, textures) as shown in category rules above.

3. FEATURE BADGES (3-5 pieces): 
   - Rounded pill/oval shaped with frosted glass or solid colored background
   - Each badge has a small icon + short text in RUSSIAN (2-4 words max)
   - Examples: "💧 Стойкий аромат", "📦 30 мл", "🎁 Подарочная упаковка"
   - Badges float around the product with soft shadow
   - Text must be PERFECTLY READABLE, no distortion

4. HEADLINE: Large bold text in RUSSIAN at top or prominent position. Describes the product type (e.g. "Парфюмерная вода", "Смартфон", "Крем для лица"). NOT the brand name.

5. TYPOGRAPHY: All text must be sharp, professional, properly kerned. Use maximum 2 font families. NO AI-garbled text, NO random characters, NO misspelled words.

6. VOLUME/SIZE BADGE: Circular badge showing key spec (volume in мл, size, weight) with decorative circular text border.

7. COMPOSITION: Strong visual hierarchy — eye flows from headline → product → features → volume badge. Professional spacing, nothing cramped.

8. LIGHTING: Dramatic, category-appropriate (moody for perfume, bright for household, warm for food).

9. COMMERCIAL QUALITY: This must be indistinguishable from a real design agency output. Think Pinterest top pins, Behance featured projects, Wildberries bestseller cards.

═══════════════════════════════════
BANNED ELEMENTS (NEVER INCLUDE)
═══════════════════════════════════
- Words: "лучший", "топ", "хит продаж", "оригинал", "качественный", "скидка", "акция", "бесплатно", "№1", "идеальный", "уникальный", "эксклюзив", "super", "mega", "best", "top seller", "number one", "популярный", "машхур", "mashxur", "famous"
- Generic white/plain backgrounds
- Distorted or AI-garbled text
- Watermarks or logos not on the original product  
- Clip-art or cartoon-style icons
- More than 5 feature badges
- Cyrillic text errors or mixed alphabets in same badge

VARIATION SEED: #${variationSeed} — Create a UNIQUE design, not a template copy.`;

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), "product.png");
  formData.append("model", "gpt-image-1");
  formData.append("prompt", cardPrompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "high");

  const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Card generation failed (${resp.status}): ${errText.substring(0, 300)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log("✅ STEP 4 Done: Marketplace card generated"); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log("✅ STEP 4 Done: Card generated (URL)"); return url; }
  return null;
}

// =====================================================
// STEP 4b: Supplementary Images (Features, Angles, Use-cases)
// =====================================================
const SUPPLEMENTARY_PROMPTS: { role: string; promptFn: (det: any, catStyle: typeof CATEGORY_STYLES.default) => string }[] = [
  {
    role: "feature_highlight",
    promptFn: (det, catStyle) => {
      const productName = sanitizeStopWords(det?.product_name || 'Product');
      const feats = (det?.key_features || []).slice(0, 4).map((f: string) => sanitizeStopWords(f));
      return `Create a FEATURE HIGHLIGHT infographic for "${productName}".

FORMAT: 1080x1440 vertical (3:4 portrait ratio).

This is image #2 in a product gallery — it FOCUSES on key features and specifications.

DESIGN:
- Background: ${catStyle.background_style}
- Style: ${catStyle.visual_style}
- The product should be shown at 30-40% size, positioned to one side
- The remaining 60% should be filled with LARGE, clear feature call-outs
- Each feature gets its own section with:
  • A relevant icon (emoji or simple graphic)
  • Feature name in RUSSIAN (bold, 2-3 words)
  • Short explanation (1 line, smaller text)
- Features to highlight: ${feats.join(', ')}
- Use connecting lines or arrows from features to relevant product parts
- Professional infographic layout like on Pinterest top pins

RULES:
- Product must remain PIXEL-PERFECT from reference photo
- ALL text in RUSSIAN, perfectly readable, no AI-garbled characters
- NO stop words: "лучший", "топ", "хит", "популярный", "оригинал", "скидка"
- NO plain white background
- Commercial design agency quality`;
    }
  },
  {
    role: "angle_closeup",
    promptFn: (det, catStyle) => {
      const productName = sanitizeStopWords(det?.product_name || 'Product');
      return `Create a CLOSE-UP / DETAIL VIEW infographic for "${productName}".

FORMAT: 1080x1440 vertical (3:4 portrait ratio).

This is image #3 — it shows the product from a DIFFERENT ANGLE or ZOOMED IN on key details.

DESIGN:
- Background: ${catStyle.background_style}
- Style: ${catStyle.visual_style}
- Show the product LARGER than usual (60-70% of frame)
- Slight creative angle: 20-30° rotation, or perspective view
- Add 2-3 ZOOM BUBBLES highlighting key details (texture, material, label, buttons etc.)
- Each zoom bubble has a thin elegant border and a short RUSSIAN label
- Subtle depth-of-field effect — sharp product, slightly blurred background elements
- Professional product photography feel

RULES:
- Product must remain PIXEL-PERFECT from reference photo
- ALL text in RUSSIAN, perfectly readable
- NO stop words: "лучший", "топ", "хит", "популярный", "оригинал", "скидка"
- NO plain white background
- Magazine editorial quality`;
    }
  },
  {
    role: "lifestyle_usecase",
    promptFn: (det, catStyle) => {
      const productName = sanitizeStopWords(det?.product_name || 'Product');
      const audience = det?.target_audience || 'general consumer';
      return `Create a LIFESTYLE / USE-CASE scene for "${productName}".

FORMAT: 1080x1440 vertical (3:4 portrait ratio).

This is image #4 — it shows HOW the product is USED in real life.

DESIGN:
- The product should be shown in a realistic usage context/environment
- Target audience: ${audience}
- Background: A contextual lifestyle scene (NOT studio background). Examples:
  • Perfume → elegant vanity table, evening setting
  • Electronics → modern desk setup, hands holding device
  • Beauty → bathroom shelf, skincare routine scene
  • Food → kitchen counter, dining table
  • Fashion → styled outfit flat-lay
- The product is the HERO but surrounded by lifestyle props
- Add 1-2 minimal text overlays in RUSSIAN: product category name and one key benefit
- Warm, inviting, aspirational mood — like a lifestyle brand Instagram post
- Soft natural lighting

RULES:
- Product must remain PIXEL-PERFECT from reference photo
- ALL text in RUSSIAN, perfectly readable
- NO stop words: "лучший", "топ", "хит", "популярный", "оригинал", "скидка"
- Commercial lifestyle photography quality
- The scene should feel REAL, not AI-generated`;
    }
  },
];

async function generateSupplementaryImage(
  imageUrl: string,
  detection: any,
  categoryStyle: typeof CATEGORY_STYLES.default,
  apiKey: string,
  promptIndex: number
): Promise<string | null> {
  const suppPrompt = SUPPLEMENTARY_PROMPTS[promptIndex % SUPPLEMENTARY_PROMPTS.length];
  console.log(`🖼 STEP 4.${promptIndex + 1}: Generating ${suppPrompt.role} image...`);

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) return null;

  const prompt = suppPrompt.promptFn(detection, categoryStyle);

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), "product.png");
  formData.append("model", "gpt-image-1");
  formData.append("prompt", prompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "high");

  const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`${suppPrompt.role} generation failed (${resp.status}): ${errText.substring(0, 200)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log(`✅ ${suppPrompt.role} generated`); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log(`✅ ${suppPrompt.role} generated (URL)`); return url; }
  return null;
}

// =====================================================
// STEP 5: AI Quality Control (GPT-4o)
// =====================================================
async function qualityControl(imageUrl: string, apiKey: string): Promise<any> {
  console.log("🏆 STEP 5: AI Quality Control (GPT-4o)...");

  const resp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `You are a senior marketplace conversion and compliance expert.

Evaluate this marketplace product card image.

Score each (0-100):
- design_quality: Overall visual design
- visual_hierarchy: Layout clarity and information flow
- conversion_strength: How likely to generate clicks/sales
- marketplace_compliance: Meets Uzum/Yandex/WB standards

If any score below 85, provide EXACT improvement instructions.

Return ONLY valid JSON:
{
  "design_quality": 0-100,
  "visual_hierarchy": 0-100,
  "conversion_strength": 0-100,
  "marketplace_compliance": 0-100,
  "overall_score": 0-100,
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "pass": true/false
}` },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
        ]
      }],
      max_tokens: 400,
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    console.error(`Quality control failed: ${resp.status}`);
    return { overall_score: 70, pass: false, improvements: ["QC scan failed"] };
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`✅ STEP 5 Done: overall=${result.overall_score}, pass=${result.pass}`);
      return result;
    }
  } catch (e) {
    console.error("JSON parse in QC:", e);
  }
  return { overall_score: 70, pass: false, improvements: ["Parse error"] };
}

// =====================================================
// HELPERS
// =====================================================
async function downloadImage(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:')) {
      const base64Content = url.replace(/^data:image\/\w+;base64,/, '');
      return Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    }
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    console.error("Download image error:", e);
    return null;
  }
}

async function uploadToStorage(supabase: any, imageSource: string, partnerId: string, productId: string): Promise<string | null> {
  try {
    let bytes: Uint8Array;
    if (imageSource.startsWith('http')) {
      const resp = await fetch(imageSource);
      if (!resp.ok) return null;
      bytes = new Uint8Array(await resp.arrayBuffer());
    } else if (imageSource.startsWith('data:')) {
      const base64Content = imageSource.replace(/^data:image\/\w+;base64,/, '');
      bytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    } else {
      bytes = Uint8Array.from(atob(imageSource), c => c.charCodeAt(0));
    }

    const fileName = `ai-agent/${partnerId}/${productId}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

    if (error) { console.error("Storage upload error:", error); return null; }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    console.log("✅ Uploaded:", urlData?.publicUrl?.substring(0, 80));
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

// ===== Marketplace upload helpers =====
async function uploadToYandex(credentials: any, offerId: string, newImageUrl: string): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) return { success: false, message: 'Business ID topilmadi' };

  const getResp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
    { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId] }) }
  );

  let existingPictures: string[] = [];
  if (getResp.ok) {
    const getData = await getResp.json();
    existingPictures = getData.result?.offerMappings?.[0]?.offer?.pictures || [];
  }

  const allPictures = [newImageUrl, ...existingPictures];
  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
    { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: { offerId, pictures: allPictures } }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: `Yangi rasm 1-chi o'ringa qo'yildi (jami ${allPictures.length} ta)` };
}

async function uploadToWildberries(credentials: any, nmID: number, newImageUrl: string): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v3/media/save`,
    { method: 'POST', headers, body: JSON.stringify({ nmId: nmID, data: [newImageUrl] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: "Yangi rasm 1-chi o'ringa yuklandi" };
}

// ===== Multi-image marketplace upload helpers =====
async function uploadAllToYandex(credentials: any, offerId: string, newImageUrls: string[]): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) return { success: false, message: 'Business ID topilmadi' };

  // Get existing pictures
  const getResp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
    { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId] }) }
  );

  let existingPictures: string[] = [];
  if (getResp.ok) {
    const getData = await getResp.json();
    existingPictures = getData.result?.offerMappings?.[0]?.offer?.pictures || [];
  }

  // New images first, then existing (ensures hero is #1)
  const allPictures = [...newImageUrls, ...existingPictures];
  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
    { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: { offerId, pictures: allPictures } }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: `${newImageUrls.length} ta yangi rasm yuklandi (jami ${allPictures.length} ta)` };
}

async function uploadAllToWildberries(credentials: any, nmID: number, newImageUrls: string[]): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v3/media/save`,
    { method: 'POST', headers, body: JSON.stringify({ nmId: nmID, data: newImageUrls }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }
  return { success: true, message: `${newImageUrls.length} ta rasm yuklandi` };
}

// =====================================================
// MAIN SERVE
// =====================================================
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
      return new Response(JSON.stringify({ error: "Admin ruxsati yo'q" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action, partnerId, productName, category, offerId, nmID, marketplace, referenceImageUrl, features } = body;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY sozlanmagan' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 SELLERCLOUDX AI IMAGE INTELLIGENCE SYSTEM`);
    console.log(`Action: ${action}, Product: ${productName}`);
    console.log(`Reference: ${referenceImageUrl ? 'YES' : 'NO'}`);
    console.log(`${'='.repeat(60)}`);

    // ===== FULL PIPELINE: generate-and-upload =====
    if (action === 'generate-and-upload') {
      if (!partnerId) {
        return new Response(JSON.stringify({ error: 'partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const pipelineResult: any = {
        steps: [],
        detection: null,
        qualityScan: null,
        qualityControl: null,
        imageUrl: null,
        cardUrl: null,
        marketplaceUpload: null,
      };

      // Determine source image
      let sourceImageUrl = referenceImageUrl;
      if (!sourceImageUrl) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'referenceImageUrl (mahsulot rasmi) kerak. Rasm topilmadi.' 
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STEP 1: Product + Category Detection ──
      const detection = await detectProductCategory(sourceImageUrl, OPENAI_API_KEY);
      pipelineResult.detection = detection;
      pipelineResult.steps.push({ step: 1, name: "Product Detection", status: detection ? "✅" : "⚠️" });

      const detectedCategory = detection?.category || category || '';
      const categoryStyle = getCategoryStyle(detectedCategory);
      console.log(`📦 Category: ${detectedCategory} → Style: ${categoryStyle.visual_style}`);

      // ── STEP 2: Image Quality Scan ──
      const qualityScan = await scanImageQuality(sourceImageUrl, OPENAI_API_KEY);
      pipelineResult.qualityScan = qualityScan;
      pipelineResult.steps.push({ step: 2, name: "Quality Scan", status: `Score: ${qualityScan.compliance_score}` });

      // ── STEP 3: Auto Fix (if score < 85) ──
      let workingImageUrl = sourceImageUrl;
      if (qualityScan.fix_required || qualityScan.compliance_score < 85) {
        console.log(`⚠️ Score ${qualityScan.compliance_score} < 85 → Auto fixing...`);
        const fixedImage = await autoFixImage(sourceImageUrl, qualityScan.issues || [], OPENAI_API_KEY);
        if (fixedImage) {
          // Upload fixed image to storage
          const fixedUrl = await uploadToStorage(supabase, fixedImage, partnerId, `${offerId || 'fix'}-fixed`);
          if (fixedUrl) {
            workingImageUrl = fixedUrl;
            pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "✅ Fixed" });
          } else {
            pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "⚠️ Upload failed" });
          }
        } else {
          pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "⚠️ Fix failed, using original" });
        }
      } else {
        pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "⏭ Not needed (score ≥ 85)" });
      }

      // Upload clean product image
      const cleanImageUrl = await uploadToStorage(supabase, workingImageUrl, partnerId, offerId || 'product');
      pipelineResult.imageUrl = cleanImageUrl;

      // ── STEP 4: Generate 4 Images (1 Hero + 3 Supplementary) ──
      const variationSeed = Math.floor(Math.random() * 100);
      
      // 4.1: Main Hero Card (best quality, primary position)
      console.log("🎨 STEP 4.0: Generating HERO card (main image)...");
      let heroCardImage = await generateMarketplaceCard(
        workingImageUrl, detection, categoryStyle, OPENAI_API_KEY, variationSeed
      );

      let heroCardUrl: string | null = null;
      let qcResult: any = null;

      if (heroCardImage) {
        heroCardUrl = await uploadToStorage(supabase, heroCardImage, partnerId, `${offerId || 'card'}-hero`);
        pipelineResult.steps.push({ step: "4.0", name: "Hero Card", status: "✅" });

        // ── STEP 5: Quality Control on hero ──
        if (heroCardUrl) {
          qcResult = await qualityControl(heroCardUrl, OPENAI_API_KEY);
          pipelineResult.qualityControl = qcResult;
          pipelineResult.steps.push({ step: 5, name: "Quality Control", status: `Score: ${qcResult.overall_score}` });

          // Auto improvement (1 retry if score < 70)
          if (qcResult.overall_score < 70 && qcResult.improvements?.length) {
            console.log(`🔄 Score ${qcResult.overall_score} < 70 → Auto improvement...`);
            const improvedCard = await generateMarketplaceCard(
              workingImageUrl, detection, categoryStyle, OPENAI_API_KEY, variationSeed + 1
            );
            if (improvedCard) {
              const improvedUrl = await uploadToStorage(supabase, improvedCard, partnerId, `${offerId || 'card'}-hero-v2`);
              if (improvedUrl) {
                const newQc = await qualityControl(improvedUrl, OPENAI_API_KEY);
                if (newQc.overall_score > (qcResult.overall_score || 0)) {
                  heroCardUrl = improvedUrl;
                  qcResult = newQc;
                  pipelineResult.qualityControl = newQc;
                }
              }
            }
            pipelineResult.steps.push({ step: "5b", name: "Auto Improvement", status: `Final: ${qcResult.overall_score}` });
          }
        }
      } else {
        pipelineResult.steps.push({ step: "4.0", name: "Hero Card", status: "❌ Failed" });
      }

      pipelineResult.cardUrl = heroCardUrl;

      // 4.1-4.3: Generate 3 supplementary images (feature, angle, use-case)
      const supplementaryUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        const suppImage = await generateSupplementaryImage(
          workingImageUrl, detection, categoryStyle, OPENAI_API_KEY, i
        );
        if (suppImage) {
          const suppUrl = await uploadToStorage(supabase, suppImage, partnerId, `${offerId || 'card'}-supp-${i + 1}`);
          if (suppUrl) {
            supplementaryUrls.push(suppUrl);
            pipelineResult.steps.push({ step: `4.${i + 1}`, name: SUPPLEMENTARY_PROMPTS[i].role, status: "✅" });
          } else {
            pipelineResult.steps.push({ step: `4.${i + 1}`, name: SUPPLEMENTARY_PROMPTS[i].role, status: "⚠️ Upload failed" });
          }
        } else {
          pipelineResult.steps.push({ step: `4.${i + 1}`, name: SUPPLEMENTARY_PROMPTS[i].role, status: "❌ Failed" });
        }
      }

      pipelineResult.supplementaryImages = supplementaryUrls;
      console.log(`✅ Generated ${1 + supplementaryUrls.length} total images (1 hero + ${supplementaryUrls.length} supplementary)`);

      // ── STEP 6: Upload ALL images to Marketplace ──
      // Collect all generated image URLs in order: hero first, then supplementary
      const allGeneratedImages: string[] = [];
      if (heroCardUrl) allGeneratedImages.push(heroCardUrl);
      allGeneratedImages.push(...supplementaryUrls);

      let mpResult: { success: boolean; message: string } = { success: false, message: 'Marketplace aniqlanmadi' };

      if (marketplace && offerId && allGeneratedImages.length > 0) {
        const { data: conns } = await supabase
          .from('marketplace_connections')
          .select('*')
          .eq('user_id', partnerId)
          .eq('marketplace', marketplace)
          .eq('is_active', true)
          .limit(1);

        if (conns?.length) {
          const conn = conns[0];
          let creds: any;
          if (conn.encrypted_credentials) {
            const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
            creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          } else {
            creds = conn.credentials || {};
          }

          if (marketplace === 'yandex') {
            // Upload all images at once — hero first, then supplementary
            mpResult = await uploadAllToYandex(creds, offerId, allGeneratedImages);
          } else if (marketplace === 'wildberries' && nmID) {
            // Upload all images to WB
            mpResult = await uploadAllToWildberries(creds, nmID, allGeneratedImages);
          }
        }
      }

      pipelineResult.marketplaceUpload = mpResult;
      pipelineResult.steps.push({ step: 6, name: "Marketplace Upload", status: mpResult.success ? "✅" : "⚠️" });

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 PIPELINE COMPLETE — ${allGeneratedImages.length} images`);
      pipelineResult.steps.forEach((s: any) => console.log(`  Step ${s.step}: ${s.name} → ${s.status}`));
      console.log(`${'='.repeat(60)}\n`);

      return new Response(JSON.stringify({
        success: true,
        imageUrl: cleanImageUrl,
        cardUrl: heroCardUrl,
        infographicUrl: heroCardUrl,
        supplementaryImages: supplementaryUrls,
        totalImages: allGeneratedImages.length,
        qualityScore: qcResult?.overall_score || null,
        detection,
        pipeline: pipelineResult,
        marketplaceUpload: mpResult,
        message: mpResult.success
          ? `✅ ${allGeneratedImages.length} ta rasm yaratildi (sifat: ${qcResult?.overall_score || '?'}/100) va marketplace'ga yuklandi`
          : `⚠️ ${allGeneratedImages.length} ta rasm yaratildi (sifat: ${qcResult?.overall_score || '?'}/100). MP: ${mpResult.message}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "action kerak: 'generate-and-upload'" }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent images error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
