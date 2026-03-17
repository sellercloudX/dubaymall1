import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, GripVertical, Save, PlayCircle, Pencil, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

export function TutorialVideosAdmin() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', youtube_url: '', category: 'general' });

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['admin-tutorial-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_videos')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as TutorialVideo[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (video: typeof form) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tutorial_videos').insert({
        title: video.title,
        description: video.description || null,
        youtube_url: video.youtube_url,
        category: video.category || 'general',
        sort_order: videos.length,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-videos'] });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      setShowAdd(false);
      setForm({ title: '', description: '', youtube_url: '', category: 'general' });
      toast.success('Video qo\'shildi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutorialVideo> & { id: string }) => {
      const { error } = await supabase.from('tutorial_videos').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-videos'] });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      setEditingId(null);
      toast.success('Yangilandi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-videos'] });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      toast.success('O\'chirildi');
    },
  });

  const handleAdd = () => {
    if (!form.title.trim() || !form.youtube_url.trim()) {
      toast.error('Sarlavha va YouTube URL kiriting');
      return;
    }
    if (!extractYouTubeId(form.youtube_url)) {
      toast.error('Noto\'g\'ri YouTube URL');
      return;
    }
    addMutation.mutate(form);
  };

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Qo'llanma videolar</h2>
          <p className="text-sm text-muted-foreground">{videos.length} ta video</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <><X className="h-4 w-4 mr-1.5" />Bekor</> : <><Plus className="h-4 w-4 mr-1.5" />Yangi video</>}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Video sarlavhasi *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="YouTube URL *" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} />
            <Textarea placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <Input placeholder="Kategoriya (masalan: boshlash, narxlar)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
                <Save className="h-4 w-4 mr-1.5" />Saqlash
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {videos.map(video => {
          const ytId = extractYouTubeId(video.youtube_url);
          return (
            <Card key={video.id} className="overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                {/* Thumbnail */}
                <div className="w-28 sm:w-36 shrink-0 rounded-lg overflow-hidden bg-muted aspect-video relative">
                  {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
                  <PlayCircle className="absolute inset-0 m-auto h-6 w-6 text-white/80" />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{video.title}</h4>
                  {video.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{video.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[10px]">{video.category || 'general'}</Badge>
                    <span className="text-[10px] text-muted-foreground">#{video.sort_order + 1}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{video.is_published ? 'Faol' : 'Yashirin'}</span>
                    <Switch
                      checked={video.is_published}
                      onCheckedChange={checked => updateMutation.mutate({ id: video.id, is_published: checked })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Videoni o\'chirmoqchimisiz?')) deleteMutation.mutate(video.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
