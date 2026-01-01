/**
 * Supabase Integrations
 * 
 * This file provides integration functions when using Supabase backend.
 * AI functionality (LLM and Image generation) is handled by secure Edge Functions.
 * API keys are stored as Supabase secrets and never exposed to the client.
 * 
 * Edge Functions used:
 * - ai-invoke-llm: Text generation with OpenAI or Gemini
 * - ai-generate-image: Image generation with OpenAI or Gemini
 */

import { supabase } from './supabaseClient';
import { logger } from '@/utils/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ===========================================
// Edge Function Helper
// ===========================================

/**
 * Call a Supabase Edge Function with authentication
 * @param {string} functionName - Name of the edge function
 * @param {Object} body - Request body
 * @returns {Promise<Object>} - Response data
 */
async function callEdgeFunction(functionName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Edge function ${functionName} failed`);
  }

  return data;
}

// ===========================================
// AI Use Cases (passed to Edge Functions)
// ===========================================

/**
 * Use case constants for model selection
 * These are passed to the Edge Function which selects the appropriate model
 * - IMAGE: Optimized for image generation tasks
 * - RECIPE: Better quality for complex recipe generation
 * - DEFAULT: Cost-effective for simple tasks
 */
export const AI_USE_CASES = {
  IMAGE: 'image',
  RECIPE: 'recipe',
  DEFAULT: 'default'
};

// ===========================================
// AI Functions (via Edge Functions)
// ===========================================

/**
 * Invoke LLM (Large Language Model)
 * Calls the ai-invoke-llm Edge Function which handles OpenAI/Gemini securely
 * @param {Object} params - { prompt, response_json_schema, useCase, temperature }
 * @param {string} params.prompt - The prompt to send to the LLM
 * @param {Object} params.response_json_schema - Optional JSON schema for structured responses
 * @param {string} params.useCase - 'recipe' | 'image' | 'default' (determines which model to use)
 * @param {number} params.temperature - Optional temperature (0.0-2.0). Lower = more deterministic, higher = more creative
 *                                       Use 0.0-0.3 for structured data extraction, 0.7 (default) for balanced, 0.8-1.0 for creative
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function InvokeLLM({ prompt, response_json_schema, useCase = 'default', temperature }) {
  try {
    logger.ai(`Calling LLM (useCase: ${useCase}, temp: ${temperature ?? 'default'})`);
    
    const body = {
      prompt,
      response_json_schema,
      useCase
    };
    
    // Only include temperature if explicitly provided
    if (temperature !== undefined) {
      body.temperature = temperature;
    }
    
    const result = await callEdgeFunction('ai-invoke-llm', body);
    
    logger.success('LLM response received');
    return result;
  } catch (error) {
    console.error('InvokeLLM error:', error);
    throw error;
  }
}

/**
 * Generate Image
 * Calls the ai-generate-image Edge Function which handles OpenAI/Gemini securely
 * Images are automatically uploaded to Supabase Storage and a permanent URL is returned
 * @param {Object} params - { prompt }
 * @param {string} params.prompt - The image generation prompt
 * @returns {Promise<Object>} - { url: string } - Supabase Storage URL
 */
export async function GenerateImage({ prompt, quality = 'medium' }) {
  try {
    logger.ai(`Generating image (quality: ${quality})`);
    
    const result = await callEdgeFunction('ai-generate-image', { prompt, quality });
    
    logger.success('Image generated');
    return result;
  } catch (error) {
    console.error('GenerateImage error:', error);
    throw error;
  }
}

// ===========================================
// File Upload Functions (Direct Supabase Storage)
// ===========================================

/**
 * Upload File to Supabase Storage
 * @param {Object} params - { file }
 * @returns {Promise<Object>} - { file_url: string }
 */
export async function UploadFile({ file }) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return { file_url: publicUrl };
  } catch (error) {
    console.error('UploadFile error:', error);
    throw error;
  }
}

/**
 * Upload Private File to Supabase Storage
 * @param {Object} params - { file }
 * @returns {Promise<Object>} - { file_path: string }
 */
export async function UploadPrivateFile({ file }) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `private/${fileName}`;

    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    return { file_path: filePath };
  } catch (error) {
    console.error('UploadPrivateFile error:', error);
    throw error;
  }
}

/**
 * Create Signed URL for private files
 * @param {Object} params - { file_path, expires_in }
 * @returns {Promise<Object>} - { signed_url: string }
 */
export async function CreateFileSignedUrl({ file_path, expires_in = 3600 }) {
  try {
    const { data, error } = await supabase.storage
      .from('images')
      .createSignedUrl(file_path, expires_in);

    if (error) throw error;

    return { signed_url: data.signedUrl };
  } catch (error) {
    console.error('CreateFileSignedUrl error:', error);
    throw error;
  }
}

// ===========================================
// Placeholder Functions
// ===========================================

/**
 * Send Email - Placeholder (needs email service like Resend, SendGrid)
 * @param {Object} params - { to, subject, body }
 */
export async function SendEmail({ to, subject, body }) {
  // TODO: Implement with Resend, SendGrid, or Supabase Edge Function
  console.warn('SendEmail not implemented for Supabase. Use Resend or SendGrid.');
  throw new Error('Email sending not configured. Please set up an email service.');
}

/**
 * Extract Data from Uploaded File - Placeholder
 * @param {Object} params - { file_url, extraction_prompt }
 */
export async function ExtractDataFromUploadedFile({ file_url, extraction_prompt }) {
  // TODO: Implement with vision model or document parser
  console.warn('ExtractDataFromUploadedFile not implemented for Supabase.');
  throw new Error('File extraction not configured.');
}

// ===========================================
// Core Export Object (for compatibility)
// ===========================================

export const Core = {
  InvokeLLM,
  GenerateImage,
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  SendEmail,
  ExtractDataFromUploadedFile
};

/**
 * Get AI Provider Info
 * Note: AI configuration is now handled server-side in Edge Functions.
 * This function returns minimal info for debugging purposes.
 */
export const getAIProviderInfo = () => ({
  provider: 'edge-function', // AI calls are handled by Edge Functions
  note: 'AI configuration is managed server-side for security',
  edgeFunctions: {
    llm: 'ai-invoke-llm',
    image: 'ai-generate-image'
  }
});
