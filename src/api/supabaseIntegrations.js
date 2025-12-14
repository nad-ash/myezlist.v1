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
 * 
 * OpenAI Model Configuration (use case based):
 * - VITE_OPENAI_MODEL_IMAGE: For image generation (default: 'gpt-image-1-mini')
 * - VITE_OPENAI_MODEL_RECIPE: For recipe generation (default: 'gpt-4o')
 * - VITE_OPENAI_MODEL_DEFAULT: For everything else (default: 'gpt-4o-mini')
 * - VITE_OPENAI_IMAGE_QUALITY: Image quality for gpt-image models (default: 'medium') - low, medium, high
 * 
 * Gemini Model Configuration (use case based):
 * - VITE_GEMINI_MODEL_IMAGE: For image generation (default: 'gemini-2.5-flash-image')
 * - VITE_GEMINI_MODEL_RECIPE: For recipe generation (default: 'gemini-2.5-flash')
 * - VITE_GEMINI_MODEL_DEFAULT: For everything else (default: 'gemini-2.5-flash-lite')
 */

import { supabase } from './supabaseClient';

// ===========================================
// AI Provider Configuration
// ===========================================
const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'openai';

// OpenAI Configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';

// OpenAI Model Configuration - Use case based model selection
const OPENAI_MODELS = {
  image: import.meta.env.VITE_OPENAI_MODEL_IMAGE || 'gpt-image-1-mini',
  recipe: import.meta.env.VITE_OPENAI_MODEL_RECIPE || 'gpt-4o',
  default: import.meta.env.VITE_OPENAI_MODEL_DEFAULT || 'gpt-4o-mini'
};

// OpenAI Image Quality Configuration
const OPENAI_IMAGE_QUALITY = import.meta.env.VITE_OPENAI_IMAGE_QUALITY || 'medium'; // low, medium, high

// Legacy support: VITE_OPENAI_MODEL overrides default model
if (import.meta.env.VITE_OPENAI_MODEL) {
  OPENAI_MODELS.default = import.meta.env.VITE_OPENAI_MODEL;
}
// Legacy support: VITE_OPENAI_IMAGE_MODEL overrides image model
if (import.meta.env.VITE_OPENAI_IMAGE_MODEL) {
  OPENAI_MODELS.image = import.meta.env.VITE_OPENAI_IMAGE_MODEL;
}

// Helper to get OpenAI model for a specific use case
const getOpenAIModel = (useCase = 'default') => {
  return OPENAI_MODELS[useCase] || OPENAI_MODELS.default;
};

// Google Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Gemini Model Configuration - Use case based model selection
const GEMINI_MODELS = {
  image: import.meta.env.VITE_GEMINI_MODEL_IMAGE || 'gemini-2.5-flash-image',
  recipe: import.meta.env.VITE_GEMINI_MODEL_RECIPE || 'gemini-2.5-flash',
  default: import.meta.env.VITE_GEMINI_MODEL_DEFAULT || 'gemini-2.5-flash-lite'
};

// Legacy support: VITE_GEMINI_MODEL overrides default model
if (import.meta.env.VITE_GEMINI_MODEL) {
  GEMINI_MODELS.default = import.meta.env.VITE_GEMINI_MODEL;
}

// Helper to get Gemini model for a specific use case
const getGeminiModel = (useCase = 'default') => {
  return GEMINI_MODELS[useCase] || GEMINI_MODELS.default;
};

// Log which provider and models are active
if (AI_PROVIDER === 'gemini') {
  console.log(`🤖 AI Provider: GEMINI`);
  console.log(`   📷 Image Model: ${GEMINI_MODELS.image}`);
  console.log(`   🍳 Recipe Model: ${GEMINI_MODELS.recipe}`);
  console.log(`   ⚡ Default Model: ${GEMINI_MODELS.default}`);
} else {
  console.log(`🤖 AI Provider: OPENAI`);
  console.log(`   📷 Image Model: ${OPENAI_MODELS.image} (quality: ${OPENAI_IMAGE_QUALITY})`);
  console.log(`   🍳 Recipe Model: ${OPENAI_MODELS.recipe}`);
  console.log(`   ⚡ Default Model: ${OPENAI_MODELS.default}`);
}

