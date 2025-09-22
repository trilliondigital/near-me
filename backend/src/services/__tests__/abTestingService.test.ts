import { abTestingService } from '../abTestingService';
import { db } from '../../database/connection';

// Mock database
jest.mock('../../database/connection');
const mockDb = db as jest.Mocked<typeof db>;

describe('ABTestingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExperiment', () => {
    it('should create a new A/B experiment', async () => {
      const mockExperimentId = 'test-experiment-123';
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockExperimentId }]
      });

      const experiment = {
        name: 'Test Notification Style',
        description: 'Testing different notification styles',
        status: 'draft' as const,
        trafficAllocation: 0.5,
        controlVariant: { style: 'standard' },
        testVariant: { style: 'minimal' },
        primaryMetric: 'task_completion_rate',
        secondaryMetrics: ['engagement_rate']
      };

      const experimentId = await abTestingService.createExperiment(experiment);

      expect(experimentId).toBe(mockExperimentId);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ab_experiments'),
        expect.arrayContaining([
          experiment.name,
          experiment.description,
          experiment.status,
          experiment.trafficAllocation,
          undefined, // startDate
          undefined, // endDate
          JSON.stringify(experiment.controlVariant),
          JSON.stringify(experiment.testVariant),
          experiment.primaryMetric,
          experiment.secondaryMetrics
        ])
      );
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const experiment = {
        name: 'Test Experiment',
        status: 'draft' as const,
        trafficAllocation: 0.5,
        controlVariant: { version: 'A' },
        testVariant: { version: 'B' },
        primaryMetric: 'conversion_rate',
        secondaryMetrics: []
      };

      await expect(abTestingService.createExperiment(experiment)).rejects.toThrow('Database error');
    });
  });

  describe('getExperiment', () => {
    it('should return experiment data', async () => {
      const mockExperiment = {
        id: 'test-experiment-123',
        name: 'Test Experiment',
        description: 'Test description',
        status: 'running',
        traffic_allocation: '0.5',
        start_date: new Date(),
        end_date: null,
        control_variant: { version: 'A' },
        test_variant: { version: 'B' },
        primary_metric: 'conversion_rate',
        secondary_metrics: ['engagement_rate'],
        control_users: 100,
        test_users: 95,
        statistical_significance: null,
        confidence_interval: null
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockExperiment]
      });

      const result = await abTestingService.getExperiment('test-experiment-123');

      expect(result).toEqual({
        id: mockExperiment.id,
        name: mockExperiment.name,
        description: mockExperiment.description,
        status: mockExperiment.status,
        trafficAllocation: 0.5,
        startDate: mockExperiment.start_date,
        endDate: mockExperiment.end_date,
        controlVariant: mockExperiment.control_variant,
        testVariant: mockExperiment.test_variant,
        primaryMetric: mockExperiment.primary_metric,
        secondaryMetrics: mockExperiment.secondary_metrics,
        controlUsers: mockExperiment.control_users,
        testUsers: mockExperiment.test_users,
        statisticalSignificance: mockExperiment.statistical_significance,
        confidenceInterval: mockExperiment.confidence_interval
      });
    });

    it('should return null for non-existent experiment', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await abTestingService.getExperiment('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('assignUserToExperiment', () => {
    it('should assign user to experiment variant', async () => {
      const experimentId = 'test-experiment-123';
      const userId = 'test-user-456';

      // Mock existing assignment check (no existing assignment)
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Mock experiment details
      const mockExperiment = {
        id: experimentId,
        name: 'Test Experiment',
        status: 'running',
        trafficAllocation: 0.5,
        controlVariant: { version: 'A' },
        testVariant: { version: 'B' },
        primaryMetric: 'conversion_rate',
        secondaryMetrics: [],
        controlUsers: 0,
        testUsers: 0
      };

      // Mock getExperiment call
      mockDb.query.mockResolvedValueOnce({
        rows: [{ 
          id: experimentId,
          name: 'Test Experiment',
          status: 'running',
          traffic_allocation: '0.5',
          control_variant: { version: 'A' },
          test_variant: { version: 'B' },
          primary_metric: 'conversion_rate',
          secondary_metrics: [],
          control_users: 0,
          test_users: 0
        }]
      });

      // Mock assignment insertion
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Mock user count update
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const variant = await abTestingService.assignUserToExperiment(userId, experimentId);

      expect(variant).toMatch(/^(control|test)$/);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT variant FROM ab_test_assignments'),
        [experimentId, userId]
      );
    });

    it('should return existing assignment if user already assigned', async () => {
      const experimentId = 'test-experiment-123';
      const userId = 'test-user-456';

      // Mock existing assignment
      mockDb.query.mockResolvedValueOnce({
        rows: [{ variant: 'control' }]
      });

      const variant = await abTestingService.assignUserToExperiment(userId, experimentId);

      expect(variant).toBe('control');
      // Should not create new assignment
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-running experiment', async () => {
      const experimentId = 'test-experiment-123';
      const userId = 'test-user-456';

      // Mock no existing assignment
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Mock experiment with non-running status
      mockDb.query.mockResolvedValueOnce({
        rows: [{ 
          id: experimentId,
          status: 'paused',
          traffic_allocation: '0.5'
        }]
      });

      const variant = await abTestingService.assignUserToExperiment(userId, experimentId);

      expect(variant).toBeNull();
    });
  });

  describe('recordResult', () => {
    it('should record A/B test result', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = {
        experimentId: 'test-experiment-123',
        userId: 'test-user-456',
        variant: 'test' as const,
        metricName: 'conversion_rate',
        metricValue: 0.15
      };

      await abTestingService.recordResult(result);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ab_test_results'),
        [
          result.experimentId,
          result.userId,
          result.variant,
          result.metricName,
          result.metricValue
        ]
      );
    });
  });

  describe('getExperimentResults', () => {
    it('should return aggregated experiment results', async () => {
      const mockResults = [
        {
          variant: 'control',
          metric_name: 'conversion_rate',
          sample_size: '100',
          mean_value: '0.12',
          std_dev: '0.05',
          min_value: '0.01',
          max_value: '0.25'
        },
        {
          variant: 'test',
          metric_name: 'conversion_rate',
          sample_size: '95',
          mean_value: '0.15',
          std_dev: '0.06',
          min_value: '0.02',
          max_value: '0.28'
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockResults });

      const results = await abTestingService.getExperimentResults('test-experiment-123');

      expect(results).toEqual({
        control: {
          conversion_rate: {
            sampleSize: 100,
            mean: 0.12,
            stdDev: 0.05,
            min: 0.01,
            max: 0.25
          }
        },
        test: {
          conversion_rate: {
            sampleSize: 95,
            mean: 0.15,
            stdDev: 0.06,
            min: 0.02,
            max: 0.28
          }
        }
      });
    });
  });

  describe('calculateStatisticalSignificance', () => {
    it('should calculate statistical significance', async () => {
      const mockConversionData = [
        { variant: 'control', total_users: '1000', conversions: '120' },
        { variant: 'test', total_users: '950', conversions: '142' }
      ];

      const mockSignificance = { p_value: '0.03' };

      mockDb.query
        .mockResolvedValueOnce({ rows: mockConversionData })
        .mockResolvedValueOnce({ rows: [mockSignificance] })
        .mockResolvedValueOnce({ rows: [] }); // updateExperiment

      const pValue = await abTestingService.calculateStatisticalSignificance(
        'test-experiment-123',
        'conversion_rate'
      );

      expect(pValue).toBe(0.03);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT calculate_ab_test_significance'),
        [120, 1000, 142, 950]
      );
    });

    it('should return 1.0 when insufficient data', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No data

      const pValue = await abTestingService.calculateStatisticalSignificance(
        'test-experiment-123',
        'conversion_rate'
      );

      expect(pValue).toBe(1.0);
    });
  });

  describe('analyzeExperiment', () => {
    it('should provide comprehensive experiment analysis', async () => {
      const experimentId = 'test-experiment-123';

      // Mock getExperiment
      const mockExperiment = {
        id: experimentId,
        name: 'Test Experiment',
        primaryMetric: 'conversion_rate',
        controlUsers: 1000,
        testUsers: 950
      };

      // Mock getExperimentResults
      const mockResults = {
        control: {
          conversion_rate: { mean: 0.12, sampleSize: 1000 }
        },
        test: {
          conversion_rate: { mean: 0.15, sampleSize: 950 }
        }
      };

      // Mock calculateStatisticalSignificance
      const mockSignificance = 0.03;

      // Setup mocks for the various method calls
      jest.spyOn(abTestingService, 'getExperiment').mockResolvedValueOnce(mockExperiment as any);
      jest.spyOn(abTestingService, 'getExperimentResults').mockResolvedValueOnce(mockResults);
      jest.spyOn(abTestingService, 'calculateStatisticalSignificance').mockResolvedValueOnce(mockSignificance);

      const analysis = await abTestingService.analyzeExperiment(experimentId);

      expect(analysis).toEqual({
        experiment: mockExperiment,
        results: mockResults,
        primaryMetric: {
          name: 'conversion_rate',
          significance: 0.03,
          lift: 25, // (0.15 - 0.12) / 0.12 * 100
          isSignificant: true
        },
        recommendation: expect.stringContaining('positive improvement'),
        sampleSizes: {
          control: 1000,
          test: 950,
          total: 1950
        }
      });
    });
  });

  describe('experiment lifecycle', () => {
    it('should start experiment', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await abTestingService.startExperiment('test-experiment-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ab_experiments'),
        expect.arrayContaining(['test-experiment-123'])
      );
    });

    it('should pause experiment', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await abTestingService.pauseExperiment('test-experiment-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ab_experiments'),
        expect.arrayContaining(['test-experiment-123'])
      );
    });

    it('should complete experiment', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await abTestingService.completeExperiment('test-experiment-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ab_experiments'),
        expect.arrayContaining(['test-experiment-123'])
      );
    });
  });
});