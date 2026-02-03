import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShop } from '@/hooks/useShop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

interface CreateShopDialogProps {
  onSuccess?: () => void;
}

export function CreateShopDialog({ onSuccess }: CreateShopDialogProps) {
  const { t } = useLanguage();
  const { createShop } = useShop();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t.shopNameRequired);
      return;
    }

    setLoading(true);
    try {
      await createShop({
        name: formData.name,
        description: formData.description || null,
        slug: formData.slug || generateSlug(formData.name),
      });
      toast.success(t.shopCreated);
      setOpen(false);
      setFormData({ name: '', description: '', slug: '' });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {t.createShop}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t.createShop}</DialogTitle>
          <DialogDescription>{t.createShopDesc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t.shopName} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleNameChange}
                placeholder="Mening do'konim"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">{t.shopSlug}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/shop/</span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                  placeholder="mening-dokonim"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t.shopDescription}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Do'kon haqida qisqacha..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.createShop}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}