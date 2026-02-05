import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEOHead, StructuredData } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useRecentlyViewed } from '@/hooks/useRecommendations';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductReviews } from '@/components/reviews/ProductReviews';
import { ProductRecommendations } from '@/components/marketplace/ProductRecommendations';
import { StarRating } from '@/components/reviews/StarRating';
import { useProductRating } from '@/hooks/useReviews';
import { 
  ShoppingCart, 
  Heart, 
  Minus, 
  Plus, 
  Store, 
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Truck,
  CreditCard,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'> & { 
  shop?: Tables<'shops'>;
  category?: Tables<'categories'>;
};

// Format product name - first letter uppercase, rest lowercase
const formatProductName = (name: string): string => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

// Calculate delivery date
const calculateDeliveryDate = (preparationDays: number = 1): { date: string; fullDate: string } => {
  const today = new Date();
  const deliveryDays = 2;
  const totalDays = preparationDays + deliveryDays;
  const deliveryDate = new Date(today.getTime() + totalDays * 24 * 60 * 60 * 1000);
  
  const day = deliveryDate.getDate();
  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const month = months[deliveryDate.getMonth()];
  
  return {
    date: `${day}-${month.slice(0, 3)}`,
    fullDate: `${day}-${month}`
  };
};

// Installment calculations
const calculateInstallment24 = (price: number): number => Math.round((price * 1.6) / 24);
const calculateInstallment12 = (price: number): number => Math.round((price * 1.45) / 12);
const calculateTotal24 = (price: number): number => Math.round(price * 1.6);
const calculateTotal12 = (price: number): number => Math.round(price * 1.45);

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToRecentlyViewed } = useRecentlyViewed();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(0);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | '12month' | '24month'>('cash');
  const { data: ratingData } = useProductRating(id || '');

  useEffect(() => {
    if (id) {
      fetchProduct();
      addToRecentlyViewed(id);
    }
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        shop:shops(*),
        category:categories(*)
      `)
      .eq('id', id)
      .single();

    if (!error && data) {
      setProduct(data as Product);
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error(t.loginRequired || 'Savatchaga qo\'shish uchun tizimga kiring');
      return;
    }

    await addToCart(product!.id, quantity);
    toast.success(t.addedToCart || 'Savatchaga qo\'shildi');
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      toast.error('Sevimlilarga qo\'shish uchun tizimga kiring');
      return;
    }

    setFavoriteLoading(true);
    const isCurrentlyFavorite = isFavorite(product!.id);
    const success = await toggleFavorite(product!.id);
    
    if (success) {
      toast.success(isCurrentlyFavorite ? 'Sevimlilardan o\'chirildi' : 'Sevimlilarga qo\'shildi');
    }
    setFavoriteLoading(false);
  };

  const discount = product?.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t.noData}</h2>
          <Button asChild>
            <Link to="/marketplace">{t.marketplace}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const images = product.images || [];
  const hasReviews = ratingData?.total_reviews && Number(ratingData.total_reviews) > 0;
  const deliveryInfo = calculateDeliveryDate(product.preparation_days || 1);

  // Calculate prices based on payment type
  const getFinalPrice = () => {
    switch (paymentType) {
      case '12month':
        return calculateTotal12(product.price);
      case '24month':
        return calculateTotal24(product.price);
      default:
        return product.price;
    }
  };

  const getMonthlyPayment = () => {
    switch (paymentType) {
      case '12month':
        return calculateInstallment12(product.price);
      case '24month':
        return calculateInstallment24(product.price);
      default:
        return null;
    }
  };

  // Product structured data for SEO
  const productStructuredData = {
    name: formatProductName(product.name),
    description: product.description || '',
    image: images[0] || '/placeholder.svg',
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: product.shop?.name || 'Dubay Mall',
    },
    offers: {
      '@type': 'Offer',
      url: `https://dubaymall.uz/product/${product.id}`,
      priceCurrency: 'UZS',
      price: product.price,
      availability: product.stock_quantity > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: product.shop?.name || 'Dubay Mall',
      },
    },
    aggregateRating: hasReviews ? {
      '@type': 'AggregateRating',
      ratingValue: ratingData?.average_rating || 0,
      reviewCount: Number(ratingData?.total_reviews),
    } : undefined,
  };

  return (
    <Layout>
      <SEOHead
        title={`${formatProductName(product.name)} - Dubay Mall`}
        description={product.description?.slice(0, 155) || `${formatProductName(product.name)} - eng yaxshi narxlarda Dubay Mall'da xarid qiling`}
        image={images[0]}
        url={`https://dubaymall.uz/product/${product.id}`}
        type="product"
        product={{
          price: product.price,
          currency: 'UZS',
          availability: product.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
          brand: product.shop?.name,
        }}
      />
      <StructuredData type="Product" data={productStructuredData} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/marketplace" className="hover:text-primary">{t.marketplace}</Link>
          <span>/</span>
          <span className="text-foreground line-clamp-1">{formatProductName(product.name)}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImage]}
                    alt={formatProductName(product.name)}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80"
                        onClick={() => setCurrentImage(i => i === 0 ? images.length - 1 : i - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80"
                        onClick={() => setCurrentImage(i => i === images.length - 1 ? 0 : i + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                      idx === currentImage ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              {discount && (
                <Badge className="bg-destructive mb-2">-{discount}%</Badge>
              )}
              {/* Full product name displayed here */}
              <h1 className="text-2xl md:text-3xl font-bold">{formatProductName(product.name)}</h1>
              
              {/* Rating - Only show if has real reviews */}
              {hasReviews && (
                <div className="flex items-center gap-2 mt-2">
                  <StarRating 
                    rating={ratingData?.average_rating || 0} 
                    showValue 
                    totalReviews={Number(ratingData?.total_reviews) || 0}
                  />
                </div>
              )}

              {product.shop && (
                <Link 
                  to={`/shop/${product.shop.slug}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary mt-2"
                >
                  <Store className="h-4 w-4" />
                  {product.shop.name}
                </Link>
              )}
            </div>

            {/* Price Section */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-primary whitespace-nowrap">
                  {formatPrice(product.price)}
                </span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-xl text-muted-foreground line-through whitespace-nowrap">
                    {formatPrice(product.original_price)}
                  </span>
                )}
              </div>

              {/* Installment Badge */}
              <div className="inline-block bg-yellow-300 dark:bg-yellow-400 text-yellow-900 text-sm font-medium px-3 py-1.5 rounded whitespace-nowrap">
                {new Intl.NumberFormat('uz-UZ').format(calculateInstallment24(product.price))} so'm/oyiga × 24 oy
              </div>
            </div>

            {/* Delivery Info */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Yetkazib berish</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-primary font-semibold">{deliveryInfo.fullDate}</span> gacha yetkaziladi
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Options */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  To'lov usulini tanlang
                </h3>
                
                <div className="space-y-2">
                  {/* Cash Payment */}
                  <button
                    onClick={() => setPaymentType('cash')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      paymentType === 'cash' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Naqd yoki karta</p>
                        <p className="text-sm text-muted-foreground">To'liq to'lov</p>
                      </div>
                      <span className="font-bold text-lg whitespace-nowrap">{formatPrice(product.price)}</span>
                    </div>
                  </button>

                  {/* 12 Month Installment */}
                  <button
                    onClick={() => setPaymentType('12month')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      paymentType === '12month' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">12 oylik muddatli</p>
                        <p className="text-sm text-muted-foreground">Jami: {formatPrice(calculateTotal12(product.price))}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-primary whitespace-nowrap">
                          {new Intl.NumberFormat('uz-UZ').format(calculateInstallment12(product.price))}
                        </span>
                        <span className="text-sm text-muted-foreground"> so'm/oy</span>
                      </div>
                    </div>
                  </button>

                  {/* 24 Month Installment */}
                  <button
                    onClick={() => setPaymentType('24month')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      paymentType === '24month' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">24 oylik muddatli</p>
                        <p className="text-sm text-muted-foreground">Jami: {formatPrice(calculateTotal24(product.price))}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-primary whitespace-nowrap">
                          {new Intl.NumberFormat('uz-UZ').format(calculateInstallment24(product.price))}
                        </span>
                        <span className="text-sm text-muted-foreground"> so'm/oy</span>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Stock & Quantity */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t.productStock}:</span>
                  <Badge variant={product.stock_quantity > 0 ? 'default' : 'destructive'}>
                    {product.stock_quantity > 0 
                      ? `${product.stock_quantity} dona` 
                      : t.statusOutOfStock}
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{t.quantity || 'Miqdori'}:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
                      disabled={quantity >= product.stock_quantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    className="flex-1 gap-2" 
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={product.stock_quantity === 0}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {t.addToCart || 'Savatga qo\'shish'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleToggleFavorite}
                    disabled={favoriteLoading}
                    className={isFavorite(product.id) ? 'text-destructive' : ''}
                  >
                    {favoriteLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Heart className={`h-5 w-5 ${isFavorite(product.id) ? 'fill-current' : ''}`} />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {product.description && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{t.productDescription}</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Similar Products */}
        <div className="mt-12">
          <ProductRecommendations currentProductId={product.id} />
        </div>

        {/* Reviews Section */}
        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>

        {/* Recently Viewed */}
        <div className="mt-12">
          <ProductRecommendations type="recent" />
        </div>
      </div>
    </Layout>
  );
}
