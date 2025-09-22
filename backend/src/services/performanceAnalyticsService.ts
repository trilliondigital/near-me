import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

export interface PerformanceMetrics {
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  timestamp: Date;
  
  // Battery metrics
  batteryLevel?: number;
  batteryDrainRate?: number; // Percentage per hour
  isCharging?: boolean;
  isLowPowerMode?: boolean;
  
  // Location metrics
  locationAccuracy?: number; // meters
  locationUpdatesPerHour?: number;
  geofenceEventsPerHour?: number;
  geofenceResponseTimeMs?: number;
  
  // Performance metrics
  memoryUsageMB?: number;
  cpuUsagePercentage?: number;
  crashFreePercentage?: number;
  falsePositiveRate?: number;
  
  // Network metrics
  apiResponseTimeMs?: number;
  networkRequestCount?: number;
  cacheHitRate?: number;
  
  // Background metrics
  backgroundExecutionTimeMs?: number;
  notificationDeliveryTimeMs?: number;
}

export interface PerformanceAlert {
  id: string;
  userId: string;
  deviceId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metrics: Partial<PerformanceMetrics>;
  timestamp: Date;
  resolved: boolean;
}

export enum AlertType {
  HIGH_BATTERY_DRAIN = 'high_battery_drain',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  HIGH_CPU_USAGE = 'high_cpu_usage',
  LOW_CRASH_FREE_RATE = 'low_crash_free_rate',
  HIGH_FALSE_POSITIVE_RATE = 'high_false_positive_rate',
  SLOW_GEOFENCE_RESPONSE = 'slow_geofence_response',
  SLOW_API_RESPONSE = 'slow_api_response',
  POOR_LOCATION_ACCURACY = 'poor_location_accuracy'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface PerformanceThresholds {
  maxBatteryDrainRate: number; // 5% per day
  maxMemoryUsageMB: number; // 200MB
  maxCpuUsagePercentage: number; // 20%
  minCrashFreePercentage: number; // 99%
  maxFalsePositiveRate: number; // 10%
  maxGeofenceResponseTimeMs: number; // 5000ms
  maxApiResponseTimeMs: number; // 2000ms
  maxLocationAccuracyMeters: number; // 100m
}

class PerformanceAnalyticsService extends EventEmitter {
  private static instance: PerformanceAnalyticsService;
  private thresholds: PerformanceThresholds;
  private alertCache = new Map<string, PerformanceAlert>();
  private metricsBuffer: PerformanceMetrics[] = [];
  private bufferFlushInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.thresholds = {
      maxBatteryDrainRate: 5.0, // 5% per day
      maxMemoryUsageMB: 200,
      maxCpuUsagePercentage: 20,
      minCrashFreePercentage: 99.0,
      maxFalsePositiveRate: 10.0,
      maxGeofenceResponseTimeMs: 5000,
      maxApiResponseTimeMs: 2000,
      maxLocationAccuracyMeters: 100
    };