// ===========================================
// OpenAI Implementation
// ===========================================
async function invokeLLM_OpenAI({ prompt, response_json_schema, useCase = 'default' }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
  }

  const model = getOpenAIModel(useCase);
  console.log(`🤖 OpenAI: Using model "${model}" for useCase "${useCase}"`);

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
      model,
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

  const imageModel = getOpenAIModel('image');
  const isGptImage = imageModel.startsWith('gpt-image');
  const isDallE3 = imageModel === 'dall-e-3';
  
  console.log(`📷 OpenAI: Generating image with model "${imageModel}" (quality: ${isGptImage ? OPENAI_IMAGE_QUALITY : 'standard'})`);

  // Build request body based on model type
  const requestBody = {
    model: imageModel,
    prompt,
    n: 1
  };

  if (isGptImage) {
    // GPT Image models (gpt-image-1, gpt-image-1-mini)
    requestBody.quality = OPENAI_IMAGE_QUALITY; // low, medium, high
    requestBody.size = '1024x1024';
  } else if (isDallE3) {
    // DALL-E 3
    requestBody.quality = 'standard';
    requestBody.size = '1024x1024';
  } else {
    // DALL-E 2 or other
    requestBody.size = '512x512';
  }

  const response = await fetch(`${OPENAI_API_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI Image API error');
  }

  const data = await response.json();
  
  // GPT Image models return base64, DALL-E returns URL
  if (isGptImage && data.data[0]?.b64_json) {
    return { 
      url: `data:image/png;base64,${data.data[0].b64_json}`,
      isBase64: true 
    };
  }
  
  return { url: data.data[0]?.url };
}

// ===========================================
// Google Gemini Implementation
// ===========================================
async function invokeLLM_Gemini({ prompt, response_json_schema, useCase = 'default' }) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to .env');
  }

  const model = getGeminiModel(useCase);
  console.log(`🤖 Gemini: Using model "${model}" for useCase "${useCase}"`);

  const systemPrompt = response_json_schema 
    ? 'You are a helpful assistant. Always respond with valid JSON matching the requested schema. Output ONLY the JSON, no markdown or explanation.'
    : 'You are a helpful assistant.';

  const response = await fetch(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to .env');
  }

  const model = getGeminiModel('image');
  console.log(`📷 Gemini: Generating image with model "${model}"`);

  const response = await fetch(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['image', 'text'],
          temperature: 0.7
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Gemini image generation error:', error);
    throw new Error(error.error?.message || 'Gemini image generation failed');
  }

  const data = await response.json();
  
  // Extract image from response
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(part => part.inlineData?.mimeType?.startsWith('image/'));
  
  if (!imagePart) {
    console.error('No image in Gemini response:', data);
    throw new Error('No image generated by Gemini');
  }

  // Return base64 data URL
  const { mimeType, data: base64Data } = imagePart.inlineData;
  return { 
    url: `data:${mimeType};base64,${base64Data}`,
    isBase64: true 
  };
}

// ===========================================
// Unified Export Functions (Auto-switch based on provider)
// ===========================================

/**
 * Use case constants for model selection (Gemini only)
 * - IMAGE: Uses gemini-2.5-flash-image (best for image generation)
 * - RECIPE: Uses gemini-2.5-flash (better quality for complex tasks)
 * - DEFAULT: Uses gemini-2.5-flash-lite (cost-effective for simple tasks)
 */
export const AI_USE_CASES = {
  IMAGE: 'image',
  RECIPE: 'recipe',
  DEFAULT: 'default'
};

/**
 * Invoke LLM (Large Language Model)
 * Automatically uses OpenAI or Gemini based on VITE_AI_PROVIDER
 * @param {Object} params - { prompt, response_json_schema, useCase }
 * @param {string} params.useCase - 'recipe' | 'default' (determines which Gemini model to use)
 * @returns {Object} - Parsed JSON response
 */
export async function InvokeLLM({ prompt, response_json_schema, useCase = 'default' }) {
  try {
    if (AI_PROVIDER === 'gemini') {
      return await invokeLLM_Gemini({ prompt, response_json_schema, useCase });
    }
    return await invokeLLM_OpenAI({ prompt, response_json_schema, useCase });
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
  models: AI_PROVIDER === 'gemini' ? GEMINI_MODELS : OPENAI_MODELS,
  imageModel: AI_PROVIDER === 'gemini' ? GEMINI_MODELS.image : OPENAI_MODELS.image,
  imageQuality: AI_PROVIDER === 'openai' ? OPENAI_IMAGE_QUALITY : null,
  recipeModel: AI_PROVIDER === 'gemini' ? GEMINI_MODELS.recipe : OPENAI_MODELS.recipe,
  defaultModel: AI_PROVIDER === 'gemini' ? GEMINI_MODELS.default : OPENAI_MODELS.default,
  openaiConfigured: !!OPENAI_API_KEY,
  geminiConfigured: !!GEMINI_API_KEY
});
