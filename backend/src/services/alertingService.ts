import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { query as dbQuery } from '../database/connection';
import { analyticsService } from './analyticsService';

interface Alert {
  id: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metricName?: string;
  thresholdValue?: number;
  currentValue?: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata: any;
  createdAt: Date;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'percentage_change';
  threshold: number;
  timeWindow: number; // minutes
  severity: 'info' | 'warning' | 'critical';
  isActive: boolean;
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
}

interface MetricThreshold {
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  condition: 'greater_than' | 'less_than';
  timeWindow: number;
}

class AlertingService extends EventEmitter {
  private static instance: AlertingService;
  private alertRules: AlertRule[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private constructor() {
    super();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService();
    }
    return AlertingService.instance;
  }

  // MARK: - Alert Management

  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const sql = `
        INSERT INTO analytics_alerts (
          alert_type, severity, title, message, metric_name, 
          threshold_value, current_value, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const values = [
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        alert.metricName,
        alert.thresholdValue,
        alert.currentValue,
        JSON.stringify(alert.metadata || {})
      ];

      const result = await dbQuery(sql, values);
      const alertId = result.rows[0].id;

      logger.warn('Alert created', { 
        alertId, 
        type: alert.alertType, 
        severity: alert.severity,
        title: alert.title 
      });

      this.emit('alertCreated', { alertId, ...alert });
      
      // Send notifications for critical alerts
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotification(alertId, alert);
      }

      return alertId;
    } catch (error) {
      logger.error('Failed to create alert', error);
      throw error;
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const sql = `
        SELECT 
          id, alert_type, severity, title, message, metric_name,
          threshold_value, current_value, status, acknowledged_by,
          acknowledged_at, resolved_at, metadata, created_at
        FROM analytics_alerts
        WHERE status = 'active'
        ORDER BY severity DESC, created_at DESC
      `;

      const result = await dbQuery(sql);
      return result.rows.map(this.mapRowToAlert);
    } catch (error) {
      logger.error('Failed to get active alerts', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const sql = `
        UPDATE analytics_alerts 
        SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
        WHERE id = $2 AND status = 'active'
      `;

      await dbQuery(sql, [acknowledgedBy, alertId]);
      
      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      this.emit('alertAcknowledged', { alertId, acknowledgedBy });
    } catch (error) {
      logger.error('Failed to acknowledge alert', error);
      throw error;
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const sql = `
        UPDATE analytics_alerts 
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1 AND status IN ('active', 'acknowledged')
      `;

      await dbQuery(sql, [alertId]);
      
      logger.info('Alert resolved', { alertId });
      this.emit('alertResolved', { alertId });
    } catch (error) {
      logger.error('Failed to resolve alert', error);
      throw error;
    }
  }

  // MARK: - Alert Rules Management

  private initializeDefaultRules(): void {
    this.alertRules = [
      {
        id: 'dau_drop',
        name: 'Daily Active Users Drop',
        description: 'Alert when DAU drops significantly',
        metricName: 'daily_active_users',
        condition: 'percentage_change',
        threshold: -20, // 20% drop
        timeWindow: 60, // 1 hour
        severity: 'warning',
        isActive: true,
        cooldownPeriod: 240 // 4 hours
      },
      {
        id: 'crash_rate_high',
        name: 'High Crash Rate',
        description: 'Alert when crash rate exceeds threshold',
        metricName: 'crash_rate',
        condition: 'greater_than',
        threshold: 5, // 5%
        timeWindow: 30,
        severity: 'critical',
        isActive: true,
        cooldownPeriod: 60
      },
      {
        id: 'conversion_rate_low',
        name: 'Low Conversion Rate',
        description: 'Alert when premium conversion rate is too low',
        metricName: 'premium_conversion_rate',
        condition: 'less_than',
        threshold: 3, // 3%
        timeWindow: 120,
        severity: 'warning',
        isActive: true,
        cooldownPeriod: 480 // 8 hours
      },
      {
        id: 'api_error_rate_high',
        name: 'High API Error Rate',
        description: 'Alert when API error rate is elevated',
        metricName: 'api_error_rate',
        condition: 'greater_than',
        threshold: 10, // 10%
        timeWindow: 15,
        severity: 'critical',
        isActive: true,
        cooldownPeriod: 30
      },
      {
        id: 'notification_delivery_low',
        name: 'Low Notification Delivery Rate',
        description: 'Alert when notification delivery rate drops',
        metricName: 'notification_delivery_rate',
        condition: 'less_than',
        threshold: 85, // 85%
        timeWindow: 60,
        severity: 'warning',
        isActive: true,
        cooldownPeriod: 120
      }
    ];
  }

  async addAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const ruleId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: AlertRule = { id: ruleId, ...rule };
    
    this.alertRules.push(newRule);
    logger.info('Alert rule added', { ruleId, name: rule.name });
    
    return ruleId;
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error('Alert rule not found');
    }

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    logger.info('Alert rule updated', { ruleId, updates });
  }

  async removeAlertRule(ruleId: string): Promise<void> {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error('Alert rule not found');
    }

    this.alertRules.splice(ruleIndex, 1);
    logger.info('Alert rule removed', { ruleId });
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  // MARK: - Monitoring

  private startMonitoring(): void {
    // Check metrics every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring) {
        await this.checkAllRules();
      }
    }, 5 * 60 * 1000);

    logger.info('Alert monitoring started');
  }

  private async checkAllRules(): Promise<void> {
    this.isMonitoring = true;

    try {
      for (const rule of this.alertRules) {
        if (rule.isActive && this.shouldCheckRule(rule)) {
          await this.checkRule(rule);
        }
      }
    } catch (error) {
      logger.error('Error during alert rule checking', error);
    } finally {
      this.isMonitoring = false;
    }
  }

  private shouldCheckRule(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return true;
    
    const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownPeriod * 60 * 1000);
    return new Date() > cooldownEnd;
  }

  private async checkRule(rule: AlertRule): Promise<void> {
    try {
      const currentValue = await this.getMetricValue(rule.metricName, rule.timeWindow);
      
      if (currentValue === null) {
        logger.debug('No data available for metric', { metricName: rule.metricName });
        return;
      }

      const shouldAlert = this.evaluateCondition(rule, currentValue);
      
      if (shouldAlert) {
        await this.triggerAlert(rule, currentValue);
        rule.lastTriggered = new Date();
      }
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to check alert rule', { ruleId: rule.id, error: errMsg });
    }
  }

  private async getMetricValue(metricName: string, timeWindowMinutes: number): Promise<number | null> {
    try {
      let sql: string;
      const timeWindow = `${timeWindowMinutes} minutes`;

      switch (metricName) {
        case 'daily_active_users':
          sql = `
            SELECT COUNT(DISTINCT user_id) as value
            FROM user_events 
            WHERE timestamp >= NOW() - INTERVAL '${timeWindow}'
          `;
          break;

        case 'crash_rate':
          sql = `
            SELECT 
              COUNT(CASE WHEN event_type = 'app_crash' THEN 1 END)::DECIMAL / 
              COUNT(DISTINCT session_id) * 100 as value
            FROM user_events 
            WHERE timestamp >= NOW() - INTERVAL '${timeWindow}'
          `;
          break;

        case 'premium_conversion_rate':
          sql = `
            SELECT 
              COUNT(CASE WHEN event_type = 'premium_converted' THEN 1 END)::DECIMAL /
              NULLIF(COUNT(CASE WHEN event_type = 'trial_started' THEN 1 END), 0) * 100 as value
            FROM user_events 
            WHERE timestamp >= NOW() - INTERVAL '${timeWindow}'
          `;
          break;

        case 'api_error_rate':
          // Compute server error rate (5xx) from api_request_metrics within the time window
          sql = `
            SELECT 
              COALESCE(
                COUNT(CASE WHEN status_code >= 500 THEN 1 END)::DECIMAL /
                NULLIF(COUNT(*), 0) * 100, 0
              ) AS value
            FROM api_request_metrics 
            WHERE timestamp >= NOW() - INTERVAL '${timeWindow}'
          `;
          break;

        case 'notification_delivery_rate':
          sql = `
            SELECT 
              COUNT(CASE WHEN event_type = 'nudge_delivered' THEN 1 END)::DECIMAL /
              NULLIF(COUNT(CASE WHEN event_type = 'nudge_sent' THEN 1 END), 0) * 100 as value
            FROM user_events 
            WHERE timestamp >= NOW() - INTERVAL '${timeWindow}'
          `;
          break;

        default:
          logger.warn('Unknown metric name for alerting', { metricName });
          return null;
      }

      const result = await dbQuery(sql);
      return result.rows[0]?.value ? parseFloat(result.rows[0].value) : null;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get metric value', { metricName, error: errMsg });
      return null;
    }
  }

  private evaluateCondition(rule: AlertRule, currentValue: number): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return currentValue > rule.threshold;
      
      case 'less_than':
        return currentValue < rule.threshold;
      
      case 'equals':
        return currentValue === rule.threshold;
      
      case 'not_equals':
        return currentValue !== rule.threshold;
      
      case 'percentage_change':
        // For percentage change, we need to compare with previous period
        // This is a simplified implementation
        return Math.abs(currentValue) > Math.abs(rule.threshold);
      
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alert = {
      alertType: rule.id,
      severity: rule.severity,
      title: rule.name,
      message: `${rule.description}. Current value: ${currentValue.toFixed(2)}, Threshold: ${rule.threshold}`,
      metricName: rule.metricName,
      thresholdValue: rule.threshold,
      currentValue: currentValue,
      metadata: {
        ruleId: rule.id,
        timeWindow: rule.timeWindow,
        condition: rule.condition
      }
    };

    await this.createAlert(alert);
  }

  // MARK: - Notifications

  private async sendCriticalAlertNotification(alertId: string, alert: any): Promise<void> {
    try {
      // In a real implementation, this would integrate with:
      // - Slack/Discord webhooks
      // - Email notifications
      // - SMS alerts
      // - PagerDuty/OpsGenie
      
      logger.critical('CRITICAL ALERT', {
        alertId,
        title: alert.title,
        message: alert.message,
        metricName: alert.metricName,
        currentValue: alert.currentValue,
        threshold: alert.thresholdValue
      });

      // Simulate webhook notification
      this.emit('criticalAlert', {
        alertId,
        alert,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to send critical alert notification', error);
    }
  }

  // MARK: - Analytics Integration

  async getAlertMetrics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);
      
      const sql = `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          severity,
          COUNT(*) as alert_count,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/60) as avg_resolution_time_minutes
        FROM analytics_alerts
        WHERE created_at >= $1
        GROUP BY DATE_TRUNC('day', created_at), severity
        ORDER BY date DESC, severity
      `;

      const result = await dbQuery(sql, [timeFilter]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get alert metrics', error instanceof Error ? error.message : String(error));
      throw error;
    }
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
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  // MARK: - Utilities

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      metricName: row.metric_name,
      thresholdValue: row.threshold_value,
      currentValue: row.current_value,
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      metadata: row.metadata || {},
      createdAt: row.created_at
    };
  }

  // MARK: - Cleanup

  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('Alert monitoring stopped');
  }
}

export const alertingService = AlertingService.getInstance();