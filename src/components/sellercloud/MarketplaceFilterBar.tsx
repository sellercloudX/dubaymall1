import React from 'react';
import { Button } from '@/components/ui/button';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';

interface MarketplaceFilterBarProps {
  connectedMarketplaces: string[];
  selectedMp: string;
  onSelect: (mp: string) => void;
  showAll?: boolean;
  allLabel?: string;
  allIcon?: string;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'WB',
  ozon: 'Ozon',
};

export const MarketplaceFilterBar = React.forwardRef<HTMLDivElement, MarketplaceFilterBarProps>(({
  connectedMarketplaces,
  selectedMp,
  onSelect,
  showAll = true,
  allLabel = 'Umumiy',
  allIcon = '📊',
}, ref) => {
  if (connectedMarketplaces.length <= 1 && !showAll) return null;

  return (
    <div ref={ref} className="flex gap-1.5 flex-wrap">
      {showAll && connectedMarketplaces.length > 1 && (
        <Button
          variant={selectedMp === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect('all')}
          className="h-7 text-[11px] px-2.5 rounded-full"
        >
          <span>{allIcon}</span> {allLabel}
        </Button>
      )}
      {connectedMarketplaces.map(mp => (
        <Button
          key={mp}
          variant={selectedMp === mp ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(mp)}
          className="h-7 text-[11px] px-2.5 rounded-full"
        >
          <MarketplaceLogo marketplace={mp} size={14} />
          <span>{MARKETPLACE_SHORT_NAMES[mp] || mp}</span>
        </Button>
      ))}
    </div>
  );
}
