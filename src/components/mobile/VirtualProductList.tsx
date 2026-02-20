 import { useRef, memo } from 'react';
 import { useVirtualizer } from '@tanstack/react-virtual';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Image as ImageIcon, Package, Warehouse } from 'lucide-react';
 
 interface Product {
   offerId: string;
   name: string;
   price?: number;
   shopSku?: string;
   category?: string;
   pictures?: string[];
   availability?: string;
   stockFBO?: number;
   stockFBS?: number;
   stockCount?: number;
   uniqueKey?: string;
 }
 
interface VirtualProductListProps {
  products: Product[];
  marketplace?: string;
  onProductClick?: (product: Product) => void;
}
 
const formatPrice = (price?: number, marketplace?: string) => {
  if (!price) return '—';
  const isRub = marketplace === 'wildberries';
  const currency = isRub ? ' ₽' : ' so\'m';
  if (!isRub && price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
  return new Intl.NumberFormat(isRub ? 'ru-RU' : 'uz-UZ').format(Math.round(price)) + currency;
};
 
 const getStockBadge = (fbo?: number, fbs?: number) => {
   const total = (fbo || 0) + (fbs || 0);
   if (total === 0) return <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>;
   if (total < 10) return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">{total} ta</Badge>;
   return <Badge variant="secondary" className="text-[10px]">{total} ta</Badge>;
 };
 
 // Memoized product row to prevent unnecessary re-renders
 const ProductRow = memo(({ product, onClick, marketplace }: { product: Product; onClick?: (p: Product) => void; marketplace?: string }) => (
   <Card 
    className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
     onClick={() => onClick?.(product)}
   >
    <CardContent className="p-2.5">
       <div className="flex gap-2.5">
        <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
           {product.pictures?.[0] ? (
             <img 
               src={product.pictures[0]} 
               alt={product.name}
               className="w-full h-full object-cover"
               loading="lazy"
               onError={(e) => {
                 e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
               }}
             />
           ) : (
             <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
           )}
         </div>
         <div className="flex-1 min-w-0">
          <div className="font-medium text-[13px] line-clamp-2 mb-0.5 leading-tight">
             {product.name || 'Nomsiz'}
           </div>
          <div className="text-[11px] text-muted-foreground mb-1 truncate">
             SKU: {product.shopSku || product.offerId}
           </div>
           <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-primary text-sm">
               {formatPrice(product.price, marketplace)}
             </span>
            <div className="flex items-center gap-1.5">
              {product.stockFBO !== undefined && product.stockFBO > 0 && (
                <Badge variant="outline" className="text-[10px] py-0">
                  <Warehouse className="h-2.5 w-2.5 mr-0.5" />
                  {product.stockFBO}
                </Badge>
              )}
              {getStockBadge(product.stockFBO, product.stockFBS)}
            </div>
           </div>
         </div>
       </div>
     </CardContent>
   </Card>
 ));
 
 ProductRow.displayName = 'ProductRow';
 
 export function VirtualProductList({ products, marketplace, onProductClick }: VirtualProductListProps) {
   const parentRef = useRef<HTMLDivElement>(null);
 
   const virtualizer = useVirtualizer({
     count: products.length,
     getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
     overscan: 5, // Render 5 extra items above/below viewport
   });
 
   return (
     <div 
       ref={parentRef} 
      className="flex-1 overflow-y-auto px-3 py-2"
       style={{ contain: 'strict' }}
     >
       <div
         style={{
           height: `${virtualizer.getTotalSize()}px`,
           width: '100%',
           position: 'relative',
         }}
       >
         {virtualizer.getVirtualItems().map((virtualItem) => {
           const product = products[virtualItem.index];
           return (
             <div
               key={product.uniqueKey || `${product.offerId}-${virtualItem.index}`}
               style={{
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 width: '100%',
                 height: `${virtualItem.size}px`,
                 transform: `translateY(${virtualItem.start}px)`,
              paddingBottom: '8px',
               }}
             >
               <ProductRow product={product} onClick={onProductClick} marketplace={marketplace} />
             </div>
           );
         })}
       </div>
     </div>
   );
 }