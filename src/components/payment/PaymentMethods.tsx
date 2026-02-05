import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Smartphone, Building2, Calendar } from 'lucide-react';

interface PaymentMethodsProps {
  value: string;
  onChange: (value: string) => void;
  totalAmount?: number;
  showInstallments?: boolean;
}

// Installment calculations
const calculateInstallment24 = (price: number): number => Math.round((price * 1.6) / 24);
const calculateInstallment12 = (price: number): number => Math.round((price * 1.45) / 12);
const formatPrice = (price: number) => new Intl.NumberFormat('uz-UZ').format(price);

export function PaymentMethods({ value, onChange, totalAmount = 0, showInstallments = true }: PaymentMethodsProps) {
  const paymentMethods = [
    {
      id: 'cash',
      name: 'Naqd pul',
      description: 'Yetkazib berishda to\'laysiz',
      icon: Banknote,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      id: 'payme',
      name: 'Payme',
      description: 'Karta yoki ilova orqali',
      icon: CreditCard,
      color: 'text-[#00CCCC]',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950',
      badge: 'Tez',
    },
    {
      id: 'click',
      name: 'Click',
      description: 'Click ilovasi orqali',
      icon: Smartphone,
      color: 'text-[#00AAFF]',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      badge: 'Tez',
    },
    {
      id: 'uzcard',
      name: 'Uzcard',
      description: 'Uzcard kartasi orqali',
      icon: Building2,
      color: 'text-[#1E3A8A]',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950',
    },
  ];

  const installmentMethods = showInstallments && totalAmount > 0 ? [
    {
      id: 'installment_12',
      name: '12 oylik muddatli',
      description: `${formatPrice(calculateInstallment12(totalAmount))} so'm/oyiga`,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      badge: 'Muddatli',
      isInstallment: true,
      monthly: calculateInstallment12(totalAmount),
      total: Math.round(totalAmount * 1.45),
    },
    {
      id: 'installment_24',
      name: '24 oylik muddatli',
      description: `${formatPrice(calculateInstallment24(totalAmount))} so'm/oyiga`,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      badge: 'Eng qulay',
      isInstallment: true,
      monthly: calculateInstallment24(totalAmount),
      total: Math.round(totalAmount * 1.6),
    },
  ] : [];

  const allMethods = [...paymentMethods, ...installmentMethods];

  return (
    <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
      {/* Regular payment methods */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {paymentMethods.map((method) => {
          const Icon = method.icon;
          const isSelected = value === method.id;
          
          return (
            <div 
              key={method.id}
              className={`relative flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
              onClick={() => onChange(method.id)}
            >
              <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
              
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method.bgColor}`}>
                <Icon className={`h-5 w-5 ${method.color}`} />
              </div>
              
              <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{method.name}</span>
                  {method.badge && (
                    <Badge variant="secondary" className="text-xs py-0 h-5">
                      {method.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {method.description}
                </p>
              </Label>

              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Installment methods */}
      {installmentMethods.length > 0 && (
        <>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Muddatli to'lov</span>
            </div>
          </div>

          <div className="space-y-3">
            {installmentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = value === method.id;
              
              return (
                <div 
                  key={method.id}
                  className={`relative flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => onChange(method.id)}
                >
                  <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
                  
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method.bgColor}`}>
                    <Icon className={`h-5 w-5 ${method.color}`} />
                  </div>
                  
                  <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{method.name}</span>
                      <Badge className="text-xs py-0 h-5 bg-yellow-400 text-yellow-900 hover:bg-yellow-400">
                        {method.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Jami: {formatPrice(method.total)} so'm
                    </p>
                  </Label>

                  <div className="text-right">
                    <span className="font-bold text-lg text-primary whitespace-nowrap">
                      {formatPrice(method.monthly)}
                    </span>
                    <p className="text-xs text-muted-foreground">so'm/oy</p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </RadioGroup>
  );
}
