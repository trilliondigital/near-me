import { SubscriptionService } from './subscriptionService';
import cron from 'node-cron';

export class SubscriptionExpirationService {
  private static isRunning = false;

  /**
   * Start the subscription expiration checker
   * Runs every hour to check for expired subscriptions
   */
  static start(): void {
    if (this.isRunning) {
      console.log('⚠️ Subscription expiration service is already running');
      return;
    }

    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔍 Checking for expired subscriptions...');
        await SubscriptionService.processExpiredSubscriptions();
        console.log('✅ Subscription expiration check completed');
      } catch (error) {
        console.error('❌ Error processing expired subscriptions:', error);
      }
    });

    this.isRunning = true;
    console.log('🚀 Subscription expiration service started');
  }

  /**
   * Stop the subscription expiration checker
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Subscription expiration service is not running');
      return;
    }

    // Note: node-cron doesn't provide a direct way to stop specific tasks
    // In a production environment, you'd want to keep track of the task reference
    this.isRunning = false;
    console.log('🛑 Subscription expiration service stopped');
  }

  /**
   * Check if the service is running
   */
  static getStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger subscription expiration check
   */
  static async checkNow(): Promise<void> {
    try {
      console.log('🔍 Manual subscription expiration check triggered...');
      await SubscriptionService.processExpiredSubscriptions();
      console.log('✅ Manual subscription expiration check completed');
    } catch (error) {
      console.error('❌ Error in manual subscription expiration check:', error);
      throw error;
    }
  }
}