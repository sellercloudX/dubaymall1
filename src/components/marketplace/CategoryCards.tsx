import { Link } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Smartphone, 
  Shirt, 
  Home, 
  Car, 
  Baby,
  Dumbbell,
  BookOpen,
  Gift,
  Apple,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  'electronics': Smartphone,
  'clothing': Shirt,
  'home-garden': Home,
  'auto': Car,
  'kids': Baby,
  'sports': Dumbbell,
  'books': BookOpen,
  'gifts': Gift,
  'food': Apple,
  'beauty': Sparkles,
};

const colorMap: Record<string, string> = {
  'electronics': 'from-blue-500 to-indigo-500',
  'clothing': 'from-pink-500 to-rose-500',
  'home-garden': 'from-amber-500 to-orange-500',
  'auto': 'from-slate-600 to-slate-800',
  'kids': 'from-cyan-400 to-blue-400',
  'sports': 'from-green-500 to-emerald-500',
  'books': 'from-purple-500 to-violet-500',
  'gifts': 'from-red-500 to-pink-500',
  'food': 'from-yellow-500 to-orange-400',
  'beauty': 'from-fuchsia-500 to-pink-500',
};

export function CategoryCards() {
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <div className="mb-8 h-[212px] md:h-[152px]">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <Skeleton className="w-14 h-14 md:w-16 md:h-16 rounded-2xl" />
              <Skeleton className="mt-2 h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return <div className="mb-8 min-h-[212px] md:min-h-[152px]" />;
  }

  return (
    <div className="mb-8 min-h-[212px] md:min-h-[152px]">
      <h3 className="text-lg font-semibold mb-4">Kategoriyalar</h3>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-4">
        {categories.slice(0, 8).map((category) => {
          const Icon = iconMap[category.slug] || Sparkles;
          const gradient = colorMap[category.slug] || 'from-gray-500 to-gray-600';

          return (
            <Link
              key={category.id}
              to={`/marketplace?category=${category.id}`}
              className="group"
            >
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center",
                  "bg-gradient-to-br shadow-lg",
                  "group-hover:scale-105 group-hover:shadow-xl transition-all duration-300",
                  gradient
                )}>
                  <Icon className="h-6 w-6 md:h-7 md:w-7 text-white" />
                </div>
                <span className="mt-2 text-xs md:text-sm text-center text-foreground font-medium line-clamp-1">
                  {category.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
