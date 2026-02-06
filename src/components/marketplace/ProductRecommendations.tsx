import { forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRecommendations, useRecentlyViewed } from '@/hooks/useRecommendations';
import { ProductCard } from './ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Clock, TrendingUp } from 'lucide-react';

interface ProductRecommendationsProps {
  currentProductId?: string;
  title?: string;
  type?: 'similar' | 'trending' | 'recent';
}

export const ProductRecommendations = forwardRef<HTMLDivElement, ProductRecommendationsProps>(function ProductRecommendations({ 
  currentProductId, 
  title,
  type = 'similar' 
}, ref) {
  const { t } = useLanguage();
  const { recommendations, loading: recLoading } = useRecommendations(currentProductId, 8);
  const { recentProducts, loading: recentLoading } = useRecentlyViewed(8);

  const isRecent = type === 'recent';
  const products = isRecent ? recentProducts : recommendations;
  const loading = isRecent ? recentLoading : recLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'recent':
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      case 'trending':
        return <TrendingUp className="h-5 w-5 text-primary" />;
      default:
        return <Sparkles className="h-5 w-5 text-primary" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'recent':
        return 'Yaqinda ko\'rilgan';
      case 'trending':
        return 'Trendda';
      default:
        return 'Sizga yoqishi mumkin';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {getIcon()}
        <h2 className="text-xl font-semibold">{getTitle()}</h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {products.slice(0, 8).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
