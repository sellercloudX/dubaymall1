import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  link_type: string;
  link_id: string | null;
}

export function HeroBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const fetchBanners = async () => {
    const { data } = await supabase
      .from('banners')
      .select('*')
      .eq('position', 'hero')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(5);

    if (data && data.length > 0) {
      setBanners(data);
    }
    setLoading(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const getBannerLink = (banner: Banner): string => {
    if (banner.link_url) return banner.link_url;
    if (banner.link_type === 'product' && banner.link_id) return `/product/${banner.link_id}`;
    if (banner.link_type === 'category' && banner.link_id) return `/marketplace?category=${banner.link_id}`;
    if (banner.link_type === 'shop' && banner.link_id) return `/shop/${banner.link_id}`;
    return '/marketplace';
  };

  if (loading) {
    return (
      <div className="mb-8">
        <Skeleton className="w-full h-[200px] md:h-[320px] rounded-2xl" />
      </div>
    );
  }

  if (banners.length === 0) {
    // Default promotional banner when no banners exist
    return (
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-indigo-600 p-6 md:p-10">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <Badge className="mb-3 bg-white/20 text-white border-white/30">
              <Sparkles className="h-3 w-3 mr-1" />
              Maxsus taklif
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Yozgi chegirmalar boshlanadi!
            </h2>
            <p className="text-white/80 text-sm md:text-base">
              50% gacha chegirma barcha kategoriyalarda
            </p>
          </div>
          <Button variant="secondary" size="lg" asChild>
            <Link to="/marketplace">
              Xarid qilish
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentBanner = banners[currentIndex];

  return (
    <div className="mb-8 relative group">
      <div className="relative overflow-hidden rounded-2xl">
        {/* Banner Image */}
        <Link to={getBannerLink(currentBanner)} className="block">
          <div className="relative h-[200px] md:h-[320px] w-full">
            <img
              src={currentBanner.image_url}
              alt={currentBanner.title}
              fetchPriority="high"
              className="w-full h-full object-cover transition-transform duration-500"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            
            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-10">
              <div className="max-w-lg">
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">
                  {currentBanner.title}
                </h2>
                {currentBanner.description && (
                  <p className="text-white/90 text-sm md:text-lg mb-4 line-clamp-2">
                    {currentBanner.description}
                  </p>
                )}
                <Button variant="secondary" size="lg">
                  Batafsil
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Link>

        {/* Navigation Arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              aria-label="Oldingi banner"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              aria-label="Keyingi banner"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`${index + 1}-banner`}
              className={cn(
                "min-w-6 h-6 rounded-full transition-all flex items-center justify-center",
                index === currentIndex
                  ? "bg-white w-8"
                  : "bg-white/50 hover:bg-white/70 w-6"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
