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

export function MarketplaceFilterBar({
  connectedMarketplaces,
  selectedMp,
  onSelect,
  showAll = true,
  allLabel = 'Umumiy',
  allIcon = '📊',
}: MarketplaceFilterBarProps) {
  if (connectedMarketplaces.length <= 1 && !showAll) return null;

  return (
    <div className="flex gap-1.5 md:gap-2 flex-wrap">
      {showAll && connectedMarketplaces.length > 1 && (
        <Button
          variant={selectedMp === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect('all')}
          className="h-7 text-[11px] px-2.5 rounded-full md:h-9 md:text-sm md:px-4 md:gap-1.5"
        >
          <span className="md:mr-0.5">{allIcon}</span> {allLabel}
        </Button>
      )}
      {connectedMarketplaces.map(mp => (
        <Button
          key={mp}
          variant={selectedMp === mp ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(mp)}
          className="h-7 text-[11px] px-2.5 rounded-full md:h-9 md:text-sm md:px-4 md:gap-1.5"
        >
          <MarketplaceLogo marketplace={mp} size={14} className="md:w-[18px] md:h-[18px]" />
          <span>{MARKETPLACE_SHORT_NAMES[mp] || mp}</span>
        </Button>
      ))}
    </div>
  );
}
