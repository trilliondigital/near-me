import { GeofenceEvent } from '../models/GeofenceEvent';
import { GeofenceEventProcessor } from './geofenceEventProcessor';
import { 
  CreateGeofenceEventRequest, 
  GeofenceEventStatus 
} from '../models/types';

export interface QueuedEvent {
  id: string;
  eventData: CreateGeofenceEventRequest;
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  error?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  totalRetries: number;
}

export class EventQueueService {
  // Maximum retry attempts
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  
  // Retry delays in minutes (exponential backoff)
  private static readonly RETRY_DELAYS = [1, 5, 15]; // 1min, 5min, 15min

  // In-memory queue for demonstration (in production, use Redis or similar)
  private static eventQueue: Map<string, QueuedEvent> = new Map();
  private static processing: Set<string> = new Set();

  /**
   * Add event to queue for processing
   */
  static async enqueueEvent(eventData: CreateGeofenceEventRequest): Promise<string> {
    const eventId = this.generateEventId();
    
    const queuedEvent: QueuedEvent = {
      id: eventId,
      eventData,
      attempts: 0
    };

    this.eventQueue.set(eventId, queuedEvent);
    
    // Try to process immediately
    this.processEventAsync(eventId);
    
    return eventId;
  }

  /**
   * Add multiple events to queue (for offline sync)
   */
  static async enqueueBatchEvents(events: CreateGeofenceEventRequest[]): Promise<string[]> {
    const eventIds: string[] = [];
    
    for (const eventData of events) {
      const eventId = await this.enqueueEvent(eventData);
      eventIds.push(eventId);
    }
    
    return eventIds;
  }

