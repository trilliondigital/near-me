import { EventQueueService } from '../eventQueueService';
import { GeofenceEventProcessor } from '../geofenceEventProcessor';
import { GeofenceEvent } from '../../models/GeofenceEvent';
import { CreateGeofenceEventRequest, GeofenceEventType } from '../../models/types';

// Mock the dependencies
jest.mock('../geofenceEventProcessor');
jest.mock('../../models/GeofenceEvent');

const mockGeofenceEventProcessor = GeofenceEventProcessor as jest.Mocked<typeof GeofenceEventProcessor>;
const mockGeofenceEvent = GeofenceEvent as jest.Mocked<typeof GeofenceEvent>;

describe('EventQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the internal queue
    (EventQueueService as any).eventQueue.clear();
    (EventQueueService as any).processing.clear();
  });

  const mockEventData: CreateGeofenceEventRequest = {
    user_id: 'user-1',
    task_id: 'task-1',
    geofence_id: 'geofence-1',
    event_type: 'enter',
    location: { latitude: 37.7749, longitude: -122.4194 },
    confidence: 0.9
  };

  const mockProcessingResult = {
    event: {
      id: 'event-1',
      user_id: 'user-1',
      shouldNotify: true
    },
    shouldNotify: true,
    reason: 'Event processed successfully'
  };

  describe('enqueueEvent', () => {
    it('should add event to queue and process immediately', async () => {
      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockProcessingResult as any);

      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      expect(eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockGeofenceEventProcessor.processEvent).toHaveBeenCalledWith(mockEventData);
    });

    it('should keep event in queue if processing fails', async () => {
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = EventQueueService.getQueueStats();
      expect(stats.pending).toBe(1);
    });
  });

  describe('enqueueBatchEvents', () => {
    it('should enqueue multiple events', async () => {
      const events = [
        { ...mockEventData, geofence_id: 'geofence-1' },
        { ...mockEventData, geofence_id: 'geofence-2' },
        { ...mockEventData, geofence_id: 'geofence-3' }
      ];

      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockProcessingResult as any);

      const eventIds = await EventQueueService.enqueueBatchEvents(events);

      expect(eventIds).toHaveLength(3);
      expect(eventIds.every(id => id.match(/^evt_\d+_[a-z0-9]+$/))).toBe(true);
    });
  });

  describe('processQueue', () => {
    it('should process all pending events', async () => {
      // Add events to queue manually
      const eventId1 = await EventQueueService.enqueueEvent(mockEventData);
      const eventId2 = await EventQueueService.enqueueEvent({
        ...mockEventData,
        geofence_id: 'geofence-2'
      });

      // Mock processing to fail initially so events stay in queue
      mockGeofenceEventProcessor.processEvent.mockRejectedValueOnce(new Error('Temp failure'));
      mockGeofenceEventProcessor.processEvent.mockRejectedValueOnce(new Error('Temp failure'));

      // Wait for initial processing attempts
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now mock successful processing
      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockProcessingResult as any);

      const stats = await EventQueueService.processQueue();

      expect(stats.processed).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it('should handle processing failures', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = await EventQueueService.processQueue();

      expect(stats.retried).toBe(1);
    });

    it('should skip events in cooldown', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail initially
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Process queue again immediately (should skip due to retry delay)
      const stats = await EventQueueService.processQueue();

      expect(stats.processed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.retried).toBe(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return accurate queue statistics', async () => {
      // Add some events
      await EventQueueService.enqueueEvent(mockEventData);
      await EventQueueService.enqueueEvent({
        ...mockEventData,
        geofence_id: 'geofence-2'
      });

      // Mock processing to fail so events stay in queue
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for processing attempts
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = EventQueueService.getQueueStats();

      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.totalRetries).toBe(2);
    });

    it('should count failed events correctly', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail multiple times to exceed max retries
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually set attempts to max to simulate failure
      const queue = (EventQueueService as any).eventQueue;
      const queuedEvent = queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.attempts = 3; // Max retries
      }

      const stats = EventQueueService.getQueueStats();

      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });
  });

  describe('getQueuedEventsForUser', () => {
    it('should return events for specific user', async () => {
      await EventQueueService.enqueueEvent(mockEventData);
      await EventQueueService.enqueueEvent({
        ...mockEventData,
        user_id: 'user-2'
      });

      // Mock processing to fail so events stay in queue
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for processing attempts
      await new Promise(resolve => setTimeout(resolve, 10));

      const userEvents = EventQueueService.getQueuedEventsForUser('user-1');

      expect(userEvents).toHaveLength(1);
      expect(userEvents[0].eventData.user_id).toBe('user-1');
    });

    it('should sort events by attempts', async () => {
      const eventId1 = await EventQueueService.enqueueEvent(mockEventData);
      const eventId2 = await EventQueueService.enqueueEvent({
        ...mockEventData,
        geofence_id: 'geofence-2'
      });

      // Mock processing to fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for processing attempts
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually set different attempt counts
      const queue = (EventQueueService as any).eventQueue;
      const event1 = queue.get(eventId1);
      const event2 = queue.get(eventId2);
      if (event1) event1.attempts = 2;
      if (event2) event2.attempts = 1;

      const userEvents = EventQueueService.getQueuedEventsForUser('user-1');

      expect(userEvents).toHaveLength(2);
      expect(userEvents[0].attempts).toBe(1); // Should be sorted by attempts
      expect(userEvents[1].attempts).toBe(2);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove event from queue', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail so event stays in queue
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      const removed = EventQueueService.removeFromQueue(eventId);

      expect(removed).toBe(true);

      const stats = EventQueueService.getQueueStats();
      expect(stats.pending).toBe(0);
    });

    it('should not remove event currently being processed', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Manually add to processing set
      (EventQueueService as any).processing.add(eventId);

      const removed = EventQueueService.removeFromQueue(eventId);

      expect(removed).toBe(false);
    });
  });

  describe('retryEvent', () => {
    it('should retry failed event', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail initially
      mockGeofenceEventProcessor.processEvent.mockRejectedValueOnce(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now mock successful processing
      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockProcessingResult as any);

      const success = await EventQueueService.retryEvent(eventId);

      expect(success).toBe(true);
    });

    it('should return false for non-existent event', async () => {
      const success = await EventQueueService.retryEvent('non-existent-id');

      expect(success).toBe(false);
    });
  });

  describe('clearOldFailedEvents', () => {
    it('should clear old failed events', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually set event as failed and old
      const queue = (EventQueueService as any).eventQueue;
      const queuedEvent = queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.attempts = 3; // Max retries (failed)
        queuedEvent.lastAttempt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      const cleared = EventQueueService.clearOldFailedEvents(24);

      expect(cleared).toBe(1);

      const stats = EventQueueService.getQueueStats();
      expect(stats.failed).toBe(0);
    });
  });

  describe('syncOfflineEvents', () => {
    it('should sync offline events successfully', async () => {
      const events = [
        mockEventData,
        { ...mockEventData, geofence_id: 'geofence-2' },
        { ...mockEventData, geofence_id: 'geofence-3' }
      ];

      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockProcessingResult as any);

      const result = await EventQueueService.syncOfflineEvents('user-1', events);

      expect(result.processed).toBe(3);
      expect(result.queued).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    it('should detect and skip duplicate events', async () => {
      const events = [mockEventData];

      const existingEvent = {
        id: 'existing-event',
        calculateDistanceTo: jest.fn().mockReturnValue(50) // Within 100m threshold
      };

      mockGeofenceEvent.findRecentEvents.mockResolvedValue([existingEvent as any]);

      const result = await EventQueueService.syncOfflineEvents('user-1', events);

      expect(result.processed).toBe(0);
      expect(result.queued).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.duplicates).toBe(1);
    });

    it('should queue events that fail immediate processing', async () => {
      const events = [mockEventData];

      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      const result = await EventQueueService.syncOfflineEvents('user-1', events);

      expect(result.processed).toBe(0);
      expect(result.queued).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    it('should handle errors in sync process', async () => {
      const events = [mockEventData];

      mockGeofenceEvent.findRecentEvents.mockRejectedValue(new Error('Database error'));

      const result = await EventQueueService.syncOfflineEvents('user-1', events);

      expect(result.processed).toBe(0);
      expect(result.queued).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.duplicates).toBe(0);
    });
  });

  describe('queue processor', () => {
    it('should start background queue processor', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      EventQueueService.startQueueProcessor(1); // 1 minute interval

      expect(setIntervalSpy).toHaveBeenCalledTimes(2); // One for processing, one for cleanup
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000); // 1 minute
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3600000); // 1 hour

      setIntervalSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle processing errors gracefully', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to throw error
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Unexpected error'));

      // Wait for processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = EventQueueService.getQueueStats();
      expect(stats.pending).toBe(1); // Event should still be in queue for retry
    });

    it('should implement exponential backoff for retries', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      const queue = (EventQueueService as any).eventQueue;
      const queuedEvent = queue.get(eventId);

      expect(queuedEvent.attempts).toBe(1);
      expect(queuedEvent.nextRetry).toBeDefined();
      expect(queuedEvent.error).toBe('Processing failed');
    });

    it('should stop retrying after max attempts', async () => {
      const eventId = await EventQueueService.enqueueEvent(mockEventData);

      // Mock processing to always fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));

      // Wait for initial processing attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually set attempts to max
      const queue = (EventQueueService as any).eventQueue;
      const queuedEvent = queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.attempts = 3; // Max retries
      }

      const stats = await EventQueueService.processQueue();

      expect(stats.failed).toBe(1);
      expect(stats.retried).toBe(0);
    });
  });
});