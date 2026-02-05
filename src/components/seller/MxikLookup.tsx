 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Loader2, Search, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
 import { toast } from 'sonner';
 import { cn } from '@/lib/utils';
 
 interface MxikResult {
   mxik_code: string;
   mxik_name: string;
   name_ru?: string;
   vat_rate: number;
   confidence: number;
   alternatives: Array<{
     code: string;
     name_uz: string;
     name_ru?: string;
     confidence: number;
   }>;
 }
 
 interface MxikLookupProps {
   productName: string;
   category?: string;
   description?: string;
   value?: string;
   onChange: (mxikCode: string, mxikName: string) => void;
   disabled?: boolean;
 }
 
 export function MxikLookup({
   productName,
   category,
   description,
   value,
   onChange,
   disabled = false,
 }: MxikLookupProps) {
   const [isLoading, setIsLoading] = useState(false);
   const [result, setResult] = useState<MxikResult | null>(null);
   const [showAlternatives, setShowAlternatives] = useState(false);
   const [manualCode, setManualCode] = useState(value || '');
 
   const lookupMxik = async () => {
     if (!productName.trim()) {
       toast.error('Mahsulot nomini kiriting');
       return;
     }
 
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('lookup-mxik-code', {
         body: { productName, category, description },
       });
 
       if (error) throw error;
 
       setResult(data);
       onChange(data.mxik_code, data.mxik_name);
       setManualCode(data.mxik_code);
 
       if (data.confidence >= 80) {
         toast.success(`MXIK topildi: ${data.mxik_name} (${data.confidence}%)`);
       } else {
         toast.info(`MXIK topildi, lekin ishonch past: ${data.confidence}%`);
       }
     } catch (error: any) {
       console.error('MXIK lookup error:', error);
       toast.error('MXIK qidirishda xato');
     } finally {
       setIsLoading(false);
     }
   };
 
   const selectAlternative = (alt: { code: string; name_uz: string }) => {
     onChange(alt.code, alt.name_uz);
     setManualCode(alt.code);
     setShowAlternatives(false);
     toast.success(`MXIK o'zgartirildi: ${alt.name_uz}`);
   };
 
   const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const code = e.target.value;
     setManualCode(code);
     if (code.length === 17) {
       onChange(code, result?.mxik_name || 'Qo\'lda kiritilgan');
     }
   };
 
   const getConfidenceBadge = (confidence: number) => {
     if (confidence >= 90) {
      return <Badge variant="outline" className="border-primary/30 text-primary">Yuqori ({confidence}%)</Badge>;
     } else if (confidence >= 70) {
      return <Badge variant="secondary">O'rtacha ({confidence}%)</Badge>;
     } else {
      return <Badge variant="destructive">Past ({confidence}%)</Badge>;
     }
   };
 
   return (
     <div className="space-y-3">
       <div className="flex items-center justify-between">
         <Label>MXIK Kodi (IKPU)</Label>
         <Button
           type="button"
           variant="outline"
           size="sm"
           onClick={lookupMxik}
           disabled={disabled || isLoading || !productName.trim()}
         >
           {isLoading ? (
             <Loader2 className="h-4 w-4 animate-spin mr-1" />
           ) : (
             <Search className="h-4 w-4 mr-1" />
           )}
           Avtomatik topish
         </Button>
       </div>
 
       <div className="flex gap-2">
         <Input
           value={manualCode}
           onChange={handleManualChange}
           placeholder="17 raqamli MXIK kodi"
           maxLength={17}
           disabled={disabled}
           className="font-mono"
         />
       </div>
 
       {result && (
         <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
           <div className="flex items-start justify-between gap-2">
             <div className="flex items-start gap-2">
               {result.confidence >= 70 ? (
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
               ) : (
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
               )}
               <div>
                 <p className="font-medium text-sm">{result.mxik_name}</p>
                 {result.name_ru && (
                   <p className="text-xs text-muted-foreground">{result.name_ru}</p>
                 )}
                 <p className="text-xs text-muted-foreground mt-1">
                   QQS stavkasi: {result.vat_rate}%
                 </p>
               </div>
             </div>
             {getConfidenceBadge(result.confidence)}
           </div>
 
           {result.alternatives.length > 0 && (
             <div>
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 className="w-full justify-between text-xs h-8"
                 onClick={() => setShowAlternatives(!showAlternatives)}
               >
                 <span>Boshqa variantlar ({result.alternatives.length})</span>
                 {showAlternatives ? (
                   <ChevronUp className="h-4 w-4" />
                 ) : (
                   <ChevronDown className="h-4 w-4" />
                 )}
               </Button>
 
               {showAlternatives && (
                 <div className="space-y-1 mt-2">
                   {result.alternatives.map((alt) => (
                     <button
                       key={alt.code}
                       type="button"
                       onClick={() => selectAlternative(alt)}
                       className={cn(
                         "w-full text-left p-2 rounded-md text-sm transition-colors",
                         "hover:bg-primary/10 hover:text-primary",
                         "flex items-center justify-between"
                       )}
                     >
                       <div>
                         <p className="font-medium">{alt.name_uz}</p>
                         {alt.name_ru && (
                           <p className="text-xs text-muted-foreground">{alt.name_ru}</p>
                         )}
                       </div>
                       <Badge variant="outline" className="text-xs">
                         {alt.confidence}%
                       </Badge>
                     </button>
                   ))}
                 </div>
               )}
             </div>
           )}
         </div>
       )}
     </div>
   );
 }