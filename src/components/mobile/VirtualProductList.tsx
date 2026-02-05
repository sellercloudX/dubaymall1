 import { useRef, memo } from 'react';
 import { useVirtualizer } from '@tanstack/react-virtual';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Image as ImageIcon } from 'lucide-react';
 
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
   onProductClick?: (product: Product) => void;
 }
 
 const formatPrice = (price?: number) => {
   if (!price) return '—';
   return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
 };
 
 const getStockBadge = (fbo?: number, fbs?: number) => {
   const total = (fbo || 0) + (fbs || 0);
   if (total === 0) return <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>;
   if (total < 10) return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">{total} ta</Badge>;
   return <Badge variant="secondary" className="text-[10px]">{total} ta</Badge>;
 };
 
 // Memoized product row to prevent unnecessary re-renders
 const ProductRow = memo(({ product, onClick }: { product: Product; onClick?: (p: Product) => void }) => (
   <Card 
     className="overflow-hidden mx-3 cursor-pointer hover:bg-accent/50 transition-colors"
     onClick={() => onClick?.(product)}
   >
     <CardContent className="p-0">
       <div className="flex">
         <div className="w-14 h-14 bg-muted flex items-center justify-center shrink-0">
           {product.pictures?.[0] ? (
             <img 
               src={product.pictures[0]} 
               alt={product.name}
               className="w-full h-full object-cover"
               loading="lazy"
               onError={(e) => {
                 e.currentTarget.style.display = 'none';
               }}
             />
           ) : (
             <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
           )}
         </div>
         <div className="flex-1 p-2 min-w-0">
           <div className="font-medium text-xs line-clamp-2 mb-0.5 leading-snug">
             {product.name || 'Nomsiz'}
           </div>
           <div className="text-[10px] text-muted-foreground mb-1 truncate">
             SKU: {product.shopSku || product.offerId}
           </div>
           <div className="flex items-center justify-between gap-2">
             <span className="font-bold text-primary text-xs truncate">
               {formatPrice(product.price)}
             </span>
             {getStockBadge(product.stockFBO, product.stockFBS)}
           </div>
         </div>
       </div>
     </CardContent>
   </Card>
 ));
 
 ProductRow.displayName = 'ProductRow';
 
 export function VirtualProductList({ products, onProductClick }: VirtualProductListProps) {
   const parentRef = useRef<HTMLDivElement>(null);
 
   const virtualizer = useVirtualizer({
     count: products.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 68, // Estimated row height
     overscan: 5, // Render 5 extra items above/below viewport
   });
 
   return (
     <div 
       ref={parentRef} 
       className="flex-1 overflow-y-auto"
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
               <ProductRow product={product} onClick={onProductClick} />
             </div>
           );
         })}
       </div>
     </div>
   );
 }