import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEOHead, StructuredData } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useRecentlyViewed } from '@/hooks/useRecommendations';
import { useProductVariants, type ProductVariant } from '@/hooks/useProductVariants';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ProductRecommendations } from '@/components/marketplace/ProductRecommendations';
import { StarRating } from '@/components/reviews/StarRating';
import { useProductRating, useProductReviews } from '@/hooks/useReviews';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SellerChat } from '@/components/chat/SellerChat';
import { VariantSelector } from '@/components/product/VariantSelector';
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
  Share2,
  Star,
  MessageSquare,
  ShoppingBag,
  User,
  TrendingUp,
  ChevronRight as ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'> & {
  shop?: Tables<'shops'>;
  category?: Tables<'categories'>;
};

// Format product name - first letter uppercase, rest lowercase
const formatProductName = (name: string): string => {
  if (!name) return '';
  const cleaned = name.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

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

const calculateInstallment = (price: number, months: number): number => {
  const multipliers: Record<number, number> = { 3: 1.15, 6: 1.25, 12: 1.45, 24: 1.6 };
  return Math.round((price * (multipliers[months] || 1.6)) / months);
};
const calculateTotal = (price: number, months: number): number => {
  const multipliers: Record<number, number> = { 3: 1.15, 6: 1.25, 12: 1.45, 24: 1.6 };
  return Math.round(price * (multipliers[months] || 1.6));
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
  const [selectedInstallment, setSelectedInstallment] = useState(24);
  const [orderCount, setOrderCount] = useState(0);
  const [weeklyBuyers, setWeeklyBuyers] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [variantImageOverride, setVariantImageOverride] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant | null>>({});
  const { data: ratingData } = useProductRating(id || '');
  const { data: reviews } = useProductReviews(id || '');
  const { variantsByType, hasColors, hasSizes, hasModels } = useProductVariants(id);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchOrderStats();
      addToRecentlyViewed(id);
      supabase.from('products').select('view_count').eq('id', id).single().then(({ data }) => {
        if (data) supabase.from('products').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id).then(() => {});
      });
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

  const fetchOrderStats = async () => {
    const { count: totalOrders } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count: weeklyCount } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id)
      .gte('created_at', weekAgo.toISOString());
    
    setOrderCount(totalOrders || 0);
    setWeeklyBuyers(weeklyCount || 0);
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

  const handleShare = async () => {
    try {
      await navigator.share({ title: product?.name, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Havola nusxalandi');
    }
  };

  const discount = product?.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-[3/4]" />
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
            <Link to="/">{t.marketplace}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const images = product.images || [];
  const hasReviews = !!(ratingData?.total_reviews && Number(ratingData.total_reviews) > 0);
  const deliveryInfo = calculateDeliveryDate(product.preparation_days || 1);

  const productStructuredData = {
    name: formatProductName(product.name),
    description: product.description || '',
    image: images[0] || '/placeholder.svg',
    sku: product.id,
    brand: { '@type': 'Brand', name: product.shop?.name || 'Dubay Mall' },
    offers: {
      '@type': 'Offer',
      url: window.location.href,
      priceCurrency: 'UZS',
      price: product.price,
      availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <Layout>
      <SEOHead
        title={`${formatProductName(product.name)} - Dubay Mall`}
        description={product.description?.slice(0, 155) || `${formatProductName(product.name)} - eng yaxshi narxlarda`}
        image={images[0]}
        url={window.location.href}
        type="product"
        product={{
          price: product.price,
          currency: 'UZS',
          availability: product.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
          brand: product.shop?.name,
        }}
      />
      <StructuredData type="Product" data={productStructuredData} />

      {/* Mobile Header - Back, Name, Favorite, Share */}
      <div className="sticky top-0 z-40 bg-background border-b md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-sm font-medium line-clamp-1 flex-1 mx-2">{formatProductName(product.name)}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleToggleFavorite}>
              <Heart className={`h-5 w-5 ${isFavorite(product.id) ? 'fill-destructive text-destructive' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>


      <div className="w-full md:container md:mx-auto md:px-4 py-0 md:py-6 pb-24 md:max-w-5xl overflow-x-hidden">
        {/* Desktop Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground mb-6 px-4 md:px-0">
          <Link to="/" className="hover:text-primary">{t.marketplace}</Link>
          <span>/</span>
          {product.category && (
            <>
              <span>{product.category.name_uz}</span>
              <span>/</span>
            </>
          )}
          <span className="text-foreground line-clamp-1">{formatProductName(product.name)}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-0 md:gap-8 items-start">
          {/* Images - scrolls naturally on mobile, sticky on desktop */}
          <div className="md:sticky md:top-20">
            {/* Main Image - full width on mobile */}
            <div className="aspect-[3/4] bg-muted overflow-hidden relative">
              {images.length > 0 ? (
                <>
                  <img
                    src={variantImageOverride || images[currentImage]}
                    alt={formatProductName(product.name)}
                    className="w-full h-full object-contain"
                  />
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full"
                        onClick={() => setCurrentImage(i => i === 0 ? images.length - 1 : i - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full"
                        onClick={() => setCurrentImage(i => i === images.length - 1 ? 0 : i + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {/* Image counter badge */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-foreground/60 text-background text-xs px-2.5 py-1 rounded-full">
                      {currentImage + 1} / {images.length}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="px-4 md:px-0 mt-3">
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                          idx === currentImage ? 'border-primary' : 'border-transparent hover:border-muted-foreground/50'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Details - scrolls under sticky price on mobile */}
          <div className="px-4 md:px-0 space-y-3 mt-3 md:mt-0">
            {/* Price Section */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl md:text-3xl font-bold text-primary whitespace-nowrap">
                  {formatPrice(product.price)}
                </span>
                {discount && (
                  <Badge className="bg-destructive">-{discount}%</Badge>
                )}
                {product.original_price && product.original_price > product.price && (
                  <span className="text-base text-muted-foreground line-through whitespace-nowrap">
                    {formatPrice(product.original_price)}
                  </span>
                )}
              </div>
            </div>

            {/* Product Name */}
            <h1 className="text-base md:text-lg font-medium text-foreground leading-tight">
              {formatProductName(product.name)}
            </h1>

            {/* Variant Selector */}
            {(hasColors || hasSizes || hasModels) && (
              <Card>
                <CardContent className="p-4">
                  <VariantSelector 
                    variantsByType={variantsByType}
                    onVariantChange={setSelectedVariants}
                    onImageChange={setVariantImageOverride}
                  />
                </CardContent>
              </Card>
            )}

            {/* Rating & Stats */}
            {(hasReviews || orderCount > 0 || weeklyBuyers > 0) && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {hasReviews && (
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{ratingData?.average_rating}</span>
                        <div className="flex">
                          {[1,2,3,4,5].map(i => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i <= Math.round(ratingData?.average_rating || 0) ? 'fill-warning text-warning' : 'text-muted-foreground'}`} 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {hasReviews && (
                      <span className="text-sm text-muted-foreground">
                        {ratingData?.total_reviews} ta sharh
                      </span>
                    )}
                    {orderCount > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {orderCount > 1000 ? `${Math.floor(orderCount / 1000)}K+` : orderCount}+ ta buyurtma
                      </span>
                    )}
                  </div>
                  
                  {weeklyBuyers > 0 && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                      <TrendingUp className="h-4 w-4" />
                      <span>Bu haftada {weeklyBuyers} kishi sotib oldi</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Installment */}
            <Card className="border-primary/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <p className="font-medium text-sm">Muddatli to'lov</p>
                </div>
                <div className="flex gap-1.5 p-0.5 bg-muted/50 rounded-md">
                  {[24, 12, 6, 3].map(months => (
                    <button
                      key={months}
                      onClick={() => setSelectedInstallment(months)}
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                        selectedInstallment === months 
                          ? 'bg-background shadow-sm' 
                          : 'hover:bg-background/50'
                      }`}
                    >
                      {months} oy
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-sm font-bold">
                    {new Intl.NumberFormat('uz-UZ').format(calculateInstallment(product.price, selectedInstallment))} so'm
                  </span>
                  <span className="text-xs text-muted-foreground">× {selectedInstallment} oy</span>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{deliveryInfo.fullDate} yetkazib beramiz</p>
                    <p className="text-sm text-muted-foreground">
                      {product.free_shipping ? 'Bepul yetkazib berish' : `Yetkazish: ${formatPrice(product.shipping_price || 15000)}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quantity & Add to Cart - desktop only (mobile has sticky footer) */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center border rounded-lg">
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))} disabled={quantity >= product.stock_quantity}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button className="flex-1 gap-2 h-12" onClick={handleAddToCart} disabled={product.stock_quantity === 0}>
                <ShoppingCart className="h-5 w-5" />
                Savatga
              </Button>
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleToggleFavorite} disabled={favoriteLoading}>
                {favoriteLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Heart className={`h-5 w-5 ${isFavorite(product.id) ? 'fill-destructive text-destructive' : ''}`} />
                )}
              </Button>
            </div>

            {/* Mobile: Quantity selector only - cart button is in sticky footer */}
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex items-center border rounded-lg">
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))} disabled={quantity >= product.stock_quantity}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">Omborda: {product.stock_quantity} ta</span>
            </div>
          </div>
        </div>

        {/* Below fold content */}
        <div className="px-4 md:px-0">
          {/* Reviews */}
          {hasReviews && reviews && reviews.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{ratingData?.total_reviews} ta sharh</h2>
                <Link to="#reviews" className="text-sm text-primary flex items-center gap-1">
                  Barcha <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {reviews.slice(0, 6).map((review) => (
                    <Card key={review.id} className="w-[280px] flex-shrink-0">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{review.reviewer_name || 'Anonim'}</span>
                          <div className="flex">
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} className={`h-3 w-3 ${i <= review.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {format(new Date(review.created_at), 'd MMMM yyyy')}
                        </p>
                        {review.comment && (
                          <p className="text-sm line-clamp-3">{review.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Seller */}
          {product.shop && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Sotuvchi</h2>
              <Card>
                <CardContent className="p-4">
                  <Link to={`/shop/${product.shop.slug}`} className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={product.shop.logo_url || undefined} />
                      <AvatarFallback className="text-lg">{product.shop.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{product.shop.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        <span>4.8</span>
                        <span>·</span>
                        <span>1000+ ta baho</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  <Button variant="outline" className="w-full mt-4" onClick={() => setChatOpen(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Sotuvchidan so'rash
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category */}
          {product.category && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Shuningdek qarang</h2>
              <Card>
                <CardContent className="p-4">
                  <Link to={`/?category=${product.category.id}`} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{product.category.name_uz}</p>
                      <p className="text-sm text-muted-foreground">Turkum</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Description & Specs */}
          <div className="mt-8" id="details">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                  Ta'rif
                </TabsTrigger>
                <TabsTrigger value="specifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                  Tavsiflar
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="pt-4">
                {product.description ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="whitespace-pre-line text-muted-foreground">
                      {product.description.replace(/<br\s*\/?>/gi, '\n')}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Ta'rif mavjud emas</p>
                )}
              </TabsContent>
              <TabsContent value="specifications" className="pt-4">
                {product.specifications ? (
                  <div className="space-y-2">
                    {Object.entries(product.specifications as Record<string, string>).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Tavsiflar mavjud emas</p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Similar Products */}
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">O'xshash mahsulotlar</h2>
            <ProductRecommendations currentProductId={product.id} />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer - Savatga button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 md:hidden z-50">
        <Button 
          className="w-full gap-2 h-12" 
          size="lg"
          onClick={handleAddToCart}
          disabled={product.stock_quantity === 0}
        >
          <ShoppingCart className="h-5 w-5" />
          Savatga
          <span className="text-xs opacity-80 ml-1">{deliveryInfo.date}</span>
        </Button>
      </div>

      {/* Seller Chat */}
      {product?.shop && (
        <SellerChat
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          shop={{
            id: product.shop.id,
            name: product.shop.name,
            logo_url: product.shop.logo_url,
            user_id: product.shop.user_id,
          }}
          productId={product.id}
          productName={product.name}
        />
      )}
    </Layout>
  );
}

