import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Image, Eye, MousePointer } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  link_type: string;
  position: string;
  is_active: boolean;
  priority: number;
  views_count: number;
  clicks_count: number;
  created_at: string;
}

export function BannersManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    link_type: 'external',
    position: 'hero',
    priority: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('priority', { ascending: false });

    if (!error && data) {
      setBanners(data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.image_url) {
      toast.error('Sarlavha va rasm URL kiritish shart');
      return;
    }

    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('banners')
          .update({
            title: formData.title,
            description: formData.description || null,
            image_url: formData.image_url,
            link_url: formData.link_url || null,
            link_type: formData.link_type,
            position: formData.position,
            priority: formData.priority,
            is_active: formData.is_active,
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
        toast.success('Banner yangilandi');
      } else {
        const { error } = await supabase
          .from('banners')
          .insert({
            title: formData.title,
            description: formData.description || null,
            image_url: formData.image_url,
            link_url: formData.link_url || null,
            link_type: formData.link_type,
            position: formData.position,
            priority: formData.priority,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success('Banner qo\'shildi');
      }

      setDialogOpen(false);
      setEditingBanner(null);
      resetForm();
      fetchBanners();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      link_type: banner.link_type,
      position: banner.position,
      priority: banner.priority,
      is_active: banner.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bannerni o\'chirmoqchimisiz?')) return;

    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Banner o\'chirildi');
      fetchBanners();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(isActive ? 'Banner faollashtirildi' : 'Banner o\'chirildi');
      fetchBanners();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      link_type: 'external',
      position: 'hero',
      priority: 0,
      is_active: true,
    });
  };

  const positionLabels: Record<string, string> = {
    hero: 'Asosiy banner',
    middle: 'O\'rta qism',
    sidebar: 'Yon panel',
    popup: 'Popup',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Bannerlar boshqaruvi
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingBanner(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yangi banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? 'Bannerni tahrirlash' : 'Yangi banner qo\'shish'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Sarlavha *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Yozgi chegirma!"
                />
              </div>
              <div>
                <Label>Tavsif</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="50% gacha chegirma"
                />
              </div>
              <div>
                <Label>Rasm URL *</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
              <div>
                <Label>Havola URL</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="https://example.com yoki /marketplace"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Joylashuv</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(v) => setFormData({ ...formData, position: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hero">Asosiy banner</SelectItem>
                      <SelectItem value="middle">O'rta qism</SelectItem>
                      <SelectItem value="sidebar">Yon panel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ustunlik (0-100)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
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
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={handleSubmit}>
                  {editingBanner ? 'Saqlash' : 'Qo\'shish'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Joylashuv</TableHead>
              <TableHead>Statistika</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((banner) => (
              <TableRow key={banner.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-16 h-10 object-cover rounded"
                    />
                    <div>
                      <div className="font-medium">{banner.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {banner.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{positionLabels[banner.position]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {banner.views_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointer className="h-3 w-3" />
                      {banner.clicks_count}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={banner.is_active}
                    onCheckedChange={(v) => toggleActive(banner.id, v)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(banner)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(banner.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {banners.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Hali bannerlar yo'q
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
