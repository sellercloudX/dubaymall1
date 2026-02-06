import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductForm } from './ProductForm';
import { AIProductForm } from './AIProductForm';
import { Plus, FileEdit, Sparkles, Package } from 'lucide-react';
import type { TablesInsert } from '@/integrations/supabase/types';

type ProductInsert = TablesInsert<'products'>;

interface AddProductDialogProps {
  shopId: string;
  onSubmit: (data: ProductInsert) => Promise<void>;
}

export function AddProductDialog({ shopId, onSubmit }: AddProductDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');
  const isFileInputActive = useRef(false);
  const isProcessing = useRef(false);

  const handleSubmit = async (data: ProductInsert) => {
    setLoading(true);
    try {
      await onSubmit(data);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Prevent dialog from closing when camera/file picker or AI processing is active
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (isFileInputActive.current || isProcessing.current)) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t.addProduct}
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when interacting outside (mobile camera returns)
          if (activeTab === 'ai') {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (activeTab === 'ai') {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          // Prevent closing on focus loss (camera app steals focus)
          if (activeTab === 'ai') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.addProduct}</DialogTitle>
          <DialogDescription>
            Mahsulotni qo'shish usulini tanlang
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="text-xs sm:text-sm">
              <FileEdit className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.addManually}</span>
              <span className="sm:hidden">Qo'lda</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs sm:text-sm">
              <Sparkles className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.addWithAI}</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="dropshipping" className="text-xs sm:text-sm">
              <Package className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.addDropshipping}</span>
              <span className="sm:hidden">Import</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <ProductForm
              shopId={shopId}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
              isLoading={loading}
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <AIProductForm
              shopId={shopId}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
              isLoading={loading}
              onFileInputActive={(active) => { isFileInputActive.current = active; }}
              onProcessingChange={(processing) => { isProcessing.current = processing; }}
            />
          </TabsContent>

          <TabsContent value="dropshipping" className="mt-4">
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Dropshipping import tez orada qo'shiladi
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
