import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USD_TO_UZS = 12800;

interface CJVariant {
  vid: string;
  variantName: string;
  variantNameEn?: string;
  variantImage?: string;
  variantSku: string;
  variantSellPrice: number;
  variantInventory?: number;
  variantKey?: string;
  variantProperty?: string;
}

interface CJProductDetails {
  pid: string;
  productNameEn: string;
  productNameCn?: string;
  description?: string;
  productDescription?: string;
  sellPrice: number;
  productImage?: string;
  productImageSet?: string[];
  productVideo?: string;
  categoryName?: string;
  categoryNameEn?: string;
  productWeight?: number;
  productSku?: string;
  variants?: CJVariant[];
  packingWeight?: number;
  packingLength?: number;
  packingWidth?: number;
  packingHeight?: number;
  materialNameEn?: string;
}

interface ShippingOption {
  logisticName: string;
  logisticPrice: number;
  logisticPriceUZS: number;
  deliveryDays: string;
  logisticId: string;
}

interface ProductResponse {
  name: string;
  description: string;
  price: number;
  priceUSD: number;
  images: string[];
  video?: string;
  source_url: string;
  sku?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    priceUSD: number;
    image?: string;
    inventory?: number;
    properties?: string;
  }>;
  shippingOptions?: ShippingOption[];
  estimatedShippingCost?: number;
  estimatedShippingCostUSD?: number;
  source: string;
  category?: string;
  material?: string;
}

// Extract CJ product ID from URL
function extractCJProductId(url: string): string | null {
  const pMatch = url.match(/-p-(\d{10,})/i);
  if (pMatch) return pMatch[1];
  
  const directMatch = url.match(/\/product\/(\d{10,})/i);
  if (directMatch) return directMatch[1];
  
  const pidParam = url.match(/[?&]pid=([A-Za-z0-9-]+)/i);
  if (pidParam) return pidParam[1];
  
  return null;
}

