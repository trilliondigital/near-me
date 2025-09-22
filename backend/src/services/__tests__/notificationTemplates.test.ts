import { NotificationTemplates, NotificationTemplateContext } from '../notificationTemplates';

describe('NotificationTemplates', () => {
  const baseContext: NotificationTemplateContext = {
    taskTitle: 'Buy groceries',
    taskDescription: 'Get milk and bread',
    locationName: 'Safeway',
    style: 'standard'
  };

  describe('generateApproachTemplate', () => {
    it('should generate approach template with distance in miles', () => {
      const context = {
        ...baseContext,
        distance: 8047, // 5 miles in meters
        distanceUnit: 'miles' as const
      };

      const template = NotificationTemplates.generateApproachTemplate(context);

      expect(template.title).toBe('Approaching Safeway');
      expect(template.body).toBe('You\'re 5 miles from Safeway — Buy groceries?');
      expect(template.actions).toHaveLength(4);
      expect(template.actions[0].type).toBe('complete');
    });

    it('should generate approach template for close distances', () => {
      const context = {
        ...baseContext,
        distance: 500, // 500 meters
        distanceUnit: 'meters' as const
      };

      const template = NotificationTemplates.generateApproachTemplate(context);

      expect(template.title).toBe('Near Safeway');
      expect(template.body).toBe('You\'re close to Safeway — Buy groceries?');
    });

    it('should include description for detailed style', () => {
      const context = {
        ...baseContext,
        style: 'detailed' as const,
        distance: 8047
      };

      const template = NotificationTemplates.generateApproachTemplate(context);

      expect(template.body).toContain('Get milk and bread');
    });

    it('should limit actions for minimal style', () => {
      const context = {
        ...baseContext,
        style: 'minimal' as const,
        distance: 8047
      };

      const template = NotificationTemplates.generateApproachTemplate(context);

      expect(template.actions).toHaveLength(2);
    });
  });

  describe('generateArrivalTemplate', () => {
    it('should generate arrival template', () => {
      const template = NotificationTemplates.generateArrivalTemplate(baseContext);

      expect(template.title).toBe('Arrived at Safeway');
      expect(template.body).toBe('Arriving at Safeway — Buy groceries now?');
      expect(template.actions).toHaveLength(4);
      expect(template.actions.some(a => a.type === 'snooze_1h')).toBe(true);
    });

    it('should use minimal body for minimal style', () => {
      const context = { ...baseContext, style: 'minimal' as const };
      const template = NotificationTemplates.generateArrivalTemplate(context);

      expect(template.body).toBe('Buy groceries now?');
      expect(template.actions).toHaveLength(2);
    });

    it('should include description for detailed style', () => {
      const context = { ...baseContext, style: 'detailed' as const };
      const template = NotificationTemplates.generateArrivalTemplate(context);

      expect(template.body).toContain('Get milk and bread');
    });
  });

  describe('generatePostArrivalTemplate', () => {
    it('should generate post-arrival template', () => {
      const template = NotificationTemplates.generatePostArrivalTemplate(baseContext);

      expect(template.title).toBe('Still at Safeway');
      expect(template.body).toBe('Still at Safeway — buy groceries?');
      expect(template.actions).toHaveLength(4);
      expect(template.actions.some(a => a.type === 'snooze_today')).toBe(true);
    });

    it('should use simple body for minimal style', () => {
      const context = { ...baseContext, style: 'minimal' as const };
      const template = NotificationTemplates.generatePostArrivalTemplate(context);

      expect(template.body).toBe('Still need to buy groceries?');
    });

    it('should include description for detailed style', () => {
      const context = { ...baseContext, style: 'detailed' as const };
      const template = NotificationTemplates.generatePostArrivalTemplate(context);

      expect(template.body).toContain('Get milk and bread');
    });
  });

  describe('generateBundleTemplate', () => {
    it('should generate bundle template for single task', () => {
      const template = NotificationTemplates.generateBundleTemplate(
        1, // taskCount
        3, // reminderCount
        'Downtown',
        'standard'
      );

      expect(template.title).toBe('3 reminders nearby');
      expect(template.body).toBe('You have 3 reminders for this area');
      expect(template.actions).toHaveLength(4);
    });

    it('should generate bundle template for multiple tasks', () => {
      const template = NotificationTemplates.generateBundleTemplate(
        3, // taskCount
        5, // reminderCount
        'Downtown',
        'standard'
      );

      expect(template.title).toBe('5 reminders nearby');
      expect(template.body).toBe('You have 5 reminders for 3 tasks in this area');
    });

    it('should include location for detailed style', () => {
      const template = NotificationTemplates.generateBundleTemplate(
        2,
        4,
        'Downtown',
        'detailed'
      );

      expect(template.body).toContain('near Downtown');
    });
  });

  describe('getCategoryDisplayName', () => {
    it('should return correct display names for POI categories', () => {
      expect(NotificationTemplates.getCategoryDisplayName('gas')).toBe('gas station');
      expect(NotificationTemplates.getCategoryDisplayName('pharmacy')).toBe('pharmacy');
      expect(NotificationTemplates.getCategoryDisplayName('grocery')).toBe('grocery store');
      expect(NotificationTemplates.getCategoryDisplayName('bank')).toBe('bank');
      expect(NotificationTemplates.getCategoryDisplayName('post_office')).toBe('post office');
    });

    it('should return category name for unknown categories', () => {
      expect(NotificationTemplates.getCategoryDisplayName('unknown' as any)).toBe('unknown');
    });
  });

  describe('formatDistance', () => {
    it('should format distance in miles for long distances', () => {
      const result = NotificationTemplates.formatDistance(8047); // 5 miles

      expect(result.value).toBe(5);
      expect(result.unit).toBe('miles');
      expect(result.display).toBe('5 miles');
    });

    it('should format distance in miles with decimal for fractional miles', () => {
      const result = NotificationTemplates.formatDistance(2414); // 1.5 miles

      expect(result.value).toBe(1.5);
      expect(result.unit).toBe('miles');
      expect(result.display).toBe('1.5 miles');
    });

    it('should format distance in meters for medium distances', () => {
      const result = NotificationTemplates.formatDistance(500);

      expect(result.value).toBe(500);
      expect(result.unit).toBe('meters');
      expect(result.display).toBe('500m');
    });

    it('should round meters to nearest 10 for readability', () => {
      const result = NotificationTemplates.formatDistance(347);

      expect(result.value).toBe(350);
      expect(result.unit).toBe('meters');
      expect(result.display).toBe('350m');
    });

    it('should show "very close" for very short distances', () => {
      const result = NotificationTemplates.formatDistance(50);

      expect(result.value).toBe(50);
      expect(result.unit).toBe('meters');
      expect(result.display).toBe('very close');
    });

    it('should handle singular mile correctly', () => {
      const result = NotificationTemplates.formatDistance(1609); // 1 mile

      expect(result.display).toBe('1 mile');
    });
  });

  describe('validateContext', () => {
    it('should validate valid context', () => {
      expect(() => NotificationTemplates.validateContext(baseContext)).not.toThrow();
    });

    it('should throw error for missing task title', () => {
      const invalidContext = { ...baseContext, taskTitle: '' };
      expect(() => NotificationTemplates.validateContext(invalidContext)).toThrow('Task title is required');
    });

    it('should throw error for missing location name', () => {
      const invalidContext = { ...baseContext, locationName: '' };
      expect(() => NotificationTemplates.validateContext(invalidContext)).toThrow('Location name is required');
    });

    it('should throw error for missing style', () => {
      const invalidContext = { ...baseContext, style: undefined as any };
      expect(() => NotificationTemplates.validateContext(invalidContext)).toThrow('Notification style is required');
    });
  });

  describe('action types', () => {
    it('should include correct actions for approach notifications', () => {
      const template = NotificationTemplates.generateApproachTemplate(baseContext);
      const actionTypes = template.actions.map(a => a.type);

      expect(actionTypes).toContain('complete');
      expect(actionTypes).toContain('snooze_15m');
      expect(actionTypes).toContain('open_map');
      expect(actionTypes).toContain('mute');
      expect(actionTypes).not.toContain('snooze_today');
    });

    it('should include correct actions for arrival notifications', () => {
      const template = NotificationTemplates.generateArrivalTemplate(baseContext);
      const actionTypes = template.actions.map(a => a.type);

      expect(actionTypes).toContain('complete');
      expect(actionTypes).toContain('snooze_15m');
      expect(actionTypes).toContain('snooze_1h');
      expect(actionTypes).toContain('mute');
      expect(actionTypes).not.toContain('open_map');
    });

    it('should include correct actions for post-arrival notifications', () => {
      const template = NotificationTemplates.generatePostArrivalTemplate(baseContext);
      const actionTypes = template.actions.map(a => a.type);

      expect(actionTypes).toContain('complete');
      expect(actionTypes).toContain('snooze_1h');
      expect(actionTypes).toContain('snooze_today');
      expect(actionTypes).toContain('mute');
      expect(actionTypes).not.toContain('snooze_15m');
    });

    it('should mark mute action as destructive', () => {
      const template = NotificationTemplates.generateApproachTemplate(baseContext);
      const muteAction = template.actions.find(a => a.type === 'mute');

      expect(muteAction?.destructive).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very long task titles gracefully', () => {
      const longTitleContext = {
        ...baseContext,
        taskTitle: 'This is a very long task title that might cause issues with notification display and should be handled gracefully'
      };

      const template = NotificationTemplates.generateApproachTemplate(longTitleContext);
      expect(template.body).toContain(longTitleContext.taskTitle);
    });

    it('should handle empty task description', () => {
      const noDescContext = {
        ...baseContext,
        taskDescription: undefined,
        style: 'detailed' as const
      };

      const template = NotificationTemplates.generateApproachTemplate(noDescContext);
      expect(template.body).not.toContain('undefined');
    });

    it('should handle special characters in location names', () => {
      const specialCharContext = {
        ...baseContext,
        locationName: 'Trader Joe\'s & Co.'
      };

      const template = NotificationTemplates.generateApproachTemplate(specialCharContext);
      expect(template.body).toContain('Trader Joe\'s & Co.');
    });
  });
});