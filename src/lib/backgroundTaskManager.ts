 // Background task manager for heavy operations like AI processing
 // Runs tasks without blocking UI
 
 export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
 
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
 }
 
 type TaskListener = (tasks: BackgroundTask[]) => void;
 
 class BackgroundTaskManager {
   private tasks: Map<string, BackgroundTask> = new Map();
   private listeners: Set<TaskListener> = new Set();
   private maxConcurrent = 2;
   private runningCount = 0;
   private queue: string[] = [];
 
   subscribe(listener: TaskListener): () => void {
     this.listeners.add(listener);
     listener(this.getAllTasks());
     return () => this.listeners.delete(listener);
   }
 
   private notify() {
     const tasks = this.getAllTasks();
     this.listeners.forEach(listener => listener(tasks));
   }
 
   getAllTasks(): BackgroundTask[] {
     return Array.from(this.tasks.values())
       .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
   }
 
   getTask(id: string): BackgroundTask | undefined {
     return this.tasks.get(id);
   }
 
   createTask(type: string, message: string, data?: any): string {
     const id = crypto.randomUUID();
     const task: BackgroundTask = {
       id,
       type,
       status: 'pending',
       progress: 0,
       message,
       data,
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
       this.notify();
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
     this.runningCount++;
     this.updateTask(id, { status: 'running', progress: 0 });
 
     const updateProgress = (progress: number, message?: string) => {
       this.updateTask(id, { progress, ...(message && { message }) });
     };
 
     try {
       const result = await executor(updateProgress);
       this.updateTask(id, { status: 'completed', progress: 100 });
       return result;
     } catch (error) {
       this.updateTask(id, { 
         status: 'failed', 
         error: error instanceof Error ? error.message : 'Unknown error' 
       });
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
       if (task.status === 'completed' || task.status === 'failed') {
         this.tasks.delete(id);
       }
     }
     this.notify();
   }
 }
 
 export const backgroundTaskManager = new BackgroundTaskManager();