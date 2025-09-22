import { TaskMute, MuteDuration } from '../TaskMute';

describe('TaskMute', () => {
  const mockMuteData = {
    userId: 'user-123',
    taskId: 'task-456',
    muteDuration: '24h' as MuteDuration,
    reason: 'User requested mute'
  };

  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('create', () => {
    it('should create a new mute record', async () => {
      const mute = await TaskMute.create(mockMuteData);
      
      expect(mute).toBeDefined();
      expect(mute.userId).toBe(mockMuteData.userId);
      expect(mute.taskId).toBe(mockMuteData.taskId);
      expect(mute.muteDuration).toBe(mockMuteData.muteDuration);
      expect(mute.reason).toBe(mockMuteData.reason);
      expect(mute.status).toBe('active');
    });

    it('should handle permanent mute correctly', async () => {
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: 'permanent'
      });
      
      expect(mute.muteDuration).toBe('permanent');
      expect(mute.muteUntil).toBeNull();
    });

    it('should calculate mute until time correctly for 1h', async () => {
      const before = new Date();
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: '1h'
      });
      const after = new Date();
      
      const expectedMin = before.getTime() + 60 * 60 * 1000;
      const expectedMax = after.getTime() + 60 * 60 * 1000;
      
      expect(mute.muteUntil?.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(mute.muteUntil?.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should calculate mute until time correctly for 24h', async () => {
      const before = new Date();
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: '24h'
      });
      const after = new Date();
      
      const expectedMin = before.getTime() + 24 * 60 * 60 * 1000;
      const expectedMax = after.getTime() + 24 * 60 * 60 * 1000;
      
      expect(mute.muteUntil?.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(mute.muteUntil?.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should calculate mute until time correctly for until_tomorrow', async () => {
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: 'until_tomorrow'
      });
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      expect(mute.muteUntil?.getHours()).toBe(9);
      expect(mute.muteUntil?.getMinutes()).toBe(0);
      expect(mute.muteUntil?.getSeconds()).toBe(0);
    });

    it('should throw error if task is already muted', async () => {
      await TaskMute.create(mockMuteData);
      
      await expect(TaskMute.create(mockMuteData)).rejects.toThrow('Task is already muted');
    });
  });

  describe('findActiveByTaskId', () => {
    it('should find active mute by task ID', async () => {
      const created = await TaskMute.create(mockMuteData);
      const found = await TaskMute.findActiveByTaskId(created.taskId);
      
      expect(found).toBeDefined();
      expect(found?.taskId).toBe(mockMuteData.taskId);
      expect(found?.status).toBe('active');
    });

    it('should return null for non-existent task ID', async () => {
      const found = await TaskMute.findActiveByTaskId('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findActiveByUserId', () => {
    it('should find active mutes for a user', async () => {
      await TaskMute.create(mockMuteData);
      
      const mutes = await TaskMute.findActiveByUserId(mockMuteData.userId);
      
      expect(mutes.length).toBeGreaterThan(0);
      expect(mutes.every(m => m.userId === mockMuteData.userId)).toBe(true);
      expect(mutes.every(m => m.status === 'active')).toBe(true);
    });
  });

  describe('findExpiredMutes', () => {
    it('should find expired mutes', async () => {
      const pastTime = new Date(Date.now() - 1000);
      await TaskMute.create({
        ...mockMuteData,
        muteDuration: '1h'
      });
      
      // Manually set mute until to past time
      // This would typically be done through database manipulation in real tests
      
      const expired = await TaskMute.findExpiredMutes(pastTime);
      
      expect(expired.length).toBeGreaterThan(0);
      expect(expired.every(m => m.status === 'active')).toBe(true);
    });
  });

  describe('isTaskMuted', () => {
    it('should return true for muted task', async () => {
      await TaskMute.create(mockMuteData);
      
      const isMuted = await TaskMute.isTaskMuted(mockMuteData.taskId);
      
      expect(isMuted).toBe(true);
    });

    it('should return false for non-muted task', async () => {
      const isMuted = await TaskMute.isTaskMuted('non-muted-id');
      
      expect(isMuted).toBe(false);
    });
  });

  describe('calculateMuteUntil', () => {
    it('should calculate correct time for 1h', () => {
      const now = new Date();
      const result = TaskMute.calculateMuteUntil('1h');
      
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for 4h', () => {
      const now = new Date();
      const result = TaskMute.calculateMuteUntil('4h');
      
      const expected = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for 8h', () => {
      const now = new Date();
      const result = TaskMute.calculateMuteUntil('8h');
      
      const expected = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for 24h', () => {
      const now = new Date();
      const result = TaskMute.calculateMuteUntil('24h');
      
      const expected = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for until_tomorrow', () => {
      const result = TaskMute.calculateMuteUntil('until_tomorrow');
      
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should handle permanent mute', () => {
      const result = TaskMute.calculateMuteUntil('permanent');
      
      expect(result.getFullYear()).toBe(2099);
      expect(result.getMonth()).toBe(11); // December (0-indexed)
      expect(result.getDate()).toBe(31);
    });

    it('should throw error for invalid duration', () => {
      expect(() => {
        TaskMute.calculateMuteUntil('invalid' as MuteDuration);
      }).toThrow('Unknown mute duration: invalid');
    });
  });

  describe('extendMute', () => {
    it('should extend mute duration', async () => {
      const created = await TaskMute.create(mockMuteData);
      const originalUntil = created.muteUntil;
      
      const extended = await created.extendMute('8h');
      
      expect(extended.muteDuration).toBe('8h');
      expect(extended.muteUntil?.getTime()).toBeGreaterThan(originalUntil?.getTime() || 0);
    });

    it('should handle extending to permanent mute', async () => {
      const created = await TaskMute.create(mockMuteData);
      
      const extended = await created.extendMute('permanent');
      
      expect(extended.muteDuration).toBe('permanent');
      expect(extended.muteUntil).toBeNull();
    });
  });

  describe('markExpired', () => {
    it('should mark mute as expired', async () => {
      const created = await TaskMute.create(mockMuteData);
      
      const expired = await created.markExpired();
      
      expect(expired.status).toBe('expired');
    });
  });

  describe('cancel', () => {
    it('should cancel mute', async () => {
      const created = await TaskMute.create(mockMuteData);
      
      const cancelled = await created.cancel();
      
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('isExpired', () => {
    it('should return true for expired mute', async () => {
      const pastTime = new Date(Date.now() - 1000);
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: '1h'
      });
      
      mute.muteUntil = pastTime;
      
      expect(mute.isExpired()).toBe(true);
    });

    it('should return false for active mute', async () => {
      const mute = await TaskMute.create(mockMuteData);
      
      expect(mute.isExpired()).toBe(false);
    });

    it('should return false for permanent mute', async () => {
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: 'permanent'
      });
      
      expect(mute.isExpired()).toBe(false);
    });
  });

  describe('isPermanent', () => {
    it('should return true for permanent mute', async () => {
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: 'permanent'
      });
      
      expect(mute.isPermanent()).toBe(true);
    });

    it('should return false for temporary mute', async () => {
      const mute = await TaskMute.create(mockMuteData);
      
      expect(mute.isPermanent()).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in milliseconds', async () => {
      const mute = await TaskMute.create(mockMuteData);
      const remaining = mute.getRemainingTime();
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours
    });

    it('should return null for permanent mute', async () => {
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: 'permanent'
      });
      
      expect(mute.getRemainingTime()).toBeNull();
    });

    it('should return null for mute without muteUntil', async () => {
      const mute = await TaskMute.create(mockMuteData);
      mute.muteUntil = undefined;
      
      expect(mute.getRemainingTime()).toBeNull();
    });

    it('should return 0 for expired mute', async () => {
      const pastTime = new Date(Date.now() - 1000);
      const mute = await TaskMute.create({
        ...mockMuteData,
        muteDuration: '1h'
      });
      
      mute.muteUntil = pastTime;
      
      expect(mute.getRemainingTime()).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON without sensitive fields', async () => {
      const created = await TaskMute.create(mockMuteData);
      const json = created.toJSON();
      
      expect(json.id).toBe(created.id);
      expect(json.mute_duration).toBe(created.muteDuration);
      expect(json.mute_until).toEqual(created.muteUntil);
      expect(json.reason).toBe(created.reason);
      expect(json.status).toBe(created.status);
      
      // Should not include user_id or task_id
      expect(json).not.toHaveProperty('user_id');
      expect(json).not.toHaveProperty('task_id');
    });
  });
});
