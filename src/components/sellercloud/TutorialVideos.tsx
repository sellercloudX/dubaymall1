import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlayCircle, BookOpen, Search, Lock, Youtube, Instagram, Send, FolderOpen, ArrowLeft, ShoppingCart, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

function extractInstagramId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
  return match?.[1] || null;
}

interface TutorialFolder {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  price_uzs: number;
}

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
  is_free: boolean;
}

const platformIcons: Record<string, any> = { youtube: Youtube, instagram: Instagram, telegram: Send };
const platformLabels: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', telegram: 'Telegram' };

export function TutorialVideos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [purchaseDialog, setPurchaseDialog] = useState<TutorialFolder | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ['user-subscription-status', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('sellercloud_subscriptions')
        .select('is_active, activation_paid_until, activation_trial_ends, activated_until, admin_override')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isActive = (() => {
    if (!subscription) return false;
    if (subscription.admin_override) return true;
    const now = new Date();
    if (subscription.activation_trial_ends && new Date(subscription.activation_trial_ends) > now) return true;
    if (subscription.activation_paid_until && new Date(subscription.activation_paid_until) > now) return true;
    if (subscription.activated_until && new Date(subscription.activated_until) > now) return true;
    return false;
  })();

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['tutorial-folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_folders')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as TutorialFolder[];
    },
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['tutorial-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_videos')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as TutorialVideo[];
    },
  });

  // User's purchased folders
  const { data: purchases = [] } = useQuery({
    queryKey: ['tutorial-purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('tutorial_purchases')
        .select('folder_id')
        .eq('user_id', user.id);
      return (data || []).map(p => p.folder_id);
    },
    enabled: !!user,
  });

  // User balance
  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase
        .from('user_balances')
        .select('balance_uzs')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.balance_uzs || 0;
    },
    enabled: !!user,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const { data, error } = await supabase.rpc('purchase_tutorial_folder', { p_folder_id: folderId });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        if (result?.error === 'insufficient_balance') {
          toast.error(`Balans yetarli emas. Kerakli: ${result.price?.toLocaleString()} so'm, Balans: ${result.balance?.toLocaleString()} so'm`, {
            duration: 5000,
            action: { label: "Balansni to'ldirish", onClick: () => { window.location.hash = 'subscription'; } },
          });
          throw new Error('insufficient_balance');
        }
        throw new Error(result?.error || 'Xatolik');
      }
      return result;
    },
    onSuccess: (data, folderId) => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      if (data.message === 'already_purchased') {
        setSelectedFolder(folderId);
      } else {
        toast.success("Papka muvaffaqiyatli sotib olindi! Doimiy kirish huquqi berildi.");
        setSelectedFolder(folderId);
      }
      setPurchaseDialog(null);
    },
    onError: (err: any) => {
      if (err.message !== 'insufficient_balance') {
        toast.error("Xatolik yuz berdi");
      }
    },
  });

  const isFolderPurchased = (folderId: string) => purchases.includes(folderId);
  const isFolderFree = (folder: TutorialFolder) => !folder.price_uzs || folder.price_uzs <= 0;

  const canAccessFolder = (folder: TutorialFolder) => {
    if (isFolderFree(folder)) return true;
    if (isFolderPurchased(folder.id)) return true;
    return false;
  };

  const handleFolderClick = (folder: TutorialFolder) => {
    if (canAccessFolder(folder)) {
      setSelectedFolder(folder.id);
      return;
    }
    // Show purchase dialog
    setPurchaseDialog(folder);
  };

  const isLoading = foldersLoading || videosLoading;

  const canWatch = (video: TutorialVideo) => video.is_free || isActive;

  const handleVideoClick = (video: TutorialVideo) => {
    if (canWatch(video)) {
      setPlayerError(null);
      setSelectedVideo(video);
    }
  };

  const renderPlayer = (video: TutorialVideo) => {
    if (video.video_type === 'youtube') {
      const ytId = extractYouTubeId(video.content_url);
      if (!ytId) return <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">Video URL noto'g'ri</div>;
      // Use standard youtube.com/embed — youtube-nocookie.com causes Error 153 in some contexts
      const embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=0`;
      return (
        <iframe 
          src={embedUrl} 
          title={video.title} 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowFullScreen 
          className="w-full h-full rounded-lg"
          style={{ border: 'none' }}
        />
      );
    }
    if (video.video_type === 'instagram') {
      const igId = extractInstagramId(video.content_url);
      if (!igId) return <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">Instagram URL noto'g'ri</div>;
      return <iframe src={`https://www.instagram.com/p/${igId}/embed`} title={video.title} allowFullScreen className="w-full h-full" style={{ border: 'none' }} />;
    }
    if (video.video_type === 'telegram') {
      const embedSrc = video.embed_url || video.content_url;
      if (!embedSrc) return <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">Telegram URL noto'g'ri</div>;
      return <iframe src={embedSrc} title={video.title} allowFullScreen className="w-full h-full" style={{ border: 'none' }} />;
    }
    return null;
  };

  const getThumbnail = (video: TutorialVideo) => {
    if (video.video_type === 'youtube') {
      const ytId = extractYouTubeId(video.content_url);
      return ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (videos.length === 0 && folders.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Qo'llanmalar tez orada qo'shiladi</h3>
          <p className="text-muted-foreground text-sm">Video darsliklar tayyorlanmoqda</p>
        </CardContent>
      </Card>
    );
  }

  // Folder view (main)
  if (!selectedFolder && folders.length > 0) {
    const uncategorizedCount = videos.filter(v => !v.folder_id).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Qo'llanmalar</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map(folder => {
            const count = videos.filter(v => v.folder_id === folder.id).length;
            const purchased = isFolderPurchased(folder.id);
            const free = isFolderFree(folder);

            return (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className="group text-left rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="aspect-[4/3] relative bg-muted overflow-hidden">
                  {folder.cover_image_url ? (
                    <img src={folder.cover_image_url} alt={folder.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <FolderOpen className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  {/* Overlay for paid & not purchased */}
                  {!free && !purchased && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Lock className="h-6 w-6 mx-auto mb-1" />
                        <p className="text-xs font-bold">{folder.price_uzs.toLocaleString()} so'm</p>
                      </div>
                    </div>
                  )}
                  {/* Purchased badge */}
                  {purchased && (
                    <div className="absolute top-2 right-2">
                      <Badge className="text-[10px] bg-green-600 hover:bg-green-700 gap-1">
                        <CheckCircle className="h-3 w-3" /> Sotib olingan
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                    <h4 className="text-white text-sm font-semibold line-clamp-2">{folder.name}</h4>
                    <p className="text-white/70 text-[10px] mt-0.5">{count} ta video</p>
                  </div>
                </div>
              </button>
            );
          })}

          {uncategorizedCount > 0 && (
            <button
              onClick={() => setSelectedFolder('__uncategorized__')}
              className="group text-left rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="aspect-[4/3] relative bg-muted overflow-hidden flex items-center justify-center bg-primary/5">
                <BookOpen className="h-10 w-10 text-primary/30" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <h4 className="text-white text-sm font-semibold">Boshqa videolar</h4>
                  <p className="text-white/70 text-[10px] mt-0.5">{uncategorizedCount} ta video</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Purchase dialog */}
        <AlertDialog open={!!purchaseDialog} onOpenChange={() => setPurchaseDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>📚 {purchaseDialog?.name}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>{purchaseDialog?.description || "Bu papkadagi barcha video darsliklarni doimiy ko'rish uchun sotib oling."}</p>
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Narxi:</span>
                    <span className="font-bold">{purchaseDialog?.price_uzs?.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Balans:</span>
                    <span className={`font-medium ${(userBalance || 0) < (purchaseDialog?.price_uzs || 0) ? 'text-destructive' : 'text-green-600'}`}>
                      {(userBalance || 0).toLocaleString()} so'm
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">✅ Balansdan to'lov — papka doimiy ochiq qoladi</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              {(userBalance || 0) < (purchaseDialog?.price_uzs || 0) ? (
                <Button onClick={() => { setPurchaseDialog(null); window.location.hash = 'subscription'; }}>
                  Balansni to'ldirish
                </Button>
              ) : (
                <AlertDialogAction
                  onClick={() => purchaseDialog && purchaseMutation.mutate(purchaseDialog.id)}
                  disabled={purchaseMutation.isPending}
                >
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                  {purchaseMutation.isPending ? "To'lanmoqda..." : "Sotib olish"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!isActive && videos.some(v => !v.is_free) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 text-center">
              <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
              <h4 className="font-semibold text-sm mb-1">Premium darsliklar</h4>
              <p className="text-xs text-muted-foreground mb-3">Barcha darsliklardan foydalanish uchun obunani faollashtiring</p>
              <Button size="sm" onClick={() => { window.location.hash = 'subscription'; }}>Obunani faollashtirish</Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Inside a folder
  const currentFolder = folders.find(f => f.id === selectedFolder);
  const displayVideos = selectedFolder === '__uncategorized__'
    ? videos.filter(v => !v.folder_id)
    : selectedFolder
      ? videos.filter(v => v.folder_id === selectedFolder)
      : videos;

  const displayFiltered = displayVideos.filter(v => {
    if (selectedPlatform !== 'all' && v.video_type !== selectedPlatform) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const platforms = ['all', ...new Set(displayVideos.map(v => v.video_type))];

  return (
    <div className="space-y-4">
      {(selectedFolder || folders.length > 0) && (
        <Button variant="ghost" size="sm" onClick={() => { setSelectedFolder(null); setSelectedVideo(null); }} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {currentFolder?.name || 'Papkalar'}
        </Button>
      )}

      {selectedVideo && canWatch(selectedVideo) && (
        <Card className="overflow-hidden">
          <div className="aspect-video w-full bg-black">{renderPlayer(selectedVideo)}</div>
          {playerError && (
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />{playerError}
            </div>
          )}
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              {(() => { const Icon = platformIcons[selectedVideo.video_type] || PlayCircle; return <Icon className="h-4 w-4 text-muted-foreground" />; })()}
              <Badge variant="outline" className="text-[10px]">{platformLabels[selectedVideo.video_type] || selectedVideo.video_type}</Badge>
              {selectedVideo.is_free && <Badge variant="secondary" className="text-[10px]">Bepul</Badge>}
            </div>
            <h3 className="font-semibold text-lg">{selectedVideo.title}</h3>
            {selectedVideo.description && <p className="text-sm text-muted-foreground mt-1">{selectedVideo.description}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Video qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {platforms.length > 2 && (
          <div className="flex gap-1.5 flex-wrap">
            {platforms.map(p => {
              const Icon = platformIcons[p] || PlayCircle;
              return (
                <button key={p} onClick={() => setSelectedPlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    selectedPlatform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  {p !== 'all' && <Icon className="h-3 w-3" />}
                  {p === 'all' ? 'Hammasi' : platformLabels[p] || p}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayFiltered.map(video => {
          const thumbnail = getThumbnail(video);
          const isActiveVideo = selectedVideo?.id === video.id;
          const locked = !canWatch(video);
          const Icon = platformIcons[video.video_type] || PlayCircle;

          return (
            <button key={video.id} onClick={() => handleVideoClick(video)}
              className={`group text-left rounded-xl border overflow-hidden transition-all ${locked ? 'opacity-75' : 'hover:shadow-md'} ${isActiveVideo ? 'ring-2 ring-primary border-primary' : 'border-border'}`}>
              <div className="aspect-video relative bg-muted">
                {thumbnail ? (
                  <img src={thumbnail} alt={video.title} className={`w-full h-full object-cover ${locked ? 'blur-[2px]' : ''}`} loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Icon className="h-12 w-12 text-muted-foreground/40" /></div>
                )}
                <div className={`absolute inset-0 flex items-center justify-center ${locked ? 'bg-black/50' : 'bg-black/20 group-hover:bg-black/30'} transition-colors`}>
                  {locked ? (
                    <div className="text-center text-white"><Lock className="h-8 w-8 mx-auto mb-1" /><span className="text-xs font-medium">Obuna talab etiladi</span></div>
                  ) : (
                    <PlayCircle className="h-10 w-10 text-white/90 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <div className="absolute top-2 left-2 flex gap-1">
                  {video.is_free && <Badge className="text-[10px] bg-green-600 hover:bg-green-700">Bepul</Badge>}
                </div>
                <div className="absolute top-2 right-2"><Icon className="h-4 w-4 text-white/80" /></div>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-medium line-clamp-2 leading-snug">{video.title}</h4>
                {video.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {!isActive && displayVideos.some(v => !v.is_free) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-center">
            <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
            <h4 className="font-semibold text-sm mb-1">Premium darsliklar</h4>
            <p className="text-xs text-muted-foreground mb-3">Barcha darsliklardan foydalanish uchun obunani faollashtiring</p>
            <Button size="sm" onClick={() => { window.location.hash = 'subscription'; }}>Obunani faollashtirish</Button>
          </CardContent>
        </Card>
      )}

      {displayFiltered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">Natija topilmadi</div>
      )}
    </div>
  );
}
