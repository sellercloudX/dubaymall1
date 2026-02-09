import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface OrderReceiptProps {
  order: {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    payment_status: string;
    payment_method: string;
    shipping_address: any;
    created_at: string;
  };
  items: OrderItem[];
}

// Simple barcode generator using Code128-like pattern
function generateBarcodeDataUrl(text: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const barWidth = 2;
  const height = 60;
  // Simple encoding: each char -> binary pattern
  const encoded = text.split('').map(ch => {
    const code = ch.charCodeAt(0);
    return code.toString(2).padStart(8, '0');
  }).join('1'); // separator

  canvas.width = encoded.length * barWidth + 40;
  canvas.height = height + 25;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  let x = 20;
  for (const bit of encoded) {
    ctx.fillStyle = bit === '1' ? '#000000' : '#ffffff';
    ctx.fillRect(x, 5, barWidth, height);
    x += barWidth;
  }

  // Text below barcode
  ctx.fillStyle = '#000000';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, height + 20);

  return canvas.toDataURL('image/png');
}

export function OrderReceipt({ order, items }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'To\'langan ✓';
      case 'cash_on_delivery': return 'Naqd pul (yetkazishda)';
      case 'installment_pending': return 'Muddatli to\'lov';
      case 'pending': return 'Kutilmoqda';
      default: return status;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Kutilmoqda';
      case 'confirmed': return 'Tasdiqlangan';
      case 'processing': return 'Tayyorlanmoqda';
      case 'shipped': return 'Jo\'natildi';
      case 'out_for_delivery': return 'Yetkazilmoqda';
      case 'delivered': return 'Yetkazildi';
      case 'cancelled': return 'Bekor qilindi';
      default: return status;
    }
  };

  const barcodeUrl = generateBarcodeDataUrl(order.order_number);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Buyurtma ${order.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
            .receipt { max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 16px; }
            .barcode { text-align: center; margin: 12px 0; }
            .barcode img { max-width: 100%; }
            .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .info-label { color: #666; }
            .separator { border-top: 1px dashed #ccc; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
            .total { font-weight: bold; font-size: 16px; }
            .payment-status { text-align: center; font-size: 14px; font-weight: bold; padding: 8px; margin-top: 8px; border: 2px solid #000; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const content = receiptRef.current;
    if (!content) return;

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #000; max-width: 400px; margin: 0 auto; }
            .barcode { text-align: center; margin: 12px 0; }
            .barcode img { max-width: 100%; }
            .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .separator { border-top: 1px dashed #ccc; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
            .total { font-weight: bold; font-size: 16px; }
            .payment-status { text-align: center; font-size: 14px; font-weight: bold; padding: 8px; margin-top: 8px; border: 2px solid #000; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyurtma-${order.order_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
          <Printer className="h-3 w-3" /> Chop etish
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
          <Download className="h-3 w-3" /> Yuklab olish
        </Button>
      </div>

      <Card className="max-w-md">
        <CardContent className="p-4" ref={receiptRef}>
          <div className="receipt">
            <div className="header" style={{ textAlign: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Dubay Mall</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>Buyurtma kvitansiyasi</p>
            </div>

            <div className="barcode" style={{ textAlign: 'center', margin: '12px 0' }}>
              <img src={barcodeUrl} alt={order.order_number} style={{ maxWidth: '100%' }} />
            </div>

            <div className="separator" style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />

            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span className="info-label" style={{ color: '#666' }}>Sana:</span>
              <span>{format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}</span>
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span className="info-label" style={{ color: '#666' }}>Holat:</span>
              <span>{getStatusText(order.status)}</span>
            </div>

            {order.shipping_address && (
              <>
                <div className="separator" style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />
                <div style={{ fontSize: '12px' }}>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{order.shipping_address.name}</p>
                  <p style={{ margin: '2px 0' }}>{order.shipping_address.phone}</p>
                  <p style={{ margin: '2px 0' }}>
                    {order.shipping_address.region}, {order.shipping_address.city}
                  </p>
                  <p style={{ margin: '2px 0' }}>{order.shipping_address.address}</p>
                </div>
              </>
            )}

            <div className="separator" style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />

            {items.map((item) => (
              <div key={item.id} className="item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                <span style={{ flex: 1 }}>{item.product_name} ×{item.quantity}</span>
                <span style={{ whiteSpace: 'nowrap', marginLeft: '8px' }}>{formatPrice(item.subtotal)}</span>
              </div>
            ))}

            <div className="separator" style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />

            <div className="total" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>Jami:</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>

            <div className="payment-status" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', padding: '8px', marginTop: '8px', border: '2px solid #000' }}>
              {getPaymentStatusText(order.payment_status || 'pending')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
