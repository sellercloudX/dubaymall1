import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { Button } from '@/components/ui/button';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Crown, User, LogOut, Menu, X, Shield } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show this navbar on landing page (it has its own nav)
  if (location.pathname === '/') return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-foreground font-display">SellerCloudX</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/seller-cloud" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Crown className="h-4 w-4" />
              Dashboard
            </Link>
            {!rolesLoading && isAdmin && user && (
              <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            {user && <NotificationsDropdown />}
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Chiqish">
                <LogOut className="h-4 w-4" />
              </Button>
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

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button className="p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-3 border-b">
                <ThemeToggle />
                <LanguageSwitcher />
                {user && <NotificationsDropdown />}
              </div>
              <Link to="/seller-cloud" className="text-sm py-2 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Crown className="h-4 w-4" /> Dashboard
              </Link>
              {!rolesLoading && isAdmin && user && (
                <Link to="/admin" className="text-sm py-2 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              <div className="border-t pt-3 mt-2">
                {user ? (
                  <Button variant="ghost" size="sm" onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="justify-start gap-2 text-destructive">
                    <LogOut className="h-4 w-4" /> {t.logout}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>{t.login}</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to="/auth?mode=register" onClick={() => setMobileMenuOpen(false)}>{t.register}</Link>
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