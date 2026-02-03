import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Smartphone, Building2 } from 'lucide-react';

interface PaymentMethodsProps {
  value: string;
  onChange: (value: string) => void;
}

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

export function PaymentMethods({ value, onChange }: PaymentMethodsProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    </RadioGroup>
  );
}
