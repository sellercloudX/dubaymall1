import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FileText, Image as ImageIcon, Tag, List, Send, Plus, X,
  ChevronRight, ChevronLeft, CheckCircle2, Upload, Sparkles,
  Package, AlertTriangle, Loader2, Copy, ExternalLink, ImagePlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { resizeImageForUzum, resizeImageForUzumContain, checkImageDimensions, resizeAndUploadForUzum } from '@/lib/uzumImageResize';

interface ProductAttribute {
  name: string;
  value: string;
}

interface CardFormData {
  title: string;
  titleRu: string;
  description: string;
  descriptionRu: string;
  category: string;
  categoryId: string;
  sku: string;
  barcode: string;
  brandName: string;
  price: number;
  costPrice: number;
  mxikCode: string;
  images: string[];
  attributes: ProductAttribute[];
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

const STEPS = [
  { id: 'basic', label: 'Asosiy', icon: FileText },
  { id: 'details', label: 'Xususiyatlar', icon: Tag },
  { id: 'images', label: 'Rasmlar', icon: ImageIcon },
  { id: 'review', label: 'Tekshirish', icon: CheckCircle2 },
];

const defaultForm: CardFormData = {
  title: '',
  titleRu: '',
  description: '',
  descriptionRu: '',
  category: '',
  categoryId: '',
  sku: '',
  barcode: '',
  brandName: '',
  price: 0,
  costPrice: 0,
  mxikCode: '',
  images: [],
  attributes: [{ name: '', value: '' }],
  weightKg: 0,
  lengthCm: 0,
  widthCm: 0,
  heightCm: 0,
};

export default function UzumProductCardCreator() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CardFormData>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extensionPushed, setExtensionPushed] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [resizeMode, setResizeMode] = useState<'cover' | 'contain'>('cover');
  const update = useCallback(<K extends keyof CardFormData>(key: K, val: CardFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const addAttribute = () => {
    update('attributes', [...form.attributes, { name: '', value: '' }]);
  };

  const removeAttribute = (idx: number) => {
    update('attributes', form.attributes.filter((_, i) => i !== idx));
  };

  const updateAttribute = (idx: number, field: 'name' | 'value', val: string) => {
    const attrs = [...form.attributes];
    attrs[idx] = { ...attrs[idx], [field]: val };
    update('attributes', attrs);
  };

  const addImage = () => {
    if (imageUrl && imageUrl.startsWith('http')) {
      update('images', [...form.images, imageUrl]);
      setImageUrl('');
    }
  };

  const removeImage = (idx: number) => {
    update('images', form.images.filter((_, i) => i !== idx));
  };

  // AI-generate title & description using dedicated prepare-uzum-card function
  const generateWithAI = async () => {
    if (!form.title) {
      toast({ title: 'Xato', description: 'Avval mahsulot nomini kiriting', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('prepare-uzum-card', {
        body: {
          productName: form.title,
          description: form.description || undefined,
          category: form.category || undefined,
          brand: form.brandName || undefined,
          price: form.price > 0 ? form.price : undefined,
          specifications: form.attributes.filter(a => a.name && a.value).length > 0
            ? Object.fromEntries(form.attributes.filter(a => a.name && a.value).map(a => [a.name, a.value]))
            : undefined,
        },
      });
      if (error) throw error;

      const card = data?.card;
      if (card) {
        if (card.name_uz) update('title', card.name_uz);
        if (card.name_ru) update('titleRu', card.name_ru);
        if (card.short_description_uz && card.full_description_uz) {
          update('description', card.full_description_uz);
        } else if (card.short_description_uz) {
          update('description', card.short_description_uz);
        }
        if (card.short_description_ru && card.full_description_ru) {
          update('descriptionRu', card.full_description_ru);
        } else if (card.short_description_ru) {
          update('descriptionRu', card.short_description_ru);
        }
        if (card.brand) update('brandName', card.brand);
        if (card.properties?.length) {
          update('attributes', card.properties.map((p: any) => ({
            name: p.name_uz || p.name,
            value: p.value_uz || p.value,
          })));
        }
      }
      toast({ title: 'AI kontent yaratildi ✨', description: 'Nom, tavsif va xususiyatlar Uzum standartiga mos generatsiya qilindi' });
    } catch (err: any) {
      toast({ title: 'AI xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save to database
  const saveProduct = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Get or create uzum account
      let { data: account } = await supabase
        .from('uzum_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!account) {
        const { data: newAcc, error: accErr } = await supabase
          .from('uzum_accounts')
          .insert({ user_id: user.id, shop_name: 'Default' } as any)
          .select('id')
          .single();
        if (accErr) throw accErr;
        account = newAcc;
      }

      const { error } = await supabase.from('uzum_products').insert({
        user_id: user.id,
        uzum_account_id: account!.id,
        title: form.title,
        title_ru: form.titleRu,
        description: form.description,
        description_ru: form.descriptionRu,
        sku: form.sku || `SCX-${Date.now().toString(36).toUpperCase()}`,
        barcode: form.barcode,
        brand_name: form.brandName,
        category_name: form.category,
        category_id: form.categoryId,
        price: form.price,
        cost_price: form.costPrice,
        mxik_code: form.mxikCode,
        images: form.images,
        characteristics: form.attributes.filter(a => a.name && a.value),
        weight_kg: form.weightKg || null,
        dimensions: form.lengthCm ? { length: form.lengthCm, width: form.widthCm, height: form.heightCm } : null,
        status: 'inactive',
      } as any);

      if (error) throw error;
      toast({ title: 'Saqlandi', description: 'Mahsulot kartochkasi bazaga saqlandi' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Push to Chrome Extension via realtime command
  const pushToExtension = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Get uzum account
      let { data: account } = await supabase
        .from('uzum_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!account) {
        toast({ title: 'Xato', description: 'Avval Uzum akkauntni ulang', variant: 'destructive' });
        return;
      }

      const payload = {
        title: form.title,
        titleRu: form.titleRu,
        description: form.description,
        descriptionRu: form.descriptionRu,
        category: form.category,
        categoryId: form.categoryId,
        sku: form.sku,
        barcode: form.barcode,
        brandName: form.brandName,
        price: form.price,
        images: form.images,
        attributes: form.attributes.filter(a => a.name && a.value),
        mxikCode: form.mxikCode,
        weight: form.weightKg,
        dimensions: { length: form.lengthCm, width: form.widthCm, height: form.heightCm },
      };

      const { error } = await supabase.from('uzum_extension_commands').insert({
        user_id: user.id,
        uzum_account_id: account.id,
        command_type: 'create_product',
        payload,
        status: 'pending',
      } as any);

      if (error) throw error;
      setExtensionPushed(true);
      toast({ title: 'Extension\'ga yuborildi', description: 'Chrome Extension buyruqni qabul qilishi kutilmoqda...' });

      // Also save to products table
      await saveProduct();
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyJson = () => {
    const json = JSON.stringify({
      title: form.title,
      titleRu: form.titleRu,
      description: form.description,
      descriptionRu: form.descriptionRu,
      category: form.category,
      sku: form.sku,
      barcode: form.barcode,
      brandName: form.brandName,
      price: form.price,
      images: form.images,
      attributes: form.attributes.filter(a => a.name && a.value),
      mxikCode: form.mxikCode,
    }, null, 2);
    navigator.clipboard.writeText(json);
    toast({ title: 'Nusxalandi', description: 'JSON clipboard\'ga nusxalandi' });
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const canNext = step === 0 ? form.title.length > 0 && form.price > 0 : true;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Mahsulot kartochkasi yaratish
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {step + 1}/{STEPS.length} qadam
          </Badge>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                i === step ? 'text-primary font-medium' : i < step ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Asosiy ma'lumotlar
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={generateWithAI}
                disabled={isGenerating || !form.title}
                className="h-7 text-[10px]"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                AI bilan to'ldirish
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Mahsulot nomi (UZ) *</Label>
              <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Masalan: Smartfon uchun himoya g'ilofi" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Mahsulot nomi (RU)</Label>
              <Input value={form.titleRu} onChange={e => update('titleRu', e.target.value)} placeholder="Защитный чехол для смартфона" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tavsif (UZ)</Label>
              <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Batafsil tavsif..." className="text-xs min-h-[80px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tavsif (RU)</Label>
              <Textarea value={form.descriptionRu} onChange={e => update('descriptionRu', e.target.value)} placeholder="Подробное описание..." className="text-xs min-h-[80px]" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Kategoriya</Label>
                <Input value={form.category} onChange={e => update('category', e.target.value)} placeholder="Aksessuarlar" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Brend</Label>
                <Input value={form.brandName} onChange={e => update('brandName', e.target.value)} placeholder="Brend nomi" className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sotish narxi (so'm) *</Label>
                <Input type="number" value={form.price} onChange={e => update('price', Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Tannarx (so'm)</Label>
                <Input type="number" value={form.costPrice} onChange={e => update('costPrice', Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">SKU</Label>
                <Input value={form.sku} onChange={e => update('sku', e.target.value)} placeholder="Avtomatik" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Shtrix-kod</Label>
                <Input value={form.barcode} onChange={e => update('barcode', e.target.value)} placeholder="EAN-13" className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">MXIK kodi</Label>
              <Input value={form.mxikCode} onChange={e => update('mxikCode', e.target.value)} placeholder="MXIK / IKPU" className="h-8 text-xs" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Attributes & Dimensions */}
      {step === 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent" />
                Xususiyatlar va o'lchamlar
              </span>
              <Button variant="outline" size="sm" onClick={addAttribute} className="h-7 text-[10px]">
                <Plus className="w-3 h-3 mr-1" /> Qo'shish
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.attributes.map((attr, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={attr.name}
                  onChange={e => updateAttribute(i, 'name', e.target.value)}
                  placeholder="Xususiyat nomi"
                  className="h-8 text-xs flex-1"
                />
                <Input
                  value={attr.value}
                  onChange={e => updateAttribute(i, 'value', e.target.value)}
                  placeholder="Qiymati"
                  className="h-8 text-xs flex-1"
                />
                <Button variant="ghost" size="sm" onClick={() => removeAttribute(i)} className="h-8 w-8 p-0 text-destructive">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Separator />
            <div className="text-xs font-medium text-foreground">O'lchamlar va og'irlik</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Og'irlik (kg)</Label>
                <Input type="number" value={form.weightKg} onChange={e => update('weightKg', Number(e.target.value))} className="h-8 text-xs" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Uzunlik (sm)</Label>
                <Input type="number" value={form.lengthCm} onChange={e => update('lengthCm', Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Kenglik (sm)</Label>
                <Input type="number" value={form.widthCm} onChange={e => update('widthCm', Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Balandlik (sm)</Label>
                <Input type="number" value={form.heightCm} onChange={e => update('heightCm', Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Images */}
      {step === 2 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-success" />
              Mahsulot rasmlari
              <Badge variant="secondary" className="text-[10px]">{form.images.length}/10</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Rasm URL manzili (https://...)"
                className="h-8 text-xs flex-1"
              />
              <Button variant="outline" size="sm" onClick={addImage} disabled={!imageUrl || form.images.length >= 10} className="h-8">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {form.images.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-xs text-muted-foreground">Rasm URL manzilini kiriting</p>
                <p className="text-[10px] text-muted-foreground mt-1">Kamida 1, ko'pi bilan 10 ta rasm</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {form.images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} alt={`Product ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {i === 0 && (
                      <Badge className="absolute bottom-1 left-1 text-[8px] h-3.5 px-1">Asosiy</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 3 && (
        <div className="space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Kartochka ko'rib chiqish
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-muted-foreground">Nom (UZ):</span>
                  <div className="font-medium text-foreground">{form.title || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Nom (RU):</span>
                  <div className="font-medium text-foreground">{form.titleRu || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Narx:</span>
                  <div className="font-medium text-foreground">{form.price.toLocaleString()} so'm</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tannarx:</span>
                  <div className="font-medium text-foreground">{form.costPrice.toLocaleString()} so'm</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Kategoriya:</span>
                  <div className="font-medium text-foreground">{form.category || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Brend:</span>
                  <div className="font-medium text-foreground">{form.brandName || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU:</span>
                  <div className="font-medium text-foreground">{form.sku || 'Avtomatik'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">MXIK:</span>
                  <div className="font-medium text-foreground">{form.mxikCode || '—'}</div>
                </div>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">Xususiyatlar: </span>
                <span className="font-medium">{form.attributes.filter(a => a.name).length} ta</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rasmlar: </span>
                <span className="font-medium">{form.images.length} ta</span>
              </div>
              {form.images.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {form.images.slice(0, 5).map((img, i) => (
                    <img key={i} src={img} className="w-12 h-12 object-cover rounded border border-border flex-shrink-0" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation warnings */}
          {(!form.title || form.price <= 0) && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-[11px] text-warning">
                  {!form.title && <div>• Mahsulot nomi kiritilmagan</div>}
                  {form.price <= 0 && <div>• Sotish narxi kiritilmagan</div>}
                  {form.images.length === 0 && <div>• Kamida 1 ta rasm qo'shing</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={pushToExtension}
              disabled={isSaving || !form.title || form.price <= 0}
              className="w-full h-10 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : extensionPushed ? (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              {extensionPushed ? 'Extension\'ga yuborildi!' : 'Extension\'ga yuborish (Push)'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={saveProduct} disabled={isSaving} className="h-8 text-xs">
                <Package className="w-3 h-3 mr-1" />
                Bazaga saqlash
              </Button>
              <Button variant="outline" onClick={copyJson} className="h-8 text-xs">
                <Copy className="w-3 h-3 mr-1" />
                JSON nusxalash
              </Button>
            </div>
          </div>

          {extensionPushed && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-3 text-[11px] text-success flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Buyruq yuborildi!</strong> Chrome Extension realtime orqali buyruqni qabul qiladi va Uzum Seller formalariga avtomatik to'ldiradi.
                  Extension o'rnatilmagan bo'lsa, JSON'ni nusxalab qo'lda kiritishingiz mumkin.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="h-8 text-xs"
        >
          <ChevronLeft className="w-3 h-3 mr-1" />
          Orqaga
        </Button>
        {step < STEPS.length - 1 && (
          <Button
            size="sm"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="h-8 text-xs"
          >
            Keyingi
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
