 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { Percent, Save, Plus, Trash2 } from 'lucide-react';
 import { useCategories } from '@/hooks/useCategories';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { usePlatformSettings } from '@/hooks/usePlatformSettings';
 
 export function CategoryCommissions() {
   const queryClient = useQueryClient();
   const { categories } = useCategories();
   const { settings, getEffectiveCommission } = usePlatformSettings();
   const [showAddDialog, setShowAddDialog] = useState(false);
   const [newCategoryId, setNewCategoryId] = useState('');
   const [newPercent, setNewPercent] = useState(0);
 
   const { data: commissions, isLoading } = useQuery({
     queryKey: ['category-commissions'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('category_commissions')
         .select(`
           *,
           categories:category_id(name_uz, name_ru, slug)
         `)
         .order('commission_percent', { ascending: false });
 
       if (error) throw error;
       return data || [];
     },
   });
 
   const saveMutation = useMutation({
     mutationFn: async ({ id, percent, isActive }: { id: string; percent?: number; isActive?: boolean }) => {
       const updateData: any = {};
       if (percent !== undefined) updateData.commission_percent = percent;
       if (isActive !== undefined) updateData.is_active = isActive;
 
       const { error } = await supabase
         .from('category_commissions')
         .update(updateData)
         .eq('id', id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success('Saqlandi');
       queryClient.invalidateQueries({ queryKey: ['category-commissions'] });
     },
     onError: () => toast.error('Xatolik'),
   });
 
   const addMutation = useMutation({
     mutationFn: async () => {
       const { error } = await supabase
         .from('category_commissions')
         .insert({
           category_id: newCategoryId,
           commission_percent: newPercent,
           is_active: true,
         });
 
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success('Qo\'shildi');
       queryClient.invalidateQueries({ queryKey: ['category-commissions'] });
       setShowAddDialog(false);
       setNewCategoryId('');
       setNewPercent(0);
     },
     onError: (err: any) => toast.error('Xatolik: ' + err.message),
   });
 
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('category_commissions')
         .delete()
         .eq('id', id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success('O\'chirildi');
       queryClient.invalidateQueries({ queryKey: ['category-commissions'] });
     },
     onError: () => toast.error('Xatolik'),
   });
 
   const baseCommission = getEffectiveCommission();
   const existingCategoryIds = commissions?.map(c => c.category_id) || [];
   const availableCategories = categories.filter(c => !existingCategoryIds.includes(c.id));
 
   if (isLoading) {
     return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
   }
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Percent className="h-5 w-5" />
           Kategoriya bo'yicha komissiya
         </CardTitle>
         <CardDescription>
           Asosiy komissiya: <strong>{baseCommission}%</strong>. Quyidagi kategoriyalar uchun qo'shimcha foiz qo'shiladi.
         </CardDescription>
       </CardHeader>
       <CardContent>
         <div className="mb-4">
           <Button onClick={() => setShowAddDialog(true)} disabled={availableCategories.length === 0}>
             <Plus className="h-4 w-4 mr-2" />
             Kategoriya qo'shish
           </Button>
         </div>
 
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead>Kategoriya</TableHead>
               <TableHead>Qo'shimcha foiz</TableHead>
               <TableHead>Jami foiz</TableHead>
               <TableHead>Faol</TableHead>
               <TableHead>Amallar</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {commissions?.map((comm) => (
               <TableRow key={comm.id}>
                 <TableCell className="font-medium">
                   {(comm.categories as any)?.name_uz || 'Noma\'lum'}
                 </TableCell>
                 <TableCell>
                   <div className="flex items-center gap-2">
                     <Input
                       type="number"
                       min="0"
                       max="50"
                       step="0.5"
                       className="w-20"
                       defaultValue={comm.commission_percent}
                       onBlur={(e) => {
                         const value = parseFloat(e.target.value);
                         if (value !== comm.commission_percent) {
                           saveMutation.mutate({ id: comm.id, percent: value });
                         }
                       }}
                     />
                     <span>%</span>
                   </div>
                 </TableCell>
                 <TableCell>
                   <span className="font-bold text-primary">
                     {baseCommission + Number(comm.commission_percent)}%
                   </span>
                 </TableCell>
                 <TableCell>
                   <Switch
                     checked={comm.is_active}
                     onCheckedChange={(checked) => saveMutation.mutate({ id: comm.id, isActive: checked })}
                   />
                 </TableCell>
                 <TableCell>
                   <Button
                     size="sm"
                     variant="destructive"
                     onClick={() => deleteMutation.mutate(comm.id)}
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
 
         {commissions?.length === 0 && (
           <p className="text-center text-muted-foreground py-8">
             Barcha kategoriyalar uchun asosiy {baseCommission}% komissiya qo'llaniladi
           </p>
         )}
 
         {/* Add Dialog */}
         <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Kategoriya komissiyasi qo'shish</DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
               <div>
                 <Label>Kategoriya</Label>
                 <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Kategoriya tanlang" />
                   </SelectTrigger>
                   <SelectContent>
                     {availableCategories.map((cat) => (
                       <SelectItem key={cat.id} value={cat.id}>
                         {cat.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label>Qo'shimcha foiz (%)</Label>
                 <Input
                   type="number"
                   min="0"
                   max="50"
                   step="0.5"
                   value={newPercent}
                   onChange={(e) => setNewPercent(parseFloat(e.target.value) || 0)}
                 />
                 <p className="text-sm text-muted-foreground mt-1">
                   Jami: {baseCommission} + {newPercent} = <strong>{baseCommission + newPercent}%</strong>
                 </p>
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowAddDialog(false)}>Bekor</Button>
               <Button onClick={() => addMutation.mutate()} disabled={!newCategoryId}>
                 <Save className="h-4 w-4 mr-2" />
                 Saqlash
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </CardContent>
     </Card>
   );
 }