// Fetch product from CJDropshipping API
async function fetchCJProduct(productId: string, token: string): Promise<CJProductDetails | null> {
  try {
    console.log('Fetching CJ product:', productId);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('CJ API result:', data.result, data.message);

    if (data.result === true && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('CJ API error:', error);
    return null;
  }
}

// Fetch variants from CJ
async function fetchCJVariants(productId: string, token: string): Promise<CJVariant[]> {
  try {
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/variant/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (data.result === true && data.data) {
      return data.data;
    }
    return [];
  } catch {
    return [];
  }
}

// Fetch shipping options
async function fetchShippingOptions(token: string, weight: number = 0.5): Promise<ShippingOption[]> {
  try {
    const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate', {
      method: 'POST',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startCountryCode: 'CN',
        endCountryCode: 'UZ',
        productWeight: weight,
        quantity: 1,
      }),
    });

    const data = await response.json();
    if (data.result === true && data.data) {
      return data.data.map((opt: any) => ({
        logisticName: opt.logisticName || 'Standard',
        logisticPrice: opt.logisticPrice || 0,
        logisticPriceUZS: Math.round((opt.logisticPrice || 0) * USD_TO_UZS),
        deliveryDays: opt.logisticAging || '15-30 days',
        logisticId: opt.logisticId || '',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// FIRECRAWL SCRAPING - Fallback method
async function scrapeWithFirecrawl(url: string): Promise<ProductResponse | null> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) {
    console.log('Firecrawl not configured');
    return null;
  }

  try {
    console.log('Scraping with Firecrawl:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl request failed:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Firecrawl success:', data.success);

    if (!data.success || !data.data) {
      return null;
    }

    const html = data.data.html || '';
    const markdown = data.data.markdown || '';
    const metadata = data.data.metadata || {};

    // Extract product data from scraped content
    const productData = extractProductFromScrapedContent(html, markdown, metadata, url);
    return productData;
  } catch (error) {
    console.error('Firecrawl error:', error);
    return null;
  }
}

// Extract product info from scraped HTML/markdown
function extractProductFromScrapedContent(
  html: string, 
  markdown: string, 
  metadata: any, 
  url: string
): ProductResponse {
  // Extract images from HTML
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1];
    if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('avatar')) {
      if (src.startsWith('http') && !images.includes(src)) {
        images.push(src);
      }
    }
  }

  // Also try data-src for lazy loaded images
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((imgMatch = dataSrcRegex.exec(html)) !== null) {
    const src = imgMatch[1];
    if (src && src.startsWith('http') && !images.includes(src)) {
      images.push(src);
    }
  }

  // Extract product-gallery images specifically
  const galleryRegex = /product-gallery[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi;
  while ((imgMatch = galleryRegex.exec(html)) !== null) {
    if (imgMatch[1] && !images.includes(imgMatch[1])) {
      images.unshift(imgMatch[1]); // Add to beginning as main images
    }
  }

  // Extract price
  let priceUSD = 10;
  const pricePatterns = [
    /\$\s*(\d+\.?\d*)/,
    /USD\s*(\d+\.?\d*)/i,
    /price["\s:]+(\d+\.?\d*)/i,
    /(\d+\.?\d*)\s*USD/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = html.match(pattern) || markdown.match(pattern);
    if (match) {
      const parsedPrice = parseFloat(match[1]);
      if (parsedPrice > 0 && parsedPrice < 10000) {
        priceUSD = parsedPrice;
        break;
      }
    }
  }

  // Extract name
  let name = metadata.title || 'Imported Product';
  // Clean up the name
  name = name
    .replace(/\s*[-|]\s*CJDropshipping.*$/i, '')
    .replace(/\s*[-|]\s*AliExpress.*$/i, '')
    .replace(/Buy\s+/i, '')
    .trim();

  // Extract description
  let description = metadata.description || '';
  
  // Try to extract from markdown
  if (!description && markdown) {
    const descMatch = markdown.match(/(?:Description|Product\s+Details?)[\s:]+([^\n]+)/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  // Extract variants from HTML (basic extraction)
  const variants: ProductResponse['variants'] = [];
  
  // Look for color/size options
  const variantPatterns = [
    /data-variant-id=["']([^"']+)["'][^>]*>([^<]+)/gi,
    /class=["'][^"']*variant[^"']*["'][^>]*>([^<]+)/gi,
    /option[^>]*value=["']([^"']+)["'][^>]*>([^<]*)/gi,
  ];

  for (const pattern of variantPatterns) {
    let varMatch;
    while ((varMatch = pattern.exec(html)) !== null) {
      const id = varMatch[1] || `v${variants.length}`;
      const varName = varMatch[2]?.trim() || varMatch[1];
      if (varName && varName.length < 50) {
        variants.push({
          id: id,
          name: varName,
          sku: `SKU-${id}`,
          price: Math.round(priceUSD * USD_TO_UZS),
          priceUSD: priceUSD,
        });
      }
    }
    if (variants.length > 0) break;
  }

  // Extract video if present
  let video: string | undefined;
  const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                     html.match(/data-video=["']([^"']+)["']/i);
  if (videoMatch) {
    video = videoMatch[1];
  }

  console.log(`Extracted: ${images.length} images, ${variants.length} variants, price: $${priceUSD}`);

  return {
    name: name.slice(0, 200),
    description: description.slice(0, 1000),
    price: Math.round(priceUSD * USD_TO_UZS),
    priceUSD: priceUSD,
    images: images.length > 0 ? images.slice(0, 20) : ['/placeholder.svg'],
    video: video,
    source_url: url,
    variants: variants.slice(0, 50),
    estimatedShippingCost: Math.round(5 * USD_TO_UZS),
    estimatedShippingCostUSD: 5,
    source: url.includes('cjdropshipping') ? 'cjdropshipping' : 
            url.includes('aliexpress') ? 'aliexpress' : 
            url.includes('1688') ? '1688' : 'other',
  };
}

// Build response from CJ data
function buildCJResponse(
  product: CJProductDetails,
  variants: CJVariant[],
  shippingOptions: ShippingOption[],
  sourceUrl: string
): ProductResponse {
  const priceUSD = product.sellPrice || 10;
  const images: string[] = [];
  
  if (product.productImage) images.push(product.productImage);
  if (product.productImageSet) {
    product.productImageSet.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  variants.forEach(v => {
    if (v.variantImage && !images.includes(v.variantImage)) {
      images.push(v.variantImage);
    }
  });

  const cheapestShipping = shippingOptions.length > 0
    ? shippingOptions.reduce((min, opt) => opt.logisticPrice < min.logisticPrice ? opt : min)
    : null;

  return {
    name: product.productNameEn || 'CJ Product',
    description: product.description || product.productDescription || `SKU: ${product.productSku || 'N/A'}`,
    price: Math.round(priceUSD * USD_TO_UZS),
    priceUSD: priceUSD,
    images: images.length > 0 ? images : ['/placeholder.svg'],
    video: product.productVideo || undefined,
    source_url: sourceUrl,
    sku: product.productSku,
    weight: product.packingWeight || product.productWeight,
    dimensions: product.packingLength ? {
      length: product.packingLength,
      width: product.packingWidth || 0,
      height: product.packingHeight || 0,
    } : undefined,
    variants: variants.map(v => ({
      id: v.vid,
      name: v.variantNameEn || v.variantName || 'Variant',
      sku: v.variantSku,
      price: Math.round(v.variantSellPrice * USD_TO_UZS),
      priceUSD: v.variantSellPrice,
      image: v.variantImage || undefined,
      inventory: v.variantInventory,
      properties: v.variantProperty || v.variantKey,
    })),
    shippingOptions: shippingOptions,
    estimatedShippingCost: cheapestShipping ? cheapestShipping.logisticPriceUZS : Math.round(5 * USD_TO_UZS),
    estimatedShippingCostUSD: cheapestShipping ? cheapestShipping.logisticPrice : 5,
    source: 'cjdropshipping',
    category: product.categoryNameEn || product.categoryName,
    material: product.materialNameEn,
  };
}

// AI fallback for parsing
async function analyzeWithAI(url: string): Promise<ProductResponse> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return createFallbackResponse(url);
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Extract product info from URL. Return JSON only: {"name":"...","description":"...","priceUSD":number}' 
          },
          { role: 'user', content: `URL: ${url}` }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return createFallbackResponse(url);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const priceUSD = parsed.priceUSD || 25;
      return {
        name: parsed.name || 'Imported Product',
        description: parsed.description || '',
        price: Math.round(priceUSD * USD_TO_UZS),
        priceUSD: priceUSD,
        images: ['/placeholder.svg'],
        source_url: url,
        estimatedShippingCost: Math.round(5 * USD_TO_UZS),
        estimatedShippingCostUSD: 5,
        source: 'other',
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return createFallbackResponse(url);
}

function createFallbackResponse(url: string): ProductResponse {
  return {
    name: 'Imported Product',
    description: 'Please edit product details manually',
    price: 128000,
    priceUSD: 10,
    images: ['/placeholder.svg'],
    source_url: url,
    estimatedShippingCost: 64000,
    estimatedShippingCostUSD: 5,
    source: 'manual',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    console.log('Processing URL:', url);

    const CJDROPSHIPPING_API_KEY = Deno.env.get('CJDROPSHIPPING_API_KEY');
    const isCJUrl = url.toLowerCase().includes('cjdropshipping.com');

    // METHOD 1: CJ API (if configured and is CJ URL)
    if (CJDROPSHIPPING_API_KEY && isCJUrl) {
      console.log('Trying CJ API...');
      
      const parts = CJDROPSHIPPING_API_KEY.split('@api@');
      const token = parts.length === 2 ? parts[1] : CJDROPSHIPPING_API_KEY;
      const productId = extractCJProductId(url);

      if (productId && token) {
        const product = await fetchCJProduct(productId, token);
        
        if (product) {
          console.log('CJ API success!');
          const [variants, shippingOptions] = await Promise.all([
            fetchCJVariants(product.pid || productId, token),
            fetchShippingOptions(token, product.packingWeight || 0.5),
          ]);

          const response = buildCJResponse(product, variants, shippingOptions, url);
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      console.log('CJ API failed, trying Firecrawl...');
    }

    // METHOD 2: Firecrawl scraping (fallback)
    const scrapedData = await scrapeWithFirecrawl(url);
    if (scrapedData && scrapedData.images.length > 1) {
      console.log('Firecrawl success!');
      return new Response(JSON.stringify(scrapedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // METHOD 3: AI analysis (last resort)
    console.log('Trying AI analysis...');
    const aiResult = await analyzeWithAI(url);
    
    return new Response(JSON.stringify(aiResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', errorMessage);
    
    return new Response(JSON.stringify(createFallbackResponse('')), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
