import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Crown, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hide on landing page
  if (location.pathname === '/') return null;

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Crown, label: 'Dashboard', path: '/seller-cloud' },
    { icon: User, label: 'Profil', path: user ? '/seller-cloud' : '/auth' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden safe-area-bottom safe-area-left safe-area-right">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors min-h-[44px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px] leading-tight", active && "font-semibold")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}