import { useLanguage } from '@/contexts/LanguageContext';
import { ShoppingBag } from 'lucide-react';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <span className="font-semibold">{t.appName}</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t.appName}. {t.allRightsReserved}
          </p>
        </div>
      </div>
    </footer>
  );
}
