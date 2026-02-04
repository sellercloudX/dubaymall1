import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USD_TO_UZS = 12800; // Current exchange rate

interface CJVariant {
  vid: string;
  variantName: string;
  variantImage?: string;
  variantSku: string;
  variantSellPrice: number;
  variantInventory?: number;
}

interface CJProductDetails {
  pid: string;
  productNameEn: string;
  productNameCn?: string;
  description?: string;
  sellPrice: number;
  productImage?: string;
  productImageSet?: string[];
  productVideo?: string;
  categoryName?: string;
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
  }>;
  shippingOptions?: ShippingOption[];
  estimatedShippingCost?: number;
  estimatedShippingCostUSD?: number;
  source: string;
  category?: string;
  material?: string;
}

// Extract product ID from various URL formats
function extractProductId(url: string): string | null {
  // CJDropshipping formats: /product/xxxxx, pid=xxxxx
  const cjMatch = url.match(/\/product\/([a-zA-Z0-9-]+)/i) || 
                  url.match(/pid=([a-zA-Z0-9-]+)/i) ||
                  url.match(/detail\/([a-zA-Z0-9-]+)/i);
  if (cjMatch) return cjMatch[1];
  
  // AliExpress format: /item/xxxxx.html
  const aliMatch = url.match(/\/item\/(\d+)\.html/i) ||
                   url.match(/\/item\/(\d+)/i);
  if (aliMatch) return aliMatch[1];
  
  // 1688 format
  const taobaoMatch = url.match(/offer\/(\d+)\.html/i);
  if (taobaoMatch) return taobaoMatch[1];
  
  return null;
}

// Get CJ Access Token
async function getCJAccessToken(apiKey: string): Promise<string | null> {
  try {
    // Format: email@api@token
    const parts = apiKey.split('@api@');
    if (parts.length === 2) {
      return parts[1];
    }
    return apiKey;
  } catch {
    return null;
  }
}

// Fetch product details from CJDropshipping
async function fetchCJProduct(productId: string, token: string): Promise<CJProductDetails | null> {
  try {
    console.log('Fetching CJ product details for:', productId);
    
    // Try to get product details
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('CJ product query failed, trying list search...');
      return null;
    }

    const data = await response.json();
    console.log('CJ API response:', JSON.stringify(data).slice(0, 500));

    if (data.result && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching CJ product:', error);
    return null;
  }
}

// Fetch product variants from CJDropshipping
async function fetchCJVariants(productId: string, token: string): Promise<CJVariant[]> {
  try {
    console.log('Fetching CJ variants for:', productId);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/variant/query?pid=${productId}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.result && data.data) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching CJ variants:', error);
    return [];
  }
}

