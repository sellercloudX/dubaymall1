 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Search, Store, Users, Eye, TrendingUp, DollarSign, Package, ShoppingCart, Crown } from 'lucide-react';
 import { format } from 'date-fns';
 
 export function PartnersDetails() {
   const [search, setSearch] = useState('');
   const [selectedPartner, setSelectedPartner] = useState<any>(null);
   const [detailsType, setDetailsType] = useState<'seller' | 'blogger' | 'sellercloud' | null>(null);
 
   // Fetch sellers with profiles and stats
   const { data: sellers, isLoading: sellersLoading } = useQuery({
     queryKey: ['admin-sellers-detailed'],
     queryFn: async () => {
       const { data: sellerProfiles } = await supabase
         .from('seller_profiles')
         .select('*')
         .order('created_at', { ascending: false });

       if (!sellerProfiles?.length) return [];

       // Fetch profiles and shops separately (no FK joins)
       const userIds = sellerProfiles.map(s => s.user_id);
       const shopIds = sellerProfiles.map(s => s.shop_id).filter(Boolean) as string[];

       const [profilesRes, shopsRes] = await Promise.all([
         supabase.from('profiles').select('user_id, full_name, phone, avatar_url').in('user_id', userIds),
         shopIds.length > 0 ? supabase.from('shops').select('id, name, slug, logo_url, description').in('id', shopIds) : Promise.resolve({ data: [] }),
       ]);

       const profilesMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));
       const shopsMap = Object.fromEntries((shopsRes.data || []).map(s => [s.id, s]));

       // Get stats for each seller
       const enrichedSellers = await Promise.all(
         sellerProfiles.map(async (seller) => {
           const profile = profilesMap[seller.user_id] || null;
           const shop = seller.shop_id ? shopsMap[seller.shop_id] || null : null;

           if (!seller.shop_id) return { ...seller, profiles: profile, shops: shop, stats: null };
           
            const [productsRes, balanceRes] = await Promise.all([
             supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', seller.shop_id),
             supabase.from('seller_balances').select('*').eq('shop_id', seller.shop_id).maybeSingle(),
           ]);

           const { data: financials } = await supabase
             .from('order_financials')
             .select('order_total, platform_commission_amount, seller_net_amount')
             .eq('shop_id', seller.shop_id);

           const totalRevenue = financials?.reduce((sum, f) => sum + Number(f.order_total), 0) || 0;
           const platformEarnings = financials?.reduce((sum, f) => sum + Number(f.platform_commission_amount), 0) || 0;

           return {
             ...seller,
             profiles: profile,
             shops: shop,
             stats: {
               productsCount: productsRes.count || 0,
               totalRevenue,
               platformEarnings,
               balance: balanceRes.data,
             },
           };
         })
       );
 
       return enrichedSellers;
     },
   });
 
   // Fetch bloggers with profiles and stats
   const { data: bloggers, isLoading: bloggersLoading } = useQuery({
     queryKey: ['admin-bloggers-detailed'],
     queryFn: async () => {
       const { data: bloggerProfiles } = await supabase
         .from('blogger_profiles')
         .select('*')
         .order('created_at', { ascending: false });

       if (!bloggerProfiles?.length) return [];

       const userIds = bloggerProfiles.map(b => b.user_id);
       const { data: profilesData } = await supabase
         .from('profiles')
         .select('user_id, full_name, phone, avatar_url')
         .in('user_id', userIds);
       const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p]));

       const enrichedBloggers = await Promise.all(
         bloggerProfiles.map(async (blogger) => {
           const [linksRes, balanceRes, commissionsRes] = await Promise.all([
             supabase.from('affiliate_links').select('clicks, conversions, total_commission').eq('blogger_id', blogger.user_id),
             supabase.from('blogger_balances').select('*').eq('user_id', blogger.user_id).maybeSingle(),
             supabase.from('commissions').select('commission_amount').eq('blogger_id', blogger.user_id),
           ]);

           const totalClicks = linksRes.data?.reduce((sum, l) => sum + (l.clicks || 0), 0) || 0;
           const totalConversions = linksRes.data?.reduce((sum, l) => sum + (l.conversions || 0), 0) || 0;
           const totalEarned = commissionsRes.data?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

           return {
             ...blogger,
             profiles: profilesMap[blogger.user_id] || null,
             stats: {
               linksCount: linksRes.data?.length || 0,
               totalClicks,
               totalConversions,
               totalEarned,
               balance: balanceRes.data,
             },
           };
         })
       );

       return enrichedBloggers;
     },
   });

   // Fetch SellerCloudX subscribers
   const { data: sellerCloudUsers, isLoading: scLoading } = useQuery({
     queryKey: ['admin-sellercloud-detailed'],
     queryFn: async () => {
       const { data: subscriptions } = await supabase
         .from('sellercloud_subscriptions')
         .select('*')
         .order('created_at', { ascending: false });

       if (!subscriptions?.length) return [];

       const userIds = subscriptions.map(s => s.user_id);
       const { data: profilesData } = await supabase
         .from('profiles')
         .select('user_id, full_name, phone, avatar_url')
         .in('user_id', userIds);
       const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p]));

       const enriched = await Promise.all(
         subscriptions.map(async (sub) => {
           const { data: billing } = await supabase
             .from('sellercloud_billing')
             .select('*')
             .eq('user_id', sub.user_id)
             .order('created_at', { ascending: false });

           const { data: connections } = await supabase
             .from('marketplace_connections')
             .select('marketplace, is_active, total_revenue, products_count, orders_count')
             .eq('user_id', sub.user_id);

           const totalDebt = billing?.filter(b => b.status !== 'paid').reduce((sum, b) => sum + Number(b.balance_due), 0) || 0;
           const totalPaid = billing?.filter(b => b.status === 'paid').reduce((sum, b) => sum + Number(b.total_paid), 0) || 0;

           return {
             ...sub,
             profiles: profilesMap[sub.user_id] || null,
             stats: {
               totalDebt,
               totalPaid,
               billing: billing || [],
               connections: connections || [],
             },
           };
         })
       );

       return enriched;
     },
   });
 
   const formatMoney = (amount: number) => {
     return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
   };
 
   const openDetails = (partner: any, type: 'seller' | 'blogger' | 'sellercloud') => {
     setSelectedPartner(partner);
     setDetailsType(type);
   };
 
   const filteredSellers = sellers?.filter(s => 
     s.business_name?.toLowerCase().includes(search.toLowerCase()) ||
     (s.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     s.inn?.includes(search)
   );
 
   const filteredBloggers = bloggers?.filter(b => 
     b.social_username?.toLowerCase().includes(search.toLowerCase()) ||
     (b.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase())
   );
 
   const filteredSC = sellerCloudUsers?.filter(s => 
     (s.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     (s.profiles as any)?.phone?.includes(search)
   );
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Users className="h-5 w-5" />
           Hamkorlar tafsiloti
         </CardTitle>
         <div className="flex items-center gap-2 mt-4">
           <Search className="h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Qidirish (ism, INN, telefon)..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="max-w-sm"
           />
         </div>
       </CardHeader>
       <CardContent>
         <Tabs defaultValue="sellers">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex w-max">
              <TabsTrigger value="sellers" className="gap-1 text-xs sm:text-sm">
               <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Sotuvchilar</span> ({sellers?.length || 0})
             </TabsTrigger>
              <TabsTrigger value="bloggers" className="gap-1 text-xs sm:text-sm">
               <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Bloggerlar</span> ({bloggers?.length || 0})
             </TabsTrigger>
              <TabsTrigger value="sellercloud" className="gap-1 text-xs sm:text-sm">
               <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">SellerCloudX</span> ({sellerCloudUsers?.length || 0})
             </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
 
           {/* Sellers Tab */}
           <TabsContent value="sellers">
             {sellersLoading ? (
               <p className="text-center py-8">Yuklanmoqda...</p>
             ) : (
                <ScrollArea className="w-full">
               <Table>
                 <TableHeader>
                   <TableRow>
                      <TableHead className="min-w-[120px]">Biznes nomi</TableHead>
                     <TableHead>Egasi</TableHead>
                     <TableHead>INN</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Mahsulotlar</TableHead>
                     <TableHead>Umumiy savdo</TableHead>
                     <TableHead>Platforma daromadi</TableHead>
                      <TableHead className="text-right">Amallar</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredSellers?.map((seller) => (
                     <TableRow key={seller.id}>
                        <TableCell className="font-medium whitespace-nowrap">{seller.business_name || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{(seller.profiles as any)?.full_name || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{seller.inn || '-'}</TableCell>
                       <TableCell>
                          <Badge variant={seller.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                           {seller.status}
                         </Badge>
                       </TableCell>
                       <TableCell>{seller.stats?.productsCount || 0}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatMoney(seller.stats?.totalRevenue || 0)}</TableCell>
                        <TableCell className="text-green-600 font-medium whitespace-nowrap">
                         {formatMoney(seller.stats?.platformEarnings || 0)}
                       </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetails(seller, 'seller')}>
                            <Eye className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
             )}
           </TabsContent>
 
           {/* Bloggers Tab */}
           <TabsContent value="bloggers">
             {bloggersLoading ? (
               <p className="text-center py-8">Yuklanmoqda...</p>
             ) : (
                <ScrollArea className="w-full">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Blogger</TableHead>
                     <TableHead>Platforma</TableHead>
                     <TableHead>Username</TableHead>
                     <TableHead>Obunachilar</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Kliklar</TableHead>
                     <TableHead>Konversiyalar</TableHead>
                     <TableHead>Umumiy daromad</TableHead>
                      <TableHead className="text-right">Amallar</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredBloggers?.map((blogger) => (
                     <TableRow key={blogger.id}>
                        <TableCell className="font-medium whitespace-nowrap">{(blogger.profiles as any)?.full_name || '-'}</TableCell>
                       <TableCell>
                          <Badge variant="outline" className="text-xs">{blogger.social_platform}</Badge>
                       </TableCell>
                       <TableCell>{blogger.social_username || '-'}</TableCell>
                       <TableCell>{blogger.followers_count?.toLocaleString() || 0}</TableCell>
                       <TableCell>
                          <Badge variant={blogger.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                           {blogger.status}
                         </Badge>
                       </TableCell>
                       <TableCell>{blogger.stats?.totalClicks || 0}</TableCell>
                       <TableCell>{blogger.stats?.totalConversions || 0}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                         {formatMoney(blogger.stats?.totalEarned || 0)}
                       </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetails(blogger, 'blogger')}>
                            <Eye className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
             )}
           </TabsContent>
 
           {/* SellerCloudX Tab */}
           <TabsContent value="sellercloud">
             {scLoading ? (
               <p className="text-center py-8">Yuklanmoqda...</p>
             ) : (
                <ScrollArea className="w-full">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Foydalanuvchi</TableHead>
                     <TableHead>Tarif</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Ulanishlar</TableHead>
                     <TableHead>To'langan</TableHead>
                     <TableHead>Qarzdorlik</TableHead>
                      <TableHead className="text-right">Amallar</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredSC?.map((sub) => (
                     <TableRow key={sub.id}>
                        <TableCell className="font-medium whitespace-nowrap">{(sub.profiles as any)?.full_name || '-'}</TableCell>
                       <TableCell>
                          <Badge variant="outline" className="text-xs">{sub.plan_type}</Badge>
                       </TableCell>
                       <TableCell>
                          <Badge variant={sub.is_active ? 'default' : 'destructive'} className="text-xs">
                           {sub.is_active ? 'Faol' : 'Nofaol'}
                         </Badge>
                          {sub.admin_override && <Badge className="ml-1 bg-amber-500 text-xs">Override</Badge>}
                       </TableCell>
                       <TableCell>{sub.stats?.connections?.length || 0}</TableCell>
                        <TableCell className="text-green-600 whitespace-nowrap">
                         {formatMoney(sub.stats?.totalPaid || 0)}
                       </TableCell>
                        <TableCell className="text-red-600 whitespace-nowrap">
                         {formatMoney(sub.stats?.totalDebt || 0)}
                       </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetails(sub, 'sellercloud')}>
                            <Eye className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
             )}
           </TabsContent>
         </Tabs>
 
         {/* Details Dialog */}
         <Dialog open={!!selectedPartner} onOpenChange={() => { setSelectedPartner(null); setDetailsType(null); }}>
           <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
             <DialogHeader>
               <DialogTitle>
                 {detailsType === 'seller' && 'Sotuvchi tafsilotlari'}
                 {detailsType === 'blogger' && 'Blogger tafsilotlari'}
                 {detailsType === 'sellercloud' && 'SellerCloudX tafsilotlari'}
               </DialogTitle>
             </DialogHeader>
             
             {detailsType === 'seller' && selectedPartner && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm text-muted-foreground">Biznes nomi</p>
                     <p className="font-medium">{selectedPartner.business_name || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Biznes turi</p>
                     <p className="font-medium">{selectedPartner.business_type}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">INN</p>
                     <p className="font-medium">{selectedPartner.inn || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">OKED</p>
                     <p className="font-medium">{selectedPartner.oked || '-'}</p>
                   </div>
                   <div className="col-span-2">
                     <p className="text-sm text-muted-foreground">Yuridik manzil</p>
                     <p className="font-medium">{selectedPartner.legal_address || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Bank</p>
                     <p className="font-medium">{selectedPartner.bank_name || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">MFO</p>
                     <p className="font-medium">{selectedPartner.bank_mfo || '-'}</p>
                   </div>
                   <div className="col-span-2">
                     <p className="text-sm text-muted-foreground">Hisob raqam</p>
                     <p className="font-medium font-mono">{selectedPartner.bank_account || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Telefon</p>
                     <p className="font-medium">{selectedPartner.contact_phone || (selectedPartner.profiles as any)?.phone || '-'}</p>
                   </div>
                 </div>
                 <div className="border-t pt-4">
                   <h4 className="font-semibold mb-2">Statistika</h4>
                   <div className="grid grid-cols-3 gap-4">
                     <Card>
                       <CardContent className="p-4 text-center">
                         <Package className="h-6 w-6 mx-auto text-blue-500" />
                         <p className="text-2xl font-bold">{selectedPartner.stats?.productsCount || 0}</p>
                         <p className="text-xs text-muted-foreground">Mahsulotlar</p>
                       </CardContent>
                     </Card>
                     <Card>
                       <CardContent className="p-4 text-center">
                         <TrendingUp className="h-6 w-6 mx-auto text-green-500" />
                         <p className="text-lg font-bold">{formatMoney(selectedPartner.stats?.totalRevenue || 0)}</p>
                         <p className="text-xs text-muted-foreground">Umumiy savdo</p>
                       </CardContent>
                     </Card>
                     <Card>
                       <CardContent className="p-4 text-center">
                         <DollarSign className="h-6 w-6 mx-auto text-amber-500" />
                         <p className="text-lg font-bold">{formatMoney(selectedPartner.stats?.platformEarnings || 0)}</p>
                         <p className="text-xs text-muted-foreground">Platforma ulushi</p>
                       </CardContent>
                     </Card>
                   </div>
                 </div>
               </div>
             )}
 
             {detailsType === 'blogger' && selectedPartner && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm text-muted-foreground">Ism</p>
                     <p className="font-medium">{(selectedPartner.profiles as any)?.full_name || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Platforma</p>
                     <p className="font-medium">{selectedPartner.social_platform}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Username</p>
                     <p className="font-medium">@{selectedPartner.social_username || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Obunachilar</p>
                     <p className="font-medium">{selectedPartner.followers_count?.toLocaleString() || 0}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Nicha</p>
                     <p className="font-medium">{selectedPartner.niche || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Profil havolasi</p>
                     <a href={selectedPartner.social_url || '#'} target="_blank" className="text-primary underline">
                       {selectedPartner.social_url || '-'}
                     </a>
                   </div>
                   <div className="col-span-2">
                     <p className="text-sm text-muted-foreground">Tavsif</p>
                     <p className="font-medium">{selectedPartner.description || '-'}</p>
                   </div>
                 </div>
                 {selectedPartner.screenshots?.length > 0 && (
                   <div>
                     <p className="text-sm text-muted-foreground mb-2">Skrinshotlar</p>
                     <div className="flex gap-2 overflow-x-auto">
                       {selectedPartner.screenshots.map((url: string, i: number) => (
                         <img key={i} src={url} alt={`Screenshot ${i+1}`} className="h-32 rounded border" />
                       ))}
                     </div>
                   </div>
                 )}
                 <div className="border-t pt-4">
                   <h4 className="font-semibold mb-2">Statistika</h4>
                   <div className="grid grid-cols-4 gap-4">
                     <Card>
                       <CardContent className="p-3 text-center">
                         <p className="text-xl font-bold">{selectedPartner.stats?.linksCount || 0}</p>
                         <p className="text-xs text-muted-foreground">Havolalar</p>
                       </CardContent>
                     </Card>
                     <Card>
                       <CardContent className="p-3 text-center">
                         <p className="text-xl font-bold">{selectedPartner.stats?.totalClicks || 0}</p>
                         <p className="text-xs text-muted-foreground">Kliklar</p>
                       </CardContent>
                     </Card>
                     <Card>
                       <CardContent className="p-3 text-center">
                         <p className="text-xl font-bold">{selectedPartner.stats?.totalConversions || 0}</p>
                         <p className="text-xs text-muted-foreground">Sotuvlar</p>
                       </CardContent>
                     </Card>
                     <Card>
                       <CardContent className="p-3 text-center">
                         <p className="text-lg font-bold">{formatMoney(selectedPartner.stats?.totalEarned || 0)}</p>
                         <p className="text-xs text-muted-foreground">Daromad</p>
                       </CardContent>
                     </Card>
                   </div>
                 </div>
               </div>
             )}
 
             {detailsType === 'sellercloud' && selectedPartner && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm text-muted-foreground">Foydalanuvchi</p>
                     <p className="font-medium">{(selectedPartner.profiles as any)?.full_name || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Telefon</p>
                     <p className="font-medium">{(selectedPartner.profiles as any)?.phone || '-'}</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Tarif</p>
                     <p className="font-medium">{selectedPartner.plan_type} (${selectedPartner.monthly_fee}/oy + {selectedPartner.commission_percent}%)</p>
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Boshlangan</p>
                     <p className="font-medium">{selectedPartner.started_at ? format(new Date(selectedPartner.started_at), 'dd.MM.yyyy') : '-'}</p>
                   </div>
                 </div>
                 
                 {selectedPartner.stats?.connections?.length > 0 && (
                   <div className="border-t pt-4">
                     <h4 className="font-semibold mb-2">Ulangan marketpleyslar</h4>
                     <div className="space-y-2">
                       {selectedPartner.stats.connections.map((conn: any, i: number) => (
                         <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                           <span className="font-medium">{conn.marketplace}</span>
                           <div className="flex gap-4 text-sm">
                             <span>{conn.products_count || 0} mahsulot</span>
                             <span>{conn.orders_count || 0} buyurtma</span>
                             <span className="text-green-600">{formatMoney(conn.total_revenue || 0)}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
 
                 <div className="border-t pt-4">
                   <h4 className="font-semibold mb-2">To'lovlar tarixi</h4>
                   <div className="grid grid-cols-2 gap-4 mb-4">
                     <Card className="bg-green-50">
                       <CardContent className="p-4 text-center">
                         <p className="text-xl font-bold text-green-600">{formatMoney(selectedPartner.stats?.totalPaid || 0)}</p>
                         <p className="text-xs text-muted-foreground">To'langan</p>
                       </CardContent>
                     </Card>
                     <Card className="bg-red-50">
                       <CardContent className="p-4 text-center">
                         <p className="text-xl font-bold text-red-600">{formatMoney(selectedPartner.stats?.totalDebt || 0)}</p>
                         <p className="text-xs text-muted-foreground">Qarzdorlik</p>
                       </CardContent>
                     </Card>
                   </div>
                 </div>
               </div>
             )}
           </DialogContent>
         </Dialog>
       </CardContent>
     </Card>
   );
 }