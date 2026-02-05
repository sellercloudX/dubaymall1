 import { Suspense, lazy } from 'react';
 import { Link } from 'react-router-dom';
 import { Layout } from '@/components/Layout';
 import { SEOHead } from '@/components/SEOHead';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Skeleton } from '@/components/ui/skeleton';
 import { useBlogPosts } from '@/hooks/useBlogPosts';
 import { Calendar, Eye, ArrowRight, BookOpen } from 'lucide-react';
 import { format } from 'date-fns';
 
 const CATEGORIES = [
   { value: 'news', label: 'Yangiliklar' },
   { value: 'guides', label: "Qo'llanmalar" },
   { value: 'tips', label: 'Maslahatlar' },
   { value: 'updates', label: 'Yangilanishlar' },
   { value: 'general', label: 'Umumiy' },
 ];
 
 export default function Blog() {
   const { posts, isLoading } = useBlogPosts(true);
 
   return (
    <Layout>
      <SEOHead
        title="Blog - Dubay Mall"
        description="O'zbekiston e-tijorat haqida eng so'nggi yangiliklar, qo'llanmalar va maslahatlar. Onlayn savdo bo'yicha foydali maqolalar."
      />
 
       <div className="container mx-auto px-4 py-8">
         {/* Header */}
         <div className="text-center mb-12">
           <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
             <BookOpen className="h-10 w-10 text-primary" />
             Blog
           </h1>
           <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
             E-tijorat va onlayn savdo bo'yicha eng so'nggi yangiliklar, qo'llanmalar va foydali maslahatlar
           </p>
         </div>
 
         {/* Posts Grid */}
         {isLoading ? (
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3, 4, 5, 6].map(i => (
               <Card key={i}>
                 <Skeleton className="h-48 rounded-t-lg" />
                 <CardContent className="p-4 space-y-3">
                   <Skeleton className="h-4 w-20" />
                   <Skeleton className="h-6 w-full" />
                   <Skeleton className="h-4 w-full" />
                   <Skeleton className="h-4 w-3/4" />
                 </CardContent>
               </Card>
             ))}
           </div>
         ) : posts.length === 0 ? (
           <div className="text-center py-16">
             <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
             <h2 className="text-xl font-medium mb-2">Hali maqolalar yo'q</h2>
             <p className="text-muted-foreground">Tez orada yangi maqolalar qo'shiladi!</p>
           </div>
         ) : (
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
             {posts.map((post, index) => (
               <Link key={post.id} to={`/blog/${post.slug}`}>
                 <Card className={`h-full hover:shadow-lg transition-shadow group ${index === 0 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                   {post.featured_image ? (
                     <div className="aspect-video overflow-hidden rounded-t-lg">
                       <img
                         src={post.featured_image}
                         alt={post.title}
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                       />
                     </div>
                   ) : (
                     <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 rounded-t-lg flex items-center justify-center">
                       <BookOpen className="h-12 w-12 text-primary/50" />
                     </div>
                   )}
                   <CardContent className="p-4 space-y-3">
                     <div className="flex items-center gap-2">
                       <Badge variant="secondary">
                         {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                       </Badge>
                       <span className="text-xs text-muted-foreground flex items-center gap-1">
                         <Eye className="h-3 w-3" /> {post.views_count}
                       </span>
                     </div>
                     <h2 className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                       {post.title}
                     </h2>
                     {post.excerpt && (
                       <p className="text-sm text-muted-foreground line-clamp-2">
                         {post.excerpt}
                       </p>
                     )}
                     <div className="flex items-center justify-between pt-2 border-t">
                       <span className="text-xs text-muted-foreground flex items-center gap-1">
                         <Calendar className="h-3 w-3" />
                         {format(new Date(post.published_at || post.created_at), 'dd MMMM yyyy')}
                       </span>
                       <span className="text-primary text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                         O'qish <ArrowRight className="h-4 w-4" />
                       </span>
                     </div>
                   </CardContent>
                 </Card>
               </Link>
             ))}
           </div>
         )}
       </div>
     </Layout>
   );
 }