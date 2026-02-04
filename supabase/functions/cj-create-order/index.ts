import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  productId: string;  // CJ product ID
  variantId?: string; // CJ variant ID
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
  orderId: string;      // Our internal order ID
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shippingMethod?: string;
  remark?: string;
}

// Get fresh access token from CJ
async function getCJAccessToken(email: string, apiKey: string): Promise<string | null> {
  try {
    console.log('Getting CJ access token...');
    
    const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: apiKey,
      }),
    });

    const data = await response.json();
    
    if (data.result === true && data.data?.accessToken) {
      console.log('Got CJ access token, expires:', data.data.accessTokenExpiryDate);
      return data.data.accessToken;
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
  try {
    console.log('Creating CJ order...');
    
    // Build order products list
    const orderProducts = orderData.items.map(item => ({
      vid: item.variantId || item.productId,
      quantity: item.quantity,
    }));
    
    const cjOrderData = {
      orderNumber: orderData.orderId,
      shippingZip: orderData.shippingAddress.zipCode || '100000',
      shippingCountryCode: 'UZ', // Uzbekistan
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

    const data = await response.json();
    console.log('CJ order result:', data.result, data.message);
    
    return data;
  } catch (error) {
    console.error('CJ create order error:', error);
    return { result: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Confirm and pay for CJ order
async function confirmCJOrder(token: string, orderId: string): Promise<any> {
  try {
    console.log('Confirming CJ order:', orderId);
    
    const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/confirmOrder', {
      method: 'PATCH',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
      }),
    });

    const data = await response.json();
    console.log('CJ confirm result:', data.result, data.message);
    
    return data;
  } catch (error) {
    console.error('CJ confirm error:', error);
    return { result: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get CJ credentials
    const CJ_EMAIL = Deno.env.get('CJDROPSHIPPING_EMAIL') || 'rasmiydorixona@gmail.com';
    const CJ_API_KEY = Deno.env.get('CJDROPSHIPPING_PASSWORD') || 'eadae9b674f046f7907788a99bd0371d';
    
    if (!CJ_EMAIL || !CJ_API_KEY) {
      throw new Error('CJ credentials not configured');
    }

    const body: CreateOrderRequest = await req.json();
    
    if (!body.orderId || !body.items || body.items.length === 0 || !body.shippingAddress) {
      throw new Error('Missing required fields: orderId, items, shippingAddress');
    }

    console.log('Processing order:', body.orderId);
    console.log('Items:', body.items.length);

    // Step 1: Get fresh access token
    const accessToken = await getCJAccessToken(CJ_EMAIL, CJ_API_KEY);
    
    if (!accessToken) {
      throw new Error('Failed to get CJ access token');
    }

    // Step 2: Create order on CJ
    const createResult = await createCJOrder(accessToken, body);
    
    if (!createResult.result) {
      throw new Error(`CJ order creation failed: ${createResult.message}`);
    }

    const cjOrderId = createResult.data?.orderId;
    
    // Step 3: Confirm order (optional - depends on account settings)
    // const confirmResult = await confirmCJOrder(accessToken, cjOrderId);

    // Initialize Supabase client to update our database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update dropshipping_orders table
    const { error: updateError } = await supabase
      .from('dropshipping_orders')
      .update({
        supplier_order_id: cjOrderId,
        supplier_order_status: 'created',
        supplier_response: createResult.data,
        ordered_at: new Date().toISOString(),
      })
      .eq('order_id', body.orderId);

    if (updateError) {
      console.error('Failed to update dropshipping_orders:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      cjOrderId: cjOrderId,
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
