import express from 'express';
import { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { PrivacyService } from '../services/privacyService';
import { body, param } from 'express-validator';

const router = express.Router();
const privacyService = new PrivacyService();

// MARK: - Privacy Settings Routes

/**
 * GET /api/privacy/settings
 * Get user privacy settings
 */
router.get('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const settings = await privacyService.getPrivacySettings(userId);
    
    res.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch privacy settings',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/privacy/settings
 * Update user privacy settings
 */
router.put('/settings', 
  authenticateToken,
  [
    body('locationPrivacyMode').isIn(['standard', 'foreground_only']),
    body('onDeviceProcessing').isBoolean(),
    body('dataMinimization').isBoolean(),
    body('analyticsOptOut').isBoolean(),
    body('crashReportingOptOut').isBoolean(),
    body('locationHistoryRetention').isInt({ min: 1, max: 365 })
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
      }

      const settings = await privacyService.updatePrivacySettings(userId, req.body);
      
      res.json({
        success: true,
        data: settings,
        message: 'Privacy settings updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// MARK: - Data Export Routes

/**
 * POST /api/privacy/export
 * Request data export
 */
router.post('/export',
  authenticateToken,
  [
    body('userId').isUUID(),
    body('includeLocationHistory').isBoolean(),
    body('includeTasks').isBoolean(),
    body('includePlaces').isBoolean(),
    body('includeNotificationHistory').isBoolean(),
    body('format').isIn(['json', 'csv'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId !== req.body.userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized to export this user\'s data',
          timestamp: new Date().toISOString()
        });
      }

      const exportResponse = await privacyService.requestDataExport(req.body);
      
      res.json({
        success: true,
        data: exportResponse,
        message: 'Data export requested successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error requesting data export:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to request data export',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/privacy/export/:exportId
 * Get export status
 */
router.get('/export/:exportId',
  authenticateToken,
  [param('exportId').isUUID()],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { exportId } = req.params;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
      }

      const exportStatus = await privacyService.getExportStatus(exportId, userId);
      
      if (!exportStatus) {
        return res.status(404).json({
          success: false,
          message: 'Export not found',
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: exportStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching export status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch export status',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/privacy/exports
 * Get user's export history
 */
router.get('/exports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const exports = await privacyService.getUserExports(userId);
    
    res.json({
      success: true,
      data: exports,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user exports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      timestamp: new Date().toISOString()
    });
  }
});

// MARK: - Data Deletion Routes

/**
 * POST /api/privacy/delete
 * Request data deletion
 */
router.post('/delete',
  authenticateToken,
  [
    body('userId').isUUID(),
    body('deleteLocationHistory').isBoolean(),
    body('deleteTasks').isBoolean(),
    body('deletePlaces').isBoolean(),
    body('deleteNotificationHistory').isBoolean(),
    body('deleteAccount').isBoolean(),
    body('confirmationCode').isLength({ min: 1 })
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId !== req.body.userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized to delete this user\'s data',
          timestamp: new Date().toISOString()
        });
      }

      // Validate confirmation code
      if (req.body.confirmationCode.toUpperCase() !== 'DELETE') {
        return res.status(400).json({
          success: false,
          message: 'Invalid confirmation code',
          timestamp: new Date().toISOString()
        });
      }

      const deletionResult = await privacyService.requestDataDeletion(req.body);
      
      res.json({
        success: true,
        data: deletionResult,
        message: 'Data deletion completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing data deletion:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process data deletion',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// MARK: - Privacy Analytics Routes

/**
 * GET /api/privacy/analytics-status
 * Get analytics opt-out status
 */
router.get('/analytics-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const analyticsStatus = await privacyService.getAnalyticsStatus(userId);
    
    res.json({
      success: true,
      data: analyticsStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching analytics status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/privacy/opt-out-analytics
 * Opt out of analytics
 */
router.post('/opt-out-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    await privacyService.optOutOfAnalytics(userId);
    
    res.json({
      success: true,
      message: 'Successfully opted out of analytics',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error opting out of analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to opt out of analytics',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;