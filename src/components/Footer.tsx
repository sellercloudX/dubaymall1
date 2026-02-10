import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShoppingBag, Mail, Phone, MapPin, Globe, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-card hidden md:block">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <ShoppingBag className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold">{t.appName}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O'zbekistonning eng yirik onlayn savdo platformasi. Minglab mahsulotlar, ishonchli sotuvchilar.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild>
                <a href="https://t.me/dubaymall" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <Send className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild>
                <a href="https://instagram.com/dubaymall" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Globe className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Xaridorlar uchun */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Xaridorlar uchun</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Marketplace
              </Link>
              <Link to="/cart" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Savatcha
              </Link>
              <Link to="/favorites" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Sevimlilar
              </Link>
              <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Blog
              </Link>
            </nav>
          </div>

          {/* Sotuvchilar uchun */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Sotuvchilar uchun</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/partnership" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Hamkorlik
              </Link>
              <Link to="/seller-activation" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Sotuvchi bo'lish
              </Link>
              <Link to="/blogger-activation" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Blogger bo'lish
              </Link>
              <Link to="/seller-cloud" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                SellerCloudX
              </Link>
            </nav>
          </div>

          {/* Aloqa */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Aloqa</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>+998 90 123 45 67</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span>info@dubaymall.uz</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span>Toshkent, O'zbekiston</span>
              </div>
            </div>

            {/* Newsletter */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Yangiliklar uchun obuna bo'ling</p>
              <div className="flex gap-2">
                <Input placeholder="Email" className="h-9 text-sm" type="email" />
                <Button size="sm" className="h-9 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t.appName}. {t.allRightsReserved}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Payme</span>
            <span>Click</span>
            <span>Uzcard</span>
            <span>Humo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
