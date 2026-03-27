import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, PlayCircle, X, Youtube, Instagram, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  content_url: string;
  embed_url: string | null;
  video_type: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  is_free: boolean;
  created_at: string;
}

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

const platformIcons: Record<string, any> = { youtube: Youtube, instagram: Instagram, telegram: Send };

export function TutorialVideosAdmin() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', content_url: '', embed_url: '',
    category: 'general', video_type: 'youtube', is_free: false,
  });

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tutorial-videos'] });
    queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
  };

  const addMutation = useMutation({
    mutationFn: async (video: typeof form) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tutorial_videos').insert({
        title: video.title,
        description: video.description || null,
        content_url: video.content_url,
        embed_url: video.embed_url || null,
        video_type: video.video_type,
        category: video.category || 'general',
        is_free: video.is_free,
        sort_order: videos.length,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowAdd(false);
      setForm({ title: '', description: '', content_url: '', embed_url: '', category: 'general', video_type: 'youtube', is_free: false });
      toast.success('Video qo\'shildi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutorialVideo> & { id: string }) => {
      const { error } = await supabase.from('tutorial_videos').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Yangilandi'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('O\'chirildi'); },
  });

  const moveVideo = (id: string, direction: 'up' | 'down') => {
    const idx = videos.findIndex(v => v.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= videos.length) return;
    updateMutation.mutate({ id: videos[idx].id, sort_order: videos[swapIdx].sort_order });
    updateMutation.mutate({ id: videos[swapIdx].id, sort_order: videos[idx].sort_order });
  };

  const handleAdd = () => {
    if (!form.title.trim() || !form.content_url.trim()) {
      toast.error('Sarlavha va URL kiriting');
      return;
    }
    if (form.video_type === 'youtube' && !extractYouTubeId(form.content_url)) {
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
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.video_type} onValueChange={v => setForm(f => ({ ...f, video_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Kategoriya" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
            <Input
              placeholder={form.video_type === 'youtube' ? 'YouTube URL *' : form.video_type === 'instagram' ? 'Instagram post URL *' : 'Telegram post URL *'}
              value={form.content_url}
              onChange={e => setForm(f => ({ ...f, content_url: e.target.value }))}
            />
            {form.video_type !== 'youtube' && (
              <Input placeholder="Embed URL (ixtiyoriy)" value={form.embed_url} onChange={e => setForm(f => ({ ...f, embed_url: e.target.value }))} />
            )}
            <Textarea placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_free} onCheckedChange={v => setForm(f => ({ ...f, is_free: v }))} />
                <span className="text-sm">Bepul (hamma ko'rsin)</span>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
                <Save className="h-4 w-4 mr-1.5" />Saqlash
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {videos.map((video, idx) => {
          const ytId = video.video_type === 'youtube' ? extractYouTubeId(video.content_url) : null;
          const Icon = platformIcons[video.video_type] || PlayCircle;
          return (
            <Card key={video.id} className="overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                <div className="w-28 sm:w-36 shrink-0 rounded-lg overflow-hidden bg-muted aspect-video relative">
                  {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
                  {!ytId && <div className="w-full h-full flex items-center justify-center"><Icon className="h-6 w-6 text-muted-foreground/50" /></div>}
                  <PlayCircle className="absolute inset-0 m-auto h-6 w-6 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{video.title}</h4>
                  {video.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{video.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{video.category || 'general'}</Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Icon className="h-3 w-3" />{video.video_type}
                    </Badge>
                    {video.is_free && <Badge className="text-[10px] bg-green-600">Bepul</Badge>}
                    <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(video.id, 'up')} disabled={idx === 0}>
                      <span className="text-xs">▲</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(video.id, 'down')} disabled={idx === videos.length - 1}>
                      <span className="text-xs">▼</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={video.is_free}
                      onCheckedChange={checked => updateMutation.mutate({ id: video.id, is_free: checked })}
                    />
                    <span className="text-[10px] text-muted-foreground w-8">{video.is_free ? 'Free' : 'Pro'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={video.is_published}
                      onCheckedChange={checked => updateMutation.mutate({ id: video.id, is_published: checked })}
                    />
                    <span className="text-[10px] text-muted-foreground">{video.is_published ? 'Faol' : 'Yashirin'}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Videoni o\'chirmoqchimisiz?')) deleteMutation.mutate(video.id); }}
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
