 import { useState } from 'react';
 import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
 import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { Badge } from '@/components/ui/badge';
 import { ListTodo, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
 
 export function BackgroundTasksPanel() {
   const [open, setOpen] = useState(false);
   const { tasks, runningTasks, clearCompleted, removeTask } = useBackgroundTasks();
 
   const hasActiveTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
 
   if (tasks.length === 0) return null;
 
   return (
     <Sheet open={open} onOpenChange={setOpen}>
       <SheetTrigger asChild>
         <Button 
           variant="outline" 
           size="sm" 
           className="fixed bottom-20 right-3 z-40 shadow-lg"
         >
           {hasActiveTasks ? (
             <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
           ) : (
             <ListTodo className="h-4 w-4 mr-1.5" />
           )}
           <span className="text-xs">{runningTasks.length > 0 ? `${runningTasks.length} ta ishlayapti` : `${tasks.length} ta vazifa`}</span>
         </Button>
       </SheetTrigger>
       <SheetContent side="bottom" className="h-[60vh]">
         <SheetHeader className="flex flex-row items-center justify-between">
           <SheetTitle className="text-base">Fon vazifalari</SheetTitle>
           <Button variant="ghost" size="sm" onClick={clearCompleted}>
             <Trash2 className="h-4 w-4 mr-1" />
             Tozalash
           </Button>
         </SheetHeader>
         <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(60vh-80px)]">
           {tasks.map(task => (
             <div 
               key={task.id} 
               className="p-3 rounded-lg border bg-card"
             >
               <div className="flex items-start justify-between gap-2 mb-2">
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     {task.status === 'running' && (
                       <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                     )}
                     {task.status === 'completed' && (
                       <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                     )}
                     {task.status === 'failed' && (
                       <XCircle className="h-4 w-4 text-destructive shrink-0" />
                     )}
                     <span className="text-sm font-medium truncate">{task.message}</span>
                   </div>
                   <Badge variant="secondary" className="text-[10px]">{task.type}</Badge>
                 </div>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-6 w-6 shrink-0"
                   onClick={() => removeTask(task.id)}
                 >
                   <XCircle className="h-3.5 w-3.5" />
                 </Button>
               </div>
               {task.status === 'running' && (
                 <Progress value={task.progress} className="h-1.5" />
               )}
               {task.error && (
                 <p className="text-xs text-destructive mt-1">{task.error}</p>
               )}
             </div>
           ))}
         </div>
       </SheetContent>
     </Sheet>
   );
 }