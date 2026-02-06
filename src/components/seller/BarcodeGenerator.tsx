import { useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ScanBarcode, 
  QrCode, 
  Download, 
  Copy, 
  Printer,
  Package,
  Search
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';

interface BarcodeGeneratorProps {
  shopId: string;
}

// Simple EAN-13 barcode SVG generator
function generateBarcodeSVG(code: string): string {
  const encoding: Record<string, string> = {
    '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
    '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011',
  };
  const encodingR: Record<string, string> = {
    '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
    '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100',
  };

  // Pad to 12 digits and calculate check digit
  const digits = code.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const fullCode = digits + checkDigit;

  // Build binary pattern
  let binary = '101'; // Start guard
  for (let i = 1; i <= 6; i++) {
    binary += encoding[fullCode[i]] || '0001101';
  }
  binary += '01010'; // Center guard
  for (let i = 7; i <= 12; i++) {
    binary += encodingR[fullCode[i]] || '1110010';
  }
  binary += '101'; // End guard

  const barWidth = 2;
  const height = 80;
  const width = binary.length * barWidth + 20;

  let bars = '';
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      bars += `<rect x="${10 + i * barWidth}" y="10" width="${barWidth}" height="${height}" fill="black"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 30}" viewBox="0 0 ${width} ${height + 30}">
    <rect width="${width}" height="${height + 30}" fill="white"/>
    ${bars}
    <text x="${width / 2}" y="${height + 25}" text-anchor="middle" font-family="monospace" font-size="12">${fullCode}</text>
  </svg>`;
}

// Simple QR Code placeholder (pattern-based)
function generateQRSVG(data: string): string {
  const size = 200;
  const modules = 21;
  const moduleSize = size / modules;
  
  // Generate deterministic pattern from data
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash |= 0;
  }

  let rects = '';
  // Finder patterns (corners)
  const drawFinder = (x: number, y: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const fill = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        if (fill) {
          rects += `<rect x="${(x + c) * moduleSize}" y="${(y + r) * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(14, 0);
  drawFinder(0, 14);

  // Data modules (deterministic from hash)
  let seed = Math.abs(hash);
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      // Skip finder pattern areas
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 === 0) {
        rects += `<rect x="${c * moduleSize}" y="${r * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    ${rects}
  </svg>`;
}

export function BarcodeGenerator({ shopId }: BarcodeGeneratorProps) {
  const { products } = useProducts(shopId);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
  const [customCode, setCustomCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const barcodeRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 20);
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 20);
  }, [products, searchQuery]);

  const selectedProductData = products.find(p => p.id === selectedProduct);

  const codeValue = customCode || (selectedProduct ? selectedProduct.replace(/[^0-9]/g, '').slice(0, 12).padStart(12, '0') : '');

  const svgContent = useMemo(() => {
    if (!codeValue && !selectedProduct) return '';
    const val = codeValue || '000000000000';
    return codeType === 'barcode' ? generateBarcodeSVG(val) : generateQRSVG(selectedProductData?.name || val);
  }, [codeValue, codeType, selectedProduct, selectedProductData]);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${codeType}-${selectedProductData?.name || 'code'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Yuklab olindi');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeValue);
    toast.success('Kod nusxalandi');
  };

  const handlePrint = () => {
    if (!svgContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const productName = selectedProductData?.name || '';
    const price = selectedProductData?.price ? `${selectedProductData.price.toLocaleString()} so'm` : '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Barcode - ${productName}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: sans-serif; }
        .label { text-align: center; padding: 20px; border: 1px dashed #ccc; }
        h3 { margin: 0 0 8px; font-size: 14px; }
        p { margin: 4px 0; font-size: 12px; color: #666; }
        @media print { .label { border: none; } }
      </style>
      </head>
      <body>
        <div class="label">
          <h3>${productName}</h3>
          ${price ? `<p>${price}</p>` : ''}
          ${svgContent}
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-primary" />
          Shtrix-kod / QR-kod generatori
        </h2>
        <p className="text-sm text-muted-foreground">
          Mahsulotlarga avtomatik barcode yoki QR-code yarating
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sozlamalar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Code Type */}
            <div className="flex gap-2">
              <Button
                variant={codeType === 'barcode' ? 'default' : 'outline'}
                onClick={() => setCodeType('barcode')}
                className="flex-1 gap-2"
              >
                <ScanBarcode className="h-4 w-4" />
                Barcode
              </Button>
              <Button
                variant={codeType === 'qr' ? 'default' : 'outline'}
                onClick={() => setCodeType('qr')}
                className="flex-1 gap-2"
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
            </div>

            {/* Product Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Mahsulotni tanlang</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedProduct === product.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedProduct(product.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{product.name}</span>
                      <span className="text-xs opacity-70 ml-2 flex-shrink-0">
                        {product.price.toLocaleString()} so'm
                      </span>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm">
                    Mahsulot topilmadi
                  </p>
                )}
              </div>
            </div>

            {/* Custom Code */}
            {codeType === 'barcode' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Kod raqami (ixtiyoriy)</label>
                <Input
                  placeholder="123456789012"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  maxLength={12}
                />
                <p className="text-xs text-muted-foreground mt-1">EAN-13 format (12 raqam + 1 tekshiruv)</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ko'rinish</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedProduct || customCode ? (
              <div className="space-y-4">
                {/* Product Info */}
                {selectedProductData && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    {selectedProductData.images?.[0] ? (
                      <img
                        src={selectedProductData.images[0]}
                        alt={selectedProductData.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{selectedProductData.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedProductData.price.toLocaleString()} so'm</p>
                    </div>
                  </div>
                )}

                {/* Barcode/QR Preview */}
                <div
                  ref={barcodeRef}
                  className="flex justify-center p-6 bg-white rounded-lg border"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={handleDownload} className="flex-1 gap-2">
                    <Download className="h-4 w-4" />
                    Yuklab olish
                  </Button>
                  <Button variant="outline" onClick={handleCopy} className="gap-2">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ScanBarcode className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Mahsulot tanlang yoki kod raqamini kiriting</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
