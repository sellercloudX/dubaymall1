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
// STEP 4: Hero Infographic Image — Pinterest-style with text overlays
// =====================================================
async function generateHeroImage(
  imageUrl: string,
  detection: any,
  categoryStyle: typeof CATEGORY_STYLES.default,
  apiKey: string,
): Promise<string | null> {
  console.log("🎨 STEP 4: Hero INFOGRAPHIC Image (Pinterest-style)...");

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) {
    console.error("Failed to download image for hero generation");
    return null;
  }

  const category = detection?.category || '';
  const productName = sanitizeStopWords(detection?.product_name || detection?.productName || 'Product');
  const brand = detection?.brand || '';
  const keyFeatures = (detection?.key_features || detection?.features || []).slice(0, 4);
  const positioning = detection?.positioning || 'mid-range';

  // Build feature badges text
  const featureBadgesText = keyFeatures.length > 0 
    ? keyFeatures.map((f: string, i: number) => `• ${sanitizeStopWords(f)}`).join('\n')
    : '';

  const heroPrompt = `You are a world-class marketplace INFOGRAPHIC designer. Create a PINTEREST-STYLE product infographic card from this product photo.

FORMAT: 1080x1440 vertical (3:4 portrait).

DESIGN DIRECTION:
- Style: ${categoryStyle.visual_style}
- Background: ${categoryStyle.background_style}  
- Color palette: ${categoryStyle.color_palette}

THIS IS AN INFOGRAPHIC — IT MUST HAVE TEXT AND DESIGN ELEMENTS:

1. PRODUCT PRESERVATION: The product from the reference photo must be placed into the scene EXACTLY as-is — same shape, same colors, same labels, same brand logos, same packaging. Do NOT redraw or alter the product.

2. BACKGROUND: Create a rich, styled, category-appropriate background:
   ${categoryStyle.prompt_addition}

3. PRODUCT NAME (REQUIRED): Display the product name prominently at the TOP or BOTTOM of the image:
   "${productName}"
   - Use large, bold, elegant typography
   - Font must be clean and professional (NOT handwritten/script)
   - White or light text on dark areas, dark text on light areas for contrast
   ${brand ? `- Brand name "${brand}" should appear smaller above or below the product name` : ''}

4. FEATURE BADGES (REQUIRED): Add 3-4 rounded pill-shaped feature badges around the product:
${featureBadgesText || '   - Show key product characteristics as short text badges'}
   - Each badge: rounded rectangle with semi-transparent background
   - Clean sans-serif font, readable at thumbnail size
   - Arranged around the product (not overlapping it)
   - Use thin connecting lines or arrows from badges to relevant product areas

5. DECORATIVE DESIGN ELEMENTS:
   - Subtle geometric frames, thin border lines, or corner accents
   - Category-appropriate decorative elements (flowers for beauty, tech patterns for electronics)
   - Gradient overlays for text readability areas
   - Professional color-coordinated design system

6. LIGHTING & COMPOSITION:
   - Professional studio lighting appropriate for ${category}
   - Product occupies 35-50% of frame — leaving space for text and badges
   - Product centered or slightly offset to allow text placement

7. QUALITY: This must look like a TOP-SELLING marketplace product card — the kind that gets 10x more clicks. Think Wildberries/Ozon TOP seller infographic level. Professional, clean, information-rich but NOT cluttered.

CRITICAL TEXT ACCURACY:
- Every letter and word must be EXACTLY as specified above
- Do NOT invent, modify, or add any text that is not specified
- All text must be clearly readable, even at small thumbnail sizes
- NO spelling errors, NO random characters

BANNED:
- Flat solid color backgrounds (must be rich/styled)
- Clip-art or cartoon elements
- Distorted product appearance
- Unreadable or blurry text
- More than 5 text elements total
- Busy/cluttered compositions that hide the product`;

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
// LIFESTYLE IMAGES — 3 different angles/perspectives
// =====================================================
const LIFESTYLE_ANGLES = [
  {
    role: "closeup_detail",
    label: "Close-up Detail",
    getPrompt: (category: string, audience: string) => `You are a macro product photographer. Create an EXTREME CLOSE-UP detail shot of this product.

FORMAT: 1080x1440 vertical (3:4 portrait).

ANGLE: Very close macro shot — filling 80-90% of frame. Show:
- Material texture (fabric weave, metal finish, glass clarity, plastic grain)
- Label/brand text on packaging (sharp and readable)
- Fine craftsmanship details (stitching, embossing, engraving)
- Surface finish (matte, glossy, brushed, frosted)

LIGHTING: Raking side-light to reveal texture. Shallow depth of field — only the focused detail area is sharp, rest has beautiful bokeh blur.

BACKGROUND: The product itself IS the background at this zoom level. Soft out-of-focus product areas create natural backdrop.

MOOD: Premium quality feel — "you can see the quality". Like a luxury brand detail shot.

CRITICAL RULES:
1. PRODUCT PRESERVATION: Must be the EXACT same product from reference — same colors, labels, branding.
2. ABSOLUTELY NO TEXT overlaid on the image. No badges, watermarks, icons, typography.
3. NO graphics, arrows, callout bubbles. Pure macro photography only.
4. Must feel like a real macro photo, NOT AI-generated or composite.`
  },
  {
    role: "three_quarter_angle",
    label: "3/4 Angle View",
    getPrompt: (category: string, audience: string) => `You are a commercial product photographer. Create a DYNAMIC THREE-QUARTER ANGLE shot of this product.

FORMAT: 1080x1440 vertical (3:4 portrait).

ANGLE: 45-degree three-quarter perspective showing:
- Front face AND one side simultaneously
- Product depth and three-dimensionality
- Volume and proportions clearly visible
- Slight top-down tilt (15-20°) for added dimension

BACKGROUND: Clean, category-appropriate gradient:
- Perfume/Beauty → soft warm gradient (champagne to cream)
- Electronics → cool dark gradient (charcoal to deep blue)
- Fashion → neutral warm (sand to ivory)
- Other → light professional gradient (white to soft gray)

LIGHTING: Professional 3-point studio setup — key light from upper-left, fill from right, rim light from behind creating a beautiful edge glow. Soft shadow falling to the right.

COMPOSITION: Product at 45° angle, occupying 60-70% of frame, positioned slightly left of center (rule of thirds). Clean negative space on right side.

CRITICAL RULES:
1. PRODUCT PRESERVATION: EXACT same product — same shape, colors, labels, branding. No alterations.
2. ABSOLUTELY NO TEXT, badges, watermarks, icons, typography, or any graphic elements.
3. Pure photography. Must look like a real studio photo, not a render or composite.
4. Product must look three-dimensional and tangible.`
  },
  {
    role: "lifestyle_context",
    label: "Lifestyle Usage",
    getPrompt: (category: string, audience: string) => `You are a lifestyle editorial photographer. Create an ASPIRATIONAL LIFESTYLE scene showing this product in natural use.

FORMAT: 1080x1440 vertical (3:4 portrait).

SCENE by category:
- Perfume/Beauty → marble vanity table with morning golden light, mirror reflection, fresh flowers nearby
- Electronics → modern minimalist desk setup, hands interacting with device, coffee cup nearby
- Fashion → styled on bed with linen sheets, or draped on wooden chair with accessories
- Household → bright Scandinavian kitchen counter, organized shelf, fresh plants nearby
- Food → rustic farmhouse table, scattered fresh ingredients, warm kitchen atmosphere
- Kids → bright playful room, soft carpet, colorful toys scattered naturally
- Sport → gym locker room bench, water bottle, towel, post-workout vibe
- Default → lifestyle flat-lay on clean white marble with 3-4 complementary props

Target audience: ${audience}
Category: ${category}

CAMERA: Slightly above (30° top-down for flat-lay) OR eye-level for scene shots. Warm natural window light.

COMPOSITION: Product is the hero (30-45% of frame) but surrounded by 3-5 lifestyle props that tell a story. The viewer should WANT this lifestyle.

CRITICAL RULES:
1. PRODUCT PRESERVATION: The EXACT same product placed naturally in the scene. Same packaging, labels, colors.
2. ABSOLUTELY NO TEXT, badges, watermarks, icons, or graphic elements. Pure photography.
3. Must feel like a real lifestyle Instagram photo, NOT a Photoshop composite.
4. Natural, warm lighting. Realistic shadows and reflections.
5. Props should complement, not compete with the product.`
  },
];

