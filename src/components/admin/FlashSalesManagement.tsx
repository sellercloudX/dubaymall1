import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Zap, Package } from 'lucide-react';
import { format } from 'date-fns';

interface FlashSale {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export function FlashSalesManagement() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<FlashSale | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_percent: 20,
    start_date: '',
    end_date: '',
    is_active: true,
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('flash_sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSales(data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.start_date || !formData.end_date) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    try {
      if (editingSale) {
        const { error } = await supabase
          .from('flash_sales')
          .update({
            title: formData.title,
            description: formData.description || null,
            discount_percent: formData.discount_percent,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_active: formData.is_active,
          })
          .eq('id', editingSale.id);

        if (error) throw error;
        toast.success('Aksiya yangilandi');
      } else {
        const { error } = await supabase
          .from('flash_sales')
          .insert({
            title: formData.title,
            description: formData.description || null,
            discount_percent: formData.discount_percent,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success('Aksiya yaratildi');
      }

      setDialogOpen(false);
      setEditingSale(null);
      resetForm();
      fetchSales();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleEdit = (sale: FlashSale) => {
    setEditingSale(sale);
    setFormData({
      title: sale.title,
      description: sale.description || '',
      discount_percent: sale.discount_percent,
      start_date: sale.start_date.slice(0, 16),
      end_date: sale.end_date.slice(0, 16),
      is_active: sale.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Aksiyani o\'chirmoqchimisiz?')) return;

    try {
      const { error } = await supabase
        .from('flash_sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Aksiya o\'chirildi');
      fetchSales();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('flash_sales')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(isActive ? 'Aksiya faollashtirildi' : 'Aksiya to\'xtatildi');
      fetchSales();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discount_percent: 20,
      start_date: '',
      end_date: '',
      is_active: true,
    });
  };

  const getSaleStatus = (sale: FlashSale) => {
    const now = new Date();
    const start = new Date(sale.start_date);
    const end = new Date(sale.end_date);

    if (!sale.is_active) return { label: 'To\'xtatilgan', variant: 'secondary' as const };
    if (now < start) return { label: 'Kutilmoqda', variant: 'outline' as const };
    if (now > end) return { label: 'Tugagan', variant: 'destructive' as const };
    return { label: 'Faol', variant: 'default' as const };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5" />
          Flash Sale boshqaruvi
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingSale(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Yangi aksiya
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSale ? 'Aksiyani tahrirlash' : 'Yangi aksiya yaratish'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Sarlavha *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Mega chegirma!"
                />
              </div>
              <div>
                <Label>Tavsif</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Faqat bugun!"
                />
              </div>
              <div>
                <Label>Chegirma foizi (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Boshlanish sanasi *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tugash sanasi *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Faol</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button size="sm" onClick={handleSubmit}>
                  {editingSale ? 'Saqlash' : 'Yaratish'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aksiya</TableHead>
              <TableHead>Chegirma</TableHead>
              <TableHead>Muddat</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => {
              const status = getSaleStatus(sale);
              return (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium whitespace-nowrap">{sale.title}</div>
                      <div className="text-xs text-muted-foreground">{sale.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-xs">-{sale.discount_percent}%</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="whitespace-nowrap">{format(new Date(sale.start_date), 'dd.MM.yyyy HH:mm')}</div>
                      <div className="text-muted-foreground">
                        {format(new Date(sale.end_date), 'dd.MM.yyyy HH:mm')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(sale)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(sale.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sales.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Hali aksiyalar yo'q
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
