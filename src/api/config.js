/**
 * Backend Configuration
 * 
 * This file controls which backend services are used throughout the app.
 * 
 * MIGRATION PHASES:
 * ─────────────────
 * Phase 1 (Quick Launch): 
 *   - AUTH_PROVIDER = 'supabase' 
 *   - BACKEND_PROVIDER = 'base44'
 *   - Uses Supabase for authentication, Base44 for data/functions
 * 
 * Phase 2 (Full Migration):
 *   - AUTH_PROVIDER = 'supabase'
 *   - BACKEND_PROVIDER = 'supabase'
 *   - Uses Supabase for everything
 */

// Authentication Provider
// 'supabase' = Use Supabase Auth (recommended)
// 'base44' = Use Base44 Auth (legacy)
export const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'supabase';

// Backend Provider for Entities & Functions
// 'base44' = Use Base44 for database entities and serverless functions
// 'supabase' = Use Supabase for database and edge functions
export const BACKEND_PROVIDER = import.meta.env.VITE_BACKEND_PROVIDER || 'base44';

// Helper to check providers
export const isSupabaseAuth = () => AUTH_PROVIDER === 'supabase';
export const isSupabaseBackend = () => BACKEND_PROVIDER === 'supabase';
export const isBase44Backend = () => BACKEND_PROVIDER === 'base44';

// Log current configuration (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 App Configuration:');
  console.log(`   Auth Provider: ${AUTH_PROVIDER}`);
  console.log(`   Backend Provider: ${BACKEND_PROVIDER}`);
}

