 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 export interface BlogPost {
   id: string;
   title: string;
   slug: string;
   excerpt: string | null;
   content: string;
   featured_image: string | null;
   author_id: string;
   category: string;
   tags: string[];
   is_published: boolean;
   published_at: string | null;
   views_count: number;
   meta_title: string | null;
   meta_description: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export function useBlogPosts(onlyPublished = true) {
   const [posts, setPosts] = useState<BlogPost[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchPosts = async () => {
     try {
       setIsLoading(true);
       let query = supabase
         .from('blog_posts')
         .select('*')
         .order('published_at', { ascending: false, nullsFirst: false });
 
       if (onlyPublished) {
         query = query.eq('is_published', true);
       }
 
       const { data, error: fetchError } = await query;
 
       if (fetchError) throw fetchError;
       setPosts((data as BlogPost[]) || []);
       setError(null);
     } catch (err: any) {
       console.error('Error fetching blog posts:', err);
       setError(err.message);
     } finally {
       setIsLoading(false);
     }
   };
 
   useEffect(() => {
     fetchPosts();
   }, [onlyPublished]);
 
   return { posts, isLoading, error, refetch: fetchPosts };
 }
 
 export function useBlogPost(slug: string) {
   const [post, setPost] = useState<BlogPost | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   useEffect(() => {
     const fetchPost = async () => {
       if (!slug) return;
       
       try {
         setIsLoading(true);
         const { data, error: fetchError } = await supabase
           .from('blog_posts')
           .select('*')
           .eq('slug', slug)
           .single();
 
         if (fetchError) throw fetchError;
 
         setPost(data as BlogPost);
 
         // Increment view count
         if (data) {
           await supabase
             .from('blog_posts')
             .update({ views_count: (data.views_count || 0) + 1 })
             .eq('id', data.id);
         }
       } catch (err: any) {
         console.error('Error fetching blog post:', err);
         setError(err.message);
       } finally {
         setIsLoading(false);
       }
     };
 
     fetchPost();
   }, [slug]);
 
   return { post, isLoading, error };
 }
 
 export function useBlogManagement() {
   const { user } = useAuth();
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const createPost = async (postData: Partial<BlogPost>) => {
     if (!user) throw new Error('Not authenticated');
     
     setIsSubmitting(true);
     try {
       const slug = postData.title
         ?.toLowerCase()
         .replace(/[^a-z0-9\s-]/g, '')
         .replace(/\s+/g, '-')
         .slice(0, 100) || `post-${Date.now()}`;
 
       const { data, error } = await supabase
         .from('blog_posts')
         .insert({
          title: postData.title || '',
          content: postData.content || '',
          slug: slug,
          excerpt: postData.excerpt || null,
          featured_image: postData.featured_image || null,
          category: postData.category || 'general',
          tags: postData.tags || [],
          meta_title: postData.meta_title || null,
          meta_description: postData.meta_description || null,
          is_published: postData.is_published || false,
           author_id: user.id,
           published_at: postData.is_published ? new Date().toISOString() : null,
         })
         .select()
         .single();
 
       if (error) throw error;
       return data as BlogPost;
     } finally {
       setIsSubmitting(false);
     }
   };
 
   const updatePost = async (id: string, postData: Partial<BlogPost>) => {
     setIsSubmitting(true);
     try {
       const updateData: Partial<BlogPost> = { ...postData };
       
       // Set published_at if publishing for first time
       if (postData.is_published && !postData.published_at) {
         updateData.published_at = new Date().toISOString();
       }
 
       const { data, error } = await supabase
         .from('blog_posts')
         .update(updateData)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data as BlogPost;
     } finally {
       setIsSubmitting(false);
     }
   };
 
   const deletePost = async (id: string) => {
     const { error } = await supabase
       .from('blog_posts')
       .delete()
       .eq('id', id);
 
     if (error) throw error;
   };
 
   return { createPost, updatePost, deletePost, isSubmitting };
 }