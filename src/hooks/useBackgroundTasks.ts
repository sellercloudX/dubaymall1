 import { useState, useEffect } from 'react';
 import { backgroundTaskManager, BackgroundTask } from '@/lib/backgroundTaskManager';
 
 export function useBackgroundTasks() {
   const [tasks, setTasks] = useState<BackgroundTask[]>([]);
 
   useEffect(() => {
     return backgroundTaskManager.subscribe(setTasks);
   }, []);
 
   return {
     tasks,
     pendingTasks: tasks.filter(t => t.status === 'pending'),
     runningTasks: tasks.filter(t => t.status === 'running'),
     completedTasks: tasks.filter(t => t.status === 'completed'),
     failedTasks: tasks.filter(t => t.status === 'failed'),
     createTask: backgroundTaskManager.createTask.bind(backgroundTaskManager),
     runTask: backgroundTaskManager.runTask.bind(backgroundTaskManager),
     removeTask: backgroundTaskManager.removeTask.bind(backgroundTaskManager),
     clearCompleted: backgroundTaskManager.clearCompleted.bind(backgroundTaskManager),
   };
 }