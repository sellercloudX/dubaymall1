import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, ShoppingCart, User, LogOut, Menu, X, Shield, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function Navbar() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            <span className="text-lg md:text-xl font-bold text-foreground">{t.appName}</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.home}
            </Link>
            <Link to="/marketplace" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.marketplace}
            </Link>
            {user && (
              <>
                <Link to="/seller" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.myShop}
                </Link>
                <Link to="/blogger" className="text-muted-foreground hover:text-foreground transition-colors">
                  Blogger
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            
            {user && (
              <Link to="/favorites">
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
            )}
            
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </Badge>
                )}
              </Button>
            </Link>
            
            {user ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard" className="gap-2">
                    <User className="h-4 w-4" />
                    {t.dashboard}
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">{t.login}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth?mode=register">{t.register}</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile - Right side */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            <button
              className="p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in">
            <div className="flex flex-col gap-3">
              {user && (
                <>
                  <Link
                    to="/seller"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t.myShop}
                  </Link>
                  <Link
                    to="/blogger"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Blogger Panel
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield className="h-4 w-4" />
                      Admin Panel
                    </Link>
                  )}
                </>
              )}
              
              <div className="border-t pt-3 mt-2">
                {user ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                    className="w-full justify-start gap-2 text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.logout}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                        {t.login}
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to="/auth?mode=register" onClick={() => setMobileMenuOpen(false)}>
                        {t.register}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
