import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PaymentMethods } from '@/components/payment/PaymentMethods';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  CreditCard, 
  Truck,
  MapPin,
  Loader2,
  CheckCircle,
  Pencil
} from 'lucide-react';

// Installment calculation formulas
const calculateInstallment24 = (price: number): number => Math.round((price * 1.6) / 24);
const calculateInstallment12 = (price: number): number => Math.round((price * 1.45) / 12);

export default function CheckoutPage() {
  const { t } = useLanguage();
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    region: '',
    city: '',
    address: '',
    notes: '',
    paymentMethod: 'cash',
  });

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, region, city, address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          setFormData(prev => ({
            ...prev,
            name: profile.full_name || '',
            phone: profile.phone || '',
            region: profile.region || '',
            city: profile.city || '',
            address: profile.address || '',
          }));
          // If all required fields are filled, don't show edit mode
          if (profile.full_name && profile.phone && profile.region && profile.city && profile.address) {
            setIsEditing(false);
          } else {
            setIsEditing(true);
          }
        } else {
          setIsEditing(true);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setIsEditing(true);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Save address to profile when submitting
  const saveAddressToProfile = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone,
          region: formData.region,
          city: formData.city,
          address: formData.address,
        })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error saving address:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error(t.loginRequired || 'Tizimga kiring');
      return;
    }

    if (!formData.name || !formData.phone || !formData.region || !formData.city || !formData.address) {
      toast.error(t.fillAllFields || 'Barcha maydonlarni to\'ldiring');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, '').replace('+998', '+998 '))) {
      toast.error('Telefon raqami noto\'g\'ri formatda. Masalan: +998 90 123 45 67');
      return;
    }

    setLoading(true);

    try {
      // Save address to profile for future use
      await saveAddressToProfile();

      // Calculate shipping cost for the order
      const orderShippingCost = items.reduce((sum, item) => {
        if (item.product?.free_shipping) return sum;
        return sum + (item.product?.shipping_price || 0) * item.quantity;
      }, 0);
      const orderGrandTotal = totalPrice + orderShippingCost;

      // Generate order number
      const orderNum = 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + 
        Math.random().toString(36).substring(2, 8).toUpperCase();

      // Determine payment status based on method
      const isOnlinePayment = ['payme', 'click', 'uzcard'].includes(formData.paymentMethod);
      const isInstallment = formData.paymentMethod.startsWith('installment_');
      const paymentStatus = isInstallment ? 'installment_pending' : (isOnlinePayment ? 'pending' : 'cash_on_delivery');

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNum,
          total_amount: orderGrandTotal,
          shipping_address: {
            name: formData.name,
            phone: formData.phone,
            region: formData.region,
            city: formData.city,
            address: formData.address,
          },
          payment_method: formData.paymentMethod,
          payment_status: paymentStatus,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product?.name || '',
        product_price: item.product?.price || 0,
        quantity: item.quantity,
        subtotal: (item.product?.price || 0) * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Calculate order financials (platform commission, seller net, etc.)
      try {
        await supabase.rpc('calculate_order_financials', {
          p_order_id: order.id,
          p_platform_commission_percent: 5 // Default 5%, can be dynamic from platform_settings
        });
      } catch (finError) {
        console.error('Financial calculation error:', finError);
        // Don't fail order if financial calc fails
      }

      // If online payment, show payment modal
      if (isOnlinePayment) {
        setPendingOrder({ id: order.id, orderNumber: orderNum });
        setShowPaymentModal(true);
        setLoading(false);
        return;
      }

      // For cash payment, complete order
      await clearCart();
      setOrderNumber(orderNum);
      setOrderSuccess(true);
      toast.success(t.orderSuccess || 'Buyurtma muvaffaqiyatli qabul qilindi!');

    } catch (error: any) {
      console.error('Order error:', error);
      toast.error(error.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingOrder) return;

    try {
      // Update payment status
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', pendingOrder.id);

      await clearCart();
      setOrderNumber(pendingOrder.orderNumber);
      setOrderSuccess(true);
      setPendingOrder(null);
      toast.success('To\'lov muvaffaqiyatli amalga oshirildi!');
    } catch (error) {
      console.error('Payment update error:', error);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-4">{t.checkout || 'Buyurtma berish'}</h2>
          <p className="text-muted-foreground mb-6">
            {t.loginToCheckout || 'Buyurtma berish uchun tizimga kiring'}
          </p>
          <Button asChild>
            <Link to="/auth">{t.login}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (items.length === 0 && !orderSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-4">{t.cartEmpty || 'Savatcha bo\'sh'}</h2>
          <Button asChild>
            <Link to="/">{t.marketplace}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (orderSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="bg-primary/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t.orderSuccess || 'Buyurtma qabul qilindi!'}</h2>
          <p className="text-muted-foreground mb-6">
            {t.orderNumber || 'Buyurtma raqami'}: <span className="font-mono font-bold">{orderNumber}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            {t.orderConfirmation || 'Tez orada operatorimiz siz bilan bog\'lanadi'}
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link to="/dashboard">{t.myOrders || 'Buyurtmalarim'}</Link>
            </Button>
            <Button asChild>
              <Link to="/">{t.continueShopping || 'Xaridni davom ettirish'}</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{t.checkout || 'Buyurtma berish'}</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Shipping Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {t.shippingAddress || 'Yetkazib berish manzili'}
                    </div>
                    {!isEditing && formData.name && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="gap-1"
                      >
                        <Pencil className="h-4 w-4" />
                        Tahrirlash
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profileLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !isEditing && formData.name && formData.phone && formData.region && formData.city && formData.address ? (
                    // Show saved address in read mode
                    <div className="space-y-3 py-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{formData.name}</p>
                          <p className="text-sm text-muted-foreground">{formData.phone}</p>
                        </div>
                      </div>
                      <div className="text-sm text-foreground">
                        <p>{formData.region}, {formData.city}</p>
                        <p>{formData.address}</p>
                      </div>
                    </div>
                  ) : (
                    // Edit mode - show form
                    <>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">{t.fullName} *</Label>
                          <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Ismingiz"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t.phone} *</Label>
                          <Input
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="+998 90 123 45 67"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="region">{t.region || 'Viloyat'} *</Label>
                          <Input
                            id="region"
                            name="region"
                            value={formData.region}
                            onChange={handleInputChange}
                            placeholder="Toshkent viloyati"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">{t.city || 'Shahar/Tuman'} *</Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder="Toshkent"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">{t.address || 'To\'liq manzil'} *</Label>
                        <Input
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Ko'cha, uy raqami"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">{t.notes || 'Izoh'}</Label>
                        <Textarea
                          id="notes"
                          name="notes"
                          value={formData.notes}
                          onChange={handleInputChange}
                          placeholder="Qo'shimcha ma'lumotlar..."
                          rows={3}
                        />
                      </div>
                      {!profileLoading && isEditing && formData.name && (
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                          className="w-full"
                        >
                          Bekor qilish
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t.paymentMethod || 'To\'lov usuli'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentMethods
                    value={formData.paymentMethod}
                    onChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                    totalAmount={totalPrice}
                    showInstallments={true}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>{t.orderSummary || 'Buyurtma'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {item.product?.images?.[0] && (
                          <img 
                            src={item.product.images[0]} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-1">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} x {formatPrice(item.product?.price || 0)}</p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatPrice((item.product?.price || 0) * item.quantity)}
                      </p>
                    </div>
                  ))}
                  
                  <Separator />
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.productsCount || 'Mahsulotlar'}</span>
                    <span>{totalItems} dona</span>
                  </div>
                  {(() => {
                    const shippingTotal = items.reduce((sum, item) => {
                      if (item.product?.free_shipping) return sum;
                      return sum + (item.product?.shipping_price || 0) * item.quantity;
                    }, 0);
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t.delivery || 'Yetkazib berish'}</span>
                        {shippingTotal > 0 ? (
                          <span>{formatPrice(shippingTotal)}</span>
                        ) : (
                          <span className="text-primary">{t.free || 'Bepul'}</span>
                        )}
                      </div>
                    );
                  })()}
                  
                  <Separator />
                  
                  {(() => {
                    const shippingCost = items.reduce((sum, item) => {
                      if (item.product?.free_shipping) return sum;
                      return sum + (item.product?.shipping_price || 0) * item.quantity;
                    }, 0);
                    const grandTotal = totalPrice + shippingCost;
                    return (
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t.total || 'Jami'}</span>
                        <span className="text-primary whitespace-nowrap">{formatPrice(grandTotal)}</span>
                      </div>
                    );
                  })()}
                  
                  {/* Installment info */}
                  {formData.paymentMethod.startsWith('installment_') && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {formData.paymentMethod === 'installment_12' ? '12 oylik' : '24 oylik'} muddatli to'lov
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Oylik to'lov: <span className="font-bold">
                          {formatPrice(
                            formData.paymentMethod === 'installment_12' 
                              ? Math.round((totalPrice * 1.45) / 12)
                              : Math.round((totalPrice * 1.6) / 24)
                          )}
                        </span> so'm
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.processing || 'Jarayonda...'}
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        {t.placeOrder || 'Buyurtma berish'}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </form>

        {/* Payment Modal */}
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
          paymentMethod={formData.paymentMethod}
          amount={totalPrice}
          orderNumber={pendingOrder?.orderNumber || ''}
          orderId={pendingOrder?.id}
        />
      </div>
    </Layout>
  );
}
