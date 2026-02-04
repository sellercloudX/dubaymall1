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
  entryCode?: string;
  entryNameEn?: string;
  sourceFrom?: number;
  productType?: string;
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
  productType?: string;
}

// Extract CJ product ID from URL - the numeric ID after -p-
function extractCJProductId(url: string): string | null {
  // Format: /product/product-name-p-1234567890.html or /product/1234567890
  // The PID is the long numeric string
  
  // Try to extract from -p- format (most common)
  const pMatch = url.match(/-p-(\d{10,})/i);
  if (pMatch) {
    console.log('Extracted PID from -p- format:', pMatch[1]);
    return pMatch[1];
  }
  
  // Try direct numeric product ID
  const directMatch = url.match(/\/product\/(\d{10,})/i);
  if (directMatch) {
    console.log('Extracted PID from direct format:', directMatch[1]);
    return directMatch[1];
  }
  
  // Try pid parameter
  const pidParam = url.match(/[?&]pid=([A-Za-z0-9-]+)/i);
  if (pidParam) {
    console.log('Extracted PID from query param:', pidParam[1]);
    return pidParam[1];
  }
  
  // Try detail page format
  const detailMatch = url.match(/\/detail\/([A-Za-z0-9-]+)/i);
  if (detailMatch) {
    console.log('Extracted PID from detail format:', detailMatch[1]);
    return detailMatch[1];
  }
  
  console.log('Could not extract PID from URL:', url);
  return null;
}

