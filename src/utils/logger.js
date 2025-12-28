/**
 * Debug Logger Utility
 * 
 * Controls console logging based on environment and debug mode.
 * 
 * In DEVELOPMENT: All logs are enabled by default
 * In PRODUCTION: Logs are hidden unless debug mode is enabled via localStorage
 * 
 * To enable debug mode in production:
 *   localStorage.setItem('DEBUG_MODE', 'your-secret-passphrase');
 *   // Then refresh the page
 * 
 * To disable:
 *   localStorage.removeItem('DEBUG_MODE');
 */

const isDev = import.meta.env.DEV;

/**
 * Simple hash function for passphrase verification
 * Uses djb2 algorithm - fast and produces consistent hashes
 */
const hashPassphrase = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer, then to hex string
  return (hash >>> 0).toString(16);
};

// Pre-computed hash of the secret passphrase (passphrase not stored in code)
const DEBUG_SECRET_HASH = 'ae992627';

/**
 * Check if debug mode is enabled
 * - Always true in development
 * - In production, requires correct secret in localStorage (verified via hash)
 */
export const isDebugMode = () => {
  // Always debug in development
  if (isDev) return true;
  
  // In production, require secret passphrase (verified by hash)
  if (typeof window === 'undefined') return false;
  const input = localStorage.getItem('DEBUG_MODE');
  if (!input) return false;
  return hashPassphrase(input) === DEBUG_SECRET_HASH;
};

/**
 * Logger object with various log levels
 * All methods check debug mode before logging
 */
export const logger = {
  /**
   * Debug log - for verbose debugging info
   * Only shows in dev or when debug mode is enabled
   */
  debug: (...args) => {
    if (isDebugMode()) {
      console.log(...args);
    }
  },

  /**
   * Info log - for general information
   * In production with debug mode, sanitizes sensitive fields
   */
  info: (message, data = null) => {
    if (!isDebugMode()) return;
    
    if (data === null) {
      console.log(message);
      return;
    }

    if (isDev) {
      // Full data in development
      console.log(message, data);
    } else {
      // Sanitize sensitive fields in production (even with debug enabled)
      const sanitized = sanitizeData(data);
      console.log(message, sanitized);
    }
  },

  /**
   * Warn log - for warnings (always shown)
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Error log - for errors (always shown)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Realtime log - specifically for Supabase realtime events
   * Includes emoji prefix for easy filtering
   */
  realtime: (component, action, itemId = null, data = null) => {
    if (!isDebugMode()) return;
    
    const prefix = `📡 ${component}:`;
    
    if (data === null && itemId === null) {
      console.log(`${prefix} ${action}`);
    } else if (data === null) {
      console.log(`${prefix} ${action} for item ${isDev ? itemId : '[id]'}`);
    } else if (isDev) {
      console.log(`${prefix} ${action} for item ${itemId}`, data);
    } else {
      console.log(`${prefix} ${action} for item [id]`, sanitizeData(data));
    }
  },

  /**
   * Cache log - for cache operations
   */
  cache: (component, action, details = '') => {
    if (!isDebugMode()) return;
    console.log(`📦 ${component}: ${action}${details ? ` - ${details}` : ''}`);
  },

  /**
   * AI log - for AI/LLM operations
   */
  ai: (action, details = null) => {
    if (!isDebugMode()) return;
    if (details === null) {
      console.log(`🤖 ${action}`);
    } else {
      console.log(`🤖 ${action}`, isDev ? details : '[details hidden]');
    }
  },

  /**
   * Import log - for import operations
   */
  import: (action, itemName = null, details = null) => {
    if (!isDebugMode()) return;
    const prefix = itemName ? `🔎 "${itemName}":` : '📥';
    if (details === null) {
      console.log(`${prefix} ${action}`);
    } else {
      console.log(`${prefix} ${action}`, isDev ? details : '[details hidden]');
    }
  },

  /**
   * Success log - for successful operations
   */
  success: (message, details = null) => {
    if (!isDebugMode()) return;
    if (details === null) {
      console.log(`✅ ${message}`);
    } else {
      console.log(`✅ ${message}`, isDev ? details : '');
    }
  },

  /**
   * Background task log
   */
  background: (action, details = null) => {
    if (!isDebugMode()) return;
    if (details === null) {
      console.log(`🎨 ${action}`);
    } else {
      console.log(`🎨 ${action}`, isDev ? details : '');
    }
  }
};

/**
 * Sanitize sensitive data for production logs
 * Removes or redacts fields that could be sensitive
 */
function sanitizeData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return '[array]';

  const sanitized = { ...data };
  
  // List of sensitive fields to redact
  const sensitiveFields = [
    'id', 'user_id', 'list_id', 'item_id', 'recipe_id',
    'email', 'added_by', 'created_by', 'owner_id', 'member_id',
    'photo_url', 'image_url', 'url'
  ];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[redacted]';
    }
  }
  
  return sanitized;
}

export default logger;