  /**
   * Process a single event from the queue
   */
  private static async processEventAsync(eventId: string): Promise<void> {
    if (this.processing.has(eventId)) {
      return; // Already processing
    }

    const queuedEvent = this.eventQueue.get(eventId);
    if (!queuedEvent) {
      return; // Event not found
    }

    // Check if we should retry yet
    if (queuedEvent.nextRetry && queuedEvent.nextRetry > new Date()) {
      return; // Not time to retry yet
    }

    this.processing.add(eventId);

    try {
      queuedEvent.attempts++;
      queuedEvent.lastAttempt = new Date();

      // Process the event
      const result = await GeofenceEventProcessor.processEvent(queuedEvent.eventData);
      
      // Remove from queue on success
      this.eventQueue.delete(eventId);
      this.processing.delete(eventId);

      console.log(`Successfully processed queued event ${eventId}`);

    } catch (error) {
      this.processing.delete(eventId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      queuedEvent.error = errorMessage;

      if (queuedEvent.attempts >= this.MAX_RETRY_ATTEMPTS) {
        // Max retries reached, mark as failed
        console.error(`Event ${eventId} failed after ${queuedEvent.attempts} attempts:`, errorMessage);
        // Keep in queue but don't retry (for debugging/manual intervention)
      } else {
        // Schedule retry
        const retryDelayMinutes = this.RETRY_DELAYS[queuedEvent.attempts - 1] || 15;
        queuedEvent.nextRetry = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
        
        console.log(`Event ${eventId} failed (attempt ${queuedEvent.attempts}), retrying in ${retryDelayMinutes} minutes:`, errorMessage);
        
        // Schedule retry
        setTimeout(() => {
          this.processEventAsync(eventId);
        }, retryDelayMinutes * 60 * 1000);
      }
    }
  }

  /**
   * Process all pending events in the queue
   */
  static async processQueue(): Promise<{
    processed: number;
    failed: number;
    retried: number;
  }> {
    const stats = { processed: 0, failed: 0, retried: 0 };
    
    for (const [eventId, queuedEvent] of this.eventQueue.entries()) {
      if (this.processing.has(eventId)) {
        continue; // Skip events currently being processed
      }

      // Check if event should be retried
      if (queuedEvent.nextRetry && queuedEvent.nextRetry > new Date()) {
        continue; // Not time to retry yet
      }

      if (queuedEvent.attempts >= this.MAX_RETRY_ATTEMPTS) {
        stats.failed++;
        continue; // Max retries reached
      }

      try {
        await this.processEventAsync(eventId);
        
        if (!this.eventQueue.has(eventId)) {
          stats.processed++;
        } else {
          stats.retried++;
        }
      } catch (error) {
        console.error(`Error processing queued event ${eventId}:`, error);
        stats.failed++;
      }
    }

    return stats;
  }

  /**
   * Get queue statistics
   */
  static getQueueStats(): QueueStats {
    let pending = 0;
    let failed = 0;
    let totalRetries = 0;

    for (const queuedEvent of this.eventQueue.values()) {
      totalRetries += queuedEvent.attempts;
      
      if (queuedEvent.attempts >= this.MAX_RETRY_ATTEMPTS) {
        failed++;
      } else {
        pending++;
      }
    }

    return {
      pending,
      processing: this.processing.size,
      failed,
      completed: 0, // Completed events are removed from queue
      totalRetries
    };
  }

  /**
   * Get queued events for a user
   */
  static getQueuedEventsForUser(userId: string): QueuedEvent[] {
    const userEvents: QueuedEvent[] = [];
    
    for (const queuedEvent of this.eventQueue.values()) {
      if (queuedEvent.eventData.user_id === userId) {
        userEvents.push(queuedEvent);
      }
    }
    
    return userEvents.sort((a, b) => a.attempts - b.attempts);
  }

  /**
   * Remove event from queue (manual intervention)
   */
  static removeFromQueue(eventId: string): boolean {
    if (this.processing.has(eventId)) {
      return false; // Cannot remove while processing
    }
    
    return this.eventQueue.delete(eventId);
  }

  /**
   * Retry failed event manually
   */
  static async retryEvent(eventId: string): Promise<boolean> {
    const queuedEvent = this.eventQueue.get(eventId);
    if (!queuedEvent) {
      return false;
    }

    // Reset retry timer and attempt processing
    queuedEvent.nextRetry = undefined;
    queuedEvent.error = undefined;
    
    await this.processEventAsync(eventId);
    return true;
  }

  /**
   * Clear old failed events from queue
   */
  static clearOldFailedEvents(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleared = 0;

    for (const [eventId, queuedEvent] of this.eventQueue.entries()) {
      if (queuedEvent.attempts >= this.MAX_RETRY_ATTEMPTS && 
          queuedEvent.lastAttempt && 
          queuedEvent.lastAttempt < cutoffTime) {
        this.eventQueue.delete(eventId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Sync offline events from mobile client
   */
  static async syncOfflineEvents(
    userId: string, 
    events: CreateGeofenceEventRequest[]
  ): Promise<{
    queued: number;
    processed: number;
    failed: number;
    duplicates: number;
  }> {
    const stats = { queued: 0, processed: 0, failed: 0, duplicates: 0 };

    // Sort events by timestamp (if available in location data)
    const sortedEvents = events.sort((a, b) => {
      // Use latitude as a proxy for timestamp (this is a simplification)
      return a.location.latitude - b.location.latitude;
    });

    for (const eventData of sortedEvents) {
      try {
        // Check for existing events to avoid duplicates
        const existingEvents = await GeofenceEvent.findRecentEvents(
          eventData.user_id,
          eventData.task_id,
          eventData.event_type,
          60 // Check last hour
        );

        const isDuplicate = existingEvents.some(existing => {
          const distance = existing.calculateDistanceTo(eventData.location);
          return distance <= 100; // Within 100 meters
        });

        if (isDuplicate) {
          stats.duplicates++;
          continue;
        }

        // Try to process immediately
        try {
          await GeofenceEventProcessor.processEvent(eventData);
          stats.processed++;
        } catch (error) {
          // If immediate processing fails, queue for retry
          await this.enqueueEvent(eventData);
          stats.queued++;
        }

      } catch (error) {
        console.error('Error syncing offline event:', error);
        stats.failed++;
      }
    }

    return stats;
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start background queue processor (call this on server startup)
   */
  static startQueueProcessor(intervalMinutes: number = 5): void {
    setInterval(async () => {
      try {
        const stats = await this.processQueue();
        if (stats.processed > 0 || stats.failed > 0 || stats.retried > 0) {
          console.log('Queue processing stats:', stats);
        }
      } catch (error) {
        console.error('Error in queue processor:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Also clean up old failed events periodically
    setInterval(() => {
      const cleared = this.clearOldFailedEvents(24);
      if (cleared > 0) {
        console.log(`Cleared ${cleared} old failed events from queue`);
      }
    }, 60 * 60 * 1000); // Every hour
  }
}