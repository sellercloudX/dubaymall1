import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { Upload, Sparkles, Loader2, X, ImageIcon } from 'lucide-react';
import type { TablesInsert } from '@/integrations/supabase/types';

type ProductInsert = TablesInsert<'products'>;

interface AIProductFormProps {
  shopId: string;
  onSubmit: (data: ProductInsert) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface AIResponse {
  name: string;
  description: string;
  category: string;
  suggestedPrice: number;
}

export function AIProductForm({ shopId, onSubmit, onCancel, isLoading }: AIProductFormProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [formData, setFormData] = useState<Partial<ProductInsert>>({
    name: '',
    description: '',
    price: 0,
    stock_quantity: 10,
    category_id: null,
    status: 'draft',
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAiResult(null);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setAiResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const analyzeImage = async () => {
    if (!imagePreview) {
      toast.error('Iltimos, avval rasm yuklang');
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-product-image', {
        body: { imageBase64: imagePreview },
      });

      if (error) throw error;

      setAiResult(data);
      setFormData(prev => ({
        ...prev,
        name: data.name,
        description: data.description,
        price: data.suggestedPrice,
      }));

      // Try to match category
      const matchedCategory = categories.find(
        cat => cat.name.toLowerCase().includes(data.category.toLowerCase()) ||
               data.category.toLowerCase().includes(cat.name.toLowerCase())
      );
      if (matchedCategory) {
        setFormData(prev => ({ ...prev, category_id: matchedCategory.id }));
      }

      toast.success(t.aiSuggestion + ' tayyor!');
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error('AI tahlil qilishda xatolik yuz berdi');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let imageUrl: string | null = null;
    
    // Upload image if exists
    if (imageFile) {
      const fileName = `${shopId}/${Date.now()}-${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile);

      if (uploadError) {
        toast.error('Rasm yuklashda xatolik');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      imageUrl = urlData.publicUrl;
    }

    await onSubmit({
      shop_id: shopId,
      name: formData.name || '',
      description: formData.description,
      price: formData.price || 0,
      stock_quantity: formData.stock_quantity || 0,
      category_id: formData.category_id,
      status: formData.status || 'draft',
      source: 'ai',
      images: imageUrl ? [imageUrl] : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image Upload */}
      <div className="space-y-2">
        <Label>{t.uploadImage}</Label>
        <div className="relative">
          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Card
              className="border-dashed cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-8">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">{t.uploadImage}</p>
              </CardContent>
            </Card>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Analyze Button */}
      {imagePreview && !aiResult && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={analyzeImage}
          disabled={analyzing}
        >
          {analyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {t.analyzeImage}
        </Button>
      )}

      {/* AI Result / Form */}
      {aiResult && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">{t.aiSuggestion}</span>
            </div>
            <div className="space-y-4">
              <div>
                <Label>{t.productName}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t.productDescription}</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.productPrice} (so'm)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>{t.productStock}</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t.productCategory}</Label>
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
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={isLoading || !formData.name}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}