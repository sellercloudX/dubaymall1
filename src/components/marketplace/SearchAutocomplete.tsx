import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Clock, TrendingUp, Package, ArrowRight, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type ProductSuggestion = Pick<Tables<'products'>, 'id' | 'name' | 'price' | 'images'>;

interface SearchAutocompleteProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({ onSearch, placeholder, className }: SearchAutocompleteProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Popular search terms (could be fetched from analytics)
  const popularSearches = ['Telefon', 'Ko\'ylak', 'Ayollar sumkasi', 'Sport kiyim', 'Kosmetika'];

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // Click outside to close
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, images')
        .eq('status', 'active')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (!error && data) {
        setSuggestions(data);
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const saveRecentSearch = (searchTerm: string) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    saveRecentSearch(searchTerm);
    setIsOpen(false);
    setQuery('');
    if (onSearch) {
      onSearch(searchTerm);
    } else {
      navigate(`/?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleProductClick = (product: ProductSuggestion) => {
    saveRecentSearch(product.name);
    setIsOpen(false);
    setQuery('');
    navigate(`/product/${product.id}`);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder || t.search + '...'}
          className="pl-10 pr-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
            }
          }}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-[400px]">
            {/* Product suggestions */}
            {query.length >= 2 && suggestions.length > 0 && (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 py-1">Mahsulotlar</p>
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    className="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-md transition-colors text-left"
                    onClick={() => handleProductClick(product)}
                  >
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                      {product.images && product.images[0] ? (
                        <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-primary">{formatPrice(product.price)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Search for query */}
            {query.length >= 2 && (
              <button
                className="w-full flex items-center gap-2 p-3 hover:bg-accent text-left border-t"
                onClick={() => handleSearch(query)}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  "<span className="font-medium">{query}</span>" ni qidirish
                </span>
              </button>
            )}

            {/* Recent searches */}
            {query.length < 2 && recentSearches.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Yaqinda qidirilgan
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={clearRecentSearches}
                  >
                    Tozalash
                  </Button>
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left"
                    onClick={() => handleSearch(search)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{search}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Popular searches */}
            {query.length < 2 && (
              <div className="p-2 border-t">
                <p className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Mashhur qidiruvlar
                </p>
                <div className="flex flex-wrap gap-2 p-2">
                  {popularSearches.map((search, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleSearch(search)}
                    >
                      {search}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && query.length >= 2 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Qidirilmoqda...
              </div>
            )}

            {/* No results */}
            {!loading && query.length >= 2 && suggestions.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Mahsulot topilmadi
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
