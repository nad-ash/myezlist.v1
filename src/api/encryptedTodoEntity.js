/**
 * Encrypted Todo Entity
 * 
 * Wraps the standard Todo with automatic client-side encryption/decryption.
 * This ensures that task titles and descriptions are encrypted before being stored
 * in the database, and decrypted when retrieved.
 * 
 * Usage:
 *   import { EncryptedTodo } from '@/api/encryptedTodo';
 *   
 *   // Create with encryption
 *   await EncryptedTodo.create(taskData, userId, trackingContext);
 *   
 *   // Filter with automatic decryption
 *   const tasks = await EncryptedTodo.filter({ created_by: email }, userId, orderBy);
 * 
 * Unencrypted fields (for database queries/notifications):
 *   - due_date, due_time
 *   - status, priority, category
 *   - created_by, is_favorite
 *   - timestamps
 * 
 * Encrypted fields:
 *   - title
 *   - description
 */

import { Todo } from './entities';
import { 
  encryptTaskForStorage, 
  decryptTaskFromStorage, 
  decryptTasks,
  taskNeedsMigration,
  migrateTaskToEncrypted
} from '@/utils/taskEncryption';

/**
 * Encrypted Todo Entity - provides encryption layer over Todo
 */
export const EncryptedTodo = {
  /**
   * Create a new task with encrypted sensitive fields
   * 
   * @param {Object} taskData - Task data (title, description, etc.)
   * @param {string} userId - User's Supabase UUID for encryption key
   * @param {Object} trackingContext - Activity tracking context
   * @returns {Promise<Object>} - Created task (with encrypted fields in DB)
   */
  async create(taskData, userId, trackingContext) {
    // Encrypt sensitive fields before storage
    const encryptedData = await encryptTaskForStorage(taskData, userId);
    
    // Create in database
    const result = await Todo.create(encryptedData, trackingContext);
    
    // Return with decrypted fields for immediate UI use
    return decryptTaskFromStorage(result, userId);
  },

  /**
   * Update a task with encrypted sensitive fields
   * 
   * @param {string} id - Task ID
   * @param {Object} taskData - Fields to update
   * @param {string} userId - User's Supabase UUID for encryption key
   * @param {Object} trackingContext - Activity tracking context
   * @returns {Promise<Object>} - Updated task
   */
  async update(id, taskData, userId, trackingContext) {
    // Encrypt any sensitive fields being updated
    const encryptedData = await encryptTaskForStorage(taskData, userId);
    
    // Update in database
    const result = await Todo.update(id, encryptedData, trackingContext);
    
    // Return with decrypted fields for immediate UI use
    return decryptTaskFromStorage(result, userId);
  },

  /**
   * Filter tasks and decrypt results
   * 
   * @param {Object} filterObj - Filter criteria (e.g., { created_by: email })
   * @param {string} userId - User's Supabase UUID for decryption key
   * @param {string} orderBy - Order by field (e.g., '-created_date')
   * @returns {Promise<Array>} - Array of decrypted tasks
   */
  async filter(filterObj, userId, orderBy) {
    // Fetch encrypted tasks from database
    const encryptedTasks = await Todo.filter(filterObj, orderBy);
    
    // Decrypt all tasks in parallel
    return decryptTasks(encryptedTasks, userId);
  },

  /**
   * Get a single task by ID and decrypt
   * 
   * @param {string} id - Task ID
   * @param {string} userId - User's Supabase UUID for decryption key
   * @returns {Promise<Object>} - Decrypted task
   */
  async get(id, userId) {
    const encryptedTask = await Todo.get(id);
    return decryptTaskFromStorage(encryptedTask, userId);
  },

  /**
   * Delete a task (no encryption needed)
   * 
   * @param {string} id - Task ID
   * @param {Object} trackingContext - Activity tracking context
   * @returns {Promise<void>}
   */
  async delete(id, trackingContext) {
    return Todo.delete(id, trackingContext);
  },

  /**
   * List all tasks (with decryption)
   * Note: This should rarely be used - prefer filter() for user-specific queries
   * 
   * @param {string} userId - User's Supabase UUID for decryption key
   * @param {string} orderBy - Order by field
   * @returns {Promise<Array>} - Array of decrypted tasks
   */
  async list(userId, orderBy) {
    const encryptedTasks = await Todo.list(orderBy);
    return decryptTasks(encryptedTasks, userId);
  },

  /**
   * Migrate existing plaintext tasks to encrypted format
   * Call this once per user to encrypt any legacy unencrypted tasks
   * 
   * @param {string} userEmail - User's email for filtering
   * @param {string} userId - User's Supabase UUID for encryption key
   * @param {Function} onProgress - Optional callback for progress updates
   * @returns {Promise<Object>} - Migration results { migrated: number, skipped: number, errors: number }
   */
  async migrateUserTasks(userEmail, userId, onProgress) {
    const results = {
      migrated: 0,
      skipped: 0,
      errors: 0,
      total: 0
    };

    try {
      // Fetch all user's tasks (raw, without decryption)
      const tasks = await Todo.filter({ created_by: userEmail }, '-created_date');
      results.total = tasks.length;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        try {
          if (taskNeedsMigration(task)) {
            // Task has plaintext data - encrypt it
            const encryptedUpdates = await migrateTaskToEncrypted(task, userId);
            
            if (encryptedUpdates) {
              await Todo.update(task.id, encryptedUpdates);
              results.migrated++;
            }
          } else {
            // Task already encrypted or empty
            results.skipped++;
          }
        } catch (taskError) {
          console.error(`Failed to migrate task ${task.id}:`, taskError);
          results.errors++;
        }

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: tasks.length,
            ...results
          });
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    return results;
  },

  /**
   * Check if any tasks need migration
   * 
   * @param {string} userEmail - User's email for filtering
   * @returns {Promise<boolean>} - True if there are unencrypted tasks
   */
  async hasPendingMigration(userEmail) {
    try {
      const tasks = await Todo.filter({ created_by: userEmail }, '-created_date');
      return tasks.some(task => taskNeedsMigration(task));
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return false;
    }
  }
};

export default EncryptedTodo;

