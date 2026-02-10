import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Handshake, ShoppingCart, Heart, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  requiresAuth?: boolean;
}

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { icon: Home, label: 'Marketplace', path: '/' },
    { icon: Heart, label: 'Sevimli', path: '/favorites', requiresAuth: true },
    { icon: ShoppingCart, label: 'Savat', path: '/cart', badge: totalItems },
    { icon: Handshake, label: 'Hamkorlik', path: '/partnership' },
    { icon: User, label: 'Profil', path: user ? '/dashboard' : '/auth' },
  ];

  const handleNavigation = (item: NavItem) => {
    if (item.requiresAuth && !user) {
      navigate('/auth');
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item)}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors min-h-[44px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[9px]"
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-[10px] leading-tight",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
