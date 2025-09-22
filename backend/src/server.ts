import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { placeRoutes } from './routes/places';
import { poiRoutes } from './routes/poi';
import { geofenceRoutes } from './routes/geofences';
import { healthRoutes } from './routes/health';
import notificationRoutes from './routes/notifications';
import notificationPersistenceRoutes from './routes/notificationPersistence';
import notificationManagerRoutes from './routes/notificationManager';
import backgroundProcessorRoutes from './routes/backgroundProcessor';
import pushNotificationRoutes from './routes/pushNotifications';
import { BackgroundProcessor } from './services/backgroundProcessor';
import { PushNotificationService } from './services/pushNotificationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/poi', poiRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications/persistence', notificationPersistenceRoutes);
app.use('/api/notifications/manager', notificationManagerRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);
app.use('/api/background', backgroundProcessorRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Near Me API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize push notification service
  PushNotificationService.initialize({
    apns: process.env.APNS_KEY_ID ? {
      teamId: process.env.APNS_TEAM_ID!,
      keyId: process.env.APNS_KEY_ID!,
      bundleId: process.env.APNS_BUNDLE_ID!,
      privateKey: process.env.APNS_PRIVATE_KEY!,
      environment: (process.env.APNS_ENVIRONMENT as 'development' | 'production') || 'development'
    } : undefined,
    fcm: process.env.FCM_PROJECT_ID ? {
      projectId: process.env.FCM_PROJECT_ID!,
      privateKey: process.env.FCM_PRIVATE_KEY!,
      clientEmail: process.env.FCM_CLIENT_EMAIL!,
      serverKey: process.env.FCM_SERVER_KEY
    } : undefined,
    useMockServices: process.env.NODE_ENV === 'development' && !process.env.USE_REAL_PUSH_SERVICES
  });
  console.log('📱 Push notification service initialized');
  
  // Start background processor for notification management
  if (process.env.NODE_ENV !== 'test') {
    BackgroundProcessor.configure({
      intervalMinutes: parseInt(process.env.BACKGROUND_PROCESSOR_INTERVAL || '5'),
      enableSnoozeProcessing: process.env.ENABLE_SNOOZE_PROCESSING !== 'false',
      enableMuteProcessing: process.env.ENABLE_MUTE_PROCESSING !== 'false',
      enableRetryProcessing: process.env.ENABLE_RETRY_PROCESSING !== 'false',
      enableSchedulerProcessing: process.env.ENABLE_SCHEDULER_PROCESSING !== 'false',
      enableCleanup: process.env.ENABLE_CLEANUP !== 'false',
      cleanupOlderThanHours: parseInt(process.env.CLEANUP_OLDER_THAN_HOURS || '24')
    });
    
    BackgroundProcessor.start();
    console.log('🔄 Background processor started for notification management');
  }
});

export default app;