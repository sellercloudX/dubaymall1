import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingBag, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FavoritesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { favorites, loading } = useFavorites();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sevimlilar</h1>
          <p className="text-muted-foreground mb-6">
            Sevimli mahsulotlarni ko'rish uchun tizimga kiring
          </p>
          <Button onClick={() => navigate('/auth')}>
            Tizimga kirish
          </Button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Heart className="h-8 w-8 text-primary fill-primary" />
          <div>
            <h1 className="text-3xl font-bold">Sevimlilar</h1>
            <p className="text-muted-foreground">
              {favorites.length} ta mahsulot
            </p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
            <h2 className="text-xl font-semibold mb-2">Sevimlilar bo'sh</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sizga yoqqan mahsulotlarni ❤️ belgisi bilan saqlang va keyinroq osonlik bilan toping
            </p>
            <Button onClick={() => navigate('/')} size="lg">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Marketplace'ga o'tish
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {favorites.map((fav) => (
              <ProductCard
                key={fav.id}
                product={{
                  ...fav.products,
                  shop: fav.products.shop
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
