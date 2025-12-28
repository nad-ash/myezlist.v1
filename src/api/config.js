/**
 * Backend Configuration
 * 
 * This app uses Supabase for all backend services:
 * - Authentication (Supabase Auth)
 * - Database (Supabase PostgreSQL)
 * - Edge Functions (Supabase Edge Functions)
 * - Storage (Supabase Storage)
 */

// Authentication Provider - always Supabase
export const AUTH_PROVIDER = 'supabase';

// Backend Provider - always Supabase
export const BACKEND_PROVIDER = 'supabase';

// Helper functions for consistency
export const isSupabaseAuth = () => true;
export const isSupabaseBackend = () => true;

// Log current configuration (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 MyEZList Configuration:');
  console.log(`   Backend: Supabase`);
}
