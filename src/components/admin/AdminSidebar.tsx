import { cn } from '@/lib/utils';
import {
  TrendingUp, BarChart3, UsersRound, Users, UserCheck,
  Wallet, Zap, Settings, Bot, MessageCircle, Shield,
  LayoutDashboard, ChevronLeft, ChevronRight, Crown,
  LogOut, Sun, Moon, DollarSign, BookOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/contexts/ThemeContext';

export interface AdminMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  superAdminOnly?: boolean;
  group: 'main' | 'management' | 'finance' | 'system';
}

export const adminMenuItems: AdminMenuItem[] = [
  { id: 'metrics', label: 'Dashboard', icon: LayoutDashboard, permission: 'can_manage_finances', group: 'main' },
  { id: 'analytics', label: 'Analitika', icon: BarChart3, permission: 'can_manage_finances', group: 'main' },
  { id: 'partners', label: 'Hamkorlar', icon: UsersRound, permission: 'can_manage_finances', group: 'main' },
  { id: 'users', label: 'Foydalanuvchilar', icon: Users, permission: 'can_manage_users', group: 'management' },
  { id: 'activations', label: 'Aktivatsiya', icon: UserCheck, permission: 'can_manage_activations', group: 'management' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, permission: 'can_manage_users', group: 'management' },
  { id: 'finance', label: 'Daromad', icon: Wallet, permission: 'can_manage_finances', group: 'finance' },
  { id: 'sellercloud', label: 'SellerCloudX', icon: Crown, permission: 'can_manage_finances', group: 'finance' },
  { id: 'pricing', label: 'Narxlar & Balans', icon: DollarSign, permission: 'can_manage_finances', group: 'finance' },
  { id: 'expenses', label: 'Xarajatlar', icon: Zap, permission: 'can_manage_finances', group: 'finance' },
  { id: 'tutorials', label: 'Qo\'llanmalar', icon: BookOpen, permission: 'can_manage_content', group: 'management' },
  { id: 'admins', label: 'Adminlar', icon: Settings, superAdminOnly: true, group: 'system' },
  { id: 'ai-agent', label: 'AI Agent', icon: Bot, superAdminOnly: true, group: 'system' },
];

const groupLabels: Record<string, string> = {
  main: 'Asosiy',
  management: 'Boshqaruv',
  finance: 'Moliya',
  system: 'Tizim',
};

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasPermission: (perm: string) => boolean;
  isSuperAdmin: boolean;
}

export function AdminSidebar({ activeTab, onTabChange, hasPermission, isSuperAdmin }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const visibleItems = adminMenuItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  const groups = ['main', 'management', 'finance', 'system'].filter(group =>
    visibleItems.some(item => item.group === group)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header with collapse button */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-16 border-b border-border shrink-0",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
          <Shield className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold truncate text-foreground">Admin Panel</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </p>
          </div>
        )}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {collapsed ? 'Kengaytirish' : 'Yig\'ish'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {groups.map((group, gi) => {
          const groupItems = visibleItems.filter(item => item.group === group);
          return (
            <div key={group}>
              {gi > 0 && <Separator className="my-3" />}
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabels[group]}
                </p>
              )}
              {groupItems.map(item => {
                const isActive = activeTab === item.id;
                const btn = (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary-foreground")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.id} delayDuration={0}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return btn;
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        {/* Dark mode toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
              )}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
              {!collapsed && <span>{resolvedTheme === 'dark' ? 'Yorug\' rejim' : 'Qorong\'i rejim'}</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">{resolvedTheme === 'dark' ? 'Yorug\' rejim' : 'Qorong\'i rejim'}</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={handleSignOut}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Chiqish</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">Chiqish</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
