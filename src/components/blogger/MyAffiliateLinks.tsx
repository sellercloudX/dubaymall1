import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Link2, MousePointer, ShoppingCart, TrendingUp, ExternalLink } from 'lucide-react';

export default function MyAffiliateLinks() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ['my-affiliate-links-full', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('affiliate_links')
        .select(`
          *,
          products (
            id,
            name,
            price,
            images,
            affiliate_commission_percent,
            shops (name)
          )
        `)
        .eq('blogger_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const copyLink = async (linkCode: string, productId: string) => {
    const fullUrl = `${window.location.origin}/product/${productId}?ref=${linkCode}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(linkCode);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Nusxalandi!',
      description: 'Havola clipboard-ga nusxalandi',
    });
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
          <Link2 className="h-5 w-5" />
          Mening havolalarim
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!links?.length ? (
          <div className="text-center py-8">
            <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Hali affiliate havolangiz yo'q. "Mahsulotlar" bo'limidan havola yarating.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-center">Bosishlar</TableHead>
                  <TableHead className="text-center">Sotuvlar</TableHead>
                  <TableHead className="text-center">Komissiya</TableHead>
                  <TableHead className="text-right">Daromad</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const product = link.products as any;
                  const shop = product?.shops as { name: string } | null;
                  const conversionRate = link.clicks > 0 
                    ? ((link.conversions / link.clicks) * 100).toFixed(1)
                    : '0';

                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {product?.images?.[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                No img
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground line-clamp-1">
                              {product?.name || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {shop?.name || 'Unknown shop'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MousePointer className="h-3 w-3 text-muted-foreground" />
                          <span>{link.clicks}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                          <span>{link.conversions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {product?.affiliate_commission_percent || 0}%
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {conversionRate}% konversiya
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {(link.total_commission || 0).toLocaleString()} so'm
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(link.link_code, product?.id)}
                          >
                            {copiedId === link.link_code ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/product/${product?.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
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