// Fetch product details from CJDropshipping API v2.0
async function fetchCJProduct(productId: string, token: string): Promise<CJProductDetails | null> {
  try {
    console.log('Fetching CJ product with PID:', productId);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('CJ API Response status:', response.status);
    console.log('CJ API Response:', responseText.slice(0, 1000));

    if (!response.ok) {
      console.error('CJ API request failed:', response.status, responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    
    if (data.result === true && data.data) {
      console.log('Product found:', data.data.productNameEn);
      return data.data;
    }
    
    console.log('Product not found or API returned false:', data.message);
    return null;
  } catch (error) {
    console.error('Error fetching CJ product:', error);
    return null;
  }
}

// Fetch all variants for a product
async function fetchCJVariants(productId: string, token: string): Promise<CJVariant[]> {
  try {
    console.log('Fetching variants for PID:', productId);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/variant/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Variants API Response:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error('Variants request failed:', response.status);
      return [];
    }

    const data = JSON.parse(responseText);
    
    if (data.result === true && data.data) {
      console.log('Found variants:', data.data.length);
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching variants:', error);
    return [];
  }
}

// Fetch shipping options to Uzbekistan
async function fetchShippingOptions(productId: string, token: string, weight: number = 0.5): Promise<ShippingOption[]> {
  try {
    console.log('Fetching shipping for weight:', weight, 'kg');
    
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

    const responseText = await response.text();
    console.log('Shipping API Response:', responseText.slice(0, 500));

    if (!response.ok) {
      return [];
    }

    const data = JSON.parse(responseText);
    
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
  } catch (error) {
    console.error('Error fetching shipping:', error);
    return [];
  }
}

// Search products by name (fallback)
async function searchCJProducts(query: string, token: string): Promise<CJProductDetails | null> {
  try {
    console.log('Searching CJ products:', query);
    
    // Clean the search query
    const cleanQuery = query
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 5) // Take first 5 words
      .join(' ');
    
    console.log('Clean search query:', cleanQuery);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list?pageNum=1&pageSize=5&productNameEn=${encodeURIComponent(cleanQuery)}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Search API Response:', responseText.slice(0, 500));

    if (!response.ok) {
      return null;
    }

    const data = JSON.parse(responseText);
    
    if (data.result === true && data.data?.list?.length > 0) {
      console.log('Search found product:', data.data.list[0].productNameEn);
      return data.data.list[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching products:', error);
    return null;
  }
}

// Build comprehensive product response
function buildProductResponse(
  product: CJProductDetails,
  variants: CJVariant[],
  shippingOptions: ShippingOption[],
  sourceUrl: string
): ProductResponse {
  const priceUSD = product.sellPrice || 10;
  const priceUZS = Math.round(priceUSD * USD_TO_UZS);

  // Build images array from all sources
  const images: string[] = [];
  
  // Main product image
  if (product.productImage && product.productImage.trim()) {
    images.push(product.productImage);
  }
  
  // Product image set
  if (product.productImageSet && Array.isArray(product.productImageSet)) {
    product.productImageSet.forEach(img => {
      if (img && img.trim() && !images.includes(img)) {
        images.push(img);
      }
    });
  }
  
  // Variant images
  variants.forEach(v => {
    if (v.variantImage && v.variantImage.trim() && !images.includes(v.variantImage)) {
      images.push(v.variantImage);
    }
  });

  console.log('Total images collected:', images.length);

  // Build description
  let description = product.description || product.productDescription || '';
  if (!description && product.materialNameEn) {
    description = `Material: ${product.materialNameEn}`;
  }
  if (product.productSku) {
    description += description ? `\n\nSKU: ${product.productSku}` : `SKU: ${product.productSku}`;
  }

  // Get cheapest shipping
  const cheapestShipping = shippingOptions.length > 0
    ? shippingOptions.reduce((min, opt) => opt.logisticPrice < min.logisticPrice ? opt : min)
    : null;

  // Map variants
  const mappedVariants = variants.map(v => ({
    id: v.vid,
    name: v.variantNameEn || v.variantName || 'Variant',
    sku: v.variantSku,
    price: Math.round(v.variantSellPrice * USD_TO_UZS),
    priceUSD: v.variantSellPrice,
    image: v.variantImage || undefined,
    inventory: v.variantInventory,
    properties: v.variantProperty || v.variantKey,
  }));

  console.log('Mapped variants:', mappedVariants.length);

  return {
    name: product.productNameEn || 'CJ Product',
    description: description || 'Product from CJDropshipping',
    price: priceUZS,
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
    variants: mappedVariants,
    shippingOptions: shippingOptions,
    estimatedShippingCost: cheapestShipping ? cheapestShipping.logisticPriceUZS : Math.round(5 * USD_TO_UZS),
    estimatedShippingCostUSD: cheapestShipping ? cheapestShipping.logisticPrice : 5,
    source: 'cjdropshipping',
    category: product.categoryNameEn || product.categoryName,
    material: product.materialNameEn,
    productType: product.productType,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    console.log('Processing URL:', url);

    const CJDROPSHIPPING_API_KEY = Deno.env.get('CJDROPSHIPPING_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const isCJUrl = url.toLowerCase().includes('cjdropshipping.com') || url.toLowerCase().includes('cj.com');
    
    // Try CJDropshipping API
    if (CJDROPSHIPPING_API_KEY && isCJUrl) {
      console.log('Using CJDropshipping API...');
      
      // Extract token from API key (format: email@api@token)
      const parts = CJDROPSHIPPING_API_KEY.split('@api@');
      const token = parts.length === 2 ? parts[1] : CJDROPSHIPPING_API_KEY;
      
      if (!token) {
        throw new Error('Invalid CJ API key format');
      }

      // Extract product ID from URL
      const productId = extractCJProductId(url);
      console.log('Extracted product ID:', productId);

      let product: CJProductDetails | null = null;

      // Try direct lookup first
      if (productId) {
        product = await fetchCJProduct(productId, token);
      }

      // If not found, try search by product name from URL
      if (!product) {
        // Extract name from URL for search
        const urlPath = new URL(url).pathname;
        const nameMatch = urlPath.match(/\/product\/([^/]+)/);
        if (nameMatch) {
          const searchName = nameMatch[1]
            .replace(/-p-\d+/g, '')
            .replace(/\.html$/i, '')
            .replace(/-/g, ' ');
          console.log('Searching by name:', searchName);
          product = await searchCJProducts(searchName, token);
        }
      }

      if (product) {
        // Fetch variants and shipping in parallel
        const actualPid = product.pid || productId || '';
        const [variants, shippingOptions] = await Promise.all([
          fetchCJVariants(actualPid, token),
          fetchShippingOptions(actualPid, token, product.packingWeight || 0.5),
        ]);

        const response = buildProductResponse(product, variants, shippingOptions, url);

        console.log('Returning product with', response.images.length, 'images and', response.variants?.length || 0, 'variants');

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Product not found via CJ API, falling back to AI analysis');
    }

    // Fallback: Use AI to analyze URL
    if (!LOVABLE_API_KEY) {
      throw new Error('No API keys configured for analysis');
    }

    const prompt = `Analyze this e-commerce product URL and extract product information.

URL: ${url}

Based on the URL structure and common e-commerce patterns, provide a JSON response with:
- name: Product name (extract from URL if possible)
- description: A brief product description based on URL keywords
- priceUSD: Estimated price in USD (10-50 range for typical products)
- images: Array with placeholder image URL

Response MUST be valid JSON only:
{
  "name": "Product Name",
  "description": "Product description",
  "priceUSD": 25,
  "images": ["/placeholder.svg"]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts product information from e-commerce URLs. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to analyze URL');
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    let productData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      productData = {
        name: 'Imported Product',
        description: 'Product imported from external source',
        priceUSD: 25,
        images: ['/placeholder.svg']
      };
    }

    const priceUSD = productData.priceUSD || 25;
    const fullResponse: ProductResponse = {
      name: productData.name || 'Imported Product',
      description: productData.description || '',
      price: Math.round(priceUSD * USD_TO_UZS),
      priceUSD: priceUSD,
      images: productData.images || ['/placeholder.svg'],
      source_url: url,
      estimatedShippingCost: Math.round(5 * USD_TO_UZS),
      estimatedShippingCostUSD: 5,
      source: url.includes('aliexpress') ? 'aliexpress' : url.includes('1688') ? '1688' : 'other',
    };

    return new Response(JSON.stringify(fullResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in analyze-dropshipping-url:', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      name: 'Imported Product',
      description: 'Please edit product details manually',
      price: 100000,
      priceUSD: 8,
      images: ['/placeholder.svg'],
      estimatedShippingCost: 64000,
      estimatedShippingCostUSD: 5,
      source: 'manual',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
