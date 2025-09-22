import { GeofenceEvent } from '../models/GeofenceEvent';
import { Geofence } from '../models/Geofence';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { 
  CreateGeofenceEventRequest, 
  GeofenceEventType, 
  Coordinate,
  GeofenceType 
} from '../models/types';
import { ValidationError } from '../models/validation';

export interface EventProcessingResult {
  event: GeofenceEvent;
  shouldNotify: boolean;
  bundledWith?: string;
  cooldownMinutes?: number;
  reason: string;
}

export interface NotificationBundle {
  id: string;
  events: GeofenceEvent[];
  location: Coordinate;
  radius: number;
  message: string;
}

export class GeofenceEventProcessor {
  // Deduplication window in minutes
  private static readonly DEDUPLICATION_WINDOW = 15;
  
  // Cooldown periods by geofence type (in minutes)
  private static readonly COOLDOWN_PERIODS = {
    approach_5mi: 60,    // 1 hour
    approach_3mi: 45,    // 45 minutes
    approach_1mi: 30,    // 30 minutes
    arrival: 15,         // 15 minutes
    post_arrival: 120    // 2 hours
  };

  // Dense POI area detection radius (meters)
  private static readonly DENSE_AREA_RADIUS = 500;
  private static readonly DENSE_AREA_THRESHOLD = 3; // 3+ events within radius

  /**
   * Process a geofence event from mobile client
   */
  static async processEvent(eventData: CreateGeofenceEventRequest): Promise<EventProcessingResult> {
    // Create the event record
    const event = await GeofenceEvent.create(eventData);

    try {
      // Validate the event
      await this.validateEvent(event);

      // Check for duplicates
      const isDuplicate = await this.checkForDuplicates(event);
      if (isDuplicate) {
        await event.updateStatus('duplicate');
        return {
          event,
          shouldNotify: false,
          reason: 'Duplicate event within deduplication window'
        };
      }

      // Check if event is in cooldown
      if (event.isInCooldown()) {
        await event.updateStatus('cooldown');
        return {
          event,
          shouldNotify: false,
          reason: 'Event is in cooldown period'
        };
      }

      // Evaluate on-device logic for privacy
      const shouldProcess = await this.evaluateOnDevice(event);
      if (!shouldProcess) {
        await event.updateStatus('processed');
        return {
          event,
          shouldNotify: false,
          reason: 'Event filtered by on-device evaluation'
        };
      }

      // Check for dense POI area bundling
      const bundlingResult = await this.checkForBundling(event);
      
      // Determine cooldown period
      const geofence = await Geofence.findById(event.geofence_id);
      const cooldownMinutes = geofence ? 
        this.COOLDOWN_PERIODS[geofence.geofence_type] : 
        this.COOLDOWN_PERIODS.arrival;

      // Set cooldown
      await event.setCooldown(cooldownMinutes);

      // Mark as processed
      await event.updateStatus('processed');

      return {
        event,
        shouldNotify: true,
        bundledWith: bundlingResult.bundledWith,
        cooldownMinutes,
        reason: bundlingResult.reason
      };

    } catch (error) {
      await event.updateStatus('failed');
      throw error;
    }
  }

  /**
   * Process multiple events in batch (for offline sync)
   */
  static async processBatchEvents(events: CreateGeofenceEventRequest[]): Promise<EventProcessingResult[]> {
    const results: EventProcessingResult[] = [];
    
    // Sort events by timestamp to process in chronological order
    const sortedEvents = events.sort((a, b) => 
      new Date(a.location.latitude).getTime() - new Date(b.location.latitude).getTime()
    );

    for (const eventData of sortedEvents) {
      try {
        const result = await this.processEvent(eventData);
        results.push(result);
      } catch (error) {
        console.error('Error processing batch event:', error);
        // Continue processing other events
      }
    }

    return results;
  }

