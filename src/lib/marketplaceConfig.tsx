import uzumLogo from '@/assets/logos/uzum-market-new.png';
import wbLogo from '@/assets/logos/wildberries-new.jpg';
import ozonLogo from '@/assets/logos/ozon-new.png';
import magnitLogo from '@/assets/logos/magnit-new.png';

export interface MarketplaceInfo {
  name: string;
  logo: string;
  color: string;
}

export const MARKETPLACE_CONFIG: Record<string, MarketplaceInfo> = {
  yandex: { name: 'Yandex Market', logo: magnitLogo, color: 'from-yellow-500 to-amber-500' },
  uzum: { name: 'Uzum Market', logo: uzumLogo, color: 'from-purple-500 to-violet-500' },
  wildberries: { name: 'Wildberries', logo: wbLogo, color: 'from-fuchsia-500 to-pink-500' },
  ozon: { name: 'Ozon', logo: ozonLogo, color: 'from-blue-500 to-cyan-500' },
};

export const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

export function MarketplaceLogo({ marketplace, size = 20, className = '' }: { marketplace: string; size?: number; className?: string }) {
  const config = MARKETPLACE_CONFIG[marketplace];
  if (!config) return <span className={`inline-block ${className}`}>📦</span>;
  return (
    <img 
      src={config.logo} 
      alt={config.name} 
      width={size} 
      height={size} 
      className={`rounded object-cover ${className}`}
    />
  );
}
