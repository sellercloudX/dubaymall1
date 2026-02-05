import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShopBySlug } from '@/hooks/useShop';
import { usePublicProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store, Package, Star, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { shop, loading: shopLoading, error } = useShopBySlug(slug || '');
  const { products, loading: productsLoading } = usePublicProducts({ shopId: shop?.id });
  const { addToCart } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const handleAddToCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(productId);
    toast.success("Savatga qo'shildi");
  };

  if (shopLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!shop) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
          <h1 className="text-2xl font-bold mb-2">Do'kon topilmadi</h1>
          <p className="text-muted-foreground">Bu manzilda do'kon mavjud emas</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Shop Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="h-24 w-24 rounded-full object-cover border-4 border-background"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center">
                <Store className="h-12 w-12 text-primary" />
              </div>
            )}
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold">{shop.name}</h1>
              {shop.description && (
                <p className="text-muted-foreground mt-2 max-w-xl">{shop.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-accent fill-accent" />
                  <span className="font-medium">{shop.rating || 0}</span>
                </div>
                <Badge variant="secondary">
                  <Package className="h-3 w-3 mr-1" />
                  {products.length} mahsulot
                </Badge>
                <Badge variant="secondary">
                  {shop.total_sales || 0} sotilgan
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">{t.products}</h2>
        
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Hozircha mahsulotlar yo'q</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`}>
                <Card className="overflow-hidden group h-full hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {product.original_price && product.original_price > product.price && (
                      <Badge className="absolute top-2 left-2 bg-destructive">
                        -{Math.round((1 - product.price / product.original_price) * 100)}%
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="mb-2">
                      <p className="font-bold text-primary">{formatPrice(product.price)}</p>
                      {product.original_price && product.original_price > product.price && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.original_price)}
                        </p>
                      )}
                    </div>
                    <h3 className="font-medium line-clamp-2 text-sm">{product.name}</h3>
                    <div className="mt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={(e) => handleAddToCart(e, product.id)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Savatga
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}