import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  sku?: string;
}

interface ShippingAddress {
  name: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  address: string;
  zipCode?: string;
}

interface CreateOrderRequest {
  orderId: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shippingMethod?: string;
  remark?: string;
}

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

// Extract JWT from various formats
function extractToken(apiKey: string): string {
  // Format: API@CJ2904420@CJ:eyJ...
  if (apiKey.includes('@CJ:')) {
    return apiKey.split('@CJ:')[1];
  }
  // Direct JWT
  if (apiKey.startsWith('eyJ')) {
    return apiKey;
  }
  return apiKey;
}

// Get access token - prefer cached/stored token
async function getCJAccessToken(): Promise<string | null> {
  // Check cached token
  if (cachedToken && tokenExpiry && tokenExpiry > new Date()) {
    console.log('Using cached token');
    return cachedToken;
  }

  // Check stored API key (might be a valid JWT)
  const storedKey = Deno.env.get('CJDROPSHIPPING_API_KEY');
  if (storedKey) {
    const token = extractToken(storedKey);
    if (token.startsWith('eyJ')) {
      // Validate token by decoding payload
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp || payload.iat + 15 * 24 * 60 * 60; // 15 days default
        const expiryDate = new Date(exp * 1000);
        
        if (expiryDate > new Date()) {
          console.log('Using stored JWT token, expires:', expiryDate.toISOString());
          cachedToken = token;
          tokenExpiry = expiryDate;
          return token;
        }
      } catch (e) {
        console.log('Could not parse stored token');
      }
    }
  }

  // Try to get fresh token
  const email = Deno.env.get('CJDROPSHIPPING_EMAIL');
  const password = Deno.env.get('CJDROPSHIPPING_PASSWORD');
  
  if (!email || !password) {
    console.log('No CJ credentials configured');
    return null;
  }

  try {
    console.log('Getting fresh CJ access token...');
    
    const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (data.result === true && data.data?.accessToken) {
      cachedToken = data.data.accessToken;
      tokenExpiry = new Date(data.data.accessTokenExpiryDate);
      console.log('Got fresh token, expires:', tokenExpiry.toISOString());
      return cachedToken;
    }
    
    console.error('CJ token error:', data.message);
    return null;
  } catch (error) {
    console.error('CJ auth error:', error);
    return null;
  }
}

// Create order on CJ
async function createCJOrder(token: string, orderData: CreateOrderRequest): Promise<any> {
  console.log('Creating CJ order:', orderData.orderId);
  
  const orderProducts = orderData.items.map(item => ({
    vid: item.variantId || item.productId,
    quantity: item.quantity,
  }));
  
  const cjOrderData = {
    orderNumber: orderData.orderId,
    shippingZip: orderData.shippingAddress.zipCode || '100000',
    shippingCountryCode: 'UZ',
    shippingCountry: orderData.shippingAddress.country || 'Uzbekistan',
    shippingProvince: orderData.shippingAddress.province,
    shippingCity: orderData.shippingAddress.city,
    shippingAddress: orderData.shippingAddress.address,
    shippingCustomerName: orderData.shippingAddress.name,
    shippingPhone: orderData.shippingAddress.phone,
    remark: orderData.remark || '',
    logisticName: orderData.shippingMethod || 'CJPacket Ordinary',
    fromCountryCode: 'CN',
    products: orderProducts,
  };

  const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder', {
    method: 'POST',
    headers: {
      'CJ-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cjOrderData),
  });

  return await response.json();
}

// Get order tracking info
async function getCJOrderTracking(token: string, orderId: string): Promise<any> {
  const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${orderId}`, {
    method: 'GET',
    headers: {
      'CJ-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'create';

    // Get access token
    const accessToken = await getCJAccessToken();
    
    if (!accessToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'CJ token not available. Please configure CJDROPSHIPPING_API_KEY with a valid JWT token.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'track') {
      const { cjOrderId } = await req.json();
      const trackingData = await getCJOrderTracking(accessToken, cjOrderId);
      
      return new Response(JSON.stringify({
        success: trackingData.result,
        data: trackingData.data,
        message: trackingData.message,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: create order
    const body: CreateOrderRequest = await req.json();
    
    if (!body.orderId || !body.items?.length || !body.shippingAddress) {
      throw new Error('Missing required fields: orderId, items, shippingAddress');
    }

    const createResult = await createCJOrder(accessToken, body);
    
    if (!createResult.result) {
      throw new Error(`CJ order failed: ${createResult.message}`);
    }

    // Update database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase
      .from('dropshipping_orders')
      .update({
        supplier_order_id: createResult.data?.orderId,
        supplier_order_status: 'created',
        supplier_response: createResult.data,
        ordered_at: new Date().toISOString(),
      })
      .eq('order_id', body.orderId);

    return new Response(JSON.stringify({
      success: true,
      cjOrderId: createResult.data?.orderId,
      message: 'Buyurtma CJ ga yuborildi',
      data: createResult.data,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
