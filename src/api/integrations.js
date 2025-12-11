/**
 * Integration APIs (AI, Email, File Upload, etc.)
 * 
 * This file exports integration functions with automatic provider switching.
 * Based on BACKEND_PROVIDER config, integrations use either Base44 or direct APIs.
 */

import { BACKEND_PROVIDER } from './config';
import { base44 } from './base44Client';
import * as SupabaseIntegrations from './supabaseIntegrations';

// ==========================================
// INTEGRATION EXPORTS
// Automatically switches between Base44 and Supabase/OpenAI based on BACKEND_PROVIDER
// ==========================================

// Helper to get integration from the correct provider
const getIntegration = (integrationName, supabaseIntegration) => {
  if (BACKEND_PROVIDER === 'supabase') {
    return supabaseIntegration;
  }
  // Base44 provider
  return base44.integrations?.Core?.[integrationName] || (async () => {
    throw new Error(`Integration '${integrationName}' not available`);
  });
};

// Core Integration Object (for legacy compatibility)
export const Core = BACKEND_PROVIDER === 'supabase' 
  ? SupabaseIntegrations.Core 
  : base44.integrations?.Core;

// Individual exports for direct imports
export const InvokeLLM = getIntegration('InvokeLLM', SupabaseIntegrations.InvokeLLM);
export const SendEmail = getIntegration('SendEmail', SupabaseIntegrations.SendEmail);
export const UploadFile = getIntegration('UploadFile', SupabaseIntegrations.UploadFile);
export const GenerateImage = getIntegration('GenerateImage', SupabaseIntegrations.GenerateImage);
export const ExtractDataFromUploadedFile = getIntegration('ExtractDataFromUploadedFile', SupabaseIntegrations.ExtractDataFromUploadedFile);
export const CreateFileSignedUrl = getIntegration('CreateFileSignedUrl', SupabaseIntegrations.CreateFileSignedUrl);
export const UploadPrivateFile = getIntegration('UploadPrivateFile', SupabaseIntegrations.UploadPrivateFile);
