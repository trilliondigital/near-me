import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { 
  securityHeaders, 
  corsOptions, 
  requestId, 
  securityLogger, 
  validateContentType,
  validateRequestBody,
  apiRateLimit,
  speedLimiter
} from './middleware/security';
import { healthRoutes } from './routes/health';
import { requestMetrics } from './middleware/requestMetrics';
import { BackgroundProcessor } from './services/backgroundProcessor';
import { PushNotificationService } from './services/pushNotificationService';
import { analyticsManager } from './services/analyticsManager';
import { SubscriptionExpirationService } from './services/subscriptionExpirationService';
import { initializeDatabase, initializeRedis } from './database/connection';

// Load environment variables
dotenv.config();

// Initialize database/redis before wiring routes
function getDatabaseConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: Number(u.port || 5432),
        database: (u.pathname || '').replace(/^\//, ''),
        user: decodeURIComponent(u.username || ''),
        password: decodeURIComponent(u.password || ''),
        ssl: false,
      } as const;
    } catch (_) {
      // Fall through to discrete envs
    }
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'nearme',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: false,
  } as const;
}

function getRedisConfig() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: Number(u.port || 6379),
        db: Number((u.pathname || '').replace(/^\//, '') || 0),
        password: decodeURIComponent(u.password || ''),
      } as any;
    } catch (_) {
      // Fall through
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  } as any;
}

// Initialize DB synchronously; Redis asynchronously
try {
  initializeDatabase(getDatabaseConfig());
  console.log('🗄️  Database pool initialized');
} catch (err) {
  console.error('❌ Failed to initialize database pool:', err);
}

initializeRedis(getRedisConfig())
  .then(() => console.log('🧠 Redis client initialized'))
  .catch((err) => console.warn('⚠️  Redis initialization failed (continuing):', (err as any)?.message || err));

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(requestId);
app.use(securityLogger);

// Rate limiting and speed limiting
app.use(apiRateLimit);
app.use(speedLimiter);

// Request validation
app.use(validateRequestBody());
app.use(validateContentType());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware with security limits
app.use(express.json({ 
  limit: '1mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 100
}));

// Request metrics middleware (must be before routes)
app.use(requestMetrics);

// API routes
app.use('/api/health', healthRoutes);

const ENABLE_FULL_ROUTES = process.env.ENABLE_FULL_ROUTES === 'true';
if (ENABLE_FULL_ROUTES) {
  const { authRoutes } = require('./routes/auth');
  const userRoutes = require('./routes/userRoutes').default;
  const { taskRoutes } = require('./routes/tasks');
  const { placeRoutes } = require('./routes/places');
  const { poiRoutes } = require('./routes/poi');
  const { geofenceRoutes } = require('./routes/geofences');
  const notificationRoutes = require('./routes/notifications').default;
  const notificationPersistenceRoutes = require('./routes/notificationPersistence').default;
  const notificationManagerRoutes = require('./routes/notificationManager').default;
  const pushNotificationRoutes = require('./routes/pushNotifications').default;
  const subscriptionRoutes = require('./routes/subscriptions').default;
  const privacyRoutes = require('./routes/privacy').default;
  const performanceRoutes = require('./routes/performance').default;
  const analyticsRoutes = require('./routes/analytics').default;
  const dashboardRoutes = require('./routes/dashboard').default;
  const backgroundProcessorRoutes = require('./routes/backgroundProcessor').default;
  const feedbackRoutes = require('./routes/feedback').default;
  const monitoringRoutes = require('./routes/monitoring').default;

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/places', placeRoutes);
  app.use('/api/poi', poiRoutes);
  app.use('/api/geofences', geofenceRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/notifications/persistence', notificationPersistenceRoutes);
  app.use('/api/notifications/manager', notificationManagerRoutes);
  app.use('/api/push-notifications', pushNotificationRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/privacy', privacyRoutes);
  app.use('/api/performance', performanceRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/background', backgroundProcessorRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/monitoring', monitoringRoutes);
} else {
  console.log('🧪 Running in minimal route mode. Set ENABLE_FULL_ROUTES=true to enable full API.');
}

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
  
  // Initialize analytics manager
  analyticsManager.initialize().then(() => {
    console.log('📊 Analytics manager initialized');
  }).catch(error => {
    console.error('❌ Failed to initialize analytics manager:', error);
  });
  
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
    
    // Start subscription expiration service
    SubscriptionExpirationService.start();
    console.log('⏰ Subscription expiration service started');
  }
});

export default app;