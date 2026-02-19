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
// CATEGORY STYLE MAP — determines design direction
// =====================================================
const CATEGORY_STYLES: Record<string, {
  visual_style: string;
  background_style: string;
  color_palette: string;
  prompt_addition: string;
}> = {
  perfume: {
    visual_style: "Luxury cosmetic advertising",
    background_style: "Elegant gradient with gold accents",
    color_palette: "Deep gold, rose gold, champagne, warm bronze",
    prompt_addition: "Soft glow lighting. Elegant gradient background. Gold accents. Premium minimal typography. Close-up focus. Romantic atmosphere. Luxury feel.",
  },
  beauty: {
    visual_style: "Premium beauty advertising",
    background_style: "Soft pastel gradient with shimmer",
    color_palette: "Rose pink, pearl white, soft gold, lavender",
    prompt_addition: "Soft diffused lighting. Pastel gradient background. Shimmer effects. Beauty-focused aesthetic. Elegant composition.",
  },
  electronics: {
    visual_style: "Modern technology advertising",
    background_style: "Clean tech gradient or dark minimalist",
    color_palette: "Deep blue, metallic silver, electric blue, charcoal",
    prompt_addition: "Modern technology advertising style. Clean white or tech gradient background. Functional feature highlights. Minimalist composition. Blue or metallic accents. Precise typography.",
  },
  fashion: {
    visual_style: "Lifestyle fashion advertising",
    background_style: "Trendy lifestyle backdrop",
    color_palette: "Neutral tones, warm beige, soft contrast",
    prompt_addition: "Lifestyle fashion advertising style. Modern trendy composition. Soft natural lighting. Dynamic layout. Instagram-ready aesthetic.",
  },
  household: {
    visual_style: "Fresh clean advertising",
    background_style: "Bright clean background with freshness cues",
    color_palette: "Fresh blue, clean white, bright green, sky blue",
    prompt_addition: "Fresh bright background. Clean hygiene atmosphere. Water splash or freshness visual cues. High brightness commercial look.",
  },
  food: {
    visual_style: "Appetizing food advertising",
    background_style: "Warm rustic or clean white",
    color_palette: "Warm orange, natural green, appetizing red, golden brown",
    prompt_addition: "Appetizing food photography style. Warm inviting lighting. Natural textures. Fresh ingredient feel. Mouth-watering presentation.",
  },
  kids: {
    visual_style: "Playful colorful advertising",
    background_style: "Bright colorful fun background",
    color_palette: "Bright yellow, sky blue, candy pink, grass green",
    prompt_addition: "Playful colorful style. Fun energetic composition. Bright cheerful lighting. Child-friendly aesthetic. Safe and happy atmosphere.",
  },
  sport: {
    visual_style: "Dynamic active advertising",
    background_style: "Energetic gradient with motion effects",
    color_palette: "Energy red, dynamic orange, power black, electric green",
    prompt_addition: "Dynamic active style. Energetic composition. Bold contrasts. Motion-inspired design. Athletic powerful feel.",
  },
  default: {
    visual_style: "Professional commercial advertising",
    background_style: "Clean gradient or studio white",
    color_palette: "Professional blue, clean white, subtle gray, accent gold",
    prompt_addition: "Professional commercial style. Clean modern composition. Studio-quality lighting. High-end marketplace aesthetic.",
  },
};

