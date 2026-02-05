import { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Heart, Package, Loader2, Star, Truck } from 'lucide-react';
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

// Uzum.uz style product card - clean, minimal design
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

  // Mock rating for demo - in production, this would come from reviews
  const rating = product.rating || 4.5;
  const reviewsCount = product.reviews_count || Math.floor(Math.random() * 100) + 10;

  return (
    <Link to={`/product/${product.id}`} className="block group">
      <div className="bg-card rounded-xl overflow-hidden border border-border/50 hover:border-border hover:shadow-md transition-all duration-200">
        {/* Image Container - 3:4 aspect ratio like Uzum */}
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
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}

          {/* Discount Badge - Top Left */}
          {discount && (
            <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground font-semibold text-xs px-2 py-0.5 rounded-md">
              -{discount}%
            </Badge>
          )}

          {/* Free Shipping Badge */}
          {product.free_shipping && (
            <Badge className="absolute top-2 left-2 mt-7 bg-green-600 dark:bg-green-500 text-white font-medium text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Truck className="h-2.5 w-2.5" />
              Bepul
            </Badge>
          )}

          {/* Favorite Button - Top Right */}
          <button
            type="button"
            aria-label={isProductFavorite ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isProductFavorite 
                ? 'bg-destructive/10 text-destructive' 
                : 'bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background'
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

          {/* Quick Add to Cart - Bottom Right (appears on hover) */}
          <button
            type="button"
            aria-label="Savatchaga qo'shish"
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary/90 shadow-lg"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Shop Name */}
          {product.shop && (
            <p className="text-[11px] text-muted-foreground mb-1 truncate">
              {product.shop.name}
            </p>
          )}

          {/* Product Name - 2 lines max */}
          <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem] leading-tight text-foreground mb-2">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">({reviewsCount})</span>
          </div>

          {/* Price Section */}
          <div className="flex flex-col">
            <span className="text-base font-bold text-primary whitespace-nowrap">
              {formatPrice(product.price)} <span className="text-xs font-medium">so'm</span>
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.original_price)} so'm
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});