    // Flush metrics buffer every 30 seconds
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, 30000);
  }

  static getInstance(): PerformanceAnalyticsService {
    if (!PerformanceAnalyticsService.instance) {
      PerformanceAnalyticsService.instance = new PerformanceAnalyticsService();
    }
    return PerformanceAnalyticsService.instance;
  }

  // MARK: - Metrics Collection
  async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Add to buffer for batch processing
      this.metricsBuffer.push({
        ...metrics,
        timestamp: new Date()
      });

      // Check for performance issues
      await this.analyzeMetrics(metrics);

      // Emit event for real-time monitoring
      this.emit('metricsReceived', metrics);

      logger.debug('Performance metrics recorded', {
        userId: metrics.userId,
        platform: metrics.platform,
        batteryLevel: metrics.batteryLevel,
        memoryUsage: metrics.memoryUsageMB
      });
    } catch (error) {
      logger.error('Failed to record performance metrics', error);
      throw error;
    }
  }

  private async analyzeMetrics(metrics: PerformanceMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // Battery drain analysis
    if (metrics.batteryDrainRate && metrics.batteryDrainRate > this.thresholds.maxBatteryDrainRate) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.HIGH_BATTERY_DRAIN,
        AlertSeverity.CRITICAL,
        `High battery drain detected: ${metrics.batteryDrainRate.toFixed(1)}% per day`
      ));
    }

    // Memory usage analysis
    if (metrics.memoryUsageMB && metrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.HIGH_MEMORY_USAGE,
        AlertSeverity.HIGH,
        `High memory usage detected: ${metrics.memoryUsageMB.toFixed(1)}MB`
      ));
    }

    // CPU usage analysis
    if (metrics.cpuUsagePercentage && metrics.cpuUsagePercentage > this.thresholds.maxCpuUsagePercentage) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.HIGH_CPU_USAGE,
        AlertSeverity.HIGH,
        `High CPU usage detected: ${metrics.cpuUsagePercentage.toFixed(1)}%`
      ));
    }

    // Crash-free rate analysis
    if (metrics.crashFreePercentage && metrics.crashFreePercentage < this.thresholds.minCrashFreePercentage) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.LOW_CRASH_FREE_RATE,
        AlertSeverity.CRITICAL,
        `Low crash-free rate detected: ${metrics.crashFreePercentage.toFixed(1)}%`
      ));
    }

    // False positive rate analysis
    if (metrics.falsePositiveRate && metrics.falsePositiveRate > this.thresholds.maxFalsePositiveRate) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.HIGH_FALSE_POSITIVE_RATE,
        AlertSeverity.MEDIUM,
        `High false positive rate detected: ${metrics.falsePositiveRate.toFixed(1)}%`
      ));
    }

    // Geofence response time analysis
    if (metrics.geofenceResponseTimeMs && metrics.geofenceResponseTimeMs > this.thresholds.maxGeofenceResponseTimeMs) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.SLOW_GEOFENCE_RESPONSE,
        AlertSeverity.MEDIUM,
        `Slow geofence response detected: ${metrics.geofenceResponseTimeMs.toFixed(0)}ms`
      ));
    }

    // API response time analysis
    if (metrics.apiResponseTimeMs && metrics.apiResponseTimeMs > this.thresholds.maxApiResponseTimeMs) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.SLOW_API_RESPONSE,
        AlertSeverity.LOW,
        `Slow API response detected: ${metrics.apiResponseTimeMs.toFixed(0)}ms`
      ));
    }

    // Location accuracy analysis
    if (metrics.locationAccuracy && metrics.locationAccuracy > this.thresholds.maxLocationAccuracyMeters) {
      alerts.push(this.createAlert(
        metrics,
        AlertType.POOR_LOCATION_ACCURACY,
        AlertSeverity.MEDIUM,
        `Poor location accuracy detected: ${metrics.locationAccuracy.toFixed(0)}m`
      ));
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private createAlert(
    metrics: PerformanceMetrics,
    alertType: AlertType,
    severity: AlertSeverity,
    message: string
  ): PerformanceAlert {
    return {
      id: `${metrics.userId}_${alertType}_${Date.now()}`,
      userId: metrics.userId,
      deviceId: metrics.deviceId,
      alertType,
      severity,
      message,
      metrics,
      timestamp: new Date(),
      resolved: false
    };
  }

  private async processAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // Check if similar alert already exists (debouncing)
      const alertKey = `${alert.userId}_${alert.alertType}`;
      const existingAlert = this.alertCache.get(alertKey);
      
      if (existingAlert && !existingAlert.resolved) {
        // Update existing alert instead of creating new one
        existingAlert.timestamp = alert.timestamp;
        existingAlert.metrics = alert.metrics;
        await this.updateAlert(existingAlert);
        return;
      }

      // Store new alert
      await this.storeAlert(alert);
      this.alertCache.set(alertKey, alert);

      // Emit alert event
      this.emit('performanceAlert', alert);

      // Trigger automatic optimizations for critical alerts
      if (alert.severity === AlertSeverity.CRITICAL) {
        await this.triggerAutomaticOptimizations(alert);
      }

      logger.warn('Performance alert generated', {
        alertType: alert.alertType,
        severity: alert.severity,
        userId: alert.userId,
        message: alert.message
      });
    } catch (error) {
      logger.error('Failed to process performance alert', error);
    }
  }

  private async triggerAutomaticOptimizations(alert: PerformanceAlert): Promise<void> {
    try {
      switch (alert.alertType) {
        case AlertType.HIGH_BATTERY_DRAIN:
          await this.recommendBatteryOptimization(alert.userId);
          break;
        case AlertType.HIGH_MEMORY_USAGE:
          await this.recommendMemoryCleanup(alert.userId);
          break;
        case AlertType.LOW_CRASH_FREE_RATE:
          await this.recommendEmergencyMode(alert.userId);
          break;
        default:
          break;
      }
    } catch (error) {
      logger.error('Failed to trigger automatic optimizations', error);
    }
  }

  private async recommendBatteryOptimization(userId: string): Promise<void> {
    // This would integrate with push notification service
    // to send optimization recommendations to the user
    logger.info('Recommending battery optimization', { userId });
  }

  private async recommendMemoryCleanup(userId: string): Promise<void> {
    // This would trigger memory cleanup recommendations
    logger.info('Recommending memory cleanup', { userId });
  }

  private async recommendEmergencyMode(userId: string): Promise<void> {
    // This would recommend enabling emergency mode
    logger.info('Recommending emergency mode', { userId });
  }

  // MARK: - Data Persistence
  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      await this.batchStoreMetrics(metricsToFlush);
      
      logger.debug('Flushed metrics buffer', { count: metricsToFlush.length });
    } catch (error) {
      logger.error('Failed to flush metrics buffer', error);
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  private async batchStoreMetrics(metrics: PerformanceMetrics[]): Promise<void> {
    const query = `
      INSERT INTO performance_metrics (
        user_id, device_id, platform, app_version, timestamp,
        battery_level, battery_drain_rate, is_charging, is_low_power_mode,
        location_accuracy, location_updates_per_hour, geofence_events_per_hour, geofence_response_time_ms,
        memory_usage_mb, cpu_usage_percentage, crash_free_percentage, false_positive_rate,
        api_response_time_ms, network_request_count, cache_hit_rate,
        background_execution_time_ms, notification_delivery_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    `;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      for (const metric of metrics) {
        await client.query(query, [
          metric.userId,
          metric.deviceId,
          metric.platform,
          metric.appVersion,
          metric.timestamp,
          metric.batteryLevel,
          metric.batteryDrainRate,
          metric.isCharging,
          metric.isLowPowerMode,
          metric.locationAccuracy,
          metric.locationUpdatesPerHour,
          metric.geofenceEventsPerHour,
          metric.geofenceResponseTimeMs,
          metric.memoryUsageMB,
          metric.cpuUsagePercentage,
          metric.crashFreePercentage,
          metric.falsePositiveRate,
          metric.apiResponseTimeMs,
          metric.networkRequestCount,
          metric.cacheHitRate,
          metric.backgroundExecutionTimeMs,
          metric.notificationDeliveryTimeMs
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async storeAlert(alert: PerformanceAlert): Promise<void> {
    const query = `
      INSERT INTO performance_alerts (
        id, user_id, device_id, alert_type, severity, message, metrics, timestamp, resolved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      alert.id,
      alert.userId,
      alert.deviceId,
      alert.alertType,
      alert.severity,
      alert.message,
      JSON.stringify(alert.metrics),
      alert.timestamp,
      alert.resolved
    ]);
  }

  private async updateAlert(alert: PerformanceAlert): Promise<void> {
    const query = `
      UPDATE performance_alerts 
      SET metrics = $1, timestamp = $2, resolved = $3
      WHERE id = $4
    `;

    await db.query(query, [
      JSON.stringify(alert.metrics),
      alert.timestamp,
      alert.resolved,
      alert.id
    ]);
  }

  // MARK: - Analytics and Reporting
  async getPerformanceReport(userId: string, timeRange: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    const timeFilter = this.getTimeFilter(timeRange);
    
    const query = `
      SELECT 
        AVG(battery_drain_rate) as avg_battery_drain,
        AVG(memory_usage_mb) as avg_memory_usage,
        AVG(cpu_usage_percentage) as avg_cpu_usage,
        AVG(location_accuracy) as avg_location_accuracy,
        AVG(geofence_response_time_ms) as avg_geofence_response_time,
        AVG(api_response_time_ms) as avg_api_response_time,
        AVG(crash_free_percentage) as avg_crash_free_percentage,
        AVG(false_positive_rate) as avg_false_positive_rate,
        COUNT(*) as total_metrics
      FROM performance_metrics 
      WHERE user_id = $1 AND timestamp >= $2
    `;

    const result = await db.query(query, [userId, timeFilter]);
    const metrics = result.rows[0];

    // Get recent alerts
    const alertsQuery = `
      SELECT alert_type, severity, message, timestamp, resolved
      FROM performance_alerts 
      WHERE user_id = $1 AND timestamp >= $2
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    const alertsResult = await db.query(alertsQuery, [userId, timeFilter]);
    const alerts = alertsResult.rows;

    // Calculate health score
    const healthScore = this.calculateHealthScore(metrics);

    return {
      timeRange,
      healthScore,
      metrics: {
        batteryDrainRate: parseFloat(metrics.avg_battery_drain) || 0,
        memoryUsageMB: parseFloat(metrics.avg_memory_usage) || 0,
        cpuUsagePercentage: parseFloat(metrics.avg_cpu_usage) || 0,
        locationAccuracy: parseFloat(metrics.avg_location_accuracy) || 0,
        geofenceResponseTimeMs: parseFloat(metrics.avg_geofence_response_time) || 0,
        apiResponseTimeMs: parseFloat(metrics.avg_api_response_time) || 0,
        crashFreePercentage: parseFloat(metrics.avg_crash_free_percentage) || 100,
        falsePositiveRate: parseFloat(metrics.avg_false_positive_rate) || 0
      },
      alerts,
      recommendations: this.generateRecommendations(metrics, alerts)
    };
  }

  private getTimeFilter(timeRange: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private calculateHealthScore(metrics: any): number {
    const scores = [
      Math.max(0, 1 - (parseFloat(metrics.avg_battery_drain) || 0) / 5), // Battery drain score
      Math.max(0, 1 - (parseFloat(metrics.avg_memory_usage) || 0) / 200), // Memory usage score
      Math.max(0, 1 - (parseFloat(metrics.avg_cpu_usage) || 0) / 20), // CPU usage score
      (parseFloat(metrics.avg_crash_free_percentage) || 100) / 100, // Crash-free score
      Math.max(0, 1 - (parseFloat(metrics.avg_false_positive_rate) || 0) / 10), // False positive score
      Math.max(0, 1 - (parseFloat(metrics.avg_geofence_response_time) || 0) / 5000) // Response time score
    ];

    return scores.reduce((sum, score) => sum + score, 0) / scores.length * 100;
  }

  private generateRecommendations(metrics: any, alerts: any[]): string[] {
    const recommendations: string[] = [];

    if (parseFloat(metrics.avg_battery_drain) > this.thresholds.maxBatteryDrainRate) {
      recommendations.push('Enable battery optimization to reduce power consumption');
    }

    if (parseFloat(metrics.avg_memory_usage) > this.thresholds.maxMemoryUsageMB) {
      recommendations.push('Clear app cache and reduce memory usage');
    }

    if (parseFloat(metrics.avg_false_positive_rate) > this.thresholds.maxFalsePositiveRate) {
      recommendations.push('Adjust geofence radii to reduce false positive notifications');
    }

    if (parseFloat(metrics.avg_geofence_response_time) > this.thresholds.maxGeofenceResponseTimeMs) {
      recommendations.push('Optimize geofence processing for faster response times');
    }

    const criticalAlerts = alerts.filter(alert => alert.severity === AlertSeverity.CRITICAL && !alert.resolved);
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical performance issues immediately');
    }

    return recommendations;
  }

  // MARK: - Configuration
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', newThresholds);
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  // MARK: - Cleanup
  destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    this.flushMetricsBuffer();
  }
}

export const performanceAnalyticsService = PerformanceAnalyticsService.getInstance();