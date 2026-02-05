import { Globe, RefreshCw, Settings, Home, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Store, Users, ShoppingBag, FileText } from 'lucide-react';

interface MobileSellerCloudHeaderProps {
  connectedCount: number;
  onRefresh: () => void;
  isLoading: boolean;
}

export function MobileSellerCloudHeader({ connectedCount, onRefresh, isLoading }: MobileSellerCloudHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-b safe-area-top">
      <div className="flex items-center justify-between h-14 px-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Bozor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/partnership')}>
                <Users className="h-4 w-4 mr-2" />
                Hamkorlik
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/seller')}>
                <Store className="h-4 w-4 mr-2" />
                BazarHub Do'koni
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/blogger')}>
                <FileText className="h-4 w-4 mr-2" />
                Blogger Kabineti
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Shaxsiy Kabinet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight truncate">SellerCloudX</h1>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                {connectedCount} marketplace
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/seller-cloud')}
            className="h-9 w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
