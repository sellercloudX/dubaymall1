import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  Package,
  ArrowRight 
} from 'lucide-react';

export default function CartPage() {
  const { t } = useLanguage();
  const { items, loading, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const { user } = useAuth();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-4">{t.cart || 'Savatcha'}</h2>
          <p className="text-muted-foreground mb-6">
            {t.loginToViewCart || 'Savatchani ko\'rish uchun tizimga kiring'}
          </p>
          <Button asChild>
            <Link to="/auth">{t.login}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-4">{t.cartEmpty || 'Savatcha bo\'sh'}</h2>
          <p className="text-muted-foreground mb-6">
            {t.cartEmptyDesc || 'Hali hech narsa qo\'shmagansiz'}
          </p>
          <Button asChild>
            <Link to="/marketplace">{t.marketplace}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{t.cart || 'Savatcha'}</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                      <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden">
                        {item.product?.images && item.product.images.length > 0 ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product?.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/product/${item.product_id}`}
                        className="font-semibold hover:text-primary line-clamp-2"
                      >
                        {item.product?.name}
                      </Link>
                      <p className="text-primary font-bold mt-1">
                        {formatPrice(item.product?.price || 0)}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            disabled={item.quantity >= (item.product?.stock_quantity || 0)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeFromCart(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Subtotal (desktop) */}
                    <div className="hidden sm:block text-right">
                      <p className="text-sm text-muted-foreground">{t.subtotal || 'Jami'}</p>
                      <p className="font-bold">
                        {formatPrice((item.product?.price || 0) * item.quantity)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{t.orderSummary || 'Buyurtma ma\'lumotlari'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.productsCount || 'Mahsulotlar'} ({totalItems})
                  </span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.delivery}</span>
                  <span className="text-emerald-600">{t.free}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t.total || 'Jami'}</span>
                  <span className="text-primary">{formatPrice(totalPrice)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full gap-2" size="lg">
                  <Link to="/checkout">
                    {t.checkout || 'Buyurtma berish'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
