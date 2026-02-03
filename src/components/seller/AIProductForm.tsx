import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { Upload, Sparkles, Loader2, X, ImageIcon, Wand2, Check } from 'lucide-react';
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

type ProcessingStep = 'idle' | 'analyzing' | 'enhancing' | 'uploading' | 'done';

export function AIProductForm({ shopId, onSubmit, onCancel, isLoading }: AIProductFormProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [formData, setFormData] = useState<Partial<ProductInsert>>({
    name: '',
    description: '',
    price: 0,
    stock_quantity: 10,
    category_id: null,
    status: 'active', // Default to active so it shows in marketplace
  });

  const getProgress = () => {
    switch (processingStep) {
      case 'analyzing': return 33;
      case 'enhancing': return 66;
      case 'uploading': return 90;
      case 'done': return 100;
      default: return 0;
    }
  };

  const getStepText = () => {
    switch (processingStep) {
      case 'analyzing': return 'Mahsulot tahlil qilinmoqda...';
      case 'enhancing': return 'Infografik rasm yaratilmoqda...';
      case 'uploading': return 'Rasm yuklanmoqda...';
      case 'done': return 'Tayyor!';
      default: return '';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setEnhancedImage(null);
      };
      reader.readAsDataURL(file);
      setAiResult(null);
      setProcessingStep('idle');
    }
  };

  const clearImage = () => {
    setOriginalImage(null);
    setEnhancedImage(null);
    setImageFile(null);
    setAiResult(null);
    setProcessingStep('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processWithAI = async () => {
    if (!originalImage) {
      toast.error('Iltimos, avval rasm yuklang');
      return;
    }

    try {
      // Step 1: Analyze the image
      setProcessingStep('analyzing');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-product-image', {
        body: { imageBase64: originalImage },
      });

      if (analysisError) throw analysisError;

      setAiResult(analysisData);
      setFormData(prev => ({
        ...prev,
        name: analysisData.name,
        description: analysisData.description,
        price: analysisData.suggestedPrice,
      }));

      // Match category
      const matchedCategory = categories.find(
        cat => cat.name.toLowerCase().includes(analysisData.category.toLowerCase()) ||
               analysisData.category.toLowerCase().includes(cat.name.toLowerCase())
      );
      if (matchedCategory) {
        setFormData(prev => ({ ...prev, category_id: matchedCategory.id }));
      }

      // Step 2: Generate infographic-style marketplace image
      setProcessingStep('enhancing');
      
      // Map category name to infographic style
      const categoryMapping: Record<string, string> = {
        'elektronika': 'electronics',
        'electronics': 'electronics',
        'texnika': 'electronics',
        'telefonlar': 'electronics',
        'kosmetika': 'cosmetics',
        'cosmetics': 'cosmetics',
        'go\'zallik': 'cosmetics',
        'beauty': 'cosmetics',
        'parfyumeriya': 'cosmetics',
        'kiyim': 'clothing',
        'clothing': 'clothing',
        'fashion': 'clothing',
        'poyabzal': 'clothing',
        'oziq-ovqat': 'food',
        'food': 'food',
        'ichimliklar': 'food',
        'uy': 'home',
        'home': 'home',
        'mebel': 'home',
        'oshxona': 'home',
      };
      
      const categoryStyle = matchedCategory 
        ? categoryMapping[matchedCategory.name.toLowerCase()] || analysisData.category.toLowerCase()
        : analysisData.category.toLowerCase();
      
      const { data: enhanceData, error: enhanceError } = await supabase.functions.invoke('enhance-product-image', {
        body: { 
          imageBase64: originalImage,
          productName: analysisData.name,
          productDescription: analysisData.description,
          category: categoryStyle
        },
      });

      if (enhanceError) {
        console.error('Image enhancement failed:', enhanceError);
        toast.warning('Rasm yaxshilash ishlamadi, asl rasm ishlatiladi');
      } else if (enhanceData?.enhancedImageBase64) {
        setEnhancedImage(enhanceData.enhancedImageBase64);
      }

      setProcessingStep('done');
      toast.success('AI tahlil va infografik rasm tayyor!');
    } catch (error: any) {
      console.error('AI processing error:', error);
      toast.error('AI ishlov berishda xatolik yuz berdi');
      setProcessingStep('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setProcessingStep('uploading');
    let imageUrl: string | null = null;
    
    // Upload enhanced image or original
    const imageToUpload = enhancedImage || originalImage;
    
    if (imageToUpload) {
      try {
        // Convert base64 to blob
        const response = await fetch(imageToUpload);
        const blob = await response.blob();
        
        const fileName = `${shopId}/${Date.now()}-ai-product.${blob.type.includes('png') ? 'png' : 'jpg'}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, blob, {
            contentType: blob.type
          });

        if (uploadError) {
          toast.error('Rasm yuklashda xatolik');
          setProcessingStep('done');
          return;
        }

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      } catch (err) {
        console.error('Image upload error:', err);
        toast.error('Rasm yuklashda xatolik');
        setProcessingStep('done');
        return;
      }
    }

    await onSubmit({
      shop_id: shopId,
      name: formData.name || '',
      description: formData.description,
      price: formData.price || 0,
      stock_quantity: formData.stock_quantity || 0,
      category_id: formData.category_id,
      status: 'active', // Always active so it shows in marketplace
      source: 'ai',
      images: imageUrl ? [imageUrl] : [],
    });
    
    setProcessingStep('idle');
  };

  const isProcessing = processingStep !== 'idle' && processingStep !== 'done';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image Upload */}
      <div className="space-y-2">
        <Label>{t.uploadImage}</Label>
        <div className="relative">
          {originalImage ? (
            <div className="space-y-4">
              {/* Original vs Enhanced comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <p className="text-xs text-muted-foreground mb-2 text-center">Asl rasm</p>
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={originalImage}
                      alt="Original"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                </div>
                <div className="relative">
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    {enhancedImage ? 'AI infografik' : 'AI infografik yaratadi'}
                  </p>
                  <div className="rounded-lg overflow-hidden border">
                    {enhancedImage ? (
                      <img
                        src={enhancedImage}
                        alt="Enhanced"
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <Wand2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={clearImage}
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-2" />
                Rasmni o'chirish
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
                <p className="text-xs text-muted-foreground mt-1">AI rasm sifatini yaxshilaydi</p>
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

      {/* Progress indicator */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={getProgress()} className="h-2" />
          <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {getStepText()}
          </p>
        </div>
      )}

      {/* AI Process Button */}
      {originalImage && !aiResult && processingStep === 'idle' && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={processWithAI}
          disabled={isProcessing}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          AI bilan tahlil qilish va infografik yaratish
        </Button>
      )}

      {/* AI Result / Form */}
      {aiResult && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">{t.aiSuggestion}</span>
              {processingStep === 'done' && (
                <Check className="h-4 w-4 text-green-500 ml-auto" />
              )}
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={isLoading || !formData.name || isProcessing}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
