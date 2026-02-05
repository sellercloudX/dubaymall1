import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAdminProducts } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, CheckCircle, XCircle, Package, Eye } from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  draft: 'bg-yellow-500',
  inactive: 'bg-gray-500',
  out_of_stock: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  active: 'Faol',
  draft: 'Qoralama',
  inactive: 'Nofaol',
  out_of_stock: 'Tugagan',
};

export function ProductsModeration() {
  const { data: products, isLoading } = useAdminProducts();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || product.status === filter;
    return matchesSearch && matchesFilter;
  });

  const updateStatus = async (productId: string, status: 'active' | 'inactive' | 'draft') => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status })
        .eq('id', productId);

      if (error) throw error;
      toast.success('Mahsulot holati yangilandi');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      toast.error('Xatolik yuz berdi');
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Mahsulotlar moderatsiyasi
        </CardTitle>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mahsulot qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['all', 'draft', 'active', 'inactive'].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={filter === status ? 'default' : 'outline'}
                onClick={() => setFilter(status)}
                className="text-xs"
              >
                {status === 'all' ? 'Barchasi' : statusLabels[status]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rasm</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Do'kon</TableHead>
              <TableHead>Narx</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts?.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium max-w-[150px] truncate">{product.name}</TableCell>
                <TableCell className="whitespace-nowrap">{product.shops?.name || '-'}</TableCell>
                <TableCell className="whitespace-nowrap">{product.price.toLocaleString()} so'm</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[product.status]} text-xs`}>
                    {statusLabels[product.status]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{format(new Date(product.created_at), 'dd.MM.yyyy')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                      <a href={`/product/${product.id}`} target="_blank">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    {product.status !== 'active' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => updateStatus(product.id, 'active')}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {product.status === 'active' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => updateStatus(product.id, 'inactive')}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {filteredProducts?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Mahsulotlar topilmadi</p>
        )}
      </CardContent>
    </Card>
  );
}
