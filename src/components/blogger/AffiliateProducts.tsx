import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Link2, Search, Percent, Copy, Check } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

export default function AffiliateProducts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch products with affiliate enabled
  const { data: products, isLoading } = useQuery({
    queryKey: ['affiliate-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          shops (name, slug)
        `)
        .eq('is_affiliate_enabled', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Check which products already have affiliate links
  const { data: myLinks } = useQuery({
    queryKey: ['my-affiliate-links', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('affiliate_links')
        .select('product_id, link_code')
        .eq('blogger_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create affiliate link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Generate unique link code
      const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data, error } = await supabase
        .from('affiliate_links')
        .insert({
          product_id: productId,
          blogger_id: user.id,
          link_code: linkCode,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-affiliate-links'] });
      toast({
        title: 'Muvaffaqiyatli!',
        description: 'Affiliate havola yaratildi',
      });
    },
    onError: (error) => {
      toast({
        title: 'Xatolik',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getExistingLink = (productId: string) => {
    return myLinks?.find((link) => link.product_id === productId);
  };

  const copyLink = async (linkCode: string, productId: string) => {
    const productionDomain = 'https://dubaymall.com';
    const fullUrl = `${productionDomain}/product/${productId}?ref=${linkCode}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(productId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Nusxalandi!',
      description: 'Havola clipboard-ga nusxalandi',
    });
  };

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Affiliate mahsulotlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mahsulot qidirish..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!filteredProducts?.length ? (
            <p className="text-center text-muted-foreground py-8">
              Affiliate mahsulotlar topilmadi
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const existingLink = getExistingLink(product.id);
                const shops = product.shops as { name: string; slug: string } | null;

                return (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No image
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2 bg-emerald-600">
                        {product.affiliate_commission_percent}% komissiya
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {shops?.name || 'Unknown shop'}
                      </p>
                      <p className="text-lg font-bold text-primary mb-3">
                        {product.price.toLocaleString()} so'm
                      </p>

                      {existingLink ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => copyLink(existingLink.link_code, product.id)}
                        >
                          {copiedId === product.id ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Nusxalandi!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Havolani nusxalash
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => createLinkMutation.mutate(product.id)}
                          disabled={createLinkMutation.isPending}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Havola yaratish
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
