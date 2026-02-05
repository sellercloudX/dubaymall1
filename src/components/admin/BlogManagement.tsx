 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Switch } from '@/components/ui/switch';
 import { Label } from '@/components/ui/label';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
 import { Plus, Edit, Trash2, Eye, Calendar, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
 import { useBlogPosts, useBlogManagement, BlogPost } from '@/hooks/useBlogPosts';
 import { toast } from 'sonner';
 import { format } from 'date-fns';
 
 const CATEGORIES = [
   { value: 'news', label: 'Yangiliklar' },
   { value: 'guides', label: "Qo'llanmalar" },
   { value: 'tips', label: 'Maslahatlar' },
   { value: 'updates', label: 'Yangilanishlar' },
   { value: 'general', label: 'Umumiy' },
 ];
 
 export function BlogManagement() {
   const { posts, isLoading, refetch } = useBlogPosts(false);
   const { createPost, updatePost, deletePost, isSubmitting } = useBlogManagement();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
   const [formData, setFormData] = useState({
     title: '',
     excerpt: '',
     content: '',
     featured_image: '',
     category: 'general',
     tags: '',
     meta_title: '',
     meta_description: '',
     is_published: false,
   });
 
   const resetForm = () => {
     setFormData({
       title: '',
       excerpt: '',
       content: '',
       featured_image: '',
       category: 'general',
       tags: '',
       meta_title: '',
       meta_description: '',
       is_published: false,
     });
     setEditingPost(null);
   };
 
   const openEditDialog = (post: BlogPost) => {
     setEditingPost(post);
     setFormData({
       title: post.title,
       excerpt: post.excerpt || '',
       content: post.content,
       featured_image: post.featured_image || '',
       category: post.category,
       tags: post.tags?.join(', ') || '',
       meta_title: post.meta_title || '',
       meta_description: post.meta_description || '',
       is_published: post.is_published,
     });
     setIsDialogOpen(true);
   };
 
   const handleSubmit = async () => {
     if (!formData.title || !formData.content) {
       toast.error('Sarlavha va kontent majburiy');
       return;
     }
 
     try {
       const postData = {
         title: formData.title,
         excerpt: formData.excerpt || null,
         content: formData.content,
         featured_image: formData.featured_image || null,
         category: formData.category,
         tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
         meta_title: formData.meta_title || null,
         meta_description: formData.meta_description || null,
         is_published: formData.is_published,
       };
 
       if (editingPost) {
         await updatePost(editingPost.id, postData);
         toast.success('Maqola yangilandi');
       } else {
         await createPost(postData);
         toast.success('Maqola yaratildi');
       }
 
       setIsDialogOpen(false);
       resetForm();
       refetch();
     } catch (error: any) {
       toast.error(error.message || 'Xatolik yuz berdi');
     }
   };
 
   const handleDelete = async (id: string) => {
     if (!confirm("Maqolani o'chirishni tasdiqlaysizmi?")) return;
     
     try {
       await deletePost(id);
       toast.success("Maqola o'chirildi");
       refetch();
     } catch (error: any) {
       toast.error(error.message);
     }
   };
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
             <FileText className="h-6 w-6" />
             Blog boshqaruvi
           </h2>
           <p className="text-muted-foreground">SEO uchun maqolalar va yangiliklar</p>
         </div>
         <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
           <DialogTrigger asChild>
              <Button size="sm">
               <Plus className="h-4 w-4 mr-2" />
               Yangi maqola
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
             <DialogHeader>
               <DialogTitle>{editingPost ? 'Maqolani tahrirlash' : 'Yangi maqola'}</DialogTitle>
             </DialogHeader>
             <div className="space-y-4 py-4">
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Sarlavha *</Label>
                   <Input
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                     placeholder="Maqola sarlavhasi"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Kategoriya</Label>
                   <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       {CATEGORIES.map(cat => (
                         <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label>Qisqa tavsif (excerpt)</Label>
                 <Textarea
                   value={formData.excerpt}
                   onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                   placeholder="Qidiruv natijalarida ko'rinadigan qisqa tavsif"
                   rows={2}
                 />
               </div>
 
               <div className="space-y-2">
                 <Label>Kontent *</Label>
                 <Textarea
                   value={formData.content}
                   onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                   placeholder="Maqola matni (Markdown qo'llab-quvvatlanadi)"
                   rows={10}
                   className="font-mono text-sm"
                 />
               </div>
 
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Rasm URL</Label>
                   <Input
                     value={formData.featured_image}
                     onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                     placeholder="https://..."
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Teglar (vergul bilan)</Label>
                   <Input
                     value={formData.tags}
                     onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                     placeholder="seo, marketing, tips"
                   />
                 </div>
               </div>
 
               {/* SEO Fields */}
               <div className="border-t pt-4 space-y-4">
                 <h4 className="font-medium text-sm text-muted-foreground">SEO sozlamalari</h4>
                 <div className="space-y-2">
                   <Label>Meta Title</Label>
                   <Input
                     value={formData.meta_title}
                     onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                     placeholder="Qidiruv uchun maxsus sarlavha"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Meta Description</Label>
                   <Textarea
                     value={formData.meta_description}
                     onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                     placeholder="Qidiruv natijalari uchun tavsif (160 belgi)"
                     rows={2}
                   />
                 </div>
               </div>
 
               <div className="flex items-center justify-between border-t pt-4">
                 <div className="flex items-center gap-2">
                   <Switch
                     checked={formData.is_published}
                     onCheckedChange={(v) => setFormData({ ...formData, is_published: v })}
                   />
                   <Label>Nashr qilish</Label>
                 </div>
                 <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                     Bekor qilish
                   </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                     {isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
                   </Button>
                 </div>
               </div>
             </div>
           </DialogContent>
         </Dialog>
       </div>
 
       {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
         <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{posts.length}</p>
             <p className="text-sm text-muted-foreground">Jami maqolalar</p>
           </CardContent>
         </Card>
         <Card>
            <CardContent className="p-3 text-center">
             <p className="text-2xl font-bold text-primary">{posts.filter(p => p.is_published).length}</p>
             <p className="text-sm text-muted-foreground">Nashr qilingan</p>
           </CardContent>
         </Card>
         <Card>
            <CardContent className="p-3 text-center">
             <p className="text-2xl font-bold text-foreground">{posts.reduce((sum, p) => sum + p.views_count, 0)}</p>
             <p className="text-sm text-muted-foreground">Jami ko'rishlar</p>
           </CardContent>
         </Card>
       </div>
 
       {/* Posts Table */}
       <Card>
         <CardContent className="p-0">
            <ScrollArea className="w-full">
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Sarlavha</TableHead>
                 <TableHead>Kategoriya</TableHead>
                 <TableHead>Holat</TableHead>
                 <TableHead>Ko'rishlar</TableHead>
                 <TableHead>Sana</TableHead>
                 <TableHead className="text-right">Amallar</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {isLoading ? (
                 <TableRow>
                   <TableCell colSpan={6} className="text-center py-8">Yuklanmoqda...</TableCell>
                 </TableRow>
               ) : posts.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                     Hali maqolalar yo'q. Yangi maqola qo'shing!
                   </TableCell>
                 </TableRow>
               ) : (
                 posts.map((post) => (
                   <TableRow key={post.id}>
                     <TableCell>
                       <div className="flex items-center gap-3">
                         {post.featured_image ? (
                           <img src={post.featured_image} alt="" className="w-10 h-10 rounded object-cover" />
                         ) : (
                           <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                             <ImageIcon className="h-5 w-5 text-muted-foreground" />
                           </div>
                         )}
                         <div>
                           <p className="font-medium line-clamp-1">{post.title}</p>
                           <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
                         </div>
                       </div>
                     </TableCell>
                     <TableCell>
                        <Badge variant="secondary" className="text-xs">
                         {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       {post.is_published ? (
                         <Badge className="bg-primary/10 text-primary text-xs">Nashr</Badge>
                       ) : (
                          <Badge variant="outline" className="text-xs">Qoralama</Badge>
                       )}
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-1">
                         <Eye className="h-4 w-4 text-muted-foreground" />
                         {post.views_count}
                       </div>
                     </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                         <Calendar className="h-4 w-4" />
                         {format(new Date(post.created_at), 'dd.MM.yyyy')}
                       </div>
                     </TableCell>
                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1">
                         {post.is_published && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                             <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                               <ExternalLink className="h-4 w-4" />
                             </a>
                           </Button>
                         )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(post)}>
                           <Edit className="h-4 w-4" />
                         </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(post.id)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))
               )}
             </TableBody>
           </Table>
            <ScrollBar orientation="horizontal" />
            </ScrollArea>
         </CardContent>
       </Card>
     </div>
   );
 }