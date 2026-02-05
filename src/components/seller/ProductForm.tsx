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
  shipping_price?: number;
  free_shipping?: boolean;
  weight_kg?: number;
  preparation_days?: number;
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
    shipping_price: 0,
    free_shipping: false,
    weight_kg: 0,
    preparation_days: 1,
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
      shipping_price: formData.shipping_price || 0,
      free_shipping: formData.free_shipping || false,
      weight_kg: formData.weight_kg || 0,
      preparation_days: formData.preparation_days || 1,
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
          <h3 className="font-semibold">Yetkazib berish sozlamalari</h3>
          
          <div className="grid gap-2">
            <Label htmlFor="preparation_days">Tayyorlash vaqti (kun)</Label>
            <Select
              value={String(formData.preparation_days || 1)}
              onValueChange={(value) => setFormData(prev => ({ ...prev, preparation_days: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Shu kuni (zakaz tushgan kuni)</SelectItem>
                <SelectItem value="1">1 kun</SelectItem>
                <SelectItem value="2">2 kun</SelectItem>
                <SelectItem value="3">3 kun</SelectItem>
                <SelectItem value="5">5 kun</SelectItem>
                <SelectItem value="7">7 kun</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Zakaz tushgandan keyin qancha kunda pochtaga topshirasiz
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="free_shipping">Bepul yetkazib berish</Label>
              <p className="text-sm text-muted-foreground">
                Mahsulot bepul yetkazib beriladi
              </p>
            </div>
            <Switch
              id="free_shipping"
              checked={formData.free_shipping || false}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                free_shipping: checked,
                shipping_price: checked ? 0 : prev.shipping_price 
              }))}
            />
          </div>
 
          {!formData.free_shipping && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="shipping_price">Yetkazib berish narxi (so'm)</Label>
                <Input
                  id="shipping_price"
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.shipping_price || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipping_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="Sotuvchi qo'shimcha narxi"
                />
                <p className="text-xs text-muted-foreground">
                  Viloyat narxiga qo'shimcha sifatida qo'shiladi
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weight_kg">Mahsulot og'irligi (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.weight_kg || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.5"
                />
              </div>
            </div>
          )}
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