/**
 * Supabase Entity Implementations
 * 
 * This file provides entity classes that match the Base44 entity interface.
 * Each entity supports: list(), filter(), create(), update(), delete()
 * 
 * Activity Tracking:
 * - Pass optional trackingContext to create/update/delete for automatic tracking
 * - trackingContext: { page, operationName, userId, description }
 */

import { supabase } from './supabaseClient';

// Internal reference for activity tracking (set after entities are created)
let activityTrackingEntity = null;

/**
 * Base Entity class that provides common CRUD operations
 */
class SupabaseEntity {
  constructor(tableName, options = {}) {
    this.tableName = tableName;
    // Allow customizing column names for different tables
    this.createdDateCol = options.createdDateCol || 'created_date';
    this.updatedDateCol = options.updatedDateCol || 'updated_date';
    this.hasUpdatedDate = options.hasUpdatedDate !== false; // Default true
    this.hasCreatedDate = options.hasCreatedDate !== false; // Default true
  }

  /**
   * Get all records, optionally sorted
   * @param {string} orderBy - Column to sort by (prefix with - for descending)
   * @param {number} limit - Maximum records to return
   */
  async list(orderBy, limit = 1000) {
    // Use configured created date column as default
    const defaultOrder = `-${this.createdDateCol}`;
    const actualOrderBy = orderBy || defaultOrder;
    
    const isDescending = actualOrderBy.startsWith('-');
    const column = isDescending ? actualOrderBy.slice(1) : actualOrderBy;
    
    let query = supabase
      .from(this.tableName)
      .select('*')
      .order(column, { ascending: !isDescending })
      .limit(limit);

    const { data, error } = await query;
    
    if (error) {
      console.error(`Error listing ${this.tableName}:`, error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Filter records by criteria
   * Supports MongoDB-style operators: $gte, $lte, $gt, $lt, $ne, $in
   * @param {Object} criteria - Key-value pairs to filter by
   * @param {string} orderBy - Column to sort by (prefix with - for descending)
   */
  async filter(criteria = {}, orderBy) {
    // Use configured created date column as default
    const defaultOrder = `-${this.createdDateCol}`;
    const actualOrderBy = orderBy || defaultOrder;
    
    const isDescending = actualOrderBy.startsWith('-');
    const column = isDescending ? actualOrderBy.slice(1) : actualOrderBy;
    
    let query = supabase
      .from(this.tableName)
      .select('*');

    // Apply filters with support for comparison operators
    Object.entries(criteria).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      
      // Check if value is an object with operators
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle MongoDB-style operators
        Object.entries(value).forEach(([operator, operand]) => {
          switch (operator) {
            case '$gte':
              query = query.gte(key, operand);
              break;
            case '$gt':
              query = query.gt(key, operand);
              break;
            case '$lte':
              query = query.lte(key, operand);
              break;
            case '$lt':
              query = query.lt(key, operand);
              break;
            case '$ne':
              query = query.neq(key, operand);
              break;
            case '$in':
              query = query.in(key, operand);
              break;
            case '$like':
              query = query.like(key, operand);
              break;
            case '$ilike':
              query = query.ilike(key, operand);
              break;
            default:
              console.warn(`Unknown operator: ${operator}`);
          }
        });
      } else {
        // Simple equality
        query = query.eq(key, value);
      }
    });

    query = query.order(column, { ascending: !isDescending });

    const { data, error } = await query;
    
    if (error) {
      console.error(`Error filtering ${this.tableName}:`, error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Create a new record
   * @param {Object} recordData - Record data
   * @param {Object} trackingContext - Optional tracking context { page, operationName, userId, description }
   */
  async create(recordData, trackingContext = null) {
    // Build the insert data with proper column names
    const insertData = { ...recordData };
    
    // Only add timestamp columns if they exist in the schema
    if (this.hasCreatedDate && !insertData[this.createdDateCol]) {
      insertData[this.createdDateCol] = new Date().toISOString();
    }
    if (this.hasUpdatedDate && !insertData[this.updatedDateCol]) {
      insertData[this.updatedDateCol] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      throw error;
    }
    
    // Track activity if context provided (and not tracking activity_tracking itself)
    if (trackingContext && activityTrackingEntity && this.tableName !== 'activity_tracking') {
      activityTrackingEntity.create({
        operation_type: 'CREATE',
        page: trackingContext.page,
        operation_name: trackingContext.operationName,
        description: trackingContext.description,
        user_id: trackingContext.userId,
        timestamp: new Date().toISOString()
      }).catch(err => console.warn('Activity tracking failed:', err));
    }
    
    return data;
  }

  /**
   * Update an existing record
   * @param {string} id - Record ID
   * @param {Object} updateData - Fields to update
   * @param {Object} trackingContext - Optional tracking context { page, operationName, userId, description }
   */
  async update(id, updateData, trackingContext = null) {
    const dataToUpdate = { ...updateData };
    
    // Add updated timestamp if the table has it
    if (this.hasUpdatedDate) {
      dataToUpdate[this.updatedDateCol] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      throw error;
    }
    
    // Track activity if context provided (and not tracking activity_tracking itself)
    if (trackingContext && activityTrackingEntity && this.tableName !== 'activity_tracking') {
      activityTrackingEntity.create({
        operation_type: 'UPDATE',
        page: trackingContext.page,
        operation_name: trackingContext.operationName,
        description: trackingContext.description,
        user_id: trackingContext.userId,
        timestamp: new Date().toISOString()
      }).catch(err => console.warn('Activity tracking failed:', err));
    }
    
    return data;
  }

  /**
   * Delete a record
   * @param {string} id - Record ID
   * @param {Object} trackingContext - Optional tracking context { page, operationName, userId, description }
   */
  async delete(id, trackingContext = null) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      throw error;
    }
    
    // Track activity if context provided (and not tracking activity_tracking itself)
    if (trackingContext && activityTrackingEntity && this.tableName !== 'activity_tracking') {
      activityTrackingEntity.create({
        operation_type: 'DELETE',
        page: trackingContext.page,
        operation_name: trackingContext.operationName,
        description: trackingContext.description,
        user_id: trackingContext.userId,
        timestamp: new Date().toISOString()
      }).catch(err => console.warn('Activity tracking failed:', err));
    }
    
    return true;
  }
}

// ==========================================
// ENTITY EXPORTS
// ==========================================

// Shopping Entities
export const ShoppingList = new SupabaseEntity('shopping_lists');
export const Item = new SupabaseEntity('items');
export const ListMember = new SupabaseEntity('list_members');
export const ShareLink = new SupabaseEntity('share_links');
export const CommonItem = new SupabaseEntity('common_items');

// Task Management
export const Todo = new SupabaseEntity('todos');

// Recipe System
export const Recipe = new SupabaseEntity('recipes');
export const RecipeFavorite = new SupabaseEntity('recipe_favorites');

// Analytics & Tracking
export const Statistics = new SupabaseEntity('statistics');

// ActivityTracking uses 'timestamp' instead of 'created_date', and has no 'updated_date'
export const ActivityTracking = new SupabaseEntity('activity_tracking', {
  createdDateCol: 'timestamp',
  hasUpdatedDate: false
});

// CreditTransaction uses 'timestamp' instead of 'created_date', and has no 'updated_date'  
export const CreditTransaction = new SupabaseEntity('credit_transactions', {
  createdDateCol: 'timestamp',
  hasUpdatedDate: false
});

// Subscription & Premium Features
export const SubscriptionTier = new SupabaseEntity('subscription_tiers');
export const PremiumFeature = new SupabaseEntity('premium_features');

// User Admin (for admin operations)
export const UserAdmin = new SupabaseEntity('profiles');

// Set activity tracking entity reference (for internal use by other entities)
activityTrackingEntity = ActivityTracking;
