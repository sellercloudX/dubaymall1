import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminShops } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Store, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';

export function ShopsManagement() {
  const { data: shops, isLoading } = useAdminShops();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const filteredShops = shops?.filter(shop => 
    shop.name.toLowerCase().includes(search.toLowerCase()) ||
    shop.slug.toLowerCase().includes(search.toLowerCase())
  );

  const toggleShopStatus = async (shopId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !isActive })
        .eq('id', shopId);

      if (error) throw error;
      toast.success(isActive ? "Do'kon o'chirildi" : "Do'kon faollashtirildi");
      queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
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
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Do'konlar boshqaruvi
        </CardTitle>
        <div className="flex items-center gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Do'kon qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logo</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Reyting</TableHead>
              <TableHead>Sotuvlar</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Yaratilgan</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShops?.map((shop) => (
              <TableRow key={shop.id}>
                <TableCell>
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.name} className="w-10 h-10 object-cover rounded-full" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{shop.name}</TableCell>
                <TableCell className="text-muted-foreground">{shop.slug}</TableCell>
                <TableCell>⭐ {shop.rating?.toFixed(1) || '0.0'}</TableCell>
                <TableCell>{shop.total_sales || 0}</TableCell>
                <TableCell>
                  <Badge className={shop.is_active ? 'bg-green-500' : 'bg-red-500'}>
                    {shop.is_active ? 'Faol' : 'Nofaol'}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(shop.created_at), 'dd.MM.yyyy')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/shop/${shop.slug}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => toggleShopStatus(shop.id, shop.is_active)}
                    >
                      {shop.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredShops?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Do'konlar topilmadi</p>
        )}
      </CardContent>
    </Card>
  );
}
