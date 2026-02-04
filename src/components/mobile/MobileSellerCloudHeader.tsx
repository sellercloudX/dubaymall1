import { Globe, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface MobileSellerCloudHeaderProps {
  connectedCount: number;
  onRefresh: () => void;
  isLoading: boolean;
}

export function MobileSellerCloudHeader({ connectedCount, onRefresh, isLoading }: MobileSellerCloudHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-b safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">SellerCloudX</h1>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {connectedCount} marketplace
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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
