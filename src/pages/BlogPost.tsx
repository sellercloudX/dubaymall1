 import { useParams, Link } from 'react-router-dom';
 import { Layout } from '@/components/Layout';
 import { SEOHead } from '@/components/SEOHead';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Skeleton } from '@/components/ui/skeleton';
 import { useBlogPost } from '@/hooks/useBlogPosts';
 import { Calendar, Eye, ArrowLeft, Share2, BookOpen, Tag } from 'lucide-react';
 import { format } from 'date-fns';
 import ReactMarkdown from 'react-markdown';
 import { toast } from 'sonner';
 
 const CATEGORIES = [
   { value: 'news', label: 'Yangiliklar' },
   { value: 'guides', label: "Qo'llanmalar" },
   { value: 'tips', label: 'Maslahatlar' },
   { value: 'updates', label: 'Yangilanishlar' },
   { value: 'general', label: 'Umumiy' },
 ];
 
 export default function BlogPost() {
   const { slug } = useParams<{ slug: string }>();
   const { post, isLoading, error } = useBlogPost(slug || '');
 
   const handleShare = async () => {
     const url = window.location.href;
     if (navigator.share) {
       try {
         await navigator.share({
           title: post?.title,
           text: post?.excerpt || post?.title,
           url,
         });
       } catch (e) {
         // User cancelled
       }
     } else {
       await navigator.clipboard.writeText(url);
       toast.success('Havola nusxalandi!');
     }
   };
 
   if (isLoading) {
     return (
       <Layout>
         <div className="container mx-auto px-4 py-8 max-w-4xl">
           <Skeleton className="h-8 w-32 mb-4" />
           <Skeleton className="h-12 w-full mb-4" />
           <Skeleton className="h-6 w-48 mb-8" />
           <Skeleton className="h-64 w-full rounded-lg mb-8" />
           <div className="space-y-4">
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-3/4" />
           </div>
         </div>
       </Layout>
     );
   }
 
   if (error || !post) {
     return (
       <Layout>
         <SEOHead title="Maqola topilmadi - Blog" />
         <div className="container mx-auto px-4 py-16 text-center">
           <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
           <h1 className="text-2xl font-bold mb-2">Maqola topilmadi</h1>
           <p className="text-muted-foreground mb-6">
             Bu maqola mavjud emas yoki o'chirilgan bo'lishi mumkin.
           </p>
           <Button asChild>
             <Link to="/blog">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Blogga qaytish
             </Link>
           </Button>
         </div>
       </Layout>
     );
   }
 
   return (
     <Layout>
       <SEOHead
         title={post.meta_title || `${post.title} - Blog`}
         description={post.meta_description || post.excerpt || post.content.slice(0, 160)}
         image={post.featured_image || undefined}
         type="article"
       />
 
       <article className="container mx-auto px-4 py-8 max-w-4xl">
         {/* Back Link */}
         <Link
           to="/blog"
           className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
         >
           <ArrowLeft className="h-4 w-4" />
           Barcha maqolalar
         </Link>
 
         {/* Header */}
         <header className="mb-8">
           <div className="flex items-center gap-2 mb-4">
             <Badge variant="secondary">
               {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
             </Badge>
           </div>
 
           <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
 
           {post.excerpt && (
             <p className="text-xl text-muted-foreground mb-4">{post.excerpt}</p>
           )}
 
           <div className="flex items-center gap-4 text-sm text-muted-foreground">
             <span className="flex items-center gap-1">
               <Calendar className="h-4 w-4" />
               {format(new Date(post.published_at || post.created_at), 'dd MMMM yyyy')}
             </span>
             <span className="flex items-center gap-1">
               <Eye className="h-4 w-4" />
               {post.views_count} ko'rish
             </span>
             <Button variant="ghost" size="sm" onClick={handleShare}>
               <Share2 className="h-4 w-4 mr-1" />
               Ulashish
             </Button>
           </div>
         </header>
 
         {/* Featured Image */}
         {post.featured_image && (
           <div className="mb-8 rounded-lg overflow-hidden">
             <img
               src={post.featured_image}
               alt={post.title}
               className="w-full h-auto object-cover"
             />
           </div>
         )}
 
         {/* Content */}
         <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
           <ReactMarkdown>{post.content}</ReactMarkdown>
         </div>
 
         {/* Tags */}
         {post.tags && post.tags.length > 0 && (
           <div className="border-t pt-6">
             <div className="flex items-center gap-2 flex-wrap">
               <Tag className="h-4 w-4 text-muted-foreground" />
               {post.tags.map((tag) => (
                 <Badge key={tag} variant="outline">
                   {tag}
                 </Badge>
               ))}
             </div>
           </div>
         )}
 
         {/* Back to Blog */}
         <div className="border-t mt-8 pt-8 text-center">
           <Button variant="outline" asChild>
             <Link to="/blog">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Boshqa maqolalar
             </Link>
           </Button>
         </div>
       </article>
     </Layout>
   );
 }