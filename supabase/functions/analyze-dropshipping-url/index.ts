import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CJProductResponse {
  code: number;
  result: boolean;
  message: string;
  data?: {
    productNameEn: string;
    productNameCn?: string;
    description?: string;
    sellPrice: number;
    productImage?: string;
    productImageSet?: string[];
    categoryName?: string;
    productWeight?: number;
    productSku?: string;
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

    const CJDROPSHIPPING_API_KEY = Deno.env.get('CJDROPSHIPPING_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Extract product ID from CJDropshipping URL
    const cjProductIdMatch = url.match(/\/product\/(\d+)/i) || url.match(/pid=(\d+)/i);
    
    // Try CJDropshipping API if it's a CJ URL and we have the key
    if (CJDROPSHIPPING_API_KEY && (url.includes('cjdropshipping.com') || cjProductIdMatch)) {
      console.log('Using CJDropshipping API...');
      
      try {
        // Extract API credentials from the key format: email@api@token
        const apiParts = CJDROPSHIPPING_API_KEY.split('@api@');
        const email = apiParts[0] || '';
        const token = apiParts[1] || CJDROPSHIPPING_API_KEY;
        
        // Try to get product details from CJ API
        const productId = cjProductIdMatch?.[1];
        
        if (productId) {
          const cjResponse = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query`, {
            method: 'POST',
            headers: {
              'CJ-Access-Token': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pid: productId
            }),
          });
          
          if (cjResponse.ok) {
            const cjData: CJProductResponse = await cjResponse.json();
            
            if (cjData.result && cjData.data) {
              const product = cjData.data;
              const priceUZS = Math.round((product.sellPrice || 10) * 12800); // USD to UZS
              
              const images = product.productImageSet?.length 
                ? product.productImageSet 
                : product.productImage 
                  ? [product.productImage]
                  : ['/placeholder.svg'];
              
              return new Response(JSON.stringify({
                name: product.productNameEn || 'CJ Product',
                description: product.description || `SKU: ${product.productSku || 'N/A'}. Kategoriya: ${product.categoryName || 'Umumiy'}`,
                price: priceUZS,
                images: images,
                sku: product.productSku,
                weight: product.productWeight,
                source: 'cjdropshipping',
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } else {
            console.log('CJ API response not OK:', await cjResponse.text());
          }
        }
        
        // Try product list search if direct lookup fails
        const searchQuery = url.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, ' ').trim();
        if (searchQuery) {
          const searchResponse = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list`, {
            method: 'POST',
            headers: {
              'CJ-Access-Token': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productNameEn: searchQuery,
              pageNum: 1,
              pageSize: 1,
            }),
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.result && searchData.data?.list?.length > 0) {
              const product = searchData.data.list[0];
              const priceUZS = Math.round((product.sellPrice || 10) * 12800);
              
              return new Response(JSON.stringify({
                name: product.productNameEn || 'CJ Product',
                description: product.description || 'CJDropshipping mahsuloti',
                price: priceUZS,
                images: product.productImage ? [product.productImage] : ['/placeholder.svg'],
                source: 'cjdropshipping',
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }
      } catch (cjError) {
        console.error('CJ API error:', cjError);
      }
    }

    // Fallback: Use AI to analyze URL patterns
    if (!LOVABLE_API_KEY) {
      throw new Error('No API keys configured');
    }

    const prompt = `Analyze this e-commerce product URL and extract product information.

URL: ${url}

Based on the URL structure and common e-commerce patterns, provide a JSON response with:
- name: Product name (if extractable from URL, otherwise generate a reasonable name based on URL patterns)
- description: A brief product description
- price: Estimated price in UZS (Uzbek Sum) - use 100000-500000 range for typical products
- images: Array with placeholder image URL

Response MUST be valid JSON only:
{
  "name": "Product Name",
  "description": "Product description",
  "price": 150000,
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
        price: 150000,
        images: ['/placeholder.svg']
      };
    }

    return new Response(JSON.stringify(productData), {
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
      images: ['/placeholder.svg']
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
