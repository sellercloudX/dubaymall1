 // Background task manager for heavy operations like AI processing
 // Runs tasks without blocking UI
 
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
 
 export interface BackgroundTask {
   id: string;
   type: string;
   status: TaskStatus;
   progress: number;
   message: string;
   data?: any;
   error?: string;
   createdAt: Date;
   updatedAt: Date;
  // Batch operation specific
  totalItems?: number;
  completedItems?: number;
  failedItems?: number;
  currentItem?: string;
 }
 
 type TaskListener = (tasks: BackgroundTask[]) => void;
type TaskCompleteCallback = (task: BackgroundTask) => void;
 
 class BackgroundTaskManager {
   private tasks: Map<string, BackgroundTask> = new Map();
   private listeners: Set<TaskListener> = new Set();
  private completionCallbacks: Set<TaskCompleteCallback> = new Set();
   private maxConcurrent = 2;
   private runningCount = 0;
   private queue: string[] = [];
 
   subscribe(listener: TaskListener): () => void {
     this.listeners.add(listener);
     listener(this.getAllTasks());
     return () => this.listeners.delete(listener);
   }
 
  onTaskComplete(callback: TaskCompleteCallback): () => void {
    this.completionCallbacks.add(callback);
    return () => this.completionCallbacks.delete(callback);
  }

   private notify() {
     const tasks = this.getAllTasks();
     this.listeners.forEach(listener => listener(tasks));
   }
 
  private notifyCompletion(task: BackgroundTask) {
    this.completionCallbacks.forEach(callback => callback(task));
  }

   getAllTasks(): BackgroundTask[] {
     return Array.from(this.tasks.values())
       .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
   }
 
   getTask(id: string): BackgroundTask | undefined {
     return this.tasks.get(id);
   }
 
  createTask(type: string, message: string, data?: any, totalItems?: number): string {
     const id = crypto.randomUUID();
     const task: BackgroundTask = {
       id,
       type,
       status: 'pending',
       progress: 0,
       message,
       data,
      totalItems,
      completedItems: 0,
      failedItems: 0,
       createdAt: new Date(),
       updatedAt: new Date(),
     };
     this.tasks.set(id, task);
     this.notify();
     return id;
   }
 
   updateTask(id: string, updates: Partial<BackgroundTask>) {
     const task = this.tasks.get(id);
     if (task) {
       Object.assign(task, updates, { updatedAt: new Date() });
      
      // Auto-calculate progress for batch operations
      if (task.totalItems && task.completedItems !== undefined) {
        task.progress = Math.round((task.completedItems / task.totalItems) * 100);
      }
      
       this.notify();
     }
   }
 
  // Batch operation helpers
  incrementCompleted(id: string, currentItem?: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.completedItems = (task.completedItems || 0) + 1;
      if (currentItem) task.currentItem = currentItem;
      if (task.totalItems) {
        task.progress = Math.round((task.completedItems / task.totalItems) * 100);
      }
      task.updatedAt = new Date();
      this.notify();
    }
  }

  incrementFailed(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.failedItems = (task.failedItems || 0) + 1;
      task.updatedAt = new Date();
      this.notify();
    }
  }

  cancelTask(id: string) {
    const task = this.tasks.get(id);
    if (task && (task.status === 'pending' || task.status === 'running')) {
      task.status = 'cancelled';
      task.updatedAt = new Date();
      this.notify();
      // Remove from queue if pending
      const queueIndex = this.queue.indexOf(id);
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1);
      }
    }
  }

   async runTask<T>(
     id: string,
     executor: (updateProgress: (progress: number, message?: string) => void) => Promise<T>
   ): Promise<T> {
     const task = this.tasks.get(id);
     if (!task) throw new Error('Task not found');
 
     // Queue if too many running
     if (this.runningCount >= this.maxConcurrent) {
       this.queue.push(id);
       return new Promise((resolve, reject) => {
         const checkQueue = setInterval(() => {
          const currentTask = this.tasks.get(id);
          if (currentTask?.status === 'cancelled') {
            clearInterval(checkQueue);
            reject(new Error('Task cancelled'));
            return;
          }
          if (this.queue[0] === id && this.runningCount < this.maxConcurrent) {
             clearInterval(checkQueue);
             this.queue.shift();
             this.executeTask(id, executor).then(resolve).catch(reject);
           }
         }, 100);
       });
     }
 
     return this.executeTask(id, executor);
   }
 
   private async executeTask<T>(
     id: string,
     executor: (updateProgress: (progress: number, message?: string) => void) => Promise<T>
   ): Promise<T> {
    const task = this.tasks.get(id);
    if (task?.status === 'cancelled') {
      throw new Error('Task cancelled');
    }
    
     this.runningCount++;
     this.updateTask(id, { status: 'running', progress: 0 });
 
     const updateProgress = (progress: number, message?: string) => {
       this.updateTask(id, { progress, ...(message && { message }) });
     };
 
     try {
       const result = await executor(updateProgress);
      const completedTask = this.tasks.get(id);
      this.updateTask(id, { status: 'completed', progress: 100 });
      if (completedTask) {
        this.notifyCompletion({ ...completedTask, status: 'completed' });
      }
       return result;
     } catch (error) {
      const failedTask = this.tasks.get(id);
      this.updateTask(id, { 
         status: 'failed', 
         error: error instanceof Error ? error.message : 'Unknown error' 
       });
      if (failedTask) {
        this.notifyCompletion({ ...failedTask, status: 'failed' });
      }
       throw error;
     } finally {
       this.runningCount--;
       this.processQueue();
     }
   }
 
   private processQueue() {
     // Trigger waiting tasks to check queue
   }
 
   removeTask(id: string) {
     this.tasks.delete(id);
     this.notify();
   }
 
   clearCompleted() {
     for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
         this.tasks.delete(id);
       }
     }
     this.notify();
   }

  // Get summary stats
  getStats() {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
    };
  }
 }
 
 export const backgroundTaskManager = new BackgroundTaskManager();