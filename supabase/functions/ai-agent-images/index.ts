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
// STEP 4: Hero Product Image — Pure Professional Photography (NO text/badges)
// =====================================================
async function generateHeroImage(
  imageUrl: string,
  detection: any,
  categoryStyle: typeof CATEGORY_STYLES.default,
  apiKey: string,
): Promise<string | null> {
  console.log("🎨 STEP 4: Hero Product Image (Professional Photography)...");

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) {
    console.error("Failed to download image for hero generation");
    return null;
  }

  const category = detection?.category || '';
  const positioning = detection?.positioning || 'mid-range';

  const heroPrompt = `You are a world-class commercial product photographer. Transform this product photo into a PREMIUM e-commerce hero image.

FORMAT: 1080x1440 vertical (3:4 portrait).

PHOTOGRAPHY DIRECTION:
- Style: ${categoryStyle.visual_style}
- Background: ${categoryStyle.background_style}
- Color palette: ${categoryStyle.color_palette}

CRITICAL RULES — READ CAREFULLY:

1. PRODUCT PRESERVATION: The product from the reference photo must be placed into the scene EXACTLY as-is — same shape, same colors, same labels, same brand logos, same packaging. Do NOT redraw, reinterpret, simplify, or alter the product in ANY way. It must look like a real photograph of the SAME physical product.

2. BACKGROUND: Create a rich, layered, category-appropriate styled background:
   ${categoryStyle.prompt_addition}

3. ABSOLUTELY NO TEXT: Do NOT add ANY text, typography, labels, badges, watermarks, titles, descriptions, feature callouts, or any written content. The image must be PURELY VISUAL — a clean product photograph with styled background. ZERO text characters anywhere.

4. ABSOLUTELY NO ICONS/EMOJIS: No emoji icons, no graphic badges, no info-graphic elements, no arrows, no callout bubbles. PURE photography only.

5. LIGHTING: Professional studio-quality lighting appropriate for ${category}:
   - Perfume/Beauty: Dramatic side-lighting with soft bokeh highlights
   - Electronics: Sharp edge-lighting with blue/white rim light
   - Fashion: Warm natural window-light feel
   - Household/Food: Bright, clean, high-key lighting

6. COMPOSITION: Product centered or slightly off-center (rule of thirds). Generous negative space. The product should occupy 40-60% of the frame. Soft natural shadow underneath.

7. DEPTH & ATMOSPHERE: Add subtle atmospheric elements appropriate to category:
   - Bokeh light particles, soft reflections, gentle gradients
   - Decorative elements (flowers, water drops, fabric) where category-appropriate
   - Depth-of-field effect: product sharp, background elements softly blurred

8. QUALITY STANDARD: This must look like it was shot by a professional photographer for a major brand campaign. Think Dior, Apple, Samsung, Zara product photography level. NOT a Photoshop montage, NOT a collage, NOT an infographic.

BANNED:
- Any text, numbers, letters, words in any language
- Flat solid color backgrounds
- Clip-art, cartoon elements, graphic design elements
- Distorted or AI-looking artifacts
- Multiple products (show only the ONE product from reference)
- Busy/cluttered compositions`;

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), "product.png");
  formData.append("model", "gpt-image-1");
  formData.append("prompt", heroPrompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "high");

  const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Hero image failed (${resp.status}): ${errText.substring(0, 300)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log("✅ STEP 4 Done: Hero image generated"); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log("✅ STEP 4 Done: Hero image (URL)"); return url; }
  return null;
}

