import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ProductVariant } from '@/hooks/useProductVariants';

interface VariantSelectorProps {
  variantsByType: Record<string, ProductVariant[]>;
  onVariantChange: (selectedVariants: Record<string, ProductVariant | null>) => void;
  onImageChange?: (imageUrl: string | null) => void;
}

export function VariantSelector({ 
  variantsByType, 
  onVariantChange,
  onImageChange 
}: VariantSelectorProps) {
  const [selected, setSelected] = useState<Record<string, ProductVariant | null>>({});

  // Initialize with first variant of each type
  useEffect(() => {
    const initial: Record<string, ProductVariant | null> = {};
    Object.entries(variantsByType).forEach(([type, variants]) => {
      if (variants.length > 0) {
        initial[type] = variants[0];
      }
    });
    setSelected(initial);
    onVariantChange(initial);
    
    // Set initial image from color variant if exists
    if (initial.color?.image_url) {
      onImageChange?.(initial.color.image_url);
    }
  }, [variantsByType]);

  const handleSelect = (type: string, variant: ProductVariant) => {
    const newSelected = { ...selected, [type]: variant };
    setSelected(newSelected);
    onVariantChange(newSelected);
    
    // Only change image for color variants
    if (type === 'color' && variant.image_url) {
      onImageChange?.(variant.image_url);
    }
  };

  const typeLabels: Record<string, string> = {
    size: 'O\'lcham',
    color: 'Rang',
    model: 'Model'
  };

  if (Object.keys(variantsByType).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Color variants - show as color swatches */}
      {variantsByType.color && variantsByType.color.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{typeLabels.color}</span>
            {selected.color && (
              <span className="text-sm text-muted-foreground">
                {selected.color.variant_label || selected.color.variant_value}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {variantsByType.color.map((variant) => (
              <button
                key={variant.id}
                onClick={() => handleSelect('color', variant)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all relative",
                  selected.color?.id === variant.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                )}
                style={{ backgroundColor: variant.hex_color || '#ccc' }}
                title={variant.variant_label || variant.variant_value}
              >
                {selected.color?.id === variant.id && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      "w-3 h-3 rounded-full",
                      isLightColor(variant.hex_color) ? "bg-foreground" : "bg-white"
                    )} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size variants - show as buttons */}
      {variantsByType.size && variantsByType.size.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{typeLabels.size}</span>
          <div className="flex flex-wrap gap-2">
            {variantsByType.size.map((variant) => (
              <button
                key={variant.id}
                onClick={() => handleSelect('size', variant)}
                disabled={variant.stock_quantity === 0}
                className={cn(
                  "min-w-[48px] h-10 px-3 rounded-lg border text-sm font-medium transition-all",
                  selected.size?.id === variant.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : variant.stock_quantity === 0
                    ? "bg-muted text-muted-foreground border-muted cursor-not-allowed line-through"
                    : "bg-background text-foreground border-border hover:border-primary"
                )}
              >
                {variant.variant_label || variant.variant_value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model variants - show as buttons */}
      {variantsByType.model && variantsByType.model.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{typeLabels.model}</span>
          <div className="flex flex-wrap gap-2">
            {variantsByType.model.map((variant) => (
              <button
                key={variant.id}
                onClick={() => handleSelect('model', variant)}
                disabled={variant.stock_quantity === 0}
                className={cn(
                  "min-w-[60px] h-10 px-4 rounded-lg border text-sm font-medium transition-all",
                  selected.model?.id === variant.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : variant.stock_quantity === 0
                    ? "bg-muted text-muted-foreground border-muted cursor-not-allowed"
                    : "bg-background text-foreground border-border hover:border-primary"
                )}
              >
                {variant.variant_label || variant.variant_value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to determine if a color is light
function isLightColor(hex: string | null): boolean {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}
