import { memo, useState, useCallback, useRef, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { Button } from '@/components/ui/button';
import { Heart, Package, Loader2, Star, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface ProductCardProps {
  product: Product & { 
    shop?: { name: string; slug: string };
    rating?: number;
    reviews_count?: number;
    preparation_days?: number;
  };
}

// Format product name - first letter uppercase, rest lowercase, truncate if needed
const formatProductName = (name: string): string => {
  if (!name) return '';
  const formatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return formatted;
};

// Calculate delivery date based on preparation days + standard delivery time
const calculateDeliveryDate = (preparationDays: number = 1): string => {
  const today = new Date();
  const deliveryDays = 2; // Standard delivery time
  const totalDays = preparationDays + deliveryDays;
  const deliveryDate = new Date(today.getTime() + totalDays * 24 * 60 * 60 * 1000);
  
  const day = deliveryDate.getDate();
  const months = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const month = months[deliveryDate.getMonth()];
  
  return `${day}-${month}`;
};

// Calculate 24-month installment price: price * 1.6 / 24
const calculateInstallment = (price: number): number => {
  if (!price || price <= 0) return 0;
  return Math.round((price * 1.6) / 24);
};

// Uzum.uz style product card with image carousel
export const ProductCard = memo(forwardRef<HTMLAnchorElement, ProductCardProps>(function ProductCard({ product }, ref) {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price);
  }, []);

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error(t.loginRequired || 'Savatchaga qo\'shish uchun tizimga kiring');
      return;
    }

    await addToCart(product.id);
    toast.success(t.addedToCart || 'Savatchaga qo\'shildi');
  }, [user, addToCart, product.id, t]);

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Sevimlilarga qo\'shish uchun tizimga kiring');
      return;
    }

    setFavoriteLoading(true);
    const isCurrentlyFavorite = isFavorite(product.id);
    const success = await toggleFavorite(product.id);
    
    if (success) {
      toast.success(isCurrentlyFavorite ? 'Sevimlilardan o\'chirildi' : 'Sevimlilarga qo\'shildi');
    }
    setFavoriteLoading(false);
  }, [user, isFavorite, toggleFavorite, product.id]);

  // Image navigation
  const imageCount = product.images?.length || 0;
  
  const nextImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imageCount > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % imageCount);
    }
  }, [imageCount]);

  const prevImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imageCount > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + imageCount) % imageCount);
    }
  }, [imageCount]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || imageCount <= 1) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next image
        setCurrentImageIndex((prev) => (prev + 1) % imageCount);
      } else {
        // Swipe right - prev image
        setCurrentImageIndex((prev) => (prev - 1 + imageCount) % imageCount);
      }
    }
    touchStartX.current = null;
  }, [imageCount]);

  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  const isProductFavorite = isFavorite(product.id);

  // Real rating and reviews - only show if exists
  const rating = product.rating;
  const reviewsCount = product.reviews_count;
  const hasReviews = rating !== undefined && rating > 0 && reviewsCount !== undefined && reviewsCount > 0;

  // Calculate 24-month installment
  const monthlyPayment = calculateInstallment(product.price);

  // Calculate delivery date
  const deliveryDate = calculateDeliveryDate(product.preparation_days);

  // Affiliate/Blogger commission - show how much a blogger can earn
  const hasAffiliate = product.is_affiliate_enabled && product.affiliate_commission_percent && product.affiliate_commission_percent > 0;
  const affiliateBonus = hasAffiliate ? Math.round((product.price * (product.affiliate_commission_percent || 0)) / 100) : 0;

  return (
    <Link to={`/product/${product.id}`} className="block" ref={ref}>
      <div className="bg-card rounded-lg overflow-hidden border border-border/40 hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Image Container - 3:4 aspect ratio with carousel */}
        <div 
          className="relative aspect-[3/4] bg-muted overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {product.images && product.images.length > 0 ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" />
              )}
              <img
                src={product.images[currentImageIndex]}
                alt={product.name}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover transition-opacity ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ aspectRatio: '1080/1440' }}
              />
              
              {/* Navigation arrows - show on hover when multiple images */}
              {imageCount > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity shadow-sm"
                    aria-label="Oldingi rasm"
                  >
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity shadow-sm"
                    aria-label="Keyingi rasm"
                  >
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </button>
                  
                  {/* Image indicators */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1">
                    {product.images.map((_, index) => (
                      <span
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Discount Badge - Bottom Left on Image */}
          {discount && discount >= 5 && (
            <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[11px] font-medium py-1 px-2 text-center">
              -{discount}% chegirma
            </div>
          )}

          {/* Favorite Button - Top Right */}
          <button
            type="button"
            aria-label={isProductFavorite ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all ${
              isProductFavorite 
                ? 'bg-white text-destructive' 
                : 'bg-white/90 text-muted-foreground hover:text-destructive'
            }`}
            onClick={handleToggleFavorite}
            disabled={favoriteLoading}
          >
            {favoriteLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${isProductFavorite ? 'fill-current' : ''}`} />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-2.5 flex flex-col flex-1">
          {/* Price Section - Uzum style */}
          <div className="mb-1">
            {/* Current Price */}
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-primary whitespace-nowrap">
                {formatPrice(product.price)}
              </span>
              <span className="text-xs text-primary font-medium">so'm</span>
            </div>
            
            {/* Original Price (struck through) */}
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                {formatPrice(product.original_price)} so'm
              </span>
            )}
          </div>

          {/* Monthly Payment Badge - Yellow like Uzum - 24 month formula: (price * 1.6) / 24 */}
          <div className="mb-2">
            <span className="inline-block bg-yellow-300 dark:bg-yellow-400 text-yellow-900 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
              {product.price > 0 ? formatPrice(Math.round((product.price * 1.6) / 24)) : '0'} so'm/oyiga
            </span>
          </div>

          {/* Product Name - First letter uppercase, 2 lines max, BELOW price and installment */}
          <h3 className="text-sm font-normal line-clamp-2 leading-tight text-foreground mb-2 flex-1">
            {formatProductName(product.name)}
          </h3>

          {/* Rating - Only show if has real reviews */}
          {hasReviews && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
              <span className="text-[11px] text-muted-foreground">({reviewsCount})</span>
            </div>
          )}

          {/* Delivery Button - Full width with calculated date */}
          <Button 
            onClick={handleAddToCart}
            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 mt-auto"
          >
            <Truck className="h-4 w-4" />
            {deliveryDate}
          </Button>
        </div>
      </div>
    </Link>
  );
}));
