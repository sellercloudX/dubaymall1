import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useDeliveryOTP } from '@/hooks/useDeliveryOTP';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, CheckCircle, Loader2 } from 'lucide-react';

interface DeliveryOTPConfirmProps {
  orderId: string;
  orderNumber: string;
  onConfirmed?: () => void;
}

export function DeliveryOTPConfirm({
  orderId,
  orderNumber,
  onConfirmed
}: DeliveryOTPConfirmProps) {
  const { t } = useLanguage();
  const { verifyOTP, loading } = useDeliveryOTP();
  const [otp, setOtp] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    
    const result = await verifyOTP(orderId, otp);
    if (result.success) {
      setConfirmed(true);
      onConfirmed?.();
    }
  };

  if (confirmed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Buyurtma qabul qilindi!</h3>
              <p className="text-sm text-green-600">
                Xaridingiz uchun rahmat. Buyurtma #{orderNumber}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Yetkazib berishni tasdiqlang</CardTitle>
        <CardDescription>
          Kuryer aytgan 6 xonali kodni kiriting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p>💡 Kuryer sizga 6 xonali kod aytadi. Shu kodni kiriting va "Tasdiqlash" tugmasini bosing.</p>
        </div>

        <Button 
          onClick={handleVerify} 
          disabled={loading || otp.length !== 6}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Qabul qildim, tasdiqlash
        </Button>
      </CardContent>
    </Card>
  );
}