// Calculate shipping cost estimate
async function fetchShippingOptions(productId: string, token: string, weight: number = 0.5): Promise<ShippingOption[]> {
  try {
    console.log('Fetching shipping options...');
    
    // Get shipping estimate to Uzbekistan
    const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate', {
      method: 'POST',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productWeight: weight,
        countryCode: 'UZ', // Uzbekistan
        startCountryCode: 'CN', // From China
        quantity: 1,
      }),
    });

    if (!response.ok) {
      console.log('Shipping calculation failed');
      return [];
    }

    const data = await response.json();
    if (data.result && data.data) {
      return data.data.map((option: any) => ({
        logisticName: option.logisticName || 'Standard Shipping',
        logisticPrice: option.logisticPrice || 0,
        logisticPriceUZS: Math.round((option.logisticPrice || 0) * USD_TO_UZS),
        deliveryDays: option.logisticAging || '15-30',
        logisticId: option.logisticId || '',
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching shipping:', error);
    return [];
  }
}

// Search CJ products by keyword
async function searchCJProducts(keyword: string, token: string): Promise<CJProductDetails | null> {
  try {
    console.log('Searching CJ products for:', keyword);
    
    const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list?pageNum=1&pageSize=1&productNameEn=${encodeURIComponent(keyword)}`, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result && data.data?.list?.length > 0) {
      return data.data.list[0];
    }
    return null;
  } catch (error) {
    console.error('Error searching CJ products:', error);
    return null;
  }
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

    const CJDROPSHIPPING_API_KEY = Deno.env.get('CJDROPSHIPPING_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const productId = extractProductId(url);
    const isCJUrl = url.includes('cjdropshipping.com') || url.includes('cj.com');
    
    // Try CJDropshipping API
    if (CJDROPSHIPPING_API_KEY && (isCJUrl || productId)) {
      console.log('Using CJDropshipping API...');
      
      const token = await getCJAccessToken(CJDROPSHIPPING_API_KEY);
      if (!token) {
        throw new Error('Invalid CJ API key format');
      }

      let product: CJProductDetails | null = null;

      // Try direct product lookup first
      if (productId) {
        product = await fetchCJProduct(productId, token);
      }

      // If not found, try search
      if (!product && isCJUrl) {
        const searchQuery = url.split('/').pop()?.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        if (searchQuery) {
          product = await searchCJProducts(searchQuery, token);
        }
      }

      if (product) {
        // Fetch additional data in parallel
        const [variants, shippingOptions] = await Promise.all([
          fetchCJVariants(product.pid || productId || '', token),
          fetchShippingOptions(product.pid || productId || '', token, product.packingWeight || 0.5),
        ]);

        const priceUSD = product.sellPrice || 10;
        const priceUZS = Math.round(priceUSD * USD_TO_UZS);

        // Build comprehensive images array
        const images: string[] = [];
        if (product.productImage) images.push(product.productImage);
        if (product.productImageSet?.length) {
          product.productImageSet.forEach(img => {
            if (!images.includes(img)) images.push(img);
          });
        }
        // Add variant images
        variants.forEach(v => {
          if (v.variantImage && !images.includes(v.variantImage)) {
            images.push(v.variantImage);
          }
        });

        // Default shipping estimate (cheapest option)
        const cheapestShipping = shippingOptions.length > 0 
          ? shippingOptions.reduce((min, opt) => opt.logisticPrice < min.logisticPrice ? opt : min)
          : null;

        const response: ProductResponse = {
          name: product.productNameEn || 'CJ Product',
          description: product.description || `SKU: ${product.productSku || 'N/A'}. Material: ${product.materialNameEn || 'N/A'}`,
          price: priceUZS,
          priceUSD: priceUSD,
          images: images.length > 0 ? images : ['/placeholder.svg'],
          video: product.productVideo || undefined,
          source_url: url,
          sku: product.productSku,
          weight: product.packingWeight,
          dimensions: product.packingLength ? {
            length: product.packingLength,
            width: product.packingWidth || 0,
            height: product.packingHeight || 0,
          } : undefined,
          variants: variants.map(v => ({
            id: v.vid,
            name: v.variantName,
            sku: v.variantSku,
            price: Math.round(v.variantSellPrice * USD_TO_UZS),
            priceUSD: v.variantSellPrice,
            image: v.variantImage,
            inventory: v.variantInventory,
          })),
          shippingOptions: shippingOptions,
          estimatedShippingCost: cheapestShipping ? cheapestShipping.logisticPriceUZS : Math.round(5 * USD_TO_UZS),
          estimatedShippingCostUSD: cheapestShipping ? cheapestShipping.logisticPrice : 5,
          source: 'cjdropshipping',
          category: product.categoryName,
          material: product.materialNameEn,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback: Use AI to analyze URL patterns
    if (!LOVABLE_API_KEY) {
      throw new Error('No API keys configured');
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
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts product information from e-commerce URLs. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
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
        throw new Error('No JSON found in response');
      }
    } catch {
      console.error('Failed to parse AI response:', content);
      productData = {
        name: 'Imported Product',
        description: 'Product imported from external source',
        priceUSD: 25,
        images: ['/placeholder.svg']
      };
    }

    // Convert to full response format
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
      source: url.includes('aliexpress') ? 'aliexpress' : 
              url.includes('1688') ? '1688' : 'other',
    };

    return new Response(JSON.stringify(fullResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in analyze-dropshipping-url:', errorMessage);
    
    // Return fallback data on error
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
