import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, PlayCircle, X, Youtube, Instagram, Send, FolderPlus, FolderOpen, ArrowLeft, Image } from 'lucide-react';
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
  folder_id: string | null;
  feature_key: string | null;
  sort_order: number;
  is_published: boolean;
  is_free: boolean;
  created_at: string;
}

interface TutorialFolder {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

const FEATURE_OPTIONS = [
  { value: 'marketplaces', label: 'Marketplace ulash' },
  { value: 'products', label: 'Mahsulotlar' },
  { value: 'orders', label: 'Buyurtmalar' },
  { value: 'sales', label: 'Sotuvlar' },
  { value: 'analytics', label: 'Analitika' },
  { value: 'scanner', label: 'AI Scanner' },
  { value: 'card-creator', label: 'Kartochka yaratish' },
  { value: 'cloner', label: 'Klonlash' },
  { value: 'pricing', label: 'Narx boshqarish' },
  { value: 'inventory', label: 'Ombor boshqarish' },
  { value: 'fbs', label: 'FBS Logistika' },
  { value: 'subscription', label: 'Obuna va to\'lov' },
  { value: 'general', label: 'Umumiy' },
];

const platformIcons: Record<string, any> = { youtube: Youtube, instagram: Instagram, telegram: Send };

export function TutorialVideosAdmin() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'folders' | 'videos'>('folders');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);

  const [videoForm, setVideoForm] = useState({
    title: '', description: '', content_url: '', embed_url: '',
    video_type: 'youtube', feature_key: 'general', is_free: false,
  });

  const [folderForm, setFolderForm] = useState({
    name: '', description: '', cover_image_url: '', price_uzs: 0,
  });

  // ─── Queries ───
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['admin-tutorial-folders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tutorial_folders').select('*').order('sort_order');
      if (error) throw error;
      return data as TutorialFolder[];
    },
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['admin-tutorial-videos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tutorial_videos').select('*').order('sort_order');
      if (error) throw error;
      return data as TutorialVideo[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tutorial-videos'] });
    queryClient.invalidateQueries({ queryKey: ['admin-tutorial-folders'] });
    queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
    queryClient.invalidateQueries({ queryKey: ['tutorial-folders'] });
  };

  // ─── Folder Mutations ───
  const addFolderMutation = useMutation({
    mutationFn: async (f: typeof folderForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tutorial_folders').insert({
        name: f.name, description: f.description || null,
        cover_image_url: f.cover_image_url || null,
        price_uzs: f.price_uzs || 0,
        sort_order: folders.length, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setShowAddFolder(false); setFolderForm({ name: '', description: '', cover_image_url: '', price_uzs: 0 }); toast.success('Papka yaratildi'); },
    onError: () => toast.error('Xatolik'),
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutorialFolder> & { id: string }) => {
      const { error } = await supabase.from('tutorial_folders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Yangilandi'); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Papka o\'chirildi'); },
  });

  // ─── Video Mutations ───
  const addVideoMutation = useMutation({
    mutationFn: async (v: typeof videoForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const folderVideos = videos.filter(vid => vid.folder_id === selectedFolderId);
      const { error } = await supabase.from('tutorial_videos').insert({
        title: v.title, description: v.description || null,
        content_url: v.content_url, embed_url: v.embed_url || null,
        video_type: v.video_type, feature_key: v.feature_key || null,
        category: v.feature_key || 'general', is_free: v.is_free,
        folder_id: selectedFolderId,
        sort_order: folderVideos.length, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(); setShowAddVideo(false);
      setVideoForm({ title: '', description: '', content_url: '', embed_url: '', video_type: 'youtube', feature_key: 'general', is_free: false });
      toast.success('Video qo\'shildi');
    },
    onError: () => toast.error('Xatolik'),
  });

  const updateVideoMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutorialVideo> & { id: string }) => {
      const { error } = await supabase.from('tutorial_videos').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Yangilandi'); },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('O\'chirildi'); },
  });

  const moveVideo = (id: string, direction: 'up' | 'down', list: TutorialVideo[]) => {
    const idx = list.findIndex(v => v.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    updateVideoMutation.mutate({ id: list[idx].id, sort_order: list[swapIdx].sort_order });
    updateVideoMutation.mutate({ id: list[swapIdx].id, sort_order: list[idx].sort_order });
  };

  const handleAddVideo = () => {
    if (!videoForm.title.trim() || !videoForm.content_url.trim()) { toast.error('Sarlavha va URL kiriting'); return; }
    addVideoMutation.mutate(videoForm);
  };

  const handleAddFolder = () => {
    if (!folderForm.name.trim()) { toast.error('Papka nomini kiriting'); return; }
    addFolderMutation.mutate(folderForm);
  };

  if (foldersLoading || videosLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  // ─── Folder Videos View ───
  if (selectedFolderId) {
    const folder = folders.find(f => f.id === selectedFolderId);
    const folderVids = videos.filter(v => v.folder_id === selectedFolderId);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFolderId(null); setShowAddVideo(false); }} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> {folder?.name || 'Papkalar'}
          </Button>
          <Button size="sm" onClick={() => setShowAddVideo(!showAddVideo)}>
            {showAddVideo ? <><X className="h-4 w-4 mr-1" />Bekor</> : <><Plus className="h-4 w-4 mr-1" />Video qo'shish</>}
          </Button>
        </div>

        {showAddVideo && renderVideoForm()}

        {folderVids.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Bu papkada hali video yo'q</div>
        )}

        {folderVids.map((video, idx) => renderVideoCard(video, idx, folderVids))}
      </div>
    );
  }

  // ─── Folders List View ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Qo'llanma papkalari</h2>
          <p className="text-sm text-muted-foreground">{folders.length} ta papka, {videos.length} ta video</p>
        </div>
        <Button size="sm" onClick={() => setShowAddFolder(!showAddFolder)}>
          {showAddFolder ? <><X className="h-4 w-4 mr-1" />Bekor</> : <><FolderPlus className="h-4 w-4 mr-1" />Yangi papka</>}
        </Button>
      </div>

      {showAddFolder && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Papka nomi *" value={folderForm.name} onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Muqova rasm URL" value={folderForm.cover_image_url} onChange={e => setFolderForm(f => ({ ...f, cover_image_url: e.target.value }))} />
            <Input type="number" placeholder="Narxi (so'm, 0 = bepul)" value={folderForm.price_uzs || ''} onChange={e => setFolderForm(f => ({ ...f, price_uzs: parseInt(e.target.value) || 0 }))} />
            <Textarea placeholder="Tavsif (ixtiyoriy)" value={folderForm.description} onChange={e => setFolderForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <Button size="sm" onClick={handleAddFolder} disabled={addFolderMutation.isPending}>
              <Save className="h-4 w-4 mr-1.5" />Saqlash
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {folders.map(folder => {
          const count = videos.filter(v => v.folder_id === folder.id).length;
          return (
            <Card key={folder.id} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-20 h-14 shrink-0 rounded-lg overflow-hidden bg-muted">
                  {folder.cover_image_url ? (
                    <img src={folder.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><FolderOpen className="h-5 w-5 text-muted-foreground/50" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedFolderId(folder.id)}>
                  <h4 className="font-medium text-sm">{folder.name}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{count} ta video</p>
                    {(folder as any).price_uzs > 0 ? (
                      <Badge variant="outline" className="text-[10px]">{((folder as any).price_uzs).toLocaleString()} so'm</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Bepul</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={folder.is_published}
                    onCheckedChange={checked => updateFolderMutation.mutate({ id: folder.id, is_published: checked })} />
                  <span className="text-[10px] text-muted-foreground w-10">{folder.is_published ? 'Faol' : 'Yashirin'}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm('Papkani o\'chirmoqchimisiz?')) deleteFolderMutation.mutate(folder.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Uncategorized videos */}
      {videos.filter(v => !v.folder_id).length > 0 && (
        <div className="space-y-2 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Papkasiz videolar</h3>
            <Button size="sm" variant="outline" onClick={() => { setSelectedFolderId(null); setShowAddVideo(!showAddVideo); }}>
              <Plus className="h-4 w-4 mr-1" />Video
            </Button>
          </div>
          {showAddVideo && !selectedFolderId && renderVideoForm()}
          {videos.filter(v => !v.folder_id).map((video, idx, arr) => renderVideoCard(video, idx, arr))}
        </div>
      )}
    </div>
  );

  // ─── Reusable Renderers ───
  function renderVideoForm() {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input placeholder="Video sarlavhasi *" value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={videoForm.video_type} onValueChange={v => setVideoForm(f => ({ ...f, video_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
              </SelectContent>
            </Select>
            <Select value={videoForm.feature_key} onValueChange={v => setVideoForm(f => ({ ...f, feature_key: v }))}>
              <SelectTrigger><SelectValue placeholder="Funksiya" /></SelectTrigger>
              <SelectContent>
                {FEATURE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder={videoForm.video_type === 'youtube' ? 'YouTube URL (video yoki shorts) *' : videoForm.video_type === 'instagram' ? 'Instagram post URL *' : 'Telegram post URL *'}
            value={videoForm.content_url}
            onChange={e => setVideoForm(f => ({ ...f, content_url: e.target.value }))}
          />
          {videoForm.video_type !== 'youtube' && (
            <Input placeholder="Embed URL (ixtiyoriy)" value={videoForm.embed_url} onChange={e => setVideoForm(f => ({ ...f, embed_url: e.target.value }))} />
          )}
          <Textarea placeholder="Tavsif (ixtiyoriy)" value={videoForm.description} onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={videoForm.is_free} onCheckedChange={v => setVideoForm(f => ({ ...f, is_free: v }))} />
              <span className="text-sm">Bepul</span>
            </div>
            <Button size="sm" onClick={handleAddVideo} disabled={addVideoMutation.isPending}>
              <Save className="h-4 w-4 mr-1.5" />Saqlash
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderVideoCard(video: TutorialVideo, idx: number, list: TutorialVideo[]) {
    const ytId = video.video_type === 'youtube' ? extractYouTubeId(video.content_url) : null;
    const Icon = platformIcons[video.video_type] || PlayCircle;
    const featureLabel = FEATURE_OPTIONS.find(f => f.value === video.feature_key)?.label;

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
              {featureLabel && <Badge variant="secondary" className="text-[10px]">{featureLabel}</Badge>}
              <Badge variant="outline" className="text-[10px] gap-1"><Icon className="h-3 w-3" />{video.video_type}</Badge>
              {video.is_free && <Badge className="text-[10px] bg-green-600">Bepul</Badge>}
              <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(video.id, 'up', list)} disabled={idx === 0}>
                <span className="text-xs">▲</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(video.id, 'down', list)} disabled={idx === list.length - 1}>
                <span className="text-xs">▼</span>
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={video.is_free} onCheckedChange={checked => updateVideoMutation.mutate({ id: video.id, is_free: checked })} />
              <span className="text-[10px] text-muted-foreground w-8">{video.is_free ? 'Free' : 'Pro'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={video.is_published} onCheckedChange={checked => updateVideoMutation.mutate({ id: video.id, is_published: checked })} />
              <span className="text-[10px] text-muted-foreground">{video.is_published ? 'Faol' : 'Yashirin'}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => { if (confirm('Videoni o\'chirmoqchimisiz?')) deleteVideoMutation.mutate(video.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
