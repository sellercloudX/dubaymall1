import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { MxikLookup } from './MxikLookup';
import type { TablesInsert } from '@/integrations/supabase/types';

type ProductInsert = TablesInsert<'products'> & {
  mxik_code?: string;
  mxik_name?: string;
};

interface ProductFormProps {
  shopId: string;
  initialData?: Partial<ProductInsert>;
  onSubmit: (data: ProductInsert) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProductForm({ shopId, initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const [formData, setFormData] = useState<Partial<ProductInsert>>({
    name: '',
    description: '',
    price: 0,
    original_price: null,
    stock_quantity: 0,
    category_id: null,
    status: 'draft',
    is_affiliate_enabled: false,
    affiliate_commission_percent: 0,
    mxik_code: '',
    mxik_name: '',
    ...initialData,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      shop_id: shopId,
      name: formData.name || '',
      description: formData.description,
      price: formData.price || 0,
      original_price: formData.original_price,
      stock_quantity: formData.stock_quantity || 0,
      category_id: formData.category_id,
      status: formData.status || 'draft',
      is_affiliate_enabled: formData.is_affiliate_enabled,
      affiliate_commission_percent: formData.affiliate_commission_percent,
      source: initialData?.source || 'manual',
      images: formData.images || [],
      mxik_code: formData.mxik_code,
      mxik_name: formData.mxik_name,
    } as ProductInsert);
  };

  const handleMxikChange = (mxikCode: string, mxikName: string) => {
    setFormData(prev => ({ ...prev, mxik_code: mxikCode, mxik_name: mxikName }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="name">{t.productName} *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">{t.productDescription}</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price">{t.productPrice} (so'm) *</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="1000"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="original_price">{t.productOriginalPrice} (so'm)</Label>
          <Input
            id="original_price"
            type="number"
            min="0"
            step="1000"
            value={formData.original_price || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, original_price: e.target.value ? parseFloat(e.target.value) : null }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stock">{t.productStock}</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            value={formData.stock_quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category">{t.productCategory}</Label>
          <Select
            value={formData.category_id || ''}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value || null }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.productCategory} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">{t.productStatus}</Label>
          <Select
            value={formData.status}
            onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t.statusDraft}</SelectItem>
              <SelectItem value="active">{t.statusActive}</SelectItem>
              <SelectItem value="inactive">{t.statusInactive}</SelectItem>
              <SelectItem value="out_of_stock">{t.statusOutOfStock}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 pt-4 border-t">
          <MxikLookup
            productName={formData.name || ''}
            category={categories.find(c => c.id === formData.category_id)?.name}
            description={formData.description || ''}
            value={formData.mxik_code}
            onChange={handleMxikChange}
            disabled={isLoading}
          />
        </div>

        <div className="sm:col-span-2 space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="affiliate">{t.enableAffiliate}</Label>
              <p className="text-sm text-muted-foreground">
                Bloggerlarga reklama qilish imkonini bering
              </p>
            </div>
            <Switch
              id="affiliate"
              checked={formData.is_affiliate_enabled || false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_affiliate_enabled: checked }))}
            />
          </div>

          {formData.is_affiliate_enabled && (
            <div className="grid gap-2">
              <Label htmlFor="commission">{t.commissionPercent} (%)</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={formData.affiliate_commission_percent || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, affiliate_commission_percent: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}