// =====================================================
// STEP 4b: Lifestyle/Context Image — Product in Real Environment
// =====================================================
async function generateLifestyleImage(
  imageUrl: string,
  detection: any,
  categoryStyle: typeof CATEGORY_STYLES.default,
  apiKey: string,
): Promise<string | null> {
  console.log("🖼 STEP 4b: Lifestyle Context Image...");

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) return null;

  const category = detection?.category || '';
  const audience = detection?.target_audience || 'general consumer';

  const lifestylePrompt = `You are a lifestyle product photographer creating an aspirational scene showing this product in its natural environment.

FORMAT: 1080x1440 vertical (3:4 portrait).

SCENE DIRECTION:
Create a realistic lifestyle scene where this product is shown in USE or in its natural context:
- Perfume/Beauty → elegant vanity table, bathroom marble shelf, morning routine scene with soft golden light
- Electronics → modern minimalist desk, hands holding the device, tech-lifestyle flat-lay
- Fashion → styled outfit flat-lay on linen, hanging on wooden hanger with accessories
- Household → bright kitchen counter, organized shelf, clean laundry scene
- Food → rustic wooden table, ingredient scatter, warm kitchen atmosphere
- Kids → playful colorful room, child's hands reaching for product
- Sport → gym bag, outdoor trail, workout mat setup

Target audience: ${audience}
Category: ${category}

CRITICAL RULES:

1. PRODUCT PRESERVATION: The product must appear EXACTLY as in the reference photo — same physical product, same packaging, same labels. Place it naturally within the scene.

2. ABSOLUTELY NO TEXT: Zero text, zero typography, zero badges, zero labels, zero watermarks. Pure visual photography only.

3. ABSOLUTELY NO ICONS/GRAPHICS: No emoji, no infographic elements, no design overlays. Pure photography.

4. LIFESTYLE REALISM: The scene should feel like a real photograph taken for an Instagram lifestyle brand, NOT like a Photoshop composite. Natural lighting, realistic shadows, coherent perspective.

5. PROPS & CONTEXT: Surround the product with 3-5 relevant lifestyle props that enhance the scene without overwhelming the product. Product remains the clear hero (occupying 30-50% of frame).

6. MOOD: Warm, inviting, aspirational — makes the viewer want to own this product. Think Pinterest lifestyle board aesthetic.

7. LIGHTING: Natural, warm, soft — golden hour or soft window light feel. No harsh studio lights.

BANNED:
- Any text or typography
- Studio white backgrounds
- Isolated product with no context
- AI-looking artifacts or distortions
- Busy cluttered scenes`;

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), "product.png");
  formData.append("model", "gpt-image-1");
  formData.append("prompt", lifestylePrompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "high");

  const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Lifestyle image failed (${resp.status}): ${errText.substring(0, 200)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log("✅ Lifestyle image generated"); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log("✅ Lifestyle image (URL)"); return url; }
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

      // ── Skip Steps 2-3 (Quality Scan + Auto Fix) ──
      // Hero/Lifestyle generation already creates professional backgrounds
      // Skipping saves ~60s timeout budget for actual image generation
      let workingImageUrl = sourceImageUrl;
      pipelineResult.steps.push({ step: 2, name: "Quality Scan", status: "⏭ Skipped (hero gen handles quality)" });
      pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "⏭ Skipped" });

      // Upload clean product image
      const cleanImageUrl = await uploadToStorage(supabase, workingImageUrl, partnerId, offerId || 'product');
      pipelineResult.imageUrl = cleanImageUrl;

      // ── STEP 4: Generate 2 Professional Images (Hero + Lifestyle) ──
      // Only 2 images to stay within edge function timeout (~100s budget)
      
      // 4a: Hero — Professional product photography with styled background (NO text)
      let heroImage = await generateHeroImage(
        workingImageUrl, detection, categoryStyle, OPENAI_API_KEY
      );

      let heroUrl: string | null = null;
      let qcResult: any = null;

      if (heroImage) {
        heroUrl = await uploadToStorage(supabase, heroImage, partnerId, `${offerId || 'card'}-hero`);
        pipelineResult.steps.push({ step: "4a", name: "Hero Image", status: "✅" });

        // ── STEP 5: Quality Control on hero ──
        if (heroUrl) {
          qcResult = await qualityControl(heroUrl, OPENAI_API_KEY);
          pipelineResult.qualityControl = qcResult;
          pipelineResult.steps.push({ step: 5, name: "Quality Control", status: `Score: ${qcResult.overall_score}` });
        }
      } else {
        pipelineResult.steps.push({ step: "4a", name: "Hero Image", status: "❌ Failed" });
      }

      pipelineResult.cardUrl = heroUrl;

      // 4b: Lifestyle — Product in real-life context (NO text)
      const supplementaryUrls: string[] = [];
      const lifestyleImage = await generateLifestyleImage(
        workingImageUrl, detection, categoryStyle, OPENAI_API_KEY
      );
      if (lifestyleImage) {
        const lifestyleUrl = await uploadToStorage(supabase, lifestyleImage, partnerId, `${offerId || 'card'}-lifestyle`);
        if (lifestyleUrl) {
          supplementaryUrls.push(lifestyleUrl);
          pipelineResult.steps.push({ step: "4b", name: "Lifestyle Image", status: "✅" });
        }
      } else {
        pipelineResult.steps.push({ step: "4b", name: "Lifestyle Image", status: "❌ Failed" });
      }

      pipelineResult.supplementaryImages = supplementaryUrls;
      console.log(`✅ Generated ${(heroUrl ? 1 : 0) + supplementaryUrls.length} total images`);

      // ── STEP 6: Upload ALL images to Marketplace ──
      // Collect all generated image URLs in order: hero first, then supplementary
      const allGeneratedImages: string[] = [];
      if (heroUrl) allGeneratedImages.push(heroUrl);
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
        cardUrl: heroUrl,
        infographicUrl: heroUrl,
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
