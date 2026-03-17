import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, BookOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  category: string | null;
  sort_order: number;
}

export function TutorialVideos() {
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: videos = [], isLoading } = useQuery({
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

  const categories = ['all', ...new Set(videos.map(v => v.category || 'general'))];

  const filtered = videos.filter(v => {
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Qo'llanmalar tez orada qo'shiladi</h3>
          <p className="text-muted-foreground text-sm">Platformadan foydalanish bo'yicha video darsliklar tayyorlanmoqda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected video player */}
      {selectedVideo && (
        <Card className="overflow-hidden">
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeId(selectedVideo.youtube_url)}?rel=0&modestbranding=1`}
              title={selectedVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold text-lg">{selectedVideo.title}</h3>
            {selectedVideo.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedVideo.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Video qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat === 'all' ? 'Hammasi' : cat === 'general' ? 'Umumiy' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(video => {
          const ytId = extractYouTubeId(video.youtube_url);
          const isActive = selectedVideo?.id === video.id;
          return (
            <button
              key={video.id}
              onClick={() => setSelectedVideo(video)}
              className={`group text-left rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                isActive ? 'ring-2 ring-primary border-primary' : 'border-border'
              }`}
            >
              <div className="aspect-video relative bg-muted">
                {ytId && (
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <PlayCircle className="h-10 w-10 text-white/90 group-hover:scale-110 transition-transform" />
                </div>
                {video.category && video.category !== 'general' && (
                  <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
                    {video.category}
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-sm font-medium line-clamp-2 leading-snug">{video.title}</h4>
                {video.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Natija topilmadi
        </div>
      )}
    </div>
  );
}
