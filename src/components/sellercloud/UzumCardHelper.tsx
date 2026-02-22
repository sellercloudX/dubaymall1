import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Search, Sparkles, Download, Package, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ExcelJS from 'exceljs';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface UzumCardHelperProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface SourceProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  marketplace: string;
  images?: string[];
}

interface GeneratedRow {
  name_ru: string;
  name_uz: string;
  short_description_ru: string;
  short_description_uz: string;
  full_description_ru: string;
  full_description_uz: string;
  brand?: string;
  properties?: Array<{ name_uz: string; name_ru: string; value_uz: string; value_ru: string }>;
}

// Common fields for all products in batch
interface CommonFields {
  categoryName: string;
  categoryId: string;
  brand: string;
  country: string;
  ikpu: string;
  weight: string;
  height: string;
  width: string;
  length: string;
}

const EMPTY_COMMON: CommonFields = {
  categoryName: '',
  categoryId: '',
  brand: '',
  country: "O'zbekiston",
  ikpu: '',
  weight: '',
  height: '',
  width: '',
  length: '',
};

export function UzumCardHelper({ connectedMarketplaces, store }: UzumCardHelperProps) {
  const [step, setStep] = useState<'select' | 'details' | 'generating' | 'done'>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [common, setCommon] = useState<CommonFields>(EMPTY_COMMON);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [generatedRows, setGeneratedRows] = useState<Array<{ product: SourceProduct; data: GeneratedRow; mxik?: string }>>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Products from all connected marketplaces except uzum
  const sourceProducts = useMemo(() => {
    const products: SourceProduct[] = [];
    for (const mp of connectedMarketplaces) {
      if (mp === 'uzum') continue;
      const mpProducts = store.getProducts(mp);
      for (const p of mpProducts) {
        products.push({
          id: `${mp}-${p.offerId}`,
          name: p.name || 'Nomsiz',
          price: p.price || 0,
          description: p.description || '',
          category: p.category || '',
          marketplace: mp,
          images: p.pictures || [],
        });
      }
    }
    return products;
  }, [connectedMarketplaces, store.dataVersion]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return sourceProducts;
    const q = searchQuery.toLowerCase();
    return sourceProducts.filter(p => p.name.toLowerCase().includes(q));
  }, [sourceProducts, searchQuery]);

  const toggleProduct = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  }, [filteredProducts, selectedIds.size]);

  const selectedProducts = useMemo(() => 
    sourceProducts.filter(p => selectedIds.has(p.id)), 
    [sourceProducts, selectedIds]
  );

  // Generate AI content + auto MXIK for each product then build Excel
  const handleGenerate = async () => {
    setStep('generating');
    setProgress(0);
    setErrors([]);
    const rows: Array<{ product: SourceProduct; data: GeneratedRow; mxik?: string }> = [];
    const errs: string[] = [];
    const total = selectedProducts.length;

    for (let i = 0; i < total; i++) {
      const product = selectedProducts[i];
      setProgressText(`${i + 1}/${total}: ${product.name.slice(0, 40)}...`);
      setProgress(Math.round(((i) / total) * 100));

      try {
        // Parallel: AI card + MXIK lookup
        const [cardResult, mxikResult] = await Promise.all([
          supabase.functions.invoke('prepare-uzum-card', {
            body: {
              productName: product.name,
              description: product.description,
              category: product.category || common.categoryName,
              brand: common.brand,
              price: product.price,
            },
          }),
          // Auto MXIK lookup per product (skip if common IKPU is set)
          common.ikpu ? Promise.resolve({ data: null, error: null }) :
          supabase.functions.invoke('lookup-mxik-code', {
            body: {
              productName: product.name,
              category: product.category || common.categoryName,
              description: product.description?.slice(0, 200),
            },
          }),
        ]);

        if (cardResult.error) throw cardResult.error;
        if (cardResult.data?.error) throw new Error(cardResult.data.error);
        
        const mxikCode = common.ikpu || mxikResult.data?.mxik_code || '';
        
        if (cardResult.data?.card) {
          rows.push({ product, data: cardResult.data.card, mxik: mxikCode });
        }
      } catch (err: any) {
        console.error(`Error for ${product.name}:`, err);
        errs.push(`${product.name}: ${err?.message || 'Xatolik'}`);
      }

      // Small delay to avoid rate limiting
      if (i < total - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setProgress(100);
    setGeneratedRows(rows);
    setErrors(errs);
    setStep('done');

    if (rows.length > 0) {
      toast.success(`${rows.length} ta mahsulot tayyor!`);
    }
  };

  // Build XLSX matching Uzum template
  const handleDownloadExcel = async () => {
    if (generatedRows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Товары');

    // Header row matching Uzum template (columns A-AD)
    const headers = [
      'Название товара RU',           // A
      'Идентификатор от продавца',     // B
      'Название товара UZ',            // C
      'Группировка SKU',               // D
      'Название категории',            // E
      'id категории',                  // F
      'Бренд',                         // G
      'Модель',                        // H
      'Страна производства',           // I
      'Описание товара RU',            // J
      'Описание товара UZ',            // K
      'Краткое описание RU',           // L
      'Краткое описание UZ',           // M
      'Состав RU',                     // N
      'Состав UZ',                     // O
      'Инструкция по уходу и эксплуатации RU', // P
      'Инструкция по уходу и эксплуатации UZ', // Q
      'Размерная сетка RU',            // R
      'Размерная сетка UZ',            // S
      'Ссылки на фото',                // T
      'Штрихкод',                      // U
      'ИКПУ',                          // V
      'Цвет',                          // W
      'Размер',                        // X
      'Цена продажи (som)',            // Y
      'Цена до скидки (som)',          // Z
      'Вес (г)',                        // AA
      'Высота (мм)',                   // AB
      'Ширина (мм)',                   // AC
      'Длина (мм)',                    // AD
    ];

    ws.addRow(headers);

    // Set column widths
    const colWidths = [40, 20, 40, 20, 30, 12, 20, 15, 20, 50, 50, 50, 50, 20, 20, 20, 20, 15, 15, 50, 15, 20, 15, 15, 15, 15, 10, 12, 12, 12];
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    generatedRows.forEach(({ product, data, mxik }, idx) => {
      ws.addRow([
        data.name_ru,                                        // A
        product.id,                                          // B
        data.name_uz,                                        // C
        `SKU-${idx + 1}`,                                    // D
        common.categoryName,                                 // E
        common.categoryId,                                   // F
        data.brand || common.brand,                          // G
        '',                                                  // H
        common.country,                                      // I
        data.full_description_ru,                            // J
        data.full_description_uz,                            // K
        data.short_description_ru?.slice(0, 390),            // L
        data.short_description_uz?.slice(0, 390),            // M
        '', '', '', '', '', '',                              // N-S
        (product.images || []).join('; '),                    // T
        '',                                                  // U
        mxik || common.ikpu,                                // V
        '', '',                                              // W-X
        product.price,                                       // Y
        product.price,                                       // Z
        common.weight || '',                                 // AA
        common.height || '',                                 // AB
        common.width || '',                                  // AC
        common.length || '',                                 // AD
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uzum-products-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel fayl yuklandi!');
  };

  const handleReset = () => {
    setStep('select');
    setSelectedIds(new Set());
    setGeneratedRows([]);
    setErrors([]);
    setProgress(0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Uzum Excel Generator</CardTitle>
              <CardDescription className="text-xs">
                AI tarjima + Uzum shablon formatida Excel fayl yaratish
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Step 1: Select Products */}
      {step === 'select' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">1. Mahsulotlarni tanlang</h3>
              <Badge variant="secondary" className="text-xs">{selectedIds.size} tanlandi</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>

            {filteredProducts.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selectedIds.size === filteredProducts.length ? 'Hammasini bekor qilish' : 'Hammasini tanlash'}
              </button>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Mahsulotlar topilmadi. Marketplace ulang (Uzumdan boshqa).
                </p>
              ) : (
                filteredProducts.slice(0, 50).map(p => (
                  <label key={p.id} className="flex items-start gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer text-xs">
                    <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleProduct(p.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{p.marketplace}</Badge>
                        {p.price > 0 && <span>{new Intl.NumberFormat('uz-UZ').format(p.price)} so'm</span>}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <Button onClick={() => setStep('details')} disabled={selectedIds.size === 0} className="w-full" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Davom etish ({selectedIds.size} ta mahsulot)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Common Details */}
      {step === 'details' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">2. Umumiy ma'lumotlar</h3>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setStep('select')}>← Orqaga</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Barcha {selectedIds.size} ta mahsulotga tegishli umumiy maydonlarni to'ldiring.
              Uzum shablonidagi majburiy (*) ustunlar.
            </p>

            <div className="space-y-2">
              <Input placeholder="Kategoriya nomi * (masalan: Smartfonlar)" value={common.categoryName}
                onChange={e => setCommon(p => ({ ...p, categoryName: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="Kategoriya ID * (masalan: 16646)" value={common.categoryId}
                onChange={e => setCommon(p => ({ ...p, categoryId: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="Brend * (masalan: Samsung)" value={common.brand}
                onChange={e => setCommon(p => ({ ...p, brand: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="Ishlab chiqaruvchi mamlakat *" value={common.country}
                onChange={e => setCommon(p => ({ ...p, country: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="ИКПУ (avtomatik aniqlanadi yoki qo'lda kiriting)" value={common.ikpu} maxLength={17}
                onChange={e => setCommon(p => ({ ...p, ikpu: e.target.value }))} className="h-8 text-sm" />

              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Og'irlik (gramm) *" type="number" value={common.weight}
                  onChange={e => setCommon(p => ({ ...p, weight: e.target.value }))} className="h-8 text-sm" />
                <Input placeholder="Balandlik (mm) *" type="number" value={common.height}
                  onChange={e => setCommon(p => ({ ...p, height: e.target.value }))} className="h-8 text-sm" />
                <Input placeholder="Kenglik (mm) *" type="number" value={common.width}
                  onChange={e => setCommon(p => ({ ...p, width: e.target.value }))} className="h-8 text-sm" />
                <Input placeholder="Uzunlik (mm) *" type="number" value={common.length}
                  onChange={e => setCommon(p => ({ ...p, length: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>

            <Button onClick={handleGenerate}
              disabled={!common.categoryName || !common.brand}
              className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700">
              <Sparkles className="h-4 w-4 mr-2" />
              AI bilan Excel yaratish ({selectedIds.size} ta)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generating */}
      {step === 'generating' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <h3 className="font-medium text-sm">AI tayyorlamoqda...</h3>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progressText}</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="space-y-3">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="font-medium text-sm">{generatedRows.length} ta mahsulot tayyor!</h3>
              </div>

              {errors.length > 0 && (
                <div className="bg-destructive/10 rounded-md p-2 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {errors.length} ta xatolik
                  </div>
                  {errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate">{e}</p>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {generatedRows.slice(0, 5).map(({ product, data }, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="truncate flex-1">{data.name_ru}</span>
                  </div>
                ))}
                {generatedRows.length > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    ... va yana {generatedRows.length - 5} ta
                  </p>
                )}
              </div>

              <Button onClick={handleDownloadExcel} className="w-full" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Excel faylni yuklab olish
              </Button>

              <Button variant="outline" size="sm" onClick={handleReset} className="w-full text-xs">
                Qayta boshlash
              </Button>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-purple-500/20">
            <CardContent className="p-3 space-y-2">
              <h4 className="font-medium text-sm">📋 Qo'llanma</h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Yuqoridagi tugma orqali Excel faylni yuklab oling</li>
                <li><a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">seller.uzum.uz</a> ga kiring</li>
                <li>"Товары" → "Создание товаров из файла" bo'limiga o'ting</li>
                <li>Yuklangan Excel faylni biriktiring va "Загрузить" tugmasini bosing</li>
              </ol>
              <p className="text-[10px] text-muted-foreground italic">
                ⚠️ Kategoriya ID va ИКПУ to'g'riligini Uzum portalda tekshiring.
                Uzum shablonida kategoriya bo'yicha qo'shimcha filtrlar bo'lishi mumkin.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
