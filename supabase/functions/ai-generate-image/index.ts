// supabase/functions/ai-generate-image/index.ts
/**
 * AI Generate Image Edge Function
 * 
 * Securely handles image generation calls to OpenAI (DALL-E/GPT-Image) or Gemini.
 * API keys are stored as Supabase secrets, never exposed to the client.
 * Images are uploaded to Supabase Storage and permanent URLs are returned.
 * 
 * Input: { prompt: string, quality?: 'low' | 'medium' | 'high' }
 * Output: { url: string } - Supabase Storage URL
 * 
 * Quality parameter:
 * - 'low': Fast generation, suitable for item/product images
 * - 'medium': Balanced quality, good for most use cases (default)
 * - 'high': Best quality, suitable for hero/feature images
 * 
 * Required Supabase Secrets:
 * - AI_PROVIDER: 'openai' or 'gemini'
 * - OPENAI_API_KEY: OpenAI API key
 * - GEMINI_API_KEY: Google Gemini API key
 * - OPENAI_MODEL_IMAGE: Image model (default: gpt-image-1-mini)
 * - OPENAI_IMAGE_QUALITY: Default image quality (can be overridden by request)
 * - GEMINI_MODEL_IMAGE: Gemini image model (default: gemini-2.5-flash-image)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===========================================
// Configuration from Supabase Secrets
// ===========================================
const AI_PROVIDER = Deno.env.get("AI_PROVIDER") || "openai";

// OpenAI Configuration
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_API_URL = "https://api.openai.com/v1";
const OPENAI_IMAGE_MODEL = Deno.env.get("OPENAI_MODEL_IMAGE") || "gpt-image-1-mini";
const OPENAI_IMAGE_QUALITY = Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium"; // low, medium, high

// Gemini Configuration
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_IMAGE_MODEL = Deno.env.get("GEMINI_MODEL_IMAGE") || "gemini-2.5-flash-image";

// ===========================================
// Helper: Upload base64 image to Supabase Storage
// ===========================================
async function uploadToStorage(
  base64Data: string, 
  mimeType: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<string> {
  // Decode base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Generate unique filename
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = `ai-generated/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

  // Upload to Supabase Storage
  const { data, error } = await supabaseClient.storage
    .from('images')
    .upload(fileName, bytes, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabaseClient.storage
    .from('images')
    .getPublicUrl(fileName);

  console.log(`✅ Image uploaded to storage: ${publicUrl}`);
  return publicUrl;
}

// ===========================================
// OpenAI Image Generation
// ===========================================
async function generateImage_OpenAI(
  prompt: string,
  supabaseClient: ReturnType<typeof createClient>,
  quality?: string
): Promise<{ url: string }> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in Supabase secrets.");
  }

  const imageModel = OPENAI_IMAGE_MODEL;
  const isGptImage = imageModel.startsWith("gpt-image");
  const isDallE3 = imageModel === "dall-e-3";
  
  // Use provided quality, fallback to env var, then default to 'medium'
  const effectiveQuality = quality || OPENAI_IMAGE_QUALITY;

  console.log(`📷 OpenAI: Generating image with model "${imageModel}" (quality: ${isGptImage ? effectiveQuality : "standard"})`);

  // Build request body based on model type
  const requestBody: Record<string, unknown> = {
    model: imageModel,
    prompt,
    n: 1,
  };

  if (isGptImage) {
    // GPT Image models (gpt-image-1, gpt-image-1-mini)
    requestBody.quality = effectiveQuality; // low, medium, high
    requestBody.size = "1024x1024";
  } else if (isDallE3) {
    // DALL-E 3
    requestBody.quality = "standard";
    requestBody.size = "1024x1024";
  } else {
    // DALL-E 2 or other
    requestBody.size = "512x512";
  }

  const response = await fetch(`${OPENAI_API_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("OpenAI Image API error:", error);
    throw new Error(error.error?.message || "OpenAI Image API error");
  }

  const data = await response.json();

  // GPT Image models return base64, upload to storage
  if (isGptImage && data.data[0]?.b64_json) {
    const publicUrl = await uploadToStorage(data.data[0].b64_json, "image/png", supabaseClient);
    return { url: publicUrl };
  }

  // DALL-E returns temporary URL, download and upload to storage for permanence
  if (data.data[0]?.url) {
    const tempUrl = data.data[0].url;
    console.log(`📥 Downloading image from temporary URL...`);
    
    const imageResponse = await fetch(tempUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }
    
    const imageBlob = await imageResponse.arrayBuffer();
    // Use Deno's encodeBase64 to safely handle large images (avoids RangeError from spread operator)
    const base64Data = encodeBase64(new Uint8Array(imageBlob));
    const publicUrl = await uploadToStorage(base64Data, "image/png", supabaseClient);
    return { url: publicUrl };
  }

  throw new Error("No image data in OpenAI response");
}

// ===========================================
// Google Gemini Image Generation
// ===========================================
async function generateImage_Gemini(
  prompt: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<{ url: string }> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in Supabase secrets.");
  }

  const model = GEMINI_IMAGE_MODEL;
  console.log(`📷 Gemini: Generating image with model "${model}"`);

  const response = await fetch(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Gemini image generation error:", error);
    throw new Error(error.error?.message || "Gemini image generation failed");
  }

  const data = await response.json();

  // Extract image from response
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: { inlineData?: { mimeType?: string } }) => 
    part.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart) {
    console.error("No image in Gemini response:", data);
    throw new Error("No image generated by Gemini");
  }

  // Upload base64 to Supabase Storage
  const { mimeType, data: base64Data } = imagePart.inlineData;
  const publicUrl = await uploadToStorage(base64Data, mimeType, supabaseClient);
  return { url: publicUrl };
}

// ===========================================
// Main Handler
// ===========================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for storage access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify authentication
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📷 AI Image request from user: ${user.id}`);

    // Parse request body
    const { prompt, quality } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎨 Provider: ${AI_PROVIDER}, Quality: ${quality || 'default'}, Prompt length: ${prompt.length}`);

    // Call the appropriate provider
    let result;
    if (AI_PROVIDER === "gemini") {
      result = await generateImage_Gemini(prompt, supabaseClient);
    } else {
      result = await generateImage_OpenAI(prompt, supabaseClient, quality);
    }

    console.log(`✅ Image generated and uploaded successfully`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Image error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
