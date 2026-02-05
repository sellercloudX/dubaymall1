 // Enterprise-grade request queue for handling parallel API calls
 // Prevents overwhelming the server with too many concurrent requests
 
 type QueueItem = {
   id: string;
   execute: () => Promise<any>;
   resolve: (value: any) => void;
   reject: (error: any) => void;
   priority: number;
 };
 
 class RequestQueue {
   private queue: QueueItem[] = [];
   private activeCount = 0;
   private maxConcurrent: number;
   private processing = false;
 
   constructor(maxConcurrent = 3) {
     this.maxConcurrent = maxConcurrent;
   }
 
   async add<T>(
     execute: () => Promise<T>,
     options: { id?: string; priority?: number } = {}
   ): Promise<T> {
     const { id = crypto.randomUUID(), priority = 0 } = options;
 
     // Check for duplicate request
     const existing = this.queue.find(item => item.id === id);
     if (existing) {
       return new Promise((resolve, reject) => {
         existing.resolve = resolve;
         existing.reject = reject;
       });
     }
 
     return new Promise((resolve, reject) => {
       this.queue.push({ id, execute, resolve, reject, priority });
       this.queue.sort((a, b) => b.priority - a.priority);
       this.processQueue();
     });
   }
 
   private async processQueue() {
     if (this.processing) return;
     this.processing = true;
 
     while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
       const item = this.queue.shift();
       if (!item) continue;
 
       this.activeCount++;
 
       item.execute()
         .then(result => {
           item.resolve(result);
         })
         .catch(error => {
           item.reject(error);
         })
         .finally(() => {
           this.activeCount--;
           this.processQueue();
         });
     }
 
     this.processing = false;
   }
 
   getQueueLength() {
     return this.queue.length;
   }
 
   getActiveCount() {
     return this.activeCount;
   }
 
   clear() {
     this.queue.forEach(item => item.reject(new Error('Queue cleared')));
     this.queue = [];
   }
 }
 
 // Singleton instances for different use cases
 export const marketplaceQueue = new RequestQueue(3); // Max 3 concurrent marketplace API calls
 export const aiQueue = new RequestQueue(2); // Max 2 concurrent AI operations
 export const generalQueue = new RequestQueue(5); // General requests
 
 // Debounce helper for search/filter operations
 export function debounce<T extends (...args: any[]) => any>(
   func: T,
   wait: number
 ): (...args: Parameters<T>) => void {
   let timeoutId: ReturnType<typeof setTimeout> | null = null;
 
   return (...args: Parameters<T>) => {
     if (timeoutId) {
       clearTimeout(timeoutId);
     }
     timeoutId = setTimeout(() => {
       func(...args);
     }, wait);
   };
 }
 
 // Throttle helper for scroll events
 export function throttle<T extends (...args: any[]) => any>(
   func: T,
   limit: number
 ): (...args: Parameters<T>) => void {
   let inThrottle = false;
 
   return (...args: Parameters<T>) => {
     if (!inThrottle) {
       func(...args);
       inThrottle = true;
       setTimeout(() => {
         inThrottle = false;
       }, limit);
     }
   };
 }