import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Heart, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface ProductCardProps {
  product: Product & { shop?: { name: string; slug: string } };
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error(t.loginRequired || 'Savatchaga qo\'shish uchun tizimga kiring');
      return;
    }

    await addToCart(product.id);
    toast.success(t.addedToCart || 'Savatchaga qo\'shildi');
  };

  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  return (
    <Link to={`/product/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group h-full">
        <CardHeader className="p-0 relative">
          <div className="aspect-square bg-muted overflow-hidden">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>
          {discount && (
            <Badge className="absolute top-2 left-2 bg-destructive">
              -{discount}%
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/80 hover:bg-background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Heart className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {product.shop && (
            <p className="text-xs text-muted-foreground mb-1">{product.shop.name}</p>
          )}
          <h3 className="font-semibold line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-primary font-bold text-lg">{formatPrice(product.price)}</p>
            {product.original_price && product.original_price > product.price && (
              <p className="text-muted-foreground text-sm line-through">
                {formatPrice(product.original_price)}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button className="w-full gap-2" onClick={handleAddToCart}>
            <ShoppingCart className="h-4 w-4" />
            {t.addToCart || 'Savatga'}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
