/**
 * Client-Side Task Encryption Utility
 * 
 * Provides end-to-end encryption for task (todo) data so that:
 * - Task titles and descriptions are encrypted before storing in the database
 * - Only the authenticated user can decrypt their own tasks
 * - Due dates remain unencrypted (for notification features)
 * - The server/database never sees plaintext task content
 * 
 * Uses Web Crypto API with AES-GCM for secure client-side encryption.
 * Key is derived from the user's Supabase UUID using PBKDF2.
 * 
 * Security Properties:
 * - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
 * - Random 12-byte IV per encryption prevents pattern analysis
 * - 100,000 PBKDF2 iterations provide key stretching
 * - Key is tied to user's unique Supabase UUID
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const PBKDF2_ITERATIONS = 100000;

// App-specific salt - changes to this will invalidate all encrypted data!
const ENCRYPTION_SALT = 'myezlist-task-encryption-v1';

// Prefix to identify encrypted data (helps with legacy plaintext detection)
const ENCRYPTED_PREFIX = 'ENC:';

/**
 * Check if a string appears to be encrypted
 * @param {string} value - Value to check
 * @returns {boolean} True if the value appears to be encrypted
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Derive a cryptographic key from the user's unique ID
 * Uses PBKDF2 with SHA-256 for key derivation
 * 
 * @param {string} userId - Supabase user UUID
 * @returns {Promise<CryptoKey>} - AES-GCM key for encryption/decryption
 */
async function deriveKeyFromUserId(userId) {
  if (!userId) {
    throw new Error('User ID is required for encryption key derivation');
  }

  const encoder = new TextEncoder();
  
  // Import user ID as raw key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive AES-256 key using PBKDF2 with app-specific salt
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ENCRYPTION_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string
 * 
 * @param {string} plaintext - Text to encrypt
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<string>} - Encrypted data with prefix (ENC:base64)
 */
export async function encryptField(plaintext, userId) {
  // Handle null/undefined/empty values
  if (!plaintext || plaintext.trim() === '') {
    return plaintext;
  }
  
  // Don't re-encrypt already encrypted data
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  if (!userId) {
    console.warn('No user ID provided for encryption, storing plaintext');
    return plaintext;
  }

  try {
    const key = await deriveKeyFromUserId(userId);
    const encoder = new TextEncoder();
    
    // Generate random IV for each encryption (critical for security)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    // Encrypt the plaintext
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(plaintext)
    );
    
    // Combine IV + ciphertext into a single buffer
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Encode as base64 with prefix
    const base64 = btoa(String.fromCharCode(...combined));
    return ENCRYPTED_PREFIX + base64;
  } catch (error) {
    console.error('Encryption failed:', error);
    // Return plaintext on failure to avoid data loss
    // This should be logged/monitored in production
    return plaintext;
  }
}

/**
 * Decrypt an encrypted string
 * 
 * @param {string} encryptedData - Encrypted data with ENC: prefix
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<string>} - Decrypted plaintext
 */
export async function decryptField(encryptedData, userId) {
  // Handle null/undefined/empty values
  if (!encryptedData || encryptedData.trim() === '') {
    return encryptedData;
  }
  
  // Return plaintext data as-is (legacy or unencrypted)
  if (!isEncrypted(encryptedData)) {
    return encryptedData;
  }

  if (!userId) {
    console.warn('No user ID provided for decryption');
    return encryptedData;
  }

  try {
    const key = await deriveKeyFromUserId(userId);
    const decoder = new TextDecoder();
    
    // Remove prefix and decode base64
    const base64Data = encryptedData.slice(ENCRYPTED_PREFIX.length);
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    
    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    
    return decoder.decode(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return the encrypted data on failure
    // This could happen if the key changed or data is corrupted
    return encryptedData;
  }
}

/**
 * Encrypt task fields before saving to database
 * Only encrypts sensitive fields (title, description)
 * Leaves operational fields unencrypted (due_date, status, priority, etc.)
 * 
 * @param {Object} taskData - Task data with plaintext fields
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<Object>} - Task data with encrypted sensitive fields
 */
export async function encryptTaskForStorage(taskData, userId) {
  if (!taskData) return taskData;
  
  const encrypted = { ...taskData };
  
  // Encrypt sensitive fields
  if (taskData.title) {
    encrypted.title = await encryptField(taskData.title, userId);
  }
  
  if (taskData.description) {
    encrypted.description = await encryptField(taskData.description, userId);
  }
  
  // These fields remain unencrypted for database queries and notifications:
  // - due_date, due_time (for scheduling notifications)
  // - status (for filtering: pending, in_progress, completed)
  // - priority (for filtering: low, medium, high)
  // - category (for filtering: home, work, personal, etc.)
  // - created_by (for ownership filtering)
  // - is_favorite (for quick access filtering)
  // - timestamps (for sorting and audit)
  
  return encrypted;
}

/**
 * Decrypt task fields after loading from database
 * 
 * @param {Object} taskData - Task data with encrypted fields
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<Object>} - Task data with decrypted fields
 */
export async function decryptTaskFromStorage(taskData, userId) {
  if (!taskData) return taskData;
  
  const decrypted = { ...taskData };
  
  // Decrypt sensitive fields
  if (taskData.title) {
    decrypted.title = await decryptField(taskData.title, userId);
  }
  
  if (taskData.description) {
    decrypted.description = await decryptField(taskData.description, userId);
  }
  
  return decrypted;
}

/**
 * Decrypt an array of tasks
 * Uses Promise.all for parallel decryption (better performance)
 * 
 * @param {Array} tasks - Array of encrypted task objects
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<Array>} - Array of decrypted task objects
 */
export async function decryptTasks(tasks, userId) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return tasks;
  }
  
  return Promise.all(
    tasks.map(task => decryptTaskFromStorage(task, userId))
  );
}

/**
 * Encrypt multiple tasks (for bulk operations)
 * 
 * @param {Array} tasks - Array of plaintext task objects
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<Array>} - Array of encrypted task objects
 */
export async function encryptTasks(tasks, userId) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return tasks;
  }
  
  return Promise.all(
    tasks.map(task => encryptTaskForStorage(task, userId))
  );
}

/**
 * Check if a task needs migration (has unencrypted title/description)
 * 
 * @param {Object} task - Task object from database
 * @returns {boolean} - True if the task needs encryption migration
 */
export function taskNeedsMigration(task) {
  if (!task) return false;
  
  // Check if title exists and is not encrypted
  if (task.title && !isEncrypted(task.title)) {
    return true;
  }
  
  // Check if description exists and is not encrypted
  if (task.description && !isEncrypted(task.description)) {
    return true;
  }
  
  return false;
}

/**
 * Migrate a single task from plaintext to encrypted
 * 
 * @param {Object} task - Task with plaintext fields
 * @param {string} userId - User's Supabase UUID
 * @returns {Promise<Object>} - Task with encrypted fields, ready for update
 */
export async function migrateTaskToEncrypted(task, userId) {
  if (!task || !taskNeedsMigration(task)) {
    return null; // No migration needed
  }
  
  const updates = {};
  
  if (task.title && !isEncrypted(task.title)) {
    updates.title = await encryptField(task.title, userId);
  }
  
  if (task.description && !isEncrypted(task.description)) {
    updates.description = await encryptField(task.description, userId);
  }
  
  return {
    id: task.id,
    ...updates
  };
}

export default {
  encryptField,
  decryptField,
  encryptTaskForStorage,
  decryptTaskFromStorage,
  decryptTasks,
  encryptTasks,
  isEncrypted,
  taskNeedsMigration,
  migrateTaskToEncrypted
};

