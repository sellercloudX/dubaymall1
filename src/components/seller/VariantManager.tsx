import { useState, useRef } from 'react';
import { useProductVariants, type ProductVariant } from '@/hooks/useProductVariants';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Palette, Ruler, Package, Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VariantManagerProps {
  productId: string;
}

const VARIANT_TYPES = [
  { value: 'color', label: 'Rang', icon: Palette },
  { value: 'size', label: 'O\'lcham', icon: Ruler },
  { value: 'model', label: 'Model', icon: Package },
];

const PRESET_COLORS = [
  { name: 'Qora', hex: '#000000' },
  { name: 'Oq', hex: '#FFFFFF' },
  { name: 'Qizil', hex: '#EF4444' },
  { name: 'Ko\'k', hex: '#3B82F6' },
  { name: 'Yashil', hex: '#22C55E' },
  { name: 'Sariq', hex: '#EAB308' },
  { name: 'Pushti', hex: '#EC4899' },
  { name: 'Binafsha', hex: '#8B5CF6' },
  { name: 'Kulrang', hex: '#6B7280' },
  { name: 'Jigarrang', hex: '#92400E' },
];

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

export function VariantManager({ productId }: VariantManagerProps) {
  const { variants, variantsByType, createVariant, deleteVariant, updateVariant, isLoading } = useProductVariants(productId);
  const [newVariant, setNewVariant] = useState({
    variant_type: 'color' as 'color' | 'size' | 'model',
    variant_value: '',
    variant_label: '',
    hex_color: '',
    image_url: '',
    stock_quantity: 10,
    price_adjustment: 0,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingImageUpload, setEditingImageUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Upload image to Supabase Storage
  const uploadImage = async (file: File, variantId?: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${variantId || 'new'}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Rasm yuklashda xatolik: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari qabul qilinadi');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Rasm hajmi 5MB dan oshmasligi kerak');
      return;
    }

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      setNewVariant({ ...newVariant, image_url: imageUrl });
      toast.success('Rasm yuklandi');
    }
  };

  const handleEditFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, variantId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari qabul qilinadi');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Rasm hajmi 5MB dan oshmasligi kerak');
      return;
    }

    setEditingImageUpload(true);
    const imageUrl = await uploadImage(file, variantId);
    if (imageUrl) {
      try {
        await updateVariant({ id: variantId, updates: { image_url: imageUrl } });
        toast.success('Variant rasmi yangilandi');
      } catch (error) {
        toast.error('Xatolik yuz berdi');
      }
    }
    setEditingImageUpload(false);
    setEditingVariantId(null);
  };

  const handleAddVariant = async () => {
    if (!newVariant.variant_value) {
      toast.error('Variant qiymatini kiriting');
      return;
    }

    // For color variants, require an image
    if (newVariant.variant_type === 'color' && !newVariant.image_url) {
      toast.error('Rang varianti uchun rasm yuklang');
      return;
    }

    try {
      await createVariant({
        product_id: productId,
        variant_type: newVariant.variant_type,
        variant_value: newVariant.variant_value,
        variant_label: newVariant.variant_label || newVariant.variant_value,
        hex_color: newVariant.variant_type === 'color' ? newVariant.hex_color : null,
        image_url: newVariant.variant_type === 'color' ? newVariant.image_url : null,
        stock_quantity: newVariant.stock_quantity,
        price_adjustment: newVariant.price_adjustment,
        sort_order: variants.length,
        is_active: true,
      });
      
      toast.success('Variant qo\'shildi');
      setNewVariant({
        variant_type: newVariant.variant_type,
        variant_value: '',
        variant_label: '',
        hex_color: '',
        image_url: '',
        stock_quantity: 10,
        price_adjustment: 0,
      });
      setIsAdding(false);
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleDeleteVariant = async (id: string) => {
    try {
      await deleteVariant(id);
      toast.success('Variant o\'chirildi');
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handlePresetColor = (color: typeof PRESET_COLORS[0]) => {
    setNewVariant({
      ...newVariant,
      variant_value: color.name,
      variant_label: color.name,
      hex_color: color.hex,
    });
  };

  const handlePresetSize = (size: string) => {
    setNewVariant({
      ...newVariant,
      variant_value: size,
      variant_label: size,
    });
  };

  const removeImage = () => {
    setNewVariant({ ...newVariant, image_url: '' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Mahsulot variantlari</span>
          <Badge variant="secondary">{variants.length} ta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Variants */}
        {Object.entries(variantsByType).map(([type, typeVariants]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              {type === 'color' && <Palette className="h-4 w-4 text-muted-foreground" />}
              {type === 'size' && <Ruler className="h-4 w-4 text-muted-foreground" />}
              {type === 'model' && <Package className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-medium capitalize">
                {type === 'color' ? 'Ranglar' : type === 'size' ? 'O\'lchamlar' : 'Modellar'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {typeVariants.map((variant) => (
                <div 
                  key={variant.id}
                  className="flex items-center gap-2 bg-muted rounded-lg p-2"
                >
                  {/* Variant Image or Color */}
                  {type === 'color' && (
                    <div className="relative group">
                      {variant.image_url ? (
                        <img 
                          src={variant.image_url} 
                          alt={variant.variant_label || variant.variant_value}
                          className="w-12 h-12 rounded-lg object-cover border"
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-lg border flex items-center justify-center"
                          style={{ backgroundColor: variant.hex_color || '#ccc' }}
                        >
                          <ImageIcon className="h-4 w-4 text-white/70" />
                        </div>
                      )}
                      {/* Upload overlay */}
                      <button
                        onClick={() => {
                          setEditingVariantId(variant.id);
                          editFileInputRef.current?.click();
                        }}
                        className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {editingImageUpload && editingVariantId === variant.id ? (
                          <Loader2 className="h-4 w-4 text-white animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 text-white" />
                        )}
                      </button>
                    </div>
                  )}
                  
                  {type !== 'color' && variant.hex_color && (
                    <span 
                      className="w-6 h-6 rounded-full border shrink-0"
                      style={{ backgroundColor: variant.hex_color }}
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {variant.variant_label || variant.variant_value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ombor: {variant.stock_quantity}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteVariant(variant.id)}
                    className="text-destructive hover:text-destructive/80 p-1 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Hidden file input for editing existing variants */}
        <input
          ref={editFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => editingVariantId && handleEditFileSelect(e, editingVariantId)}
        />

        {/* Add New Variant */}
        {!isAdding ? (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Variant qo'shish
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="grid gap-4">
              {/* Variant Type */}
              <div className="space-y-2">
                <Label>Variant turi</Label>
                <Select 
                  value={newVariant.variant_type}
                  onValueChange={(v) => setNewVariant({ 
                    ...newVariant, 
                    variant_type: v as any, 
                    variant_value: '', 
                    variant_label: '', 
                    hex_color: '',
                    image_url: '' 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Color Presets */}
              {newVariant.variant_type === 'color' && (
                <div className="space-y-2">
                  <Label>Tez tanlash</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color.hex}
                        onClick={() => handlePresetColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          newVariant.hex_color === color.hex ? 'ring-2 ring-primary ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Size Presets */}
              {newVariant.variant_type === 'size' && (
                <div className="space-y-2">
                  <Label>Tez tanlash</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() => handlePresetSize(size)}
                        className={`px-3 py-1.5 rounded-lg border hover:bg-muted text-sm ${
                          newVariant.variant_value === size ? 'bg-primary text-primary-foreground' : ''
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Upload for Color Variants */}
              {newVariant.variant_type === 'color' && (
                <div className="space-y-2">
                  <Label>Rang rasmi (majburiy)</Label>
                  <div className="flex items-start gap-3">
                    {newVariant.image_url ? (
                      <div className="relative">
                        <img 
                          src={newVariant.image_url} 
                          alt="Variant rasmi"
                          className="w-20 h-20 rounded-lg object-cover border"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Yuklash</span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="flex-1 text-sm text-muted-foreground">
                      <p>Ushbu rang uchun mahsulot rasmini yuklang.</p>
                      <p className="text-xs mt-1">Maksimal hajm: 5MB</p>
                      <p className="text-xs">Format: JPG, PNG, WebP</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Variant Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Qiymat</Label>
                  <Input 
                    value={newVariant.variant_value}
                    onChange={(e) => setNewVariant({ ...newVariant, variant_value: e.target.value })}
                    placeholder={newVariant.variant_type === 'color' ? 'Qizil' : newVariant.variant_type === 'size' ? 'M' : 'Pro'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ko'rsatiladigan nom</Label>
                  <Input 
                    value={newVariant.variant_label}
                    onChange={(e) => setNewVariant({ ...newVariant, variant_label: e.target.value })}
                    placeholder="Qizil rang"
                  />
                </div>
              </div>

              {/* Color-specific fields */}
              {newVariant.variant_type === 'color' && (
                <div className="space-y-2">
                  <Label>Rang kodi (HEX)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={newVariant.hex_color}
                      onChange={(e) => setNewVariant({ ...newVariant, hex_color: e.target.value })}
                      placeholder="#FF0000"
                    />
                    {newVariant.hex_color && (
                      <div 
                        className="w-10 h-10 rounded-lg border shrink-0"
                        style={{ backgroundColor: newVariant.hex_color }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Stock & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ombordagi soni</Label>
                  <Input 
                    type="number"
                    value={newVariant.stock_quantity}
                    onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Narx farqi (so'm)</Label>
                  <Input 
                    type="number"
                    value={newVariant.price_adjustment}
                    onChange={(e) => setNewVariant({ ...newVariant, price_adjustment: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleAddVariant} className="flex-1" disabled={uploading}>
                <Plus className="h-4 w-4 mr-2" />
                Qo'shish
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Bekor qilish
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
