import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

// MARK: - Types
interface PrivacySettings {
  locationPrivacyMode: 'standard' | 'foreground_only';
  onDeviceProcessing: boolean;
  dataMinimization: boolean;
  analyticsOptOut: boolean;
  crashReportingOptOut: boolean;
  locationHistoryRetention: number;
}

interface DataExportRequest {
  userId: string;
  includeLocationHistory: boolean;
  includeTasks: boolean;
  includePlaces: boolean;
  includeNotificationHistory: boolean;
  format: 'json' | 'csv';
}

interface DataExportResponse {
  exportId: string;
  downloadUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  fileSizeBytes?: number;
}

interface DataDeletionRequest {
  userId: string;
  deleteLocationHistory: boolean;
  deleteTasks: boolean;
  deletePlaces: boolean;
  deleteNotificationHistory: boolean;
  deleteAccount: boolean;
  confirmationCode: string;
}

interface ExportedData {
  user?: any;
  tasks?: any[];
  places?: any[];
  locationHistory?: any[];
  notificationHistory?: any[];
  exportMetadata: {
    exportId: string;
    exportedAt: Date;
    format: string;
    dataTypes: string[];
  };
}

export class PrivacyService {
  private db: Pool;
  private exportDir: string;

  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/nearme'
    });
    this.exportDir = process.env.EXPORT_DIR || './exports';
    this.ensureExportDirectory();
  }

  private async ensureExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create export directory:', error);
    }
  }

  // MARK: - Privacy Settings

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    const query = `
      SELECT privacy_settings 
      FROM users 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const settings = result.rows[0].privacy_settings || {};
    
    // Return default settings merged with user settings
    return {
      locationPrivacyMode: settings.locationPrivacyMode || 'standard',
      onDeviceProcessing: settings.onDeviceProcessing !== false,
      dataMinimization: settings.dataMinimization !== false,
      analyticsOptOut: settings.analyticsOptOut || false,
      crashReportingOptOut: settings.crashReportingOptOut || false,
      locationHistoryRetention: settings.locationHistoryRetention || 30
    };
  }

  async updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<PrivacySettings> {
    const query = `
      UPDATE users 
      SET privacy_settings = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING privacy_settings
    `;
    
    const result = await this.db.query(query, [userId, JSON.stringify(settings)]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Apply data retention policy if changed
    if (settings.locationHistoryRetention) {
      await this.applyDataRetentionPolicy(userId, settings.locationHistoryRetention);
    }

    return settings;
  }

  private async applyDataRetentionPolicy(userId: string, retentionDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Clean up old location history
    const deleteQuery = `
      DELETE FROM location_history 
      WHERE user_id = $1 AND created_at < $2
    `;
    
    await this.db.query(deleteQuery, [userId, cutoffDate]);
  }

  // MARK: - Data Export

  async requestDataExport(request: DataExportRequest): Promise<DataExportResponse> {
    const exportId = uuidv4();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store export request
    const insertQuery = `
      INSERT INTO data_exports (id, user_id, request_data, status, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await this.db.query(insertQuery, [
      exportId,
      request.userId,
      JSON.stringify(request),
      'pending',
      createdAt,
      expiresAt
    ]);

    // Process export asynchronously
    this.processDataExport(exportId, request).catch(error => {
      console.error(`Export ${exportId} failed:`, error);
      this.updateExportStatus(exportId, 'failed');
    });

    return {
      exportId,
      status: 'pending',
      createdAt,
      expiresAt
    };
  }

  private async processDataExport(exportId: string, request: DataExportRequest) {
    try {
      await this.updateExportStatus(exportId, 'processing');

      const exportData: ExportedData = {
        exportMetadata: {
          exportId,
          exportedAt: new Date(),
          format: request.format,
          dataTypes: []
        }
      };

      // Collect requested data
      if (request.includeTasks) {
        exportData.tasks = await this.exportTasks(request.userId);
        exportData.exportMetadata.dataTypes.push('tasks');
      }

      if (request.includePlaces) {
        exportData.places = await this.exportPlaces(request.userId);
        exportData.exportMetadata.dataTypes.push('places');
      }

      if (request.includeLocationHistory) {
        exportData.locationHistory = await this.exportLocationHistory(request.userId);
        exportData.exportMetadata.dataTypes.push('locationHistory');
      }

      if (request.includeNotificationHistory) {
        exportData.notificationHistory = await this.exportNotificationHistory(request.userId);
        exportData.exportMetadata.dataTypes.push('notificationHistory');
      }

      // Generate export file
      const filePath = await this.generateExportFile(exportId, exportData, request.format);
      const fileStats = await fs.stat(filePath);
      
      // Update export record with file info
      await this.updateExportWithFile(exportId, filePath, fileStats.size);
      
    } catch (error) {
      console.error(`Export processing failed for ${exportId}:`, error);
      await this.updateExportStatus(exportId, 'failed');
    }
  }

  private async exportTasks(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.location_type,
        t.poi_category,
        t.status,
        t.created_at,
        t.completed_at,
        p.name as place_name,
        p.latitude as place_latitude,
        p.longitude as place_longitude
      FROM tasks t
      LEFT JOIN places p ON t.place_id = p.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  private async exportPlaces(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        id,
        name,
        latitude,
        longitude,
        address,
        place_type,
        default_radii,
        created_at
      FROM places
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  private async exportLocationHistory(userId: string): Promise<any[]> {
    // Note: This would require a location_history table
    // For now, return geofence events as location history
    const query = `
      SELECT 
        ge.id,
        ge.event_type,
        ge.latitude,
        ge.longitude,
        ge.timestamp,
        t.title as task_title,
        g.geofence_type
      FROM geofence_events ge
      JOIN geofences g ON ge.geofence_id = g.id
      JOIN tasks t ON g.task_id = t.id
      WHERE t.user_id = $1
      ORDER BY ge.timestamp DESC
      LIMIT 1000
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  private async exportNotificationHistory(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        n.id,
        n.type,
        n.title,
        n.body,
        n.sent_at,
        n.action_taken,
        t.title as task_title
      FROM notifications n
      JOIN tasks t ON n.task_id = t.id
      WHERE t.user_id = $1
      ORDER BY n.sent_at DESC
      LIMIT 1000
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  private async generateExportFile(exportId: string, data: ExportedData, format: 'json' | 'csv'): Promise<string> {
    const fileName = `export_${exportId}.${format}`;
    const filePath = path.join(this.exportDir, fileName);

    if (format === 'json') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else {
      await this.generateCsvExport(filePath, data);
    }

    return filePath;
  }

  private async generateCsvExport(filePath: string, data: ExportedData) {
    // Create a summary CSV with all data types
    const summaryData = [];

    if (data.tasks) {
      data.tasks.forEach(task => {
        summaryData.push({
          type: 'task',
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          created_at: task.created_at,
          location_info: task.place_name || task.poi_category
        });
      });
    }

    if (data.places) {
      data.places.forEach(place => {
        summaryData.push({
          type: 'place',
          id: place.id,
          title: place.name,
          description: place.address,
          status: 'active',
          created_at: place.created_at,
          location_info: `${place.latitude}, ${place.longitude}`
        });
      });
    }

    if (data.locationHistory) {
      data.locationHistory.forEach(location => {
        summaryData.push({
          type: 'location_event',
          id: location.id,
          title: location.task_title,
          description: location.event_type,
          status: location.geofence_type,
          created_at: location.timestamp,
          location_info: `${location.latitude}, ${location.longitude}`
        });
      });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'type', title: 'Type' },
        { id: 'id', title: 'ID' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'status', title: 'Status' },
        { id: 'created_at', title: 'Created At' },
        { id: 'location_info', title: 'Location Info' }
      ]
    });

    await csvWriter.writeRecords(summaryData);
  }

  private async updateExportStatus(exportId: string, status: string) {
    const query = `
      UPDATE data_exports 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [exportId, status]);
  }

  private async updateExportWithFile(exportId: string, filePath: string, fileSize: number) {
    const downloadUrl = `/api/privacy/download/${exportId}`;
    
    const query = `
      UPDATE data_exports 
      SET 
        status = 'completed',
        file_path = $2,
        file_size = $3,
        download_url = $4,
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [exportId, filePath, fileSize, downloadUrl]);
  }

  async getExportStatus(exportId: string, userId: string): Promise<DataExportResponse | null> {
    const query = `
      SELECT 
        id as export_id,
        status,
        download_url,
        file_size,
        created_at,
        expires_at
      FROM data_exports
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await this.db.query(query, [exportId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      exportId: row.export_id,
      status: row.status,
      downloadUrl: row.download_url,
      fileSizeBytes: row.file_size,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  async getUserExports(userId: string): Promise<DataExportResponse[]> {
    const query = `
      SELECT 
        id as export_id,
        status,
        download_url,
        file_size,
        created_at,
        expires_at
      FROM data_exports
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await this.db.query(query, [userId]);
    
    return result.rows.map(row => ({
      exportId: row.export_id,
      status: row.status,
      downloadUrl: row.download_url,
      fileSizeBytes: row.file_size,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
  }

  // MARK: - Data Deletion

  async requestDataDeletion(request: DataDeletionRequest): Promise<string> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      if (request.deleteLocationHistory) {
        await client.query('DELETE FROM location_history WHERE user_id = $1', [request.userId]);
        await client.query('DELETE FROM geofence_events WHERE geofence_id IN (SELECT id FROM geofences WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1))', [request.userId]);
      }

      if (request.deleteNotificationHistory) {
        await client.query('DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1)', [request.userId]);
      }

      if (request.deleteTasks) {
        await client.query('DELETE FROM geofences WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1)', [request.userId]);
        await client.query('DELETE FROM tasks WHERE user_id = $1', [request.userId]);
      }

      if (request.deletePlaces) {
        await client.query('DELETE FROM places WHERE user_id = $1', [request.userId]);
      }

      if (request.deleteAccount) {
        // Delete all user data
        await client.query('DELETE FROM data_exports WHERE user_id = $1', [request.userId]);
        await client.query('DELETE FROM users WHERE id = $1', [request.userId]);
      }

      await client.query('COMMIT');
      
      return 'Data deletion completed successfully';
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // MARK: - Analytics

  async getAnalyticsStatus(userId: string): Promise<{ analyticsOptOut: boolean; crashReportingOptOut: boolean }> {
    const settings = await this.getPrivacySettings(userId);
    return {
      analyticsOptOut: settings.analyticsOptOut,
      crashReportingOptOut: settings.crashReportingOptOut
    };
  }

  async optOutOfAnalytics(userId: string): Promise<void> {
    const currentSettings = await this.getPrivacySettings(userId);
    const updatedSettings = {
      ...currentSettings,
      analyticsOptOut: true
    };
    
    await this.updatePrivacySettings(userId, updatedSettings);
  }

  // MARK: - Cleanup

  async cleanupExpiredExports(): Promise<void> {
    const query = `
      SELECT id, file_path
      FROM data_exports
      WHERE expires_at < NOW() AND status = 'completed'
    `;
    
    const result = await this.db.query(query);
    
    for (const row of result.rows) {
      try {
        // Delete file
        if (row.file_path) {
          await fs.unlink(row.file_path);
        }
        
        // Update status
        await this.updateExportStatus(row.id, 'expired');
      } catch (error) {
        console.error(`Failed to cleanup export ${row.id}:`, error);
      }
    }
  }
}