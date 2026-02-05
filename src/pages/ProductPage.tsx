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
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'> & { 
  shop?: Tables<'shops'>;
  category?: Tables<'categories'>;
};

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

  // Product structured data for SEO
  const productStructuredData = {
    name: product.name,
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
    aggregateRating: ratingData?.total_reviews ? {
      '@type': 'AggregateRating',
      ratingValue: ratingData.average_rating || 0,
      reviewCount: Number(ratingData.total_reviews),
    } : undefined,
  };

  return (
    <Layout>
      <SEOHead
        title={`${product.name} - Dubay Mall`}
        description={product.description?.slice(0, 155) || `${product.name} - eng yaxshi narxlarda Dubay Mall'da xarid qiling`}
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
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImage]}
                    alt={product.name}
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
              <h1 className="text-3xl font-bold">{product.name}</h1>
              
              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <StarRating 
                  rating={ratingData?.average_rating || 0} 
                  showValue 
                  totalReviews={Number(ratingData?.total_reviews) || 0}
                />
              </div>

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

            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-primary">
                {formatPrice(product.price)}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.original_price)}
                </span>
              )}
            </div>

            {product.description && (
              <div>
                <h3 className="font-semibold mb-2">{t.productDescription}</h3>
                <p className="text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

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
