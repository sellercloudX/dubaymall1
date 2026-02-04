import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, Clock, ArrowRight } from 'lucide-react';

interface FlashSale {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  start_date: string;
  end_date: string;
}

interface FlashSaleProduct {
  id: string;
  sale_price: number;
  sold_count: number;
  stock_limit: number;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[] | null;
  };
}

export function FlashSaleBanner() {
  const [flashSale, setFlashSale] = useState<FlashSale | null>(null);
  const [products, setProducts] = useState<FlashSaleProduct[]>([]);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveFlashSale();
  }, []);

  useEffect(() => {
    if (!flashSale) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(flashSale.end_date).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setFlashSale(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [flashSale]);

  const fetchActiveFlashSale = async () => {
    const now = new Date().toISOString();
    
    const { data: sale, error } = await supabase
      .from('flash_sales')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && sale) {
      setFlashSale(sale);
      
      const { data: saleProducts } = await supabase
        .from('flash_sale_products')
        .select(`
          id,
          sale_price,
          sold_count,
          stock_limit,
          product:products(id, name, price, images)
        `)
        .eq('flash_sale_id', sale.id)
        .limit(6);

      if (saleProducts) {
        setProducts(saleProducts as unknown as FlashSaleProduct[]);
      }
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  if (loading) {
    return (
      <div className="mb-8">
        <Skeleton className="w-full h-[180px] rounded-2xl" />
      </div>
    );
  }

  if (!flashSale) return null;

  return (
    <div className="mb-8">
      <Card className="overflow-hidden border-red-500/30 bg-gradient-to-r from-red-500/5 via-orange-500/5 to-yellow-500/5">
        <CardContent className="p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center animate-pulse">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-foreground">{flashSale.title}</h3>
                  <Badge variant="destructive" className="animate-pulse">
                    -{flashSale.discount_percent}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{flashSale.description}</p>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <div className="flex gap-1">
                <span className="bg-red-500 text-white px-2 py-1 rounded font-mono font-bold">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-red-500 font-bold">:</span>
                <span className="bg-red-500 text-white px-2 py-1 rounded font-mono font-bold">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-red-500 font-bold">:</span>
                <span className="bg-red-500 text-white px-2 py-1 rounded font-mono font-bold">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Products */}
          {products.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
              {products.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.product.id}`}
                  className="group"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.product.images?.[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        Rasm yo'q
                      </div>
                    )}
                    <div className="absolute top-1 right-1">
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        -{flashSale.discount_percent}%
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-1">
                    <p className="text-xs text-foreground line-clamp-1">{item.product.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-red-500">
                        {formatPrice(item.sale_price)}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(item.product.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* View All */}
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
              Barchasini ko'rish
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
