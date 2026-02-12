import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle, Clock, MapPin, Search, Loader2, Warehouse, ArrowRight } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

const STEPS = [
  { key: 'created', label: 'Yaratildi', icon: Package, desc: 'Buyurtma qabul qilindi' },
  { key: 'accepted', label: 'Qabul qilindi', icon: Warehouse, desc: 'Punktga yetib keldi' },
  { key: 'in_transit', label: "Yo'lda", icon: Truck, desc: 'Kuryer oldi' },
  { key: 'out_for_delivery', label: 'Yetkazilmoqda', icon: ArrowRight, desc: 'Manzilingizga yetkazilmoqda' },
  { key: 'delivered', label: 'Yetkazildi', icon: CheckCircle, desc: 'Muvaffaqiyatli topshirildi' },
];

const statusColors: Record<string, string> = {
  created: 'bg-muted text-muted-foreground',
  accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_transit: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  returned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-destructive text-destructive-foreground',
};

interface LogisticsOrder {
  id: string;
  barcode: string;
  customer_name: string;
  product_name: string | null;
  seller_name: string | null;
  delivery_type: string;
  status: string;
  status_history: Array<{ from: string | null; to: string; at: string; note?: string }>;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  payment_amount: number;
}

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [barcode, setBarcode] = useState(searchParams.get('barcode') || '');
  const [order, setOrder] = useState<LogisticsOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const trackOrder = async (code?: string) => {
    const searchCode = code || barcode;
    if (!searchCode.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('track-order', {
        body: { barcode: searchCode.trim() },
      });

      if (invokeError || !data?.found) {
        setError('Buyurtma topilmadi. Shtrix kodni tekshiring.');
        setOrder(null);
      } else {
        setOrder(data.order);
      }
    } catch {
      setError('Server bilan bog\'lanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search if barcode in URL
  useEffect(() => {
    const urlBarcode = searchParams.get('barcode');
    if (urlBarcode) {
      setBarcode(urlBarcode);
      trackOrder(urlBarcode);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!order) return;

    const channel = supabase
      .channel(`logistics-${order.barcode}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'logistics_orders',
        filter: `barcode=eq.${order.barcode}`,
      }, (payload) => {
        setOrder(payload.new as LogisticsOrder);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order?.barcode]);

  const currentStepIndex = order ? STEPS.findIndex(s => s.key === order.status) : -1;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Buyurtmani kuzatish - DubayMall" description="Buyurtmangiz qayerda ekanligini real vaqtda kuzating" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Buyurtmani kuzatish</h1>
          <p className="text-muted-foreground mt-1">Shtrix kodni kiriting yoki skanerlang</p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="DM-20260212-001234"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && trackOrder()}
                className="font-mono"
              />
              <Button onClick={() => trackOrder()} disabled={loading || !barcode.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && searched && (
          <Card className="border-destructive/30 bg-destructive/5 mb-6">
            <CardContent className="pt-6 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Order details */}
        {order && (
          <div className="space-y-6">
            {/* Status badge */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-mono">{order.barcode}</p>
                    <CardTitle className="text-lg mt-1">{order.product_name || 'Buyurtma'}</CardTitle>
                  </div>
                  <Badge className={statusColors[order.status] || statusColors.created}>
                    {STEPS.find(s => s.key === order.status)?.label || order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.seller_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sotuvchi</span>
                    <span className="font-medium">{order.seller_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Yetkazish turi</span>
                  <span className="font-medium">{order.delivery_type === 'home' ? '🏠 Uyga' : '📦 Punkt'}</span>
                </div>
                {order.payment_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To'lov</span>
                    <span className="font-medium">{new Intl.NumberFormat('uz-UZ').format(order.payment_amount)} so'm</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress tracker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buyurtma holati</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {STEPS.map((step, i) => {
                    const done = i <= currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    const StepIcon = step.icon;

                    return (
                      <div key={step.key} className="flex gap-4">
                        {/* Line + circle */}
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            <StepIcon className="h-5 w-5" />
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`w-0.5 h-12 transition-colors ${done && i < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </div>

                        {/* Text */}
                        <div className="pt-2 pb-6">
                          <p className={`font-medium ${isCurrent ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{step.desc}</p>
                          {/* Show timestamp from history */}
                          {done && order.status_history?.find(h => h.to === step.key) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.status_history.find(h => h.to === step.key)!.at).toLocaleString('uz-UZ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Status history */}
            {order.status_history && order.status_history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tarix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...order.status_history].reverse().map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {STEPS.find(s => s.key === entry.to)?.label || entry.to}
                          </p>
                          {entry.note && <p className="text-muted-foreground text-xs">{entry.note}</p>}
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.at).toLocaleString('uz-UZ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {!order && !error && !searched && (
          <div className="text-center py-12">
            <Truck className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Buyurtma raqamini kiriting</p>
          </div>
        )}
      </div>
    </div>
  );
}
