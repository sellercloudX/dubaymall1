 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Skeleton } from '@/components/ui/skeleton';
 import { 
   TrendingUp, 
   RefreshCw, 
   ExternalLink, 
   DollarSign, 
   BarChart3,
   Flame,
   Star,
   Package,
   ArrowUpRight
 } from 'lucide-react';
 import { toast } from 'sonner';
 import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 interface TrendProduct {
   id: string;
   name: string;
   nameUz?: string;
   image: string;
   price: number;
   priceUZS: number;
   estimatedSales: number;
   profitMargin: number;
   demandIndex: number;
   trendScore: number;
   sourceUrl: string;
   category: string;
 }
 
 const formatPrice = (price: number) => {
   return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
 };
 
 const getScoreColor = (score: number) => {
   if (score >= 80) return 'text-green-600';
   if (score >= 60) return 'text-yellow-600';
   return 'text-orange-600';
 };
 
 const getScoreBadge = (score: number) => {
   if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">🔥 Hot</Badge>;
   if (score >= 60) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">⬆ Rising</Badge>;
   return <Badge variant="secondary">📈 Stable</Badge>;
 };
 
 export function MobileTrendHunter() {
   const queryClient = useQueryClient();
   
   const { data: trends, isLoading, isFetching, refetch } = useQuery({
     queryKey: ['trend-products'],
     queryFn: async () => {
       // Demo data - in production this would call 1688 API via edge function
       const demoTrends: TrendProduct[] = [
         {
           id: '1',
           name: 'Wireless Bluetooth Earbuds TWS',
           nameUz: 'Simsiz Bluetooth quloqchinlar',
           image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=200',
           price: 15,
           priceUZS: 195000,
           estimatedSales: 1250,
           profitMargin: 45,
           demandIndex: 92,
           trendScore: 88,
           sourceUrl: 'https://1688.com/product/1',
           category: 'Elektronika'
         },
         {
           id: '2',
           name: 'LED Ring Light 10" with Tripod',
           nameUz: 'LED halqa chiroq 10" tripod bilan',
           image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200',
           price: 8,
           priceUZS: 104000,
           estimatedSales: 890,
           profitMargin: 52,
           demandIndex: 85,
           trendScore: 82,
           sourceUrl: 'https://1688.com/product/2',
           category: 'Aksessuarlar'
         },
         {
           id: '3',
           name: 'Portable Mini Fan USB Rechargeable',
           nameUz: 'Ko\'chma mini ventilyator USB',
           image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
           price: 5,
           priceUZS: 65000,
           estimatedSales: 2100,
           profitMargin: 60,
           demandIndex: 95,
           trendScore: 91,
           sourceUrl: 'https://1688.com/product/3',
           category: 'Maishiy texnika'
         },
         {
           id: '4',
           name: 'Smart Watch Band Fitness Tracker',
           nameUz: 'Aqlli soat fitness tracker',
           image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
           price: 12,
           priceUZS: 156000,
           estimatedSales: 780,
           profitMargin: 48,
           demandIndex: 78,
           trendScore: 75,
           sourceUrl: 'https://1688.com/product/4',
           category: 'Elektronika'
         },
         {
           id: '5',
           name: 'Silicone Phone Case Clear',
           nameUz: 'Silikon telefon g\'ilofi shaffof',
           image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=200',
           price: 1.5,
           priceUZS: 19500,
           estimatedSales: 5400,
           profitMargin: 70,
           demandIndex: 88,
           trendScore: 85,
           sourceUrl: 'https://1688.com/product/5',
           category: 'Aksessuarlar'
         },
         {
           id: '6',
           name: 'Makeup Brush Set 12pcs',
           nameUz: 'Makiyaj cho\'tkasi to\'plami 12 ta',
           image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200',
           price: 6,
           priceUZS: 78000,
           estimatedSales: 1650,
           profitMargin: 55,
           demandIndex: 82,
           trendScore: 79,
           sourceUrl: 'https://1688.com/product/6',
           category: 'Kosmetika'
         },
       ].sort((a, b) => b.trendScore - a.trendScore);
       
       return demoTrends;
     },
     staleTime: 1000 * 60 * 30, // 30 minutes
     gcTime: 1000 * 60 * 60 * 24,
   });
 
   const handleRefresh = () => {
     toast.info('Trendlar yangilanmoqda...');
     refetch();
   };
 
   return (
     <div className="flex flex-col h-[calc(100vh-120px)]">
       {/* Header */}
       <div className="sticky top-14 bg-background z-30 px-3 py-3 border-b">
         <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
               <Flame className="h-4 w-4 text-white" />
             </div>
             <div>
               <h2 className="font-bold text-sm">Trend Hunter</h2>
               <p className="text-[10px] text-muted-foreground">1688 API orqali</p>
             </div>
           </div>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={handleRefresh}
             disabled={isFetching}
           >
             <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
             Yangilash
           </Button>
         </div>
         
         <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <Badge variant="outline" className="shrink-0 text-xs">
             <TrendingUp className="h-3 w-3 mr-1" />
             O'zbekistonda talab
           </Badge>
           <Badge variant="outline" className="shrink-0 text-xs">
             <DollarSign className="h-3 w-3 mr-1" />
             Yuqori marja
           </Badge>
           <Badge variant="outline" className="shrink-0 text-xs">
             <Star className="h-3 w-3 mr-1" />
             Top sotuvlar
           </Badge>
         </div>
       </div>
 
       {/* Products List */}
       <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
         {isLoading ? (
           Array.from({ length: 4 }).map((_, i) => (
             <Card key={i}>
               <CardContent className="p-3">
                 <div className="flex gap-3">
                   <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
                   <div className="flex-1 space-y-2">
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-3 w-3/4" />
                     <div className="flex gap-2">
                       <Skeleton className="h-6 w-16" />
                       <Skeleton className="h-6 w-16" />
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))
         ) : (
           trends?.map((product, index) => (
             <Card key={product.id} className="overflow-hidden">
               <CardContent className="p-3">
                 <div className="flex gap-3">
                   {/* Product Image */}
                   <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                     <img 
                       src={product.image} 
                       alt={product.name}
                       className="w-full h-full object-cover"
                       loading="lazy"
                     />
                     {index < 3 && (
                       <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                         {index + 1}
                       </div>
                     )}
                   </div>
 
                   {/* Product Info */}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-start justify-between gap-2 mb-1">
                       <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                         {product.nameUz || product.name}
                       </h3>
                       {getScoreBadge(product.trendScore)}
                     </div>
 
                     <div className="text-xs text-muted-foreground mb-2">
                       {product.category}
                     </div>
 
                     {/* Metrics */}
                     <div className="grid grid-cols-2 gap-2 mb-2">
                       <div className="flex items-center gap-1 text-xs">
                         <DollarSign className="h-3 w-3 text-green-600" />
                         <span className="font-semibold text-green-600">{product.profitMargin}%</span>
                         <span className="text-muted-foreground">marja</span>
                       </div>
                       <div className="flex items-center gap-1 text-xs">
                         <BarChart3 className="h-3 w-3 text-blue-600" />
                         <span className="font-semibold text-blue-600">{product.demandIndex}</span>
                         <span className="text-muted-foreground">talab</span>
                       </div>
                     </div>
 
                     {/* Price & Actions */}
                     <div className="flex items-center justify-between">
                       <div>
                         <span className="text-xs text-muted-foreground">Xitoy narxi: </span>
                         <span className="font-bold text-primary">${product.price}</span>
                       </div>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-7 text-xs"
                         onClick={() => window.open(product.sourceUrl, '_blank')}
                       >
                         <ExternalLink className="h-3 w-3 mr-1" />
                         Ko'rish
                       </Button>
                     </div>
                   </div>
                 </div>
 
                 {/* Estimated Profit Card */}
                 <div className="mt-3 p-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <ArrowUpRight className="h-4 w-4 text-green-600" />
                       <div>
                         <div className="text-xs text-muted-foreground">Taxminiy oylik savdo</div>
                         <div className="font-bold text-green-600">{product.estimatedSales.toLocaleString()} dona</div>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-xs text-muted-foreground">Kutilayotgan foyda</div>
                       <div className="font-bold text-green-600">
                         {formatPrice(Math.round(product.estimatedSales * product.priceUZS * product.profitMargin / 100))}
                       </div>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))
         )}
 
         {/* Info Card */}
         <Card className="bg-muted/50">
           <CardContent className="p-4 text-center">
             <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
             <h4 className="font-semibold text-sm mb-1">1688 API Integratsiya</h4>
             <p className="text-xs text-muted-foreground">
               RapidAPI orqali Xitoydagi trend mahsulotlarni real-vaqtda kuzating va import qiling
             </p>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }