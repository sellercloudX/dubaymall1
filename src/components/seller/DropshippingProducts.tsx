import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { 
  Package, 
  ExternalLink, 
  Pencil, 
  Trash2, 
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Product = Tables<'products'>;

interface DropshippingProductsProps {
  shopId: string;
  refreshTrigger?: number;
}

export function DropshippingProducts({ shopId, refreshTrigger }: DropshippingProductsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  useEffect(() => {
    fetchDropshippingProducts();
  }, [shopId, refreshTrigger]);

  const fetchDropshippingProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('source', 'dropshipping')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleUpdatePrice = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ price: editPrice })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, price: editPrice } : p)
      );
      setEditingId(null);

      toast({
        title: t.success,
        description: 'Narx yangilandi',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== productId));

      toast({
        title: t.success,
        description: t.productDeleted,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleActivateProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'active' })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, status: 'active' } : p)
      );

      toast({
        title: t.success,
        description: 'Mahsulot faollashtirildi',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const calculateProfit = (product: Product) => {
    if (!product.original_price) return null;
    return product.price - product.original_price;
  };

  const calculateMargin = (product: Product) => {
    if (!product.original_price || product.original_price === 0) return null;
    return ((product.price - product.original_price) / product.original_price) * 100;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Dropshipping mahsulotlar yo'q</h3>
          <p className="text-muted-foreground">Birinchi mahsulotni import qiling</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Dropshipping mahsulotlar
        </CardTitle>
        <CardDescription>
          Import qilingan mahsulotlar ({products.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.products}</TableHead>
              <TableHead>{t.productOriginalPrice}</TableHead>
              <TableHead>{t.productPrice}</TableHead>
              <TableHead>Foyda</TableHead>
              <TableHead>{t.productStatus}</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const profit = calculateProfit(product);
              const margin = calculateMargin(product);

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images?.[0] || '/placeholder.svg'}
                        alt={product.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.source_url && (
                          <a
                            href={product.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Manbani ko'rish
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.original_price 
                      ? `${product.original_price.toLocaleString()} so'm`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-32"
                        />
                        <Button size="sm" onClick={() => handleUpdatePrice(product.id)}>
                          {t.save}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          {t.cancel}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{product.price.toLocaleString()} so'm</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingId(product.id);
                            setEditPrice(product.price);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {profit !== null ? (
                      <div className="flex items-center gap-1">
                        {profit >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className={profit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                          {profit.toLocaleString()} so'm
                        </span>
                        {margin !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({margin.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={product.status === 'active' ? 'default' : 'secondary'}
                    >
                      {product.status === 'active' ? t.statusActive : t.statusDraft}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {product.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivateProduct(product.id)}
                        >
                          Faollashtirish
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.delete}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bu mahsulotni o'chirishni tasdiqlaysizmi?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              {t.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
