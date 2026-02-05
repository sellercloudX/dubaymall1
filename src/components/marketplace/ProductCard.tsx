import { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { Button } from '@/components/ui/button';
import { Heart, Package, Loader2, Star, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface ProductCardProps {
  product: Product & { 
    shop?: { name: string; slug: string };
    rating?: number;
    reviews_count?: number;
  };
}

// Uzum.uz style product card
export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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

  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  const isProductFavorite = isFavorite(product.id);

  // Mock rating - in production from reviews
  const rating = product.rating || 4.5;
  const reviewsCount = product.reviews_count || Math.floor(Math.random() * 500) + 50;

  // Calculate monthly payment (12 months)
  const monthlyPayment = Math.round(product.price / 12);

  return (
    <Link to={`/product/${product.id}`} className="block">
      <div className="bg-card rounded-lg overflow-hidden border border-border/40 hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Image Container - 3:4 aspect ratio */}
        <div className="relative aspect-[3/4] bg-muted overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" />
              )}
              <img
                src={product.images[0]}
                alt={product.name}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
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
          <div className="mb-1.5">
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

          {/* Monthly Payment Badge - Yellow like Uzum */}
          <div className="mb-2">
            <span className="inline-block bg-yellow-300 dark:bg-yellow-400 text-yellow-900 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
              {formatPrice(monthlyPayment)} so'm/oyiga
            </span>
          </div>

          {/* Product Name */}
          <h3 className="text-sm font-normal line-clamp-2 min-h-[2.5rem] leading-tight text-foreground mb-2 flex-1">
            {product.name}
          </h3>

          {/* Rating - Bottom */}
          <div className="flex items-center gap-1 mb-2">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">({reviewsCount} sharhlar)</span>
          </div>

          {/* Delivery Button - Full width, Purple like Uzum */}
          <Button 
            onClick={handleAddToCart}
            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg flex items-center justify-center gap-1.5"
          >
            <Truck className="h-4 w-4" />
            Ertaga
          </Button>
        </div>
      </div>
    </Link>
  );
});
