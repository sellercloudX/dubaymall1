import { useState, useEffect } from 'react';
import { backgroundTaskManager, type BackgroundTask } from '@/lib/backgroundTaskManager';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, ImageIcon, Check, X, Sparkles } from 'lucide-react';

export function PendingProductsBanner() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    const unsubscribe = backgroundTaskManager.subscribe((allTasks) => {
      // Only show AI image generation tasks
      const imageTasks = allTasks.filter(
        (t) => t.type === 'ai-image-generation' && 
        (t.status === 'pending' || t.status === 'running' || t.status === 'completed' || t.status === 'failed')
      );
      setTasks(imageTasks);
    });
    return unsubscribe;
  }, []);

  // Auto-remove completed/failed tasks after delay
  useEffect(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');
    if (completedTasks.length > 0) {
      const timer = setTimeout(() => {
        completedTasks.forEach(t => backgroundTaskManager.removeTask(t.id));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [tasks]);

  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
  const recentDone = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {activeTasks.map((task) => (
        <Card key={task.id} className="border-primary/30 bg-gradient-to-r from-primary/5 to-amber-500/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{task.message}</p>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    {task.status === 'pending' ? 'Navbatda' : 'Yaratilmoqda'}
                  </Badge>
                </div>
                <Progress value={task.progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {task.currentItem || 'Flux Pro bilan professional rasm yaratilmoqda...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {recentDone.map((task) => (
        <Card 
          key={task.id} 
          className={`animate-in fade-in duration-300 ${
            task.status === 'completed' 
              ? 'border-green-500/30 bg-green-500/5' 
              : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                task.status === 'completed' ? 'bg-green-500/10' : 'bg-destructive/10'
              }`}>
                {task.status === 'completed' 
                  ? <Check className="h-4 w-4 text-green-500" />
                  : <X className="h-4 w-4 text-destructive" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.message}</p>
                <p className="text-xs text-muted-foreground">
                  {task.status === 'completed' 
                    ? '✅ Professional rasm tayyor va biriktirildi!' 
                    : `❌ ${task.error || 'Rasm yaratishda xatolik'}`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
