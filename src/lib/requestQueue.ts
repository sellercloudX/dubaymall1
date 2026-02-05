 // Enterprise-grade request queue for handling parallel API calls
// Client-side queue prevents browser tab from freezing
// NOTE: This is PER-USER, not global. Server handles thousands of concurrent users.
 
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
  private stats = { processed: 0, failed: 0 };
 
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

  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      activeCount: this.activeCount,
    };
  }
 }
 
// Client-side queues - prevents browser freezing, NOT server limits
// Server handles unlimited concurrent requests from different users
export const marketplaceQueue = new RequestQueue(5); // 5 parallel per user tab
export const aiQueue = new RequestQueue(3); // AI operations per user
export const generalQueue = new RequestQueue(10); // General requests

// For bulk operations - use server-side batch processing instead
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { 
    batchSize?: number; 
    onProgress?: (completed: number, total: number) => void;
    onError?: (item: T, error: Error) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, onProgress, onError } = options;
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        onError?.(batch[idx], result.reason);
      }
    });
    
    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }
  
  return results;
}
 
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