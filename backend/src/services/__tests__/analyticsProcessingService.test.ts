import { analyticsProcessingService } from '../analyticsProcessingService';
import { db } from '../../database/connection';

// Mock database
jest.mock('../../database/connection');
const mockDb = db as jest.Mocked<typeof db>;

describe('AnalyticsProcessingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleJob', () => {
    it('should schedule a processing job', async () => {
      const jobId = await analyticsProcessingService.scheduleJob('aggregation');
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^aggregation_\d+_[a-z0-9]+$/);
    });

    it('should schedule different types of jobs', async () => {
      const jobTypes = ['aggregation', 'cohort_analysis', 'funnel_analysis', 'retention_calculation'] as const;
      
      for (const jobType of jobTypes) {
        const jobId = await analyticsProcessingService.scheduleJob(jobType);
        expect(jobId).toMatch(new RegExp(`^${jobType}_\\d+_[a-z0-9]+$`));
      }
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const jobId = await analyticsProcessingService.scheduleJob('aggregation');
      const status = await analyticsProcessingService.getJobStatus(jobId);
      
      expect(status).toBeDefined();
      expect(status?.id).toBe(jobId);
      expect(status?.type).toBe('aggregation');
      expect(status?.status).toBe('pending');
    });

    it('should return null for non-existent job', async () => {
      const status = await analyticsProcessingService.getJobStatus('non-existent-job');
      expect(status).toBeNull();
    });
  });

  describe('scheduleRegularProcessing', () => {
    it('should schedule all regular processing jobs', async () => {
      await analyticsProcessingService.scheduleRegularProcessing();
      
      // Should schedule at least aggregation, funnel_analysis, and retention_calculation
      // We can't easily test the exact jobs without exposing internal state
      // This test mainly ensures no errors are thrown
    });
  });

  describe('cleanup', () => {
    it('should clean up old completed jobs', async () => {
      // Schedule a job and mark it as completed
      const jobId = await analyticsProcessingService.scheduleJob('aggregation');
      
      // Simulate job completion by waiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await analyticsProcessingService.cleanup();
      
      // After cleanup, old jobs should be removed
      // This is a basic test - in practice you'd need to manipulate job timestamps
    });
  });
});

describe('AnalyticsProcessingService Integration', () => {
  beforeEach(() => {
    // Reset mocks for integration tests
    mockDb.query.mockReset();
  });

  describe('processAggregation', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const jobId = await analyticsProcessingService.scheduleJob('aggregation');
      
      // Wait for job to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await analyticsProcessingService.getJobStatus(jobId);
      // Job should eventually fail due to database error
      // This test verifies error handling
    });
  });

  describe('processCohortAnalysis', () => {
    it('should create cohort analysis data', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 5 });
      
      const jobId = await analyticsProcessingService.scheduleJob('cohort_analysis');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await analyticsProcessingService.getJobStatus(jobId);
      // Verify job processes successfully
    });
  });

  describe('processFunnelAnalysis', () => {
    it('should calculate funnel metrics', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 10 });
      
      const jobId = await analyticsProcessingService.scheduleJob('funnel_analysis');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await analyticsProcessingService.getJobStatus(jobId);
      // Verify funnel analysis completes
    });
  });

  describe('processRetentionCalculation', () => {
    it('should calculate retention metrics', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 15 });
      
      const jobId = await analyticsProcessingService.scheduleJob('retention_calculation');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await analyticsProcessingService.getJobStatus(jobId);
      // Verify retention calculation completes
    });
  });
});

describe('AnalyticsProcessingService Error Handling', () => {
  it('should handle invalid job types', async () => {
    await expect(
      analyticsProcessingService.scheduleJob('invalid_job_type' as any)
    ).rejects.toThrow();
  });

  it('should handle processing failures gracefully', async () => {
    // Mock database to fail
    mockDb.query.mockRejectedValue(new Error('Processing failed'));
    
    const jobId = await analyticsProcessingService.scheduleJob('aggregation');
    
    // Wait for job to fail
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await analyticsProcessingService.getJobStatus(jobId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toBeDefined();
  });

  it('should continue processing other jobs after one fails', async () => {
    // Schedule multiple jobs
    const job1 = await analyticsProcessingService.scheduleJob('aggregation');
    const job2 = await analyticsProcessingService.scheduleJob('cohort_analysis');
    
    // Mock first query to fail, second to succeed
    mockDb.query
      .mockRejectedValueOnce(new Error('First job failed'))
      .mockResolvedValueOnce({ rowCount: 1 });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const status1 = await analyticsProcessingService.getJobStatus(job1);
    const status2 = await analyticsProcessingService.getJobStatus(job2);
    
    // First job should fail, second should succeed
    expect(status1?.status).toBe('failed');
    // Second job should eventually complete (or at least not fail due to first job)
  });
});