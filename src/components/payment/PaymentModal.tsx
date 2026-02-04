import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, CreditCard, Smartphone, Shield, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  paymentMethod: string;
  amount: number;
  orderNumber: string;
  orderId?: string;
}

export function PaymentModal({ open, onClose, onSuccess, paymentMethod, amount, orderNumber, orderId }: PaymentModalProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'redirect' | 'success'>('form');
  const [progress, setProgress] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Handle Click payment with real API
  const handleClickPayment = async () => {
    if (!orderId) {
      toast.error('Buyurtma topilmadi');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('click-payment', {
        body: {
          orderId,
          amount,
          returnUrl: window.location.origin + '/dashboard?tab=orders'
        }
      });

      if (error) throw error;

      if (data?.paymentUrl) {
        setStep('redirect');
        // Open Click payment page
        window.open(data.paymentUrl, '_blank');
        toast.success('Click to\'lov sahifasi ochildi');
      }
    } catch (error: any) {
      console.error('Click payment error:', error);
      toast.error('To\'lov xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // For Click - use real API integration
    if (paymentMethod === 'click') {
      await handleClickPayment();
      return;
    }

    // For other methods (Payme, Uzcard) - use mock flow
    if (paymentMethod === 'payme' || paymentMethod === 'uzcard') {
      if (!showOtp) {
        setShowOtp(true);
        return;
      }
    }
    
    setStep('processing');
    setProgress(0);
    
    // Simulate payment processing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('success');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
    // Reset state
    setStep('form');
    setProgress(0);
    setCardNumber('');
    setExpiry('');
    setPhone('');
    setOtp('');
    setShowOtp(false);
  };

  useEffect(() => {
    if (!open) {
      setStep('form');
      setProgress(0);
      setShowOtp(false);
    }
  }, [open]);

  const getMethodConfig = () => {
    switch (paymentMethod) {
      case 'payme':
        return { 
          name: 'Payme', 
          color: 'bg-[#00CCCC]', 
          icon: '💳',
          description: 'Payme kartasi yoki ilovasi orqali'
        };
      case 'click':
        return { 
          name: 'Click', 
          color: 'bg-[#00AAFF]', 
          icon: '📱',
          description: 'Click ilovasi orqali to\'lash'
        };
      case 'uzcard':
        return { 
          name: 'Uzcard', 
          color: 'bg-[#1E3A8A]', 
          icon: '💳',
          description: 'Uzcard kartasi orqali'
        };
      default:
        return { name: 'To\'lov', color: 'bg-primary', icon: '💰', description: '' };
    }
  };

  const config = getMethodConfig();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded flex items-center justify-center text-white ${config.color}`}>
              {config.icon}
            </span>
            {config.name} orqali to'lash
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Buyurtma:</span>
                <span className="font-mono">{orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To'lov summasi:</span>
                <span className="font-bold text-lg">{formatPrice(amount)}</span>
              </div>
            </div>

            {/* Card Form for Payme/Uzcard */}
            {(paymentMethod === 'payme' || paymentMethod === 'uzcard') && !showOtp && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Karta raqami</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="8600 **** **** ****"
                      className="pl-10"
                      maxLength={19}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amal qilish muddati</Label>
                  <Input
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                </div>
              </div>
            )}

            {/* Click Payment - Direct redirect */}
            {paymentMethod === 'click' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-[#00AAFF] rounded-full flex items-center justify-center">
                    <span className="text-3xl">📱</span>
                  </div>
                  <p className="font-medium">Click orqali to'lash</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tugmani bosganingizda Click to'lov sahifasi ochiladi
                  </p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
                  <p>✓ Click ilovasiga ro'yxatdan o'tgan bo'lishingiz kerak</p>
                  <p>✓ To'lov xavfsiz SSL shifrlangan</p>
                </div>
              </div>
            )}

            {/* OTP Form */}
            {showOtp && paymentMethod !== 'click' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm">SMS kod yuborildi</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    **** {cardNumber.slice(-4)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>SMS kodni kiriting</Label>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Test uchun istalgan 6 ta raqam kiriting
                </p>
              </div>
            )}

            <Button 
              onClick={handleSubmit} 
              className="w-full" 
              disabled={
                isLoading ||
                (paymentMethod !== 'click' && !showOtp && cardNumber.length < 19) ||
                (showOtp && otp.length < 6)
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Yuklanmoqda...
                </>
              ) : paymentMethod === 'click' ? (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Click sahifasiga o'tish
                </>
              ) : showOtp ? (
                'Tasdiqlash'
              ) : (
                'Davom etish'
              )}
            </Button>
          </div>
        )}

        {step === 'redirect' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto flex items-center justify-center">
              <ExternalLink className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-lg">Click sahifasi ochildi</p>
              <p className="text-sm text-muted-foreground mt-2">
                To'lovni Click sahifasida yakunlang. <br/>
                To'lov yakunlangach, buyurtma statusi yangilanadi.
              </p>
            </div>
            <Button variant="outline" onClick={handleComplete} className="w-full">
              Tushundim
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium">To'lov amalga oshirilmoqda...</p>
              <p className="text-sm text-muted-foreground">Iltimos, kuting</p>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-lg">To'lov muvaffaqiyatli!</p>
              <p className="text-sm text-muted-foreground">{formatPrice(amount)} to'landi</p>
            </div>
            <Button onClick={handleComplete} className="w-full">
              Davom etish
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
