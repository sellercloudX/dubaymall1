import { useState, useEffect } from 'react';
 import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
 import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { Badge } from '@/components/ui/badge';
import { ListTodo, CheckCircle2, XCircle, Loader2, Trash2, Ban, Package, ShoppingCart, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { backgroundTaskManager, BackgroundTask } from '@/lib/backgroundTaskManager';

const taskTypeIcons: Record<string, React.ReactNode> = {
  'sync': <RefreshCw className="h-4 w-4" />,
  'product-sync': <Package className="h-4 w-4" />,
  'order-sync': <ShoppingCart className="h-4 w-4" />,
  'ai-process': <Sparkles className="h-4 w-4" />,
  'batch': <ListTodo className="h-4 w-4" />,
};

function getTaskIcon(type: string) {
  return taskTypeIcons[type] || <ListTodo className="h-4 w-4" />;
}
 
 export function BackgroundTasksPanel() {
   const [open, setOpen] = useState(false);
  const { tasks, runningTasks, pendingTasks, clearCompleted, removeTask, cancelTask } = useBackgroundTasks();
 
   const hasActiveTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
  const activeCount = runningTasks.length + pendingTasks.length;

  // Toast notifications for task completion
  useEffect(() => {
    const unsubscribe = backgroundTaskManager.onTaskComplete((task: BackgroundTask) => {
      if (task.status === 'completed') {
        toast({
          title: '✅ Vazifa bajarildi',
          description: task.message,
        });
      } else if (task.status === 'failed') {
        toast({
          title: '❌ Vazifa bajarilmadi',
          description: task.error || task.message,
          variant: 'destructive',
        });
      }
    });
    return unsubscribe;
  }, []);
 
   if (tasks.length === 0) return null;
 
  // Calculate overall progress for active tasks
  const overallProgress = runningTasks.length > 0
    ? Math.round(runningTasks.reduce((sum, t) => sum + t.progress, 0) / runningTasks.length)
    : 0;

   return (
    <>
      {/* Floating Progress Indicator */}
      {hasActiveTasks && !open && (
        <div className="fixed bottom-20 right-3 z-40">
          <div className="relative">
            <Button 
              variant="default" 
              size="sm" 
              className="shadow-lg pr-3 pl-2 gap-1.5"
              onClick={() => setOpen(true)}
            >
              <div className="relative">
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeCount > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">{overallProgress}%</span>
              </div>
            </Button>
            {/* Mini progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 rounded-b overflow-hidden">
              <div 
                className="h-full bg-primary-foreground transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completed/History Button */}
      {!hasActiveTasks && tasks.length > 0 && (
        <Button 
          variant="outline" 
          size="sm" 
          className="fixed bottom-20 right-3 z-40 shadow-lg"
          onClick={() => setOpen(true)}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
          <span className="text-xs">{tasks.length} ta tugallangan</span>
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Fon vazifalari</SheetTitle>
              {hasActiveTasks && (
                <Badge variant="default" className="text-[10px]">
                  {activeCount} ta faol
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              <Trash2 className="h-4 w-4 mr-1" />
              Tozalash
            </Button>
          </SheetHeader>
          
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(70vh-100px)]">
            {tasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onRemove={removeTask}
                onCancel={cancelTask}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
   );
 }

interface TaskCardProps {
  task: BackgroundTask;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
}

function TaskCard({ task, onRemove, onCancel }: TaskCardProps) {
  const isActive = task.status === 'running' || task.status === 'pending';
  const hasBatchInfo = task.totalItems && task.totalItems > 0;
  
  return (
    <div 
      className={`p-3 rounded-lg border transition-colors ${
        task.status === 'running' ? 'bg-primary/5 border-primary/20' :
        task.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
        task.status === 'cancelled' ? 'bg-muted border-muted-foreground/20' :
        'bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`shrink-0 ${
              task.status === 'running' ? 'text-primary' :
              task.status === 'completed' ? 'text-emerald-500' :
              task.status === 'failed' ? 'text-destructive' :
              task.status === 'cancelled' ? 'text-muted-foreground' :
              'text-amber-500'
            }`}>
              {task.status === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : task.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : task.status === 'failed' ? (
                <XCircle className="h-4 w-4" />
              ) : task.status === 'cancelled' ? (
                <Ban className="h-4 w-4" />
              ) : (
                getTaskIcon(task.type)
              )}
            </div>
            <span className="text-sm font-medium truncate">{task.message}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {getTaskIcon(task.type)}
              <span className="ml-1">{task.type}</span>
            </Badge>
            
            {hasBatchInfo && (
              <span className="text-[11px] text-muted-foreground">
                {task.completedItems}/{task.totalItems} 
                {task.failedItems ? ` (${task.failedItems} xato)` : ''}
              </span>
            )}
          </div>
          
          {task.currentItem && task.status === 'running' && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              Hozir: {task.currentItem}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onCancel(task.id)}
              title="Bekor qilish"
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => onRemove(task.id)}
            title="O'chirish"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Progress bar */}
      {(task.status === 'running' || task.status === 'pending') && (
        <div className="space-y-1">
          <Progress value={task.progress} className="h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{task.status === 'pending' ? 'Navbatda...' : 'Bajarilmoqda...'}</span>
            <span>{task.progress}%</span>
          </div>
        </div>
      )}
      
      {task.error && (
        <p className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
          {task.error}
        </p>
      )}
    </div>
  );
}