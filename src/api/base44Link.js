/**
 * Base44 User Linking
 * 
 * This module handles linking Supabase authenticated users to Base44 users.
 * After Supabase login, we call a Base44 backend function to get a Base44 session token.
 */

import { base44 } from './base44Client';

const BASE44_TOKEN_KEY = 'base44_session_token';
const BASE44_USER_KEY = 'base44_user';

/**
 * Link a Supabase user to Base44 and get a session token
 * @param {Object} supabaseUser - The Supabase user object
 * @returns {Promise<Object>} - The Base44 user and token
 */
export async function linkSupabaseUserToBase44(supabaseUser) {
  try {
    // Call the Base44 backend function to link/create user and get token
    const result = await base44.functions.linkSupabaseUser({
      supabase_user_id: supabaseUser.id,
      email: supabaseUser.email,
      full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0]
    });

    if (result.success) {
      // Store the Base44 token for subsequent API calls
      localStorage.setItem(BASE44_TOKEN_KEY, result.token);
      localStorage.setItem(BASE44_USER_KEY, JSON.stringify(result.user));
      
      console.log('✅ Successfully linked Supabase user to Base44');
      return result;
    } else {
      throw new Error(result.error || 'Failed to link user to Base44');
    }
  } catch (error) {
    console.error('Error linking Supabase user to Base44:', error);
    throw error;
  }
}

/**
 * Get the stored Base44 session token
 * @returns {string|null} - The Base44 session token or null
 */
export function getBase44Token() {
  return localStorage.getItem(BASE44_TOKEN_KEY);
}

/**
 * Get the stored Base44 user
 * @returns {Object|null} - The Base44 user object or null
 */
export function getBase44User() {
  const userStr = localStorage.getItem(BASE44_USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Clear the stored Base44 session
 */
export function clearBase44Session() {
  localStorage.removeItem(BASE44_TOKEN_KEY);
  localStorage.removeItem(BASE44_USER_KEY);
}

/**
 * Check if we have a valid Base44 session
 * @returns {boolean}
 */
export function hasBase44Session() {
  return !!getBase44Token();
}