  /**
   * Validate event data and context
   */
  private static async validateEvent(event: GeofenceEvent): Promise<void> {
    // Verify geofence exists and is active
    const geofence = await Geofence.findById(event.geofence_id);
    if (!geofence) {
      throw new ValidationError('Geofence not found', []);
    }

    if (!geofence.is_active) {
      throw new ValidationError('Geofence is not active', []);
    }

    // Verify task exists and is active
    const task = await Task.findById(event.task_id);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    if (task.status !== 'active') {
      throw new ValidationError('Task is not active', []);
    }

    // Verify user exists
    const user = await User.findById(event.user_id);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    // Validate location is within reasonable distance of geofence
    const distance = geofence.calculateDistance(event.location);
    const maxDistance = geofence.radius * 2; // Allow some buffer

    if (distance > maxDistance) {
      throw new ValidationError(
        `Event location too far from geofence center (${distance}m > ${maxDistance}m)`, 
        []
      );
    }
  }

  /**
   * Check for duplicate events within deduplication window
   */
  private static async checkForDuplicates(event: GeofenceEvent): Promise<boolean> {
    const recentEvents = await GeofenceEvent.findRecentEvents(
      event.user_id,
      event.task_id,
      event.event_type,
      this.DEDUPLICATION_WINDOW
    );

    // Check if there's a recent similar event
    for (const recentEvent of recentEvents) {
      if (recentEvent.id === event.id) continue;

      // Check if events are close in location (within 100m)
      const distance = event.calculateDistanceTo(recentEvent.location);
      if (distance <= 100) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate event on-device for privacy (simplified server-side version)
   */
  private static async evaluateOnDevice(event: GeofenceEvent): Promise<boolean> {
    // Get geofence details
    const geofence = await Geofence.findById(event.geofence_id);
    if (!geofence) return false;

    // Basic containment check
    const distance = geofence.calculateDistance(event.location);
    
    // For enter events, user should be within geofence
    if (event.event_type === 'enter') {
      return distance <= geofence.radius;
    }

    // For exit events, user should be outside geofence (with some buffer)
    if (event.event_type === 'exit') {
      return distance > geofence.radius * 0.8; // 80% of radius for buffer
    }

    // For dwell events, user should be within geofence
    if (event.event_type === 'dwell') {
      return distance <= geofence.radius;
    }

    return true;
  }

  /**
   * Check for notification bundling in dense POI areas
   */
  private static async checkForBundling(event: GeofenceEvent): Promise<{
    bundledWith?: string;
    reason: string;
  }> {
    // Find recent events within dense area radius
    const recentEvents = await this.findEventsInRadius(
      event.user_id,
      event.location,
      this.DENSE_AREA_RADIUS,
      30 // within 30 minutes
    );

    if (recentEvents.length >= this.DENSE_AREA_THRESHOLD) {
      // Find the primary event to bundle with (earliest unprocessed)
      const primaryEvent = recentEvents
        .filter(e => !e.notification_sent && !e.bundled_with)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];

      if (primaryEvent && primaryEvent.id !== event.id) {
        return {
          bundledWith: primaryEvent.id,
          reason: `Bundled with ${recentEvents.length} events in dense POI area`
        };
      }
    }

    return {
      reason: 'No bundling required'
    };
  }

  /**
   * Find events within radius of a location
   */
  private static async findEventsInRadius(
    userId: string,
    center: Coordinate,
    radiusMeters: number,
    withinMinutes: number
  ): Promise<GeofenceEvent[]> {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    const recentEvents = await GeofenceEvent.findByUserId(userId, { since });

    if (!recentEvents || !Array.isArray(recentEvents)) {
      return [];
    }

    return recentEvents.filter(event => {
      const distance = event.calculateDistanceTo(center);
      return distance <= radiusMeters;
    });
  }

  /**
   * Create notification bundles for dense areas
   */
  static async createNotificationBundles(events: GeofenceEvent[]): Promise<NotificationBundle[]> {
    const bundles: NotificationBundle[] = [];
    const processedEvents = new Set<string>();

    for (const event of events) {
      if (processedEvents.has(event.id)) continue;

      // Find nearby events to bundle
      const nearbyEvents = events.filter(e => {
        if (processedEvents.has(e.id) || e.id === event.id) return false;
        const distance = event.calculateDistanceTo(e.location);
        return distance <= this.DENSE_AREA_RADIUS;
      });

      if (nearbyEvents.length > 0) {
        // Create bundle
        const bundleEvents = [event, ...nearbyEvents];
        const bundle: NotificationBundle = {
          id: event.id,
          events: bundleEvents,
          location: this.calculateCenterPoint(bundleEvents.map(e => e.location)),
          radius: this.DENSE_AREA_RADIUS,
          message: this.generateBundleMessage(bundleEvents)
        };

        bundles.push(bundle);

        // Mark events as processed
        bundleEvents.forEach(e => processedEvents.add(e.id));
      } else {
        // Single event
        processedEvents.add(event.id);
      }
    }

    return bundles;
  }

  /**
   * Calculate center point of multiple coordinates
   */
  private static calculateCenterPoint(coordinates: Coordinate[]): Coordinate {
    if (coordinates.length === 0) {
      return { latitude: 0, longitude: 0 };
    }

    const sum = coordinates.reduce(
      (acc, coord) => ({
        latitude: acc.latitude + coord.latitude,
        longitude: acc.longitude + coord.longitude
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      latitude: sum.latitude / coordinates.length,
      longitude: sum.longitude / coordinates.length
    };
  }

  /**
   * Generate message for bundled notifications
   */
  private static generateBundleMessage(events: GeofenceEvent[]): string {
    const taskCount = new Set(events.map(e => e.task_id)).size;
    
    if (taskCount === 1) {
      return `You have ${events.length} reminders for this area`;
    } else {
      return `You have ${events.length} reminders for ${taskCount} tasks in this area`;
    }
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(userId: string, days: number = 7): Promise<{
    totalEvents: number;
    processed: number;
    duplicates: number;
    failed: number;
    bundled: number;
    averageProcessingTime: number;
  }> {
    const stats = await GeofenceEvent.getEventStats(userId, days);
    
    return {
      totalEvents: stats.total,
      processed: stats.byStatus.processed || 0,
      duplicates: stats.byStatus.duplicate || 0,
      failed: stats.byStatus.failed || 0,
      bundled: stats.bundledEvents,
      averageProcessingTime: 0 // TODO: Calculate from processing timestamps
    };
  }

  /**
   * Clean up old events and reset cooldowns
   */
  static async performMaintenance(): Promise<{
    eventsDeleted: number;
    cooldownsReset: number;
  }> {
    // Delete events older than 30 days
    const eventsDeleted = await GeofenceEvent.deleteOldEvents(30);

    // Reset expired cooldowns (this is handled by the database query, but we can count them)
    const cooldownsReset = 0; // TODO: Implement cooldown reset counting

    return {
      eventsDeleted,
      cooldownsReset
    };
  }

  /**
   * Process pending events (for background job)
   */
  static async processPendingEvents(limit: number = 100): Promise<EventProcessingResult[]> {
    const pendingEvents = await GeofenceEvent.findPendingEvents(limit);
    const results: EventProcessingResult[] = [];

    for (const event of pendingEvents) {
      try {
        // Convert to CreateGeofenceEventRequest format for processing
        const eventData: CreateGeofenceEventRequest = {
          user_id: event.user_id,
          task_id: event.task_id,
          geofence_id: event.geofence_id,
          event_type: event.event_type,
          location: event.location,
          confidence: event.confidence
        };

        const result = await this.processEvent(eventData);
        results.push(result);
      } catch (error) {
        console.error(`Error processing pending event ${event.id}:`, error);
        await event.updateStatus('failed');
      }
    }

    return results;
  }
}