function getCategoryStyle(category: string): typeof CATEGORY_STYLES.default {
  const cat = (category || '').toLowerCase();
  if (cat.includes('parfum') || cat.includes('perfum') || cat.includes('atir') || cat.includes('духи') || cat.includes('парфюм')) return CATEGORY_STYLES.perfume;
  if (cat.includes('kosmet') || cat.includes('beauty') || cat.includes('косметик') || cat.includes('go\'zal')) return CATEGORY_STYLES.beauty;
  if (cat.includes('elektr') || cat.includes('techni') || cat.includes('gadget') || cat.includes('электрон') || cat.includes('texnik')) return CATEGORY_STYLES.electronics;
  if (cat.includes('kiyim') || cat.includes('fashion') || cat.includes('одежд') || cat.includes('мода') || cat.includes('обувь') || cat.includes('poyabzal')) return CATEGORY_STYLES.fashion;
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

  const productName = detection?.product_name || 'Premium Product';
  const features = detection?.key_features?.slice(0, 5)?.join(', ') || 'Yuqori sifat, Tez yetkazib berish, Eng yaxshi narx';
  const category = detection?.category || '';
  const positioning = detection?.positioning || 'mid-range';

  // Anti-repetition: vary layout based on seed
  const layoutVariations = [
    "Product on the LEFT side (40%), design elements on the RIGHT (60%). Headline at TOP.",
    "Product CENTERED (50%), features arranged as floating cards AROUND it. Badge at TOP-LEFT.",
    "Product at BOTTOM-CENTER (45%), large headline and features at TOP portion.",
    "Product on the RIGHT side (40%), selling points stacked on the LEFT. Banner at BOTTOM.",
  ];
  const layoutHint = layoutVariations[variationSeed % layoutVariations.length];

  const cardPrompt = `Create a HIGH-CONVERTING Pinterest-style marketplace product card.

Resolution: 1080x1440 vertical (portrait).

Product category: ${category}
Advertising style: ${categoryStyle.visual_style}
Background style: ${categoryStyle.background_style}
Color palette: ${categoryStyle.color_palette}
Market positioning: ${positioning}

Product name: ${productName}
Key benefits: ${features}
Highlight badge: ${positioning === 'premium' ? '⭐ PREMIUM' : '🔥 TOP SELLER'}

CATEGORY-SPECIFIC STYLE:
${categoryStyle.prompt_addition}

LAYOUT: ${layoutHint}

DESIGN RULES:
- Modern clean layout with strong visual hierarchy
- Product DOMINANT and clearly visible (40-55% of frame)
- The product from the reference photo must remain 100% PIXEL-PERFECT UNCHANGED
- 3-5 benefit icons/badges with short text in RUSSIAN or UZBEK
- Large bold headline in RUSSIAN or UZBEK (selling the product emotionally)
- Premium commercial lighting with realistic soft shadow
- ${categoryStyle.background_style} — NOT plain white
- No AI artifacts, no distorted text, no random typography
- Marketplace compliant (Uzum, Yandex, Wildberries)
- High CTR advertising quality
- This must look like a REAL commercial advertisement from a professional design agency
- DO NOT reuse common generic backgrounds
- Make this design UNIQUE for this specific product

ANTI-REPETITION: Variation seed #${variationSeed}. Do not create a generic template. Adapt EVERYTHING to this specific product and category.`;

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

      // ── STEP 4: Category-Based Marketplace Card ──
      const variationSeed = Math.floor(Math.random() * 100);
      let cardImage = await generateMarketplaceCard(
        workingImageUrl, detection, categoryStyle, OPENAI_API_KEY, variationSeed
      );

      let cardUrl: string | null = null;
      let qcResult: any = null;

      if (cardImage) {
        cardUrl = await uploadToStorage(supabase, cardImage, partnerId, `${offerId || 'card'}-card`);
        pipelineResult.steps.push({ step: 4, name: "Card Generation", status: "✅" });

        // ── STEP 5: Quality Control ──
        if (cardUrl) {
          qcResult = await qualityControl(cardUrl, OPENAI_API_KEY);
          pipelineResult.qualityControl = qcResult;
          pipelineResult.steps.push({ step: 5, name: "Quality Control", status: `Score: ${qcResult.overall_score}` });

          // ── Auto improvement loop (max 1 retry to avoid timeout) ──
          if (qcResult.overall_score < 70 && qcResult.improvements?.length) {
            console.log(`🔄 Score ${qcResult.overall_score} < 70 → Auto improvement loop...`);
            for (let retry = 0; retry < 1; retry++) {
              console.log(`🔄 Retry ${retry + 1}/1...`);
              const improvedCard = await generateMarketplaceCard(
                workingImageUrl, detection, categoryStyle, OPENAI_API_KEY, variationSeed + retry + 1
              );
              if (improvedCard) {
                const improvedUrl = await uploadToStorage(supabase, improvedCard, partnerId, `${offerId || 'card'}-card-v${retry + 2}`);
                if (improvedUrl) {
                  const newQc = await qualityControl(improvedUrl, OPENAI_API_KEY);
                  if (newQc.overall_score > (qcResult.overall_score || 0)) {
                    cardUrl = improvedUrl;
                    qcResult = newQc;
                    pipelineResult.qualityControl = newQc;
                    console.log(`✅ Improved: ${newQc.overall_score}`);
                  }
                  if (newQc.overall_score >= 70) {
                    console.log("✅ Quality threshold met!");
                    break;
                  }
                }
              }
            }
            pipelineResult.steps.push({ step: "5b", name: "Auto Improvement", status: `Final: ${qcResult.overall_score}` });
          }
        }
      } else {
        pipelineResult.steps.push({ step: 4, name: "Card Generation", status: "❌ Failed" });
      }

      pipelineResult.cardUrl = cardUrl;

      // ── STEP 6: Upload to Marketplace ──
      let mpResult: { success: boolean; message: string } = { success: false, message: 'Marketplace aniqlanmadi' };

      const uploadImageUrl = cardUrl || cleanImageUrl;
      if (marketplace && offerId && uploadImageUrl) {
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
            // Upload ONLY the generated card as main image — don't re-upload the original
            mpResult = await uploadToYandex(creds, offerId, uploadImageUrl);
          } else if (marketplace === 'wildberries' && nmID) {
            mpResult = await uploadToWildberries(creds, nmID, uploadImageUrl);
          }
        }
      }

      pipelineResult.marketplaceUpload = mpResult;
      pipelineResult.steps.push({ step: 6, name: "Marketplace Upload", status: mpResult.success ? "✅" : "⚠️" });

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 PIPELINE COMPLETE`);
      pipelineResult.steps.forEach((s: any) => console.log(`  Step ${s.step}: ${s.name} → ${s.status}`));
      console.log(`${'='.repeat(60)}\n`);

      return new Response(JSON.stringify({
        success: true,
        imageUrl: cleanImageUrl,
        cardUrl,
        infographicUrl: cardUrl, // backward compatibility
        qualityScore: qcResult?.overall_score || null,
        detection,
        pipeline: pipelineResult,
        marketplaceUpload: mpResult,
        message: mpResult.success
          ? `✅ AI pipeline: kartochka yaratildi (sifat: ${qcResult?.overall_score || '?'}/100) va marketplace'ga yuklandi`
          : `⚠️ Kartochka yaratildi (sifat: ${qcResult?.overall_score || '?'}/100). MP: ${mpResult.message}`,
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