async function generateLifestyleAngle(
  imageUrl: string,
  detection: any,
  angleConfig: typeof LIFESTYLE_ANGLES[0],
  apiKey: string,
): Promise<string | null> {
  console.log(`🖼 Generating: ${angleConfig.label}...`);

  const imageBytes = await downloadImage(imageUrl);
  if (!imageBytes) return null;

  const category = detection?.category || '';
  const audience = detection?.target_audience || 'general consumer';
  const prompt = angleConfig.getPrompt(category, audience);

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
    console.error(`${angleConfig.label} failed (${resp.status}): ${errText.substring(0, 200)}`);
    return null;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) { console.log(`✅ ${angleConfig.label} generated`); return `data:image/png;base64,${b64}`; }
  const url = data.data?.[0]?.url;
  if (url) { console.log(`✅ ${angleConfig.label} (URL)`); return url; }
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

    const body = await req.json();
    const { action, partnerId, productName, category, offerId, nmID, marketplace, referenceImageUrl, features } = body;

    // Role check: 'scanner-generate' allows seller role, others require admin
    if (action === 'scanner-generate') {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const hasAccess = roles?.some(r => r.role === 'seller' || r.role === 'admin');
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Seller ruxsati yo'q" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      const { data: adminPerm } = await supabase
        .from('admin_permissions')
        .select('is_super_admin, can_manage_users')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
        return new Response(JSON.stringify({ error: "Admin ruxsati yo'q" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

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
      let workingImageUrl = sourceImageUrl;
      pipelineResult.steps.push({ step: 2, name: "Quality Scan", status: "⏭ Skipped" });
      pipelineResult.steps.push({ step: 3, name: "Auto Fix", status: "⏭ Skipped" });

      // Upload clean product image
      const cleanImageUrl = await uploadToStorage(supabase, workingImageUrl, partnerId, offerId || 'product');
      pipelineResult.imageUrl = cleanImageUrl;

      // ── STEP 4: Generate 4 Professional Images ──
      // Image 1: Infographic Hero (styled background, negative space for text overlay)
      // Images 2-4: 3 different angle lifestyle shots
      
      console.log("🎨 STEP 4: Generating 4 images (1 infographic + 3 lifestyle angles)...");

      // 4a: Infographic Hero — Professional product photography with styled background
      let heroImage = await generateHeroImage(
        workingImageUrl, detection, categoryStyle, OPENAI_API_KEY
      );

      let heroUrl: string | null = null;
      if (heroImage) {
        heroUrl = await uploadToStorage(supabase, heroImage, partnerId, `${offerId || 'card'}-hero`);
        pipelineResult.steps.push({ step: "4a", name: "Infographic Hero", status: "✅" });
      } else {
        pipelineResult.steps.push({ step: "4a", name: "Infographic Hero", status: "❌ Failed" });
      }

      pipelineResult.cardUrl = heroUrl;

      // 4b-4d: 3 Lifestyle images from different angles — PARALLEL for speed
      const supplementaryUrls: string[] = [];
      
      console.log("🔄 Generating 3 lifestyle angles in PARALLEL...");
      const anglePromises = LIFESTYLE_ANGLES.map((angle, i) => {
        const stepLabel = `4${String.fromCharCode(98 + i)}`; // 4b, 4c, 4d
        return generateLifestyleAngle(workingImageUrl, detection, angle, OPENAI_API_KEY)
          .then(async (angleImage) => {
            if (angleImage) {
              console.log(`✅ ${angle.label} generated`);
              const angleUrl = await uploadToStorage(supabase, angleImage, partnerId, `${offerId || 'card'}-${angle.role}`);
              if (angleUrl) {
                return { stepLabel, name: angle.label, status: "✅", url: angleUrl };
              }
              return { stepLabel, name: angle.label, status: "⚠️ Upload failed", url: null };
            }
            return { stepLabel, name: angle.label, status: "❌ Failed", url: null };
          })
          .catch((e) => {
            console.error(`❌ ${angle.label} error:`, e.message);
            return { stepLabel, name: angle.label, status: "❌ Failed", url: null };
          });
      });
      
      const angleResults = await Promise.all(anglePromises);
      for (const result of angleResults) {
        pipelineResult.steps.push({ step: result.stepLabel, name: result.name, status: result.status });
        if (result.url) supplementaryUrls.push(result.url);
      }

      pipelineResult.supplementaryImages = supplementaryUrls;
      const totalGenerated = (heroUrl ? 1 : 0) + supplementaryUrls.length;
      console.log(`✅ Generated ${totalGenerated} total images (target: 4)`);

      // ── Skip Step 5 (Quality Control) to save timeout budget for 4 images ──
      pipelineResult.steps.push({ step: 5, name: "Quality Control", status: "⏭ Skipped (4-image mode)" });

      // ── STEP 6: Upload ALL images to Marketplace ──
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
            mpResult = await uploadAllToYandex(creds, offerId, allGeneratedImages);
          } else if (marketplace === 'wildberries' && nmID) {
            mpResult = await uploadAllToWildberries(creds, nmID, allGeneratedImages);
          }
        }
      }

      pipelineResult.marketplaceUpload = mpResult;
      pipelineResult.steps.push({ step: 6, name: "Marketplace Upload", status: mpResult.success ? "✅" : "⚠️" });

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 PIPELINE COMPLETE — ${totalGenerated} images`);
      pipelineResult.steps.forEach((s: any) => console.log(`  Step ${s.step}: ${s.name} → ${s.status}`));
      console.log(`${'='.repeat(60)}\n`);

      return new Response(JSON.stringify({
        success: true,
        imageUrl: cleanImageUrl,
        cardUrl: heroUrl,
        infographicUrl: heroUrl,
        supplementaryImages: supplementaryUrls,
        totalImages: totalGenerated,
        qualityScore: null,
        detection,
        pipeline: pipelineResult,
        marketplaceUpload: mpResult,
        message: mpResult.success
          ? `✅ ${totalGenerated} ta rasm yaratildi va marketplace'ga yuklandi`
          : `⚠️ ${totalGenerated} ta rasm yaratildi. MP: ${mpResult.message}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== SCANNER PIPELINE: scanner-generate =====
    // IDENTICAL quality to generate-and-upload — same 6-step pipeline for seller users
    if (action === 'scanner-generate') {
      if (!referenceImageUrl) {
        return new Response(JSON.stringify({ error: 'referenceImageUrl kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const userId = user.id;
      console.log(`📸 Scanner pipeline for user ${userId}`);
      console.log(`📸 productName: ${productName}, category: ${category}, features: ${JSON.stringify(features)}`);

      // Step 1: Detect category with GPT-4o Vision
      let detection = await detectProductCategory(referenceImageUrl, OPENAI_API_KEY);
      
      // CRITICAL: Merge frontend-analyzed data into detection for better accuracy
      // Frontend analyze-product-image already identified the product — use that data as enhancement
      if (detection) {
        // Use frontend productName if detection gave generic name
        if (productName && (!detection.product_name || detection.product_name === 'Product')) {
          detection.product_name = productName;
        }
        // Merge frontend features with detected features for richer infographic badges
        if (features?.length > 0) {
          const detectedFeatures = detection.key_features || [];
          const mergedFeatures = [...new Set([...detectedFeatures, ...features])].slice(0, 5);
          detection.key_features = mergedFeatures;
        }
        // Use frontend category as fallback
        if (category && !detection.category) {
          detection.category = category;
        }
      } else {
        // Detection failed entirely — build from frontend data
        detection = {
          product_name: productName || 'Product',
          category: category || '',
          key_features: features || [],
          positioning: 'mid-range',
          target_audience: 'general consumer',
        };
      }

      const detectedCategory = detection?.category || category || '';
      const categoryStyle = getCategoryStyle(detectedCategory);
      console.log(`📦 Scanner category: ${detectedCategory} → Style: ${categoryStyle.visual_style}`);

      // Step 2: Generate Hero Infographic (Pinterest-style with text overlays)
      console.log("🎨 Scanner: Generating Hero Infographic...");
      const heroImage = await generateHeroImage(referenceImageUrl, detection, categoryStyle, OPENAI_API_KEY);
      let heroUrl: string | null = null;
      if (heroImage) {
        heroUrl = await uploadToStorage(supabase, heroImage, userId, `scanner-hero-${Date.now()}`);
        console.log("✅ Scanner Hero Infographic uploaded");
      } else {
        console.error("❌ Scanner Hero Infographic failed");
      }

      // Step 3: Generate 3 Lifestyle angles in PARALLEL
      console.log("🔄 Scanner: Generating 3 lifestyle angles in PARALLEL...");
      const anglePromises = LIFESTYLE_ANGLES.map((angle) => {
        return generateLifestyleAngle(referenceImageUrl, detection, angle, OPENAI_API_KEY)
          .then(async (img) => {
            if (img) {
              const url = await uploadToStorage(supabase, img, userId, `scanner-${angle.role}-${Date.now()}`);
              console.log(`✅ Scanner ${angle.label} uploaded`);
              return url;
            }
            console.error(`❌ Scanner ${angle.label} failed`);
            return null;
          })
          .catch((e) => {
            console.error(`❌ Scanner ${angle.label} error:`, e.message);
            return null;
          });
      });

      const angleUrls = (await Promise.all(anglePromises)).filter(Boolean) as string[];

      const allImages = [...(heroUrl ? [heroUrl] : []), ...angleUrls];
      console.log(`✅ Scanner pipeline complete: ${allImages.length}/4 images generated`);

      return new Response(JSON.stringify({
        success: true,
        images: allImages,
        heroUrl,
        lifestyleUrls: angleUrls,
        totalImages: allImages.length,
        detection,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "action kerak: 'generate-and-upload' yoki 'scanner-generate'" }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent images error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
