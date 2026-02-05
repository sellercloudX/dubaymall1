 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Switch } from '@/components/ui/switch';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { Truck, Save } from 'lucide-react';
 
 export function ShippingRatesManagement() {
   const queryClient = useQueryClient();
 
   const { data: regions, isLoading: regionsLoading } = useQuery({
     queryKey: ['regions'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('regions')
         .select('*')
         .order('name_uz');
 
       if (error) throw error;
       return data || [];
     },
   });
 
   const { data: rates, isLoading: ratesLoading } = useQuery({
     queryKey: ['shipping-rates'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('regional_shipping_rates')
         .select(`
           *,
           regions:region_id(name_uz, code)
         `);
 
       if (error) throw error;
       return data || [];
     },
   });
 
   const saveMutation = useMutation({
     mutationFn: async ({ regionId, baseRate, perKgRate }: { regionId: string; baseRate: number; perKgRate: number }) => {
       // Check if rate exists
       const existing = rates?.find(r => r.region_id === regionId);
 
       if (existing) {
         const { error } = await supabase
           .from('regional_shipping_rates')
           .update({ base_rate: baseRate, per_kg_rate: perKgRate })
           .eq('id', existing.id);
         if (error) throw error;
       } else {
         const { error } = await supabase
           .from('regional_shipping_rates')
           .insert({ region_id: regionId, base_rate: baseRate, per_kg_rate: perKgRate });
         if (error) throw error;
       }
     },
     onSuccess: () => {
       toast.success('Saqlandi');
       queryClient.invalidateQueries({ queryKey: ['shipping-rates'] });
     },
     onError: (err: any) => toast.error('Xatolik: ' + err.message),
   });
 
   const formatMoney = (amount: number) => {
     return new Intl.NumberFormat('uz-UZ').format(amount);
   };
 
   const getRateForRegion = (regionId: string) => {
     return rates?.find(r => r.region_id === regionId);
   };
 
   if (regionsLoading || ratesLoading) {
     return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
   }
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Truck className="h-5 w-5" />
           Viloyatlar bo'yicha yetkazib berish
         </CardTitle>
         <CardDescription>
           Har bir viloyat uchun bazaviy yetkazib berish narxi va kg uchun qo'shimcha narx belgilang.
           Sotuvchi o'z mahsulotiga qo'shimcha narx qo'shishi mumkin.
         </CardDescription>
       </CardHeader>
       <CardContent>
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead>Viloyat</TableHead>
               <TableHead>Bazaviy narx (so'm)</TableHead>
               <TableHead>Har kg uchun (so'm)</TableHead>
               <TableHead>Amallar</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {regions?.map((region) => {
               const rate = getRateForRegion(region.id);
               return (
                 <TableRow key={region.id}>
                   <TableCell className="font-medium">{region.name_uz}</TableCell>
                   <TableCell>
                     <Input
                       type="number"
                       min="0"
                       step="1000"
                       className="w-32"
                       defaultValue={rate?.base_rate || 0}
                       id={`base-${region.id}`}
                     />
                   </TableCell>
                   <TableCell>
                     <Input
                       type="number"
                       min="0"
                       step="500"
                       className="w-32"
                       defaultValue={rate?.per_kg_rate || 0}
                       id={`perkg-${region.id}`}
                     />
                   </TableCell>
                   <TableCell>
                     <Button
                       size="sm"
                       onClick={() => {
                         const baseInput = document.getElementById(`base-${region.id}`) as HTMLInputElement;
                         const perKgInput = document.getElementById(`perkg-${region.id}`) as HTMLInputElement;
                         saveMutation.mutate({
                           regionId: region.id,
                           baseRate: parseFloat(baseInput.value) || 0,
                           perKgRate: parseFloat(perKgInput.value) || 0,
                         });
                       }}
                     >
                       <Save className="h-4 w-4 mr-1" />
                       Saqlash
                     </Button>
                   </TableCell>
                 </TableRow>
               );
             })}
           </TableBody>
         </Table>
 
         <div className="mt-6 p-4 bg-muted rounded-lg">
           <h4 className="font-semibold mb-2">Qanday ishlaydi?</h4>
           <ul className="text-sm text-muted-foreground space-y-1">
             <li>• <strong>Bazaviy narx</strong> - viloyatga yetkazib berish uchun minimal narx</li>
             <li>• <strong>Har kg uchun</strong> - mahsulot og'irligi bo'yicha qo'shimcha narx</li>
             <li>• Yakuniy narx = Bazaviy + (Og'irlik × Kg narxi) + Sotuvchi qo'shimchasi</li>
             <li>• Sotuvchi bepul yetkazib berish tanlasa, bu narxlar qo'llanilmaydi</li>
           </ul>
         </div>
       </CardContent>
     </Card>
   );
 }