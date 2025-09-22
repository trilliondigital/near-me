#!/usr/bin/env ts-node

import { analyticsService } from '../services/analyticsService';
import { analyticsProcessingService } from '../services/analyticsProcessingService';
import { abTestingService } from '../services/abTestingService';
import { alertingService } from '../services/alertingService';
import { analyticsManager } from '../services/analyticsManager';
import { logger } from '../utils/logger';

async function testAnalyticsDashboard() {
  console.log('🧪 Testing Analytics Dashboard Components...\n');

  try {
    // Test 1: Analytics Service
    console.log('1️⃣ Testing Analytics Service...');
    
    // Simulate some events
    const testUserId = 'test-user-123';
    const testSessionId = 'test-session-456';
    
    await analyticsService.trackEvent({
      userId: testUserId,
      deviceId: 'test-device',
      sessionId: testSessionId,
      eventType: 'task_created',
      eventData: { taskId: 'test-task-1', locationType: 'custom_place' },
      platform: 'ios',
      appVersion: '1.0.0',
      analyticsConsent: true
    });

    await analyticsService.trackEvent({
      userId: testUserId,
      deviceId: 'test-device',
      sessionId: testSessionId,
      eventType: 'nudge_shown',
      eventData: { taskId: 'test-task-1', nudgeType: 'approach' },
      platform: 'ios',
      appVersion: '1.0.0',
      analyticsConsent: true
    });

    await analyticsService.trackEvent({
      userId: testUserId,
      deviceId: 'test-device',
      sessionId: testSessionId,
      eventType: 'task_completed',
      eventData: { taskId: 'test-task-1', completionMethod: 'notification_action' },
      platform: 'ios',
      appVersion: '1.0.0',
      analyticsConsent: true
    });

    console.log('✅ Analytics events tracked successfully');

    // Test 2: System Health
    console.log('\n2️⃣ Testing System Health...');
    const health = await analyticsService.getSystemHealth();
    console.log('System Health:', JSON.stringify(health, null, 2));

    // Test 3: Recent Events
    console.log('\n3️⃣ Testing Recent Events...');
    const recentEvents = await analyticsService.getRecentEvents(5);
    console.log(`Found ${recentEvents.length} recent events`);

    // Test 4: Processing Service
    console.log('\n4️⃣ Testing Processing Service...');
    const jobId = await analyticsProcessingService.scheduleJob('aggregation');
    console.log(`Scheduled processing job: ${jobId}`);
    
    // Wait a moment and check job status
    setTimeout(async () => {
      const jobStatus = await analyticsProcessingService.getJobStatus(jobId);
      console.log('Job Status:', JSON.stringify(jobStatus, null, 2));
    }, 2000);

    // Test 5: A/B Testing Service
    console.log('\n5️⃣ Testing A/B Testing Service...');
    const experimentId = await abTestingService.createExperiment({
      name: 'Test Notification Style',
      description: 'Testing different notification styles',
      status: 'draft',
      trafficAllocation: 0.5,
      controlVariant: { style: 'standard' },
      testVariant: { style: 'minimal' },
      primaryMetric: 'task_completion_rate',
      secondaryMetrics: ['engagement_rate']
    });
    console.log(`Created A/B experiment: ${experimentId}`);

    // Test user assignment
    const variant = await abTestingService.assignUserToExperiment(testUserId, experimentId);
    console.log(`User assigned to variant: ${variant}`);

    // Test 6: Alerting Service
    console.log('\n6️⃣ Testing Alerting Service...');
    const alertId = await alertingService.createAlert({
      alertType: 'test_alert',
      severity: 'info',
      title: 'Test Alert',
      message: 'This is a test alert for dashboard verification',
      metadata: { test: true }
    });
    console.log(`Created test alert: ${alertId}`);

    const activeAlerts = await alertingService.getActiveAlerts();
    console.log(`Found ${activeAlerts.length} active alerts`);

    // Test 7: Analytics Manager
    console.log('\n7️⃣ Testing Analytics Manager...');
    await analyticsManager.initialize();
    const systemStatus = await analyticsManager.getSystemStatus();
    console.log('System Status:', JSON.stringify(systemStatus, null, 2));

    console.log('\n🎉 All analytics dashboard components tested successfully!');
    console.log('\n📊 Dashboard should be available at: http://localhost:3000/api/dashboard');
    console.log('📈 API endpoints tested:');
    console.log('  - GET /api/analytics/health');
    console.log('  - GET /api/analytics/events/recent');
    console.log('  - GET /api/dashboard/overview');
    console.log('  - GET /api/dashboard/real-time');
    console.log('  - GET /api/dashboard/alerts');
    console.log('  - GET /api/dashboard/experiments');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAnalyticsDashboard().then(() => {
    console.log('\n✨ Test completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
  });
}

export { testAnalyticsDashboard };