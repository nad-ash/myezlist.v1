/**
 * Supabase Integrations
 * 
 * This file provides integration functions when using Supabase backend.
 * Supports both OpenAI and Google Gemini APIs with easy switching.
 * 
 * Environment Variables:
 * - VITE_AI_PROVIDER: 'openai' or 'gemini' (default: 'openai')
 * - VITE_OPENAI_API_KEY: OpenAI API key
 * - VITE_GEMINI_API_KEY: Google Gemini API key
 */

import { supabase } from './supabaseClient';

// ===========================================
// AI Provider Configuration
// ===========================================
const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'openai';

// OpenAI Configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_IMAGE_MODEL = import.meta.env.VITE_OPENAI_IMAGE_MODEL || 'dall-e-3';

// Google Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';

// Log which provider and model is active
console.log(`🤖 AI Provider: ${AI_PROVIDER.toUpperCase()} | Model: ${AI_PROVIDER === 'gemini' ? GEMINI_MODEL : OPENAI_MODEL}`);

// ===========================================
// OpenAI Implementation
// ===========================================
async function invokeLLM_OpenAI({ prompt, response_json_schema }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
  }

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Always respond with valid JSON matching the requested schema.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      response_format: response_json_schema ? { type: 'json_object' } : undefined,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch {
    return { response: content };
  }
}

async function generateImage_OpenAI({ prompt }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
  }

  const response = await fetch(`${OPENAI_API_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size: OPENAI_IMAGE_MODEL === 'dall-e-3' ? '1024x1024' : '512x512',
      quality: 'standard'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'DALL-E API error');
  }

  const data = await response.json();
  return { url: data.data[0]?.url };
}

// ===========================================
// Google Gemini Implementation
// ===========================================
async function invokeLLM_Gemini({ prompt, response_json_schema }) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to .env');
  }

  const systemPrompt = response_json_schema 
    ? 'You are a helpful assistant. Always respond with valid JSON matching the requested schema. Output ONLY the JSON, no markdown or explanation.'
    : 'You are a helpful assistant.';

  const response = await fetch(
    `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${prompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          responseMimeType: response_json_schema ? 'application/json' : 'text/plain'
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No response from Gemini');
  }

  try {
    // Clean up potential markdown code blocks
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch {
    return { response: content };
  }
}

async function generateImage_Gemini({ prompt }) {
  // Gemini doesn't have a direct image generation API like DALL-E
  // Option 1: Fall back to OpenAI for images if available
  if (OPENAI_API_KEY) {
    console.log('📷 Gemini: Falling back to DALL-E for image generation');
    return generateImage_OpenAI({ prompt });
  }
  
  // Option 2: Use Google's Imagen (if you have access) or throw error
  throw new Error(
    'Image generation not available with Gemini. ' +
    'Add VITE_OPENAI_API_KEY for DALL-E image generation, or use a different image service.'
  );
}

// ===========================================
// Unified Export Functions (Auto-switch based on provider)
// ===========================================

/**
 * Invoke LLM (Large Language Model)
 * Automatically uses OpenAI or Gemini based on VITE_AI_PROVIDER
 * @param {Object} params - { prompt, response_json_schema }
 * @returns {Object} - Parsed JSON response
 */
export async function InvokeLLM({ prompt, response_json_schema }) {
  try {
    if (AI_PROVIDER === 'gemini') {
      return await invokeLLM_Gemini({ prompt, response_json_schema });
    }
    return await invokeLLM_OpenAI({ prompt, response_json_schema });
  } catch (error) {
    console.error('InvokeLLM error:', error);
    throw error;
  }
}

/**
 * Generate Image
 * Uses DALL-E (OpenAI). Gemini falls back to DALL-E if OpenAI key is available.
 * @param {Object} params - { prompt }
 * @returns {Object} - { url: string }
 */
export async function GenerateImage({ prompt }) {
  try {
    if (AI_PROVIDER === 'gemini') {
      return await generateImage_Gemini({ prompt });
    }
    return await generateImage_OpenAI({ prompt });
  } catch (error) {
    console.error('GenerateImage error:', error);
    throw error;
  }
}

/**
 * Upload File to Supabase Storage
 * @param {Object} params - { file }
 * @returns {Object} - { file_url: string }
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
 * @returns {Object} - { file_path: string }
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
 * @returns {Object} - { signed_url: string }
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

// Export Core object for compatibility
export const Core = {
  InvokeLLM,
  GenerateImage,
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  SendEmail,
  ExtractDataFromUploadedFile
};

// Export provider info for debugging
export const getAIProviderInfo = () => ({
  provider: AI_PROVIDER,
  model: AI_PROVIDER === 'gemini' ? GEMINI_MODEL : OPENAI_MODEL,
  imageModel: OPENAI_IMAGE_MODEL,
  openaiConfigured: !!OPENAI_API_KEY,
  geminiConfigured: !!GEMINI_API_KEY
});
