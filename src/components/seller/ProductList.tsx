import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { MoreHorizontal, Edit, Trash2, Eye, Package, Users, Percent, Palette, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { VariantManager } from './VariantManager';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface ProductListProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onRefresh?: () => void;
}

export function ProductList({ products, loading, onEdit, onDelete, onRefresh }: ProductListProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [affiliateProduct, setAffiliateProduct] = useState<Product | null>(null);
  const [commissionPercent, setCommissionPercent] = useState('15');
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const selectByStatus = (status: string) => {
    setSelectedIds(new Set(products.filter(p => p.status === status).map(p => p.id)));
  };

  const bulkUpdateStatus = async (newStatus: 'active' | 'draft' | 'inactive') => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .in('id', ids);
    setBulkUpdating(false);
    if (error) {
      sonnerToast.error(`Xatolik: ${error.message}`);
    } else {
      sonnerToast.success(`${ids.length} ta mahsulot "${newStatus}" holatiga o'tkazildi`);
      setSelectedIds(new Set());
      onRefresh?.();
    }
  };

  const bulkUpdateStock = async (stock: number) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: stock })
      .in('id', ids);
    setBulkUpdating(false);
    if (error) {
      sonnerToast.error(`Xatolik: ${error.message}`);
    } else {
      sonnerToast.success(`${ids.length} ta mahsulotga ${stock} dona qoldiq qo'yildi`);
      setSelectedIds(new Set());
      onRefresh?.();
    }
  };

  const [stockInput, setStockInput] = useState('10');

  const handleAffiliateToggle = async (product: Product, enabled: boolean) => {
    if (enabled) {
      setAffiliateProduct(product);
      setCommissionPercent(String(product.affiliate_commission_percent || 15));
    } else {
      const { error } = await supabase
        .from('products')
        .update({ is_affiliate_enabled: false, affiliate_commission_percent: null })
        .eq('id', product.id);

      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Muvaffaqiyatli', description: 'Affiliate o\'chirildi' });
        onRefresh?.();
      }
    }
  };

  const saveAffiliateSettings = async () => {
    if (!affiliateProduct) return;
    const percent = parseInt(commissionPercent);
    if (isNaN(percent) || percent < 5 || percent > 50) {
      toast({ title: 'Xatolik', description: 'Komissiya 5-50% orasida bo\'lishi kerak', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('products')
      .update({ is_affiliate_enabled: true, affiliate_commission_percent: percent })
      .eq('id', affiliateProduct.id);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muvaffaqiyatli', description: 'Affiliate yoqildi' });
      setAffiliateProduct(null);
      onRefresh?.();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default', draft: 'secondary', inactive: 'outline', out_of_stock: 'destructive',
    };
    const labels: Record<string, string> = {
      active: t.statusActive, draft: t.statusDraft, inactive: t.statusInactive, out_of_stock: t.statusOutOfStock,
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('uz-UZ').format(price) + " so'm";

  if (loading) {
    return (
      <Card><CardContent className="p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
        <p className="text-muted-foreground">{t.loading}</p>
      </CardContent></Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t.noData}</p>
      </CardContent></Card>
    );
  }

  const draftCount = products.filter(p => p.status === 'draft').length;

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{selectedIds.size} ta tanlandi</span>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Button size="sm" onClick={() => bulkUpdateStatus('active')} disabled={bulkUpdating}>
                  {bulkUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Faollashtirish
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('draft')} disabled={bulkUpdating}>
                  Qoralamaga
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('inactive')} disabled={bulkUpdating}>
                  O'chirish
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" disabled={bulkUpdating}>Qoldiq qo'yish</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 bg-background z-50">
                    <div className="flex gap-2">
                      <Input type="number" min="0" value={stockInput} onChange={e => setStockInput(e.target.value)} className="h-8" />
                      <Button size="sm" className="h-8" onClick={() => bulkUpdateStock(parseInt(stockInput) || 0)}>OK</Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Bekor</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick filters */}
      {draftCount > 0 && selectedIds.size === 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => selectByStatus('draft')}>
            {draftCount} ta qoralama — barchasini tanlash
          </Button>
          <Button size="sm" variant="outline" onClick={toggleAll}>
            Hammasini tanlash ({products.length})
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === products.length && products.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>{t.productName}</TableHead>
              <TableHead>{t.productPrice}</TableHead>
              <TableHead>{t.productStock}</TableHead>
              <TableHead>{t.productStatus}</TableHead>
              <TableHead className="text-center">Affiliate</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className={selectedIds.has(product.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(product.id)}
                    onCheckedChange={() => toggleSelect(product.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0]} alt={product.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.source !== 'manual' && (
                        <Badge variant="outline" className="text-xs">
                          {product.source === 'ai' ? t.sourceAI : t.sourceDropshipping}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{formatPrice(product.price)}</p>
                    {product.original_price && product.original_price > product.price && (
                      <p className="text-sm text-muted-foreground line-through">{formatPrice(product.original_price)}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.stock_quantity}</TableCell>
                <TableCell>{getStatusBadge(product.status)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={product.is_affiliate_enabled || false}
                      onCheckedChange={(checked) => handleAffiliateToggle(product, checked)}
                    />
                    {product.is_affiliate_enabled && (
                      <Badge variant="secondary" className="text-xs">{product.affiliate_commission_percent}%</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background z-50">
                      <DropdownMenuItem asChild>
                        <Link to={`/product/${product.id}`} className="flex items-center">
                          <ExternalLink className="mr-2 h-4 w-4" />Ko'rish
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(product)}>
                        <Edit className="mr-2 h-4 w-4" />{t.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setVariantProduct(product)}>
                        <Palette className="mr-2 h-4 w-4" />Variantlar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteId(product.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />{t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete}?</AlertDialogTitle>
            <AlertDialogDescription>Bu amalni ortga qaytarib bo'lmaydi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Affiliate Settings Dialog */}
      <AlertDialog open={!!affiliateProduct} onOpenChange={() => setAffiliateProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />Affiliate sozlamalari
            </AlertDialogTitle>
            <AlertDialogDescription>{affiliateProduct?.name} uchun komissiya foizini belgilang</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input type="number" min="5" max="50" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="w-24" />
              <span className="text-muted-foreground">% komissiya</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Bloggerlar har sotuvdan {commissionPercent}% komissiya oladi</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={saveAffiliateSettings}>{t.save}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Variant Manager Dialog */}
      <Dialog open={!!variantProduct} onOpenChange={() => setVariantProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />{variantProduct?.name} - Variantlar
            </DialogTitle>
          </DialogHeader>
          {variantProduct && <VariantManager productId={variantProduct.id} />}
        </DialogContent>
      </Dialog>
    </>
  );
}