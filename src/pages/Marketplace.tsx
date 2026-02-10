import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { SearchAutocomplete } from '@/components/marketplace/SearchAutocomplete';
import { SEOHead } from '@/components/SEOHead';
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
  SlidersHorizontal,
  Loader2
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

type Product = Tables<'products'> & { 
  shop?: { name: string; slug: string };
  rating?: number;
  reviews_count?: number;
};

const PAGE_SIZE = 20;

export default function Marketplace() {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQueryState] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('newest');
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl && categoryFromUrl !== selectedCategory) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [searchParams]);

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

  // Reset pagination when filters change
  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchProducts(0, true);
  }, [selectedCategory, sortBy, searchQuery]);

  const fetchProducts = async (pageNum: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    
    const offset = pageNum * PAGE_SIZE;

    // Use fuzzy search RPC for typo-tolerant matching
    const { data, error } = await supabase.rpc('search_products_fuzzy', {
      search_term: searchQuery || '',
      category_filter: selectedCategory !== 'all' ? selectedCategory : null,
      sort_type: sortBy,
      page_offset: offset,
      page_limit: PAGE_SIZE,
    });

    if (!error && data) {
      const productsWithShop = (data as any[]).map(p => ({
        ...p,
        shop: p.shop_name ? { name: p.shop_name, slug: p.shop_slug } : undefined,
      })) as Product[];

      if (reset) {
        setProducts(productsWithShop);
      } else {
        setProducts(prev => [...prev, ...productsWithShop]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  // Infinite scroll observer
  const lastProductRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchProducts(nextPage);
      }
    }, { threshold: 0.1 });

    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, loading, page]);

  const filteredProducts = products.filter(product => {
    return product.price >= priceRange[0] && product.price <= priceRange[1];
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
        <HeroBanner />
        <FlashSaleBanner />
        <CategoryCards />

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <SearchAutocomplete 
            className="flex-1"
            onSearch={(q) => setSearchQuery(q)}
          />
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]" aria-label="Saralash turi">
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
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleCategoryChange('all')} />
              </Badge>
            )}
            {(priceRange[0] > 0 || priceRange[1] < 10000000) && (
              <Badge variant="secondary" className="gap-1">
                {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])} so'm
                <X className="h-3 w-3 cursor-pointer" onClick={() => setPriceRange([0, 10000000])} />
              </Badge>
            )}
          </div>
        )}

        {/* Products Grid with Infinite Scroll */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
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
            <p className="text-sm text-muted-foreground mb-3">
              {filteredProducts.length}+ ta mahsulot topildi
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  ref={index === filteredProducts.length - 1 ? lastProductRef : null}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!hasMore && filteredProducts.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Barcha mahsulotlar ko'rsatildi
              </p>
            )}

            {/* Trending Products */}
            {!searchQuery && selectedCategory === 'all' && !loadingMore && (
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
