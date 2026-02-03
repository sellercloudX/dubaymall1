import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function CommissionsHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['commissions-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          products (name),
          orders (order_number)
        `)
        .eq('blogger_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Kutilmoqda
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-emerald-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Tasdiqlangan
          </Badge>
        );
      case 'paid':
        return (
          <Badge className="bg-blue-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            To'langan
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rad etilgan
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{t.loading}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Komissiyalar tarixi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!commissions?.length ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Hali komissiyalar yo'q. Affiliate havolalaringiz orqali sotuvlar amalga oshirilganda bu yerda ko'rinadi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Buyurtma</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Buyurtma summasi</TableHead>
                  <TableHead className="text-center">Foiz</TableHead>
                  <TableHead className="text-right">Komissiya</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => {
                  const product = commission.products as { name: string } | null;
                  const order = commission.orders as { order_number: string } | null;

                  return (
                    <TableRow key={commission.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(commission.created_at), 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {order?.order_number || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {product?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right">
                        {commission.order_amount.toLocaleString()} so'm
                      </TableCell>
                      <TableCell className="text-center">
                        {commission.commission_percent}%
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {commission.commission_amount.toLocaleString()} so'm
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(commission.status || 'pending')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
