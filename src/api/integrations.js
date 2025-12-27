/**
 * Integration APIs (AI, Email, File Upload, etc.)
 * 
 * This file exports integration functions using Supabase Edge Functions
 * and direct API calls for AI services.
 */

import * as SupabaseIntegrations from './supabaseIntegrations';

// ==========================================
// INTEGRATION EXPORTS
// ==========================================

// Core Integration Object (for legacy compatibility)
export const Core = SupabaseIntegrations.Core;

// Individual exports for direct imports
export const InvokeLLM = SupabaseIntegrations.InvokeLLM;
export const SendEmail = SupabaseIntegrations.SendEmail;
export const UploadFile = SupabaseIntegrations.UploadFile;
export const GenerateImage = SupabaseIntegrations.GenerateImage;
export const ExtractDataFromUploadedFile = SupabaseIntegrations.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = SupabaseIntegrations.CreateFileSignedUrl;
export const UploadPrivateFile = SupabaseIntegrations.UploadPrivateFile;

// Export AI use case constants for model selection
export const AI_USE_CASES = SupabaseIntegrations.AI_USE_CASES;
