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
  ChefHat,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  'elektronika': Smartphone,
  'kiyim': Shirt,
  'uy-jihozlari': Home,
  'avtomobil': Car,
  'bolalar': Baby,
  'sport': Dumbbell,
  'kitoblar': BookOpen,
  'sovgalar': Gift,
  'oshxona': ChefHat,
};

const colorMap: Record<string, string> = {
  'elektronika': 'from-blue-500 to-indigo-500',
  'kiyim': 'from-pink-500 to-rose-500',
  'uy-jihozlari': 'from-amber-500 to-orange-500',
  'avtomobil': 'from-slate-600 to-slate-800',
  'bolalar': 'from-cyan-400 to-blue-400',
  'sport': 'from-green-500 to-emerald-500',
  'kitoblar': 'from-purple-500 to-violet-500',
  'sovgalar': 'from-red-500 to-pink-500',
  'oshxona': 'from-yellow-500 to-orange-400',
};

export function CategoryCards() {
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="mb-8">
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
