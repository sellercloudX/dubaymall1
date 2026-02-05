import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { SearchAutocomplete } from '@/components/marketplace/SearchAutocomplete';
import { ProductRecommendations } from '@/components/marketplace/ProductRecommendations';
import { HeroBanner } from '@/components/marketplace/HeroBanner';
import { FlashSaleBanner } from '@/components/marketplace/FlashSaleBanner';
import { CategoryCards } from '@/components/marketplace/CategoryCards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package,
  X,
  SlidersHorizontal
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'> & { shop?: { name: string; slug: string } };

export default function Marketplace() {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQueryState] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('newest');

  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('search', query);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  // Sync category with URL params
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl && categoryFromUrl !== selectedCategory) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [searchParams]);

  // Update URL when category changes
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const newParams = new URLSearchParams(searchParams);
    if (categoryId && categoryId !== 'all') {
      newParams.set('category', categoryId);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, sortBy, searchQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    
    let query = supabase
      .from('products')
      .select(`
        *,
        shop:shops(name, slug)
      `)
      .eq('status', 'active');

    if (selectedCategory && selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    // Search in database
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    // Sorting
    switch (sortBy) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'popular':
        query = query.order('view_count', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (!error && data) {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(product => {
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesPrice;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const clearFilters = () => {
    setSearchQuery('');
    handleCategoryChange('all');
    setPriceRange([0, 10000000]);
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || priceRange[0] > 0 || priceRange[1] < 10000000;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Flash Sale */}
        <FlashSaleBanner />

        {/* Categories */}
        <CategoryCards />

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{t.marketplace}</h2>
          <p className="text-muted-foreground mt-1">
            Barcha do'konlardan eng yaxshi mahsulotlar
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <SearchAutocomplete 
            className="flex-1"
            onSearch={(q) => setSearchQuery(q)}
          />
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Saralash" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Eng yangi</SelectItem>
                <SelectItem value="price_low">Arzon → Qimmat</SelectItem>
                <SelectItem value="price_high">Qimmat → Arzon</SelectItem>
                <SelectItem value="popular">Mashhur</SelectItem>
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t.filter}
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1">!</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    {t.filter}
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Tozalash
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Categories */}
                  <div>
                    <h4 className="font-medium mb-3">Kategoriya</h4>
                    <div className="space-y-2">
                      <Button
                        variant={selectedCategory === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleCategoryChange('all')}
                      >
                        Barchasi
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          variant={selectedCategory === cat.id ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleCategoryChange(cat.id)}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <h4 className="font-medium mb-3">Narx oralig'i</h4>
                    <Slider
                      min={0}
                      max={10000000}
                      step={100000}
                      value={priceRange}
                      onValueChange={setPriceRange}
                      className="mb-4"
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatPrice(priceRange[0])} so'm</span>
                      <span>{formatPrice(priceRange[1])} so'm</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.id === selectedCategory)?.name}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedCategory('all')}
                />
              </Badge>
            )}
            {(priceRange[0] > 0 || priceRange[1] < 10000000) && (
              <Badge variant="secondary" className="gap-1">
                {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])} so'm
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setPriceRange([0, 10000000])}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? 'Mahsulot topilmadi' : 'Hozircha mahsulotlar yo\'q'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
                ? 'Boshqa so\'z bilan qidiring' 
                : 'Birinchi sotuvchi siz bo\'ling va mahsulotlaringizni qo\'shing!'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <a href="/seller">Do'kon ochish</a>
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              {filteredProducts.length} ta mahsulot topildi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Trending Products */}
            {!searchQuery && selectedCategory === 'all' && (
              <div className="mt-16">
                <ProductRecommendations type="trending" title="Trendda" />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
