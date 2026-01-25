import { createClient } from '@supabase/supabase-js';
import { isNativeApp } from '@/utils/paymentPlatform';

// Custom URL scheme for native app deep linking
const NATIVE_URL_SCHEME = 'myezlist';

// Supabase configuration
// TODO: Replace with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Auth wrapper that provides a consistent interface for authentication
 * Methods: me(), logout(), redirectToLogin(), updateMe(), signInWithPassword(), etc.
 */
export const supabaseAuth = {
  /**
   * Get the current authenticated user with profile data
   * @returns {Promise<Object>} User object with profile data
   * @throws {Error} If not authenticated
   */
  me: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('Not authenticated');
    }

    // Fetch additional user profile data from your profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
    }

    // Merge auth user data with profile data
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      role: profile?.role || 'user',
      subscription_tier: profile?.subscription_tier || 'free',
      monthly_credits_total: profile?.monthly_credits_total || 15,
      credits_used_this_month: profile?.credits_used_this_month || 0,
      current_shopping_lists: profile?.current_shopping_lists || 0,
      current_total_items: profile?.current_total_items || 0,
      current_tasks: profile?.current_tasks || 0,
      current_custom_recipes: profile?.current_custom_recipes || 0,
      theme: profile?.theme || 'default',
      created_date: user.created_at,
      ...profile
    };
  },

  /**
   * Log out the current user and redirect
   * @param {string} redirectUrl - URL to redirect to after logout
   */
  logout: async (redirectUrl) => {
    await supabase.auth.signOut();
    window.location.href = redirectUrl;
  },

  /**
   * Redirect to login page
   * @param {string} redirectUrl - URL to redirect to after successful login
   */
  redirectToLogin: (redirectUrl) => {
    // Store the intended destination for after login
    localStorage.setItem('redirectAfterLogin', redirectUrl);
    window.location.href = '/Login';
  },

  /**
   * Update the current user's profile
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user object
   */
  updateMe: async (updates) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    // Update profile in profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return data;
  },

  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Session data
   */
  signInWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Sign up with email and password
   * @param {string} email 
   * @param {string} password 
   * @param {Object} metadata - Additional user metadata (full_name, etc.)
   * @returns {Promise<Object>} Session data
   */
  signUp: async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) {
      throw error;
    }

    // Create initial profile record
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: metadata.full_name || '',
        role: 'user',
        subscription_tier: 'free',
        monthly_credits_total: 15,
        credits_used_this_month: 0,
        current_shopping_lists: 0,
        current_total_items: 0,
        current_tasks: 0,
        current_custom_recipes: 0,
        theme: 'default',
        created_date: new Date().toISOString()
      });
    }

    return data;
  },

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   * @param {string} provider - 'google', 'github', 'apple', etc.
   * @param {string} redirectTo - URL to redirect after OAuth
   */
  signInWithOAuth: async (provider, redirectTo) => {
    // For native apps, use custom URL scheme for callback
    const isNative = isNativeApp();
    const defaultRedirect = isNative
      ? `${NATIVE_URL_SCHEME}://auth/callback`
      : window.location.origin + '/auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo || defaultRedirect,
        skipBrowserRedirect: isNative // Important: don't auto-redirect on native
      }
    });

    if (error) {
      throw error;
    }

    // For native apps, open the OAuth URL in the system browser
    if (isNative && data?.url) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ 
        url: data.url,
        // Use popover presentation for better mobile experience
        // Don't use windowName as it can cause issues on Android
        presentationStyle: 'popover'
      });
    }

    return data;
  },

  /**
   * Send password reset email
   * @param {string} email 
   */
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });

    if (error) {
      throw error;
    }
  },

  /**
   * Get current session
   * @returns {Promise<Object|null>} Current session or null
   */
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Listen for auth state changes
   * @param {Function} callback - Called when auth state changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

/**
 * User entity wrapper for admin operations
 * Provides filter/search functionality for user management
 */
export const UserEntity = {
  /**
   * Filter/search users (admin only)
   * @param {Object} filters - Filter criteria (e.g., { email: 'user@example.com' })
   * @returns {Promise<Array>} Array of matching users
   */
  filter: async (filters) => {
    let query = supabase.from('profiles').select('*');
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'email') {
        query = query.ilike('email', `%${value}%`);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to filter users: ${error.message}`);
    }

    return data || [];
  }
};

export default supabase;

