import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Search, Filter, ShoppingCart, Package } from 'lucide-react';

export default function Marketplace() {
  const { t } = useLanguage();

  // Placeholder products - will be replaced with real data
  const products: any[] = [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t.marketplace}</h1>
          <p className="text-muted-foreground mt-2">
            Barcha do'konlardan eng yaxshi mahsulotlar
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mahsulot qidirish..."
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtrlar
          </Button>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Hozircha mahsulotlar yo'q</h3>
            <p className="text-muted-foreground mb-6">
              Birinchi sotuvchi siz bo'ling va mahsulotlaringizni qo'shing!
            </p>
            <Button asChild>
              <a href="/dashboard">Do'kon ochish</a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  <div className="aspect-square bg-muted" />
                </CardHeader>
                <CardContent className="p-4">
                  <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                  <p className="text-primary font-bold mt-2">{product.price} so'm</p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button className="w-full gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Savatga
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
