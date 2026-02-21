import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';

const AFFILIATE_API_BASE = 'https://xewgwvsljdhjvxtmqeuy.supabase.co/functions/v1';

export interface PromoValidation {
  valid: boolean;
  promo_id?: string;
  blogger_id?: string;
  offer_id?: string;
  offer_title?: string;
  original_price?: number;
  discount?: number;
  final_price?: number;
  error_code?: string;
}

interface PromoCodeInputProps {
  customerEmail: string;
  onValidated: (result: PromoValidation | null) => void;
  disabled?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  PROMO_NOT_FOUND: "Promo kod noto'g'ri",
  CUSTOMER_ALREADY_PAID: "Promo kod faqat yangi foydalanuvchilar uchun",
  CUSTOMER_ALREADY_USED_PROMO: "Siz allaqachon promo koddan foydalangansiz",
  OFFER_NOT_ACTIVE: "Bu promo kod hozirda faol emas",
};

export function PromoCodeInput({ customerEmail, onValidated, disabled }: PromoCodeInputProps) {
  const [promoCode, setPromoCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<PromoValidation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleValidate = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      toast.error("Promo kodni kiriting");
      return;
    }

    if (!customerEmail) {
      toast.error("Email manzil topilmadi");
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setValidation(null);

    try {
      const response = await fetch(`${AFFILIATE_API_BASE}/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promo_code: code,
          customer_email: customerEmail,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setValidation(data);
        onValidated(data);
        toast.success(`Promo kod qabul qilindi! $${data.discount} chegirma`);
      } else {
        const msg = ERROR_MESSAGES[data.error_code] || "Promo kod noto'g'ri";
        setErrorMessage(msg);
        setValidation(null);
        onValidated(null);
        toast.error(msg);
      }
    } catch (err: any) {
      console.error('Promo validation error:', err);
      setErrorMessage("Tekshirishda xatolik yuz berdi");
      setValidation(null);
      onValidated(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setPromoCode('');
    setValidation(null);
    setErrorMessage(null);
    onValidated(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5" />
        Promo kod (ixtiyoriy)
      </label>
      <div className="flex gap-2">
        <Input
          placeholder="Masalan: ALI05"
          value={promoCode}
          onChange={(e) => {
            setPromoCode(e.target.value.toUpperCase());
            if (validation || errorMessage) {
              setValidation(null);
              setErrorMessage(null);
              onValidated(null);
            }
          }}
          disabled={disabled || isValidating || !!validation}
          className="flex-1 uppercase font-mono"
          maxLength={20}
        />
        {validation ? (
          <Button variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
            <XCircle className="h-4 w-4 mr-1" />
            Bekor
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={disabled || isValidating || !promoCode.trim()}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Tekshirish'
            )}
          </Button>
        )}
      </div>

      {validation && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-primary">-${validation.discount} chegirma!</span>
            <span className="text-muted-foreground ml-2">
              ${validation.original_price} → ${validation.final_price}
            </span>
          </div>
          <Badge className="bg-primary/20 text-primary text-xs">{promoCode}</Badge>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
