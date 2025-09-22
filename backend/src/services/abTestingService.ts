import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

interface ABExperiment {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  trafficAllocation: number; // 0.0 to 1.0
  startDate?: Date;
  endDate?: Date;
  controlVariant: any;
  testVariant: any;
  primaryMetric: string;
  secondaryMetrics: string[];
  controlUsers: number;
  testUsers: number;
  statisticalSignificance?: number;
  confidenceInterval?: any;
}

interface ABTestAssignment {
  experimentId: string;
  userId: string;
  variant: 'control' | 'test';
  assignedAt: Date;
}

interface ABTestResult {
  experimentId: string;
  userId: string;
  variant: 'control' | 'test';
  metricName: string;
  metricValue: number;
  recordedAt: Date;
}

class ABTestingService extends EventEmitter {
  private static instance: ABTestingService;

  private constructor() {
    super();
  }

  static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }

  // MARK: - Experiment Management

  async createExperiment(experiment: Omit<ABExperiment, 'id' | 'controlUsers' | 'testUsers'>): Promise<string> {
    try {
      const query = `
        INSERT INTO ab_experiments (
          name, description, status, traffic_allocation, start_date, end_date,
          control_variant, test_variant, primary_metric, secondary_metrics
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const values = [
        experiment.name,
        experiment.description,
        experiment.status,
        experiment.trafficAllocation,
        experiment.startDate,
        experiment.endDate,
        JSON.stringify(experiment.controlVariant),
        JSON.stringify(experiment.testVariant),
        experiment.primaryMetric,
        experiment.secondaryMetrics
      ];

      const result = await db.query(query, values);
      const experimentId = result.rows[0].id;

      logger.info('A/B experiment created', { experimentId, name: experiment.name });
      this.emit('experimentCreated', { experimentId, experiment });

      return experimentId;
    } catch (error) {
      logger.error('Failed to create A/B experiment', error);
      throw error;
    }
  }

  async updateExperiment(experimentId: string, updates: Partial<ABExperiment>): Promise<void> {
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnName = this.camelToSnake(key);
          if (key === 'controlVariant' || key === 'testVariant') {
            setClause.push(`${columnName} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${columnName} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) return;

      const query = `
        UPDATE ab_experiments 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
      `;
      values.push(experimentId);

      await db.query(query, values);
      logger.info('A/B experiment updated', { experimentId, updates });
      this.emit('experimentUpdated', { experimentId, updates });
    } catch (error) {
      logger.error('Failed to update A/B experiment', error);
      throw error;
    }
  }

  async getExperiment(experimentId: string): Promise<ABExperiment | null> {
    try {
      const query = `
        SELECT 
          id, name, description, status, traffic_allocation, start_date, end_date,
          control_variant, test_variant, primary_metric, secondary_metrics,
          control_users, test_users, statistical_significance, confidence_interval
        FROM ab_experiments 
        WHERE id = $1
      `;

      const result = await db.query(query, [experimentId]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        trafficAllocation: parseFloat(row.traffic_allocation),
        startDate: row.start_date,
        endDate: row.end_date,
        controlVariant: row.control_variant,
        testVariant: row.test_variant,
        primaryMetric: row.primary_metric,
        secondaryMetrics: row.secondary_metrics || [],
        controlUsers: row.control_users || 0,
        testUsers: row.test_users || 0,
        statisticalSignificance: row.statistical_significance,
        confidenceInterval: row.confidence_interval
      };
    } catch (error) {
      logger.error('Failed to get A/B experiment', error);
      throw error;
    }
  }

  async getActiveExperiments(): Promise<ABExperiment[]> {
    try {
      const query = `
        SELECT 
          id, name, description, status, traffic_allocation, start_date, end_date,
          control_variant, test_variant, primary_metric, secondary_metrics,
          control_users, test_users, statistical_significance, confidence_interval
        FROM ab_experiments 
        WHERE status IN ('running', 'paused')
        ORDER BY created_at DESC
      `;

      const result = await db.query(query);
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        trafficAllocation: parseFloat(row.traffic_allocation),
        startDate: row.start_date,
        endDate: row.end_date,
        controlVariant: row.control_variant,
        testVariant: row.test_variant,
        primaryMetric: row.primary_metric,
        secondaryMetrics: row.secondary_metrics || [],
        controlUsers: row.control_users || 0,
        testUsers: row.test_users || 0,
        statisticalSignificance: row.statistical_significance,
        confidenceInterval: row.confidence_interval
      }));
    } catch (error) {
      logger.error('Failed to get active experiments', error);
      throw error;
    }
  }

  // MARK: - User Assignment

  async assignUserToExperiment(userId: string, experimentId: string): Promise<'control' | 'test' | null> {
    try {
      // Check if user is already assigned
      const existingQuery = `
        SELECT variant FROM ab_test_assignments 
        WHERE experiment_id = $1 AND user_id = $2
      `;
      const existingResult = await db.query(existingQuery, [experimentId, userId]);
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0].variant;
      }

      // Get experiment details
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== 'running') {
        return null;
      }

      // Determine variant based on user ID hash and traffic allocation
      const variant = this.determineVariant(userId, experiment.trafficAllocation);
      
      if (variant) {
        // Store assignment
        const insertQuery = `
          INSERT INTO ab_test_assignments (experiment_id, user_id, variant)
          VALUES ($1, $2, $3)
          ON CONFLICT (experiment_id, user_id) DO NOTHING
        `;
        await db.query(insertQuery, [experimentId, userId, variant]);

        // Update experiment user counts
        const updateQuery = `
          UPDATE ab_experiments 
          SET ${variant}_users = ${variant}_users + 1
          WHERE id = $1
        `;
        await db.query(updateQuery, [experimentId]);

        logger.debug('User assigned to A/B test', { userId, experimentId, variant });
        this.emit('userAssigned', { userId, experimentId, variant });
      }

      return variant;
    } catch (error) {
      logger.error('Failed to assign user to experiment', error);
      throw error;
    }
  }

  async getUserExperiments(userId: string): Promise<{ [experimentId: string]: 'control' | 'test' }> {
    try {
      const query = `
        SELECT ata.experiment_id, ata.variant
        FROM ab_test_assignments ata
        JOIN ab_experiments ae ON ata.experiment_id = ae.id
        WHERE ata.user_id = $1 AND ae.status = 'running'
      `;

      const result = await db.query(query, [userId]);
      const assignments: { [experimentId: string]: 'control' | 'test' } = {};
      
      result.rows.forEach(row => {
        assignments[row.experiment_id] = row.variant;
      });

      return assignments;
    } catch (error) {
      logger.error('Failed to get user experiments', error);
      throw error;
    }
  }

  private determineVariant(userId: string, trafficAllocation: number): 'control' | 'test' | null {
    // Use consistent hashing based on user ID
    const hash = this.hashString(userId);
    const normalizedHash = hash / 0xffffffff; // Normalize to 0-1

    if (normalizedHash < trafficAllocation) {
      return 'test';
    } else if (normalizedHash < trafficAllocation * 2) {
      return 'control';
    }
    
    return null; // User not in experiment
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // MARK: - Results Tracking

  async recordResult(result: Omit<ABTestResult, 'recordedAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO ab_test_results (experiment_id, user_id, variant, metric_name, metric_value)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(query, [
        result.experimentId,
        result.userId,
        result.variant,
        result.metricName,
        result.metricValue
      ]);

      logger.debug('A/B test result recorded', result);
      this.emit('resultRecorded', result);
    } catch (error) {
      logger.error('Failed to record A/B test result', error);
      throw error;
    }
  }

  async getExperimentResults(experimentId: string): Promise<any> {
    try {
      const query = `
        SELECT 
          variant,
          metric_name,
          COUNT(*) as sample_size,
          AVG(metric_value) as mean_value,
          STDDEV(metric_value) as std_dev,
          MIN(metric_value) as min_value,
          MAX(metric_value) as max_value
        FROM ab_test_results
        WHERE experiment_id = $1
        GROUP BY variant, metric_name
        ORDER BY variant, metric_name
      `;

      const result = await db.query(query, [experimentId]);
      
      const results = {
        control: {},
        test: {}
      };

      result.rows.forEach(row => {
        results[row.variant][row.metric_name] = {
          sampleSize: parseInt(row.sample_size),
          mean: parseFloat(row.mean_value),
          stdDev: parseFloat(row.std_dev),
          min: parseFloat(row.min_value),
          max: parseFloat(row.max_value)
        };
      });

      return results;
    } catch (error) {
      logger.error('Failed to get experiment results', error);
      throw error;
    }
  }

  // MARK: - Statistical Analysis

  async calculateStatisticalSignificance(experimentId: string, metricName: string): Promise<number> {
    try {
      // Get conversion data for the metric
      const query = `
        SELECT 
          variant,
          COUNT(*) as total_users,
          COUNT(CASE WHEN metric_value > 0 THEN 1 END) as conversions
        FROM ab_test_results
        WHERE experiment_id = $1 AND metric_name = $2
        GROUP BY variant
      `;

      const result = await db.query(query, [experimentId, metricName]);
      
      if (result.rows.length < 2) {
        return 1.0; // No significance if we don't have both variants
      }

      const controlData = result.rows.find(row => row.variant === 'control');
      const testData = result.rows.find(row => row.variant === 'test');

      if (!controlData || !testData) {
        return 1.0;
      }

      // Use database function for statistical calculation
      const significanceQuery = `
        SELECT calculate_ab_test_significance($1, $2, $3, $4) as p_value
      `;

      const significanceResult = await db.query(significanceQuery, [
        parseInt(controlData.conversions),
        parseInt(controlData.total_users),
        parseInt(testData.conversions),
        parseInt(testData.total_users)
      ]);

      const pValue = parseFloat(significanceResult.rows[0].p_value);

      // Update experiment with significance
      await this.updateExperiment(experimentId, {
        statisticalSignificance: pValue
      });

      return pValue;
    } catch (error) {
      logger.error('Failed to calculate statistical significance', error);
      throw error;
    }
  }

  async analyzeExperiment(experimentId: string): Promise<any> {
    try {
      const experiment = await this.getExperiment(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }

      const results = await this.getExperimentResults(experimentId);
      const primaryMetricSignificance = await this.calculateStatisticalSignificance(
        experimentId, 
        experiment.primaryMetric
      );

      // Calculate lift for primary metric
      const controlMetric = results.control[experiment.primaryMetric];
      const testMetric = results.test[experiment.primaryMetric];
      
      let lift = 0;
      if (controlMetric && testMetric && controlMetric.mean > 0) {
        lift = ((testMetric.mean - controlMetric.mean) / controlMetric.mean) * 100;
      }

      return {
        experiment,
        results,
        primaryMetric: {
          name: experiment.primaryMetric,
          significance: primaryMetricSignificance,
          lift: lift,
          isSignificant: primaryMetricSignificance < 0.05
        },
        recommendation: this.generateRecommendation(lift, primaryMetricSignificance),
        sampleSizes: {
          control: experiment.controlUsers,
          test: experiment.testUsers,
          total: experiment.controlUsers + experiment.testUsers
        }
      };
    } catch (error) {
      logger.error('Failed to analyze experiment', error);
      throw error;
    }
  }

  private generateRecommendation(lift: number, significance: number): string {
    if (significance >= 0.05) {
      return 'No statistically significant difference detected. Consider running the test longer or increasing sample size.';
    }

    if (lift > 5) {
      return 'Test variant shows significant positive improvement. Recommend implementing the test variant.';
    } else if (lift < -5) {
      return 'Test variant shows significant negative impact. Recommend keeping the control variant.';
    } else {
      return 'Statistically significant but small practical difference. Consider business impact and implementation cost.';
    }
  }

  // MARK: - Experiment Lifecycle

  async startExperiment(experimentId: string): Promise<void> {
    try {
      await this.updateExperiment(experimentId, {
        status: 'running',
        startDate: new Date()
      });

      logger.info('A/B experiment started', { experimentId });
      this.emit('experimentStarted', { experimentId });
    } catch (error) {
      logger.error('Failed to start experiment', error);
      throw error;
    }
  }

  async pauseExperiment(experimentId: string): Promise<void> {
    try {
      await this.updateExperiment(experimentId, {
        status: 'paused'
      });

      logger.info('A/B experiment paused', { experimentId });
      this.emit('experimentPaused', { experimentId });
    } catch (error) {
      logger.error('Failed to pause experiment', error);
      throw error;
    }
  }

  async completeExperiment(experimentId: string): Promise<void> {
    try {
      await this.updateExperiment(experimentId, {
        status: 'completed',
        endDate: new Date()
      });

      logger.info('A/B experiment completed', { experimentId });
      this.emit('experimentCompleted', { experimentId });
    } catch (error) {
      logger.error('Failed to complete experiment', error);
      throw error;
    }
  }

  // MARK: - Utilities

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export const abTestingService = ABTestingService.getInstance();