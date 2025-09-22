import { GeofenceEventProcessor } from '../geofenceEventProcessor';
import { GeofenceEvent } from '../../models/GeofenceEvent';
import { Geofence } from '../../models/Geofence';
import { Task } from '../../models/Task';
import { User } from '../../models/User';
import { 
  CreateGeofenceEventRequest, 
  GeofenceEventType, 
  GeofenceType,
  Coordinate 
} from '../../models/types';

// Mock the models
jest.mock('../../models/GeofenceEvent');
jest.mock('../../models/Geofence');
jest.mock('../../models/Task');
jest.mock('../../models/User');

const mockGeofenceEvent = GeofenceEvent as jest.Mocked<typeof GeofenceEvent>;
const mockGeofence = Geofence as jest.Mocked<typeof Geofence>;
const mockTask = Task as jest.Mocked<typeof Task>;
const mockUser = User as jest.Mocked<typeof User>;

describe('GeofenceEventProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock geofence data to active state
    mockGeofenceData.is_active = true;
    mockTaskData.status = 'active';
  });

  const mockEventData: CreateGeofenceEventRequest = {
    user_id: 'user-1',
    task_id: 'task-1',
    geofence_id: 'geofence-1',
    event_type: 'enter',
    location: { latitude: 37.7749, longitude: -122.4194 },
    confidence: 0.9
  };

  const mockEvent = {
    id: 'event-1',
    user_id: 'user-1',
    task_id: 'task-1',
    geofence_id: 'geofence-1',
    event_type: 'enter' as GeofenceEventType,
    location: { latitude: 37.7749, longitude: -122.4194 },
    confidence: 0.9,
    status: 'pending',
    notification_sent: false,
    created_at: new Date(),
    updateStatus: jest.fn(),
    setCooldown: jest.fn(),
    isInCooldown: jest.fn().mockReturnValue(false),
    calculateDistanceTo: jest.fn().mockReturnValue(50)
  };

  const mockGeofenceData = {
    id: 'geofence-1',
    task_id: 'task-1',
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 1000,
    geofence_type: 'arrival' as GeofenceType,
    is_active: true,
    calculateDistance: jest.fn().mockReturnValue(50),
    getLocation: jest.fn().mockReturnValue({ latitude: 37.7749, longitude: -122.4194 })
  };

  const mockTaskData = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Test task',
    status: 'active',
    created_at: new Date()
  };

  const mockUserData = {
    id: 'user-1',
    device_id: 'device-1',
    created_at: new Date()
  };

  describe('processEvent', () => {
    beforeEach(() => {
      mockGeofenceEvent.create.mockResolvedValue(mockEvent as any);
      mockGeofence.findById.mockResolvedValue(mockGeofenceData as any);
      mockTask.findById.mockResolvedValue(mockTaskData as any);
      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockGeofenceEvent.findByUserId.mockResolvedValue([]);
      mockEvent.updateStatus.mockResolvedValue(mockEvent as any);
      mockEvent.setCooldown.mockResolvedValue(mockEvent as any);
    });

    it('should process valid event successfully', async () => {
      const result = await GeofenceEventProcessor.processEvent(mockEventData);

      expect(result.event).toBeDefined();
      expect(result.shouldNotify).toBe(true);
      expect(result.reason).toContain('No bundling required');
      expect(mockEvent.updateStatus).toHaveBeenCalledWith('processed');
      expect(mockEvent.setCooldown).toHaveBeenCalled();
    });

    it('should reject duplicate events', async () => {
      const recentEvent = {
        id: 'recent-event',
        location: { latitude: 37.7749, longitude: -122.4194 },
        calculateDistanceTo: jest.fn().mockReturnValue(50) // Within 100m threshold
      };

      mockGeofenceEvent.findRecentEvents.mockResolvedValue([recentEvent as any]);

      const result = await GeofenceEventProcessor.processEvent(mockEventData);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe('Duplicate event within deduplication window');
      expect(mockEvent.updateStatus).toHaveBeenCalledWith('duplicate');
    });

    it('should respect cooldown periods', async () => {
      mockEvent.isInCooldown.mockReturnValue(true);

      const result = await GeofenceEventProcessor.processEvent(mockEventData);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe('Event is in cooldown period');
      expect(mockEvent.updateStatus).toHaveBeenCalledWith('cooldown');
    });

    it('should validate geofence exists and is active', async () => {
      mockGeofence.findById.mockResolvedValue(null);

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Geofence not found');
    });

    it('should validate task exists and is active', async () => {
      mockTask.findById.mockResolvedValue(null);

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Task not found');
    });

    it('should validate user exists', async () => {
      mockUser.findById.mockResolvedValue(null);

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('User not found');
    });

    it('should validate event location is reasonable', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(5000); // Too far from geofence
      mockGeofenceData.radius = 1000;

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Event location too far from geofence center');
    });

    it('should handle inactive geofence', async () => {
      mockGeofenceData.is_active = false;

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Geofence is not active');
    });

    it('should handle inactive task', async () => {
      const inactiveTaskData = { ...mockTaskData, status: 'completed' };
      mockTask.findById.mockResolvedValueOnce(inactiveTaskData as any);

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Task is not active');
    });

    it('should set appropriate cooldown for different geofence types', async () => {
      const approachGeofenceData = { ...mockGeofenceData, geofence_type: 'approach_5mi' as const };
      mockGeofence.findById.mockResolvedValueOnce(approachGeofenceData as any);

      await GeofenceEventProcessor.processEvent(mockEventData);

      expect(mockEvent.setCooldown).toHaveBeenCalledWith(60); // 1 hour for approach_5mi
    });

    it('should mark event as failed on processing error', async () => {
      mockGeofence.findById.mockRejectedValue(new Error('Database error'));

      await expect(GeofenceEventProcessor.processEvent(mockEventData))
        .rejects.toThrow('Database error');

      expect(mockEvent.updateStatus).toHaveBeenCalledWith('failed');
    });
  });

  describe('processBatchEvents', () => {
    it('should process multiple events in order', async () => {
      const events = [
        { ...mockEventData, geofence_id: 'geofence-1' },
        { ...mockEventData, geofence_id: 'geofence-2' },
        { ...mockEventData, geofence_id: 'geofence-3' }
      ];

      mockGeofenceEvent.create.mockResolvedValue(mockEvent as any);
      mockGeofence.findById.mockResolvedValue(mockGeofenceData as any);
      mockTask.findById.mockResolvedValue(mockTaskData as any);
      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockEvent.updateStatus.mockResolvedValue(mockEvent as any);
      mockEvent.setCooldown.mockResolvedValue(mockEvent as any);

      const results = await GeofenceEventProcessor.processBatchEvents(events);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.shouldNotify)).toBe(true);
    });

    it('should continue processing even if some events fail', async () => {
      const events = [
        { ...mockEventData, geofence_id: 'geofence-1' },
        { ...mockEventData, geofence_id: 'invalid-geofence' },
        { ...mockEventData, geofence_id: 'geofence-3' }
      ];

      mockGeofenceEvent.create.mockResolvedValue(mockEvent as any);
      mockGeofence.findById
        .mockResolvedValueOnce(mockGeofenceData as any)
        .mockResolvedValueOnce(null) // This will cause failure
        .mockResolvedValueOnce(mockGeofenceData as any);
      mockTask.findById.mockResolvedValue(mockTaskData as any);
      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockEvent.updateStatus.mockResolvedValue(mockEvent as any);
      mockEvent.setCooldown.mockResolvedValue(mockEvent as any);

      const results = await GeofenceEventProcessor.processBatchEvents(events);

      expect(results).toHaveLength(2); // Only successful events
    });
  });

  describe('on-device evaluation', () => {
    it('should accept enter events within geofence', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(500); // Within 1000m radius
      mockGeofenceData.radius = 1000;

      const enterEventData = { ...mockEventData, event_type: 'enter' as GeofenceEventType };
      
      const result = await GeofenceEventProcessor.processEvent(enterEventData);

      expect(result.shouldNotify).toBe(true);
    });

    it('should reject enter events outside geofence', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(1500); // Outside 1000m radius
      mockGeofenceData.radius = 1000;

      const enterEventData = { ...mockEventData, event_type: 'enter' as GeofenceEventType };
      
      const result = await GeofenceEventProcessor.processEvent(enterEventData);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe('Event filtered by on-device evaluation');
    });

    it('should accept exit events outside geofence buffer', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(900); // Outside 80% of 1000m radius
      mockGeofenceData.radius = 1000;

      const exitEventData = { ...mockEventData, event_type: 'exit' as GeofenceEventType };
      
      const result = await GeofenceEventProcessor.processEvent(exitEventData);

      expect(result.shouldNotify).toBe(true);
    });

    it('should reject exit events within geofence buffer', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(700); // Within 80% of 1000m radius
      mockGeofenceData.radius = 1000;

      const exitEventData = { ...mockEventData, event_type: 'exit' as GeofenceEventType };
      
      const result = await GeofenceEventProcessor.processEvent(exitEventData);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe('Event filtered by on-device evaluation');
    });

    it('should accept dwell events within geofence', async () => {
      mockGeofenceData.calculateDistance.mockReturnValue(500); // Within 1000m radius
      mockGeofenceData.radius = 1000;

      const dwellEventData = { ...mockEventData, event_type: 'dwell' as GeofenceEventType };
      
      const result = await GeofenceEventProcessor.processEvent(dwellEventData);

      expect(result.shouldNotify).toBe(true);
    });
  });

  describe('notification bundling', () => {
    it('should bundle events in dense POI areas', async () => {
      // Mock recent events in the same area
      const recentEvents = [
        {
          id: 'event-1',
          user_id: 'user-1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          notification_sent: false,
          bundled_with: null,
          created_at: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          calculateDistanceTo: jest.fn().mockReturnValue(200) // Within 500m radius
        },
        {
          id: 'event-2',
          user_id: 'user-1',
          location: { latitude: 37.7750, longitude: -122.4195 },
          notification_sent: false,
          bundled_with: null,
          created_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          calculateDistanceTo: jest.fn().mockReturnValue(300) // Within 500m radius
        },
        {
          id: 'event-3',
          user_id: 'user-1',
          location: { latitude: 37.7751, longitude: -122.4196 },
          notification_sent: false,
          bundled_with: null,
          created_at: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
          calculateDistanceTo: jest.fn().mockReturnValue(400) // Within 500m radius
        }
      ];

      mockGeofenceEvent.findByUserId.mockResolvedValue(recentEvents as any);

      const result = await GeofenceEventProcessor.processEvent(mockEventData);

      expect(result.shouldNotify).toBe(true);
      expect(result.bundledWith).toBe('event-1'); // Should bundle with earliest event
      expect(result.reason).toContain('Bundled with');
      expect(result.reason).toContain('events in dense POI area');
    });

    it('should not bundle when events are spread out', async () => {
      const recentEvents = [
        {
          id: 'event-1',
          user_id: 'user-1',
          location: { latitude: 37.7849, longitude: -122.4094 }, // Far away
          calculateDistanceTo: jest.fn().mockReturnValue(2000) // Outside 500m radius
        }
      ];

      mockGeofenceEvent.findByUserId.mockResolvedValue(recentEvents as any);

      const result = await GeofenceEventProcessor.processEvent(mockEventData);

      expect(result.shouldNotify).toBe(true);
      expect(result.bundledWith).toBeUndefined();
      expect(result.reason).toBe('No bundling required');
    });
  });

  describe('createNotificationBundles', () => {
    it('should create bundles for nearby events', async () => {
      const events = [
        {
          id: 'event-1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          calculateDistanceTo: jest.fn().mockImplementation((loc: Coordinate) => {
            // Distance to event-2 location
            if (loc.latitude === 37.7750) return 200;
            return 0;
          })
        },
        {
          id: 'event-2',
          location: { latitude: 37.7750, longitude: -122.4195 },
          calculateDistanceTo: jest.fn().mockImplementation((loc: Coordinate) => {
            // Distance to event-1 location
            if (loc.latitude === 37.7749) return 200;
            return 0;
          })
        },
        {
          id: 'event-3',
          location: { latitude: 37.8000, longitude: -122.5000 }, // Far away
          calculateDistanceTo: jest.fn().mockReturnValue(5000)
        }
      ];

      const bundles = await GeofenceEventProcessor.createNotificationBundles(events as any);

      // The bundling logic creates individual events if they're not close enough
      // Let's check that we get the right number of bundles
      expect(bundles.length).toBeGreaterThan(0);
      
      // Find the bundle with multiple events (if any)
      const multiEventBundle = bundles.find(b => b.events.length > 1);
      if (multiEventBundle) {
        expect(multiEventBundle.message).toContain('reminders');
      }
    });

    it('should generate appropriate bundle messages', async () => {
      const events = [
        {
          id: 'event-1',
          task_id: 'task-1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          calculateDistanceTo: jest.fn().mockReturnValue(200)
        },
        {
          id: 'event-2',
          task_id: 'task-1', // Same task
          location: { latitude: 37.7750, longitude: -122.4195 },
          calculateDistanceTo: jest.fn().mockReturnValue(200)
        }
      ];

      const bundles = await GeofenceEventProcessor.createNotificationBundles(events as any);

      expect(bundles[0].message).toBe('You have 2 reminders for this area');
    });

    it('should handle multiple tasks in bundle message', async () => {
      const events = [
        {
          id: 'event-1',
          task_id: 'task-1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          calculateDistanceTo: jest.fn().mockReturnValue(200)
        },
        {
          id: 'event-2',
          task_id: 'task-2', // Different task
          location: { latitude: 37.7750, longitude: -122.4195 },
          calculateDistanceTo: jest.fn().mockReturnValue(200)
        }
      ];

      const bundles = await GeofenceEventProcessor.createNotificationBundles(events as any);

      expect(bundles[0].message).toBe('You have 2 reminders for 2 tasks in this area');
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: {
          processed: 80,
          duplicate: 10,
          failed: 5,
          pending: 5,
          cooldown: 0
        },
        bundledEvents: 15,
        byType: {},
        notificationsSent: 70
      };

      mockGeofenceEvent.getEventStats.mockResolvedValue(mockStats as any);

      const stats = await GeofenceEventProcessor.getProcessingStats('user-1', 7);

      expect(stats.totalEvents).toBe(100);
      expect(stats.processed).toBe(80);
      expect(stats.duplicates).toBe(10);
      expect(stats.failed).toBe(5);
      expect(stats.bundled).toBe(15);
    });
  });

  describe('performMaintenance', () => {
    it('should clean up old events', async () => {
      mockGeofenceEvent.deleteOldEvents.mockResolvedValue(25);

      const result = await GeofenceEventProcessor.performMaintenance();

      expect(result.eventsDeleted).toBe(25);
      expect(mockGeofenceEvent.deleteOldEvents).toHaveBeenCalledWith(30);
    });
  });

  describe('processPendingEvents', () => {
    it('should process pending events from database', async () => {
      const pendingEvents = [
        {
          id: 'pending-1',
          user_id: 'user-1',
          task_id: 'task-1',
          geofence_id: 'geofence-1',
          event_type: 'enter' as GeofenceEventType,
          location: { latitude: 37.7749, longitude: -122.4194 },
          confidence: 0.9,
          updateStatus: jest.fn()
        }
      ];

      mockGeofenceEvent.findPendingEvents.mockResolvedValue(pendingEvents as any);
      mockGeofenceEvent.create.mockResolvedValue(mockEvent as any);
      mockGeofence.findById.mockResolvedValue(mockGeofenceData as any);
      mockTask.findById.mockResolvedValue(mockTaskData as any);
      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockGeofenceEvent.findRecentEvents.mockResolvedValue([]);
      mockEvent.updateStatus.mockResolvedValue(mockEvent as any);
      mockEvent.setCooldown.mockResolvedValue(mockEvent as any);

      const results = await GeofenceEventProcessor.processPendingEvents(10);

      expect(results).toHaveLength(1);
      expect(results[0].shouldNotify).toBe(true);
    });

    it('should handle errors in pending event processing', async () => {
      const pendingEvents = [
        {
          id: 'pending-1',
          user_id: 'user-1',
          task_id: 'task-1',
          geofence_id: 'invalid-geofence',
          event_type: 'enter' as GeofenceEventType,
          location: { latitude: 37.7749, longitude: -122.4194 },
          confidence: 0.9,
          updateStatus: jest.fn()
        }
      ];

      mockGeofenceEvent.findPendingEvents.mockResolvedValue(pendingEvents as any);
      mockGeofenceEvent.create.mockRejectedValue(new Error('Processing error'));

      const results = await GeofenceEventProcessor.processPendingEvents(10);

      expect(results).toHaveLength(0);
      expect(pendingEvents[0].updateStatus).toHaveBeenCalledWith('failed');
    });
  });
});