import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Rocket, TrendingUp, Eye, MousePointer, ShoppingCart, Zap } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
}

interface Promotion {
  id: string;
  type: string;
  status: string;
  budget: number;
  spent: number;
  views_count: number;
  clicks_count: number;
  conversions: number;
  start_date: string;
  end_date: string | null;
  product: Product;
}

interface ProductBoostProps {
  shopId: string;
}

export function ProductBoost({ shopId }: ProductBoostProps) {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    budget: 100000,
    daily_budget: 20000,
    duration: 7,
  });

  useEffect(() => {
    if (shopId) {
      fetchPromotions();
      fetchProducts();
    }
  }, [shopId]);

  const fetchPromotions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('promotions')
      .select(`
        *,
        product:products(id, name, price, images)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPromotions(data as unknown as Promotion[]);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, price, images')
      .eq('shop_id', shopId)
      .eq('status', 'active');

    if (data) {
      setProducts(data);
    }
  };

  const handleCreatePromotion = async () => {
    if (!user || !formData.product_id) {
      toast.error('Mahsulotni tanlang');
      return;
    }

    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + formData.duration);

      const { error } = await supabase
        .from('promotions')
        .insert({
          type: 'product_boost',
          product_id: formData.product_id,
          shop_id: shopId,
          user_id: user.id,
          budget: formData.budget,
          daily_budget: formData.daily_budget,
          status: 'pending',
          end_date: endDate.toISOString(),
        });

      if (error) throw error;

      toast.success('Reklama so\'rovi yuborildi');
      setDialogOpen(false);
      setFormData({ product_id: '', budget: 100000, daily_budget: 20000, duration: 7 });
      fetchPromotions();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Faol</Badge>;
      case 'pending':
        return <Badge variant="outline">Kutilmoqda</Badge>;
      case 'completed':
        return <Badge variant="secondary">Tugagan</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Bekor qilingan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Mahsulot reklama (Boost)
          </h2>
          <p className="text-sm text-muted-foreground">
            Mahsulotlaringizni tez sotish uchun reklama qiling
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Zap className="h-4 w-4" />
              Yangi reklama
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mahsulotni reklama qilish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Mahsulotni tanlang</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mahsulot tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {formatPrice(product.price)} so'm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Umumiy byudjet (so'm)</Label>
                <Input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
                  min={50000}
                  step={10000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimal: 50,000 so'm
                </p>
              </div>

              <div>
                <Label>Kunlik byudjet (so'm)</Label>
                <Input
                  type="number"
                  value={formData.daily_budget}
                  onChange={(e) => setFormData({ ...formData, daily_budget: parseInt(e.target.value) || 0 })}
                  min={10000}
                  step={5000}
                />
              </div>

              <div>
                <Label>Davomiyligi (kun)</Label>
                <Select
                  value={String(formData.duration)}
                  onValueChange={(v) => setFormData({ ...formData, duration: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 kun</SelectItem>
                    <SelectItem value="7">7 kun</SelectItem>
                    <SelectItem value="14">14 kun</SelectItem>
                    <SelectItem value="30">30 kun</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxminiy ko'rishlar</span>
                    <span className="font-medium">~{Math.round(formData.budget / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Taxminiy bosishlar</span>
                    <span className="font-medium">~{Math.round(formData.budget / 500).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={handleCreatePromotion}>
                  Boshlash
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Promotions */}
      <div className="grid gap-4">
        {promotions.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Hali reklamalar yo'q</h3>
              <p className="text-muted-foreground text-center mb-4">
                Mahsulotlaringizni ko'proq odamlarga ko'rsatish uchun reklama boshlang
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Zap className="h-4 w-4 mr-2" />
                Birinchi reklamani boshlash
              </Button>
            </CardContent>
          </Card>
        )}

        {promotions.map((promo) => (
          <Card key={promo.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  {promo.product?.images?.[0] ? (
                    <img
                      src={promo.product.images[0]}
                      alt={promo.product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                      <Rocket className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold truncate">{promo.product?.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(promo.product?.price || 0)} so'm
                      </p>
                    </div>
                    {getStatusBadge(promo.status)}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="text-center">
                      <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
                      <div className="text-lg font-semibold">{promo.views_count.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Ko'rishlar</div>
                    </div>
                    <div className="text-center">
                      <MousePointer className="h-4 w-4 mx-auto text-muted-foreground" />
                      <div className="text-lg font-semibold">{promo.clicks_count.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Bosishlar</div>
                    </div>
                    <div className="text-center">
                      <ShoppingCart className="h-4 w-4 mx-auto text-muted-foreground" />
                      <div className="text-lg font-semibold">{promo.conversions}</div>
                      <div className="text-xs text-muted-foreground">Sotuvlar</div>
                    </div>
                    <div className="text-center">
                      <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
                      <div className="text-lg font-semibold">
                        {formatPrice(promo.spent)}/{formatPrice(promo.budget)}
                      </div>
                      <div className="text-xs text-muted-foreground">Sarflangan</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
