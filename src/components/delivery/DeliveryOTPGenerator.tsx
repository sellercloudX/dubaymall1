import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDeliveryOTP } from '@/hooks/useDeliveryOTP';
import { useLanguage } from '@/contexts/LanguageContext';
import { Truck, Copy, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryOTPGeneratorProps {
  orderId: string;
  orderNumber: string;
  currentOTP?: string | null;
  otpExpiresAt?: string | null;
  isDelivered?: boolean;
  onOTPGenerated?: (otp: string) => void;
}

export function DeliveryOTPGenerator({
  orderId,
  orderNumber,
  currentOTP,
  otpExpiresAt,
  isDelivered,
  onOTPGenerated
}: DeliveryOTPGeneratorProps) {
  const { t } = useLanguage();
  const { generateOTP, loading } = useDeliveryOTP();
  const [otp, setOtp] = useState<string | null>(currentOTP || null);

  const handleGenerateOTP = async () => {
    const newOTP = await generateOTP(orderId);
    if (newOTP) {
      setOtp(newOTP);
      onOTPGenerated?.(newOTP);
    }
  };

  const copyOTP = () => {
    if (otp) {
      navigator.clipboard.writeText(otp);
      toast.success('OTP kod nusxalandi!');
    }
  };

  const isExpired = otpExpiresAt ? new Date(otpExpiresAt) < new Date() : false;

  if (isDelivered) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-700">
            <CheckCircle className="h-6 w-6" />
            <div>
              <p className="font-medium">Yetkazib berish tasdiqlangan</p>
              <p className="text-sm text-green-600">Mijoz OTP kod orqali qabul qildi</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="h-5 w-5" />
          Yetkazib berish OTP
        </CardTitle>
        <CardDescription>
          Kuryer bu kodni mijozga aytadi, mijoz tasdiqlaydi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {otp && !isExpired ? (
          <>
            <div className="flex items-center justify-center gap-2 p-4 bg-primary/5 rounded-lg">
              <span className="text-4xl font-mono font-bold tracking-[0.5em] text-primary">
                {otp}
              </span>
              <Button variant="ghost" size="icon" onClick={copyOTP}>
                <Copy className="h-5 w-5" />
              </Button>
            </div>
            
            {otpExpiresAt && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Amal qilish muddati: {new Date(otpExpiresAt).toLocaleString('uz-UZ')}
                </span>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠️ Muhim!</p>
              <p>Bu kodni faqat kuryerga bering. Kuryer mijozga aytadi va mijoz platformada kiritadi.</p>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            {isExpired ? (
              <Badge variant="destructive" className="mb-4">OTP muddati tugagan</Badge>
            ) : (
              <p className="text-muted-foreground mb-4">
                Yetkazib berish boshlanganida OTP yarating
              </p>
            )}
          </div>
        )}

        <Button 
          onClick={handleGenerateOTP} 
          disabled={loading}
          className="w-full"
          variant={otp ? "outline" : "default"}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Truck className="h-4 w-4 mr-2" />
          )}
          {otp ? 'Yangi OTP yaratish' : 'OTP kod yaratish'}
        </Button>
      </CardContent>
    </Card>
  );
}
