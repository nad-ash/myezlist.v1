// supabase/functions/ai-generate-image/index.ts
/**
 * AI Generate Image Edge Function
 * 
 * Securely handles image generation calls to OpenAI (DALL-E/GPT-Image) or Gemini.
 * API keys are stored as Supabase secrets, never exposed to the client.
 * 
 * Input: { prompt: string }
 * Output: { url: string, isBase64?: boolean }
 * 
 * Required Supabase Secrets:
 * - AI_PROVIDER: 'openai' or 'gemini'
 * - OPENAI_API_KEY: OpenAI API key
 * - GEMINI_API_KEY: Google Gemini API key
 * - OPENAI_MODEL_IMAGE: Image model (default: gpt-image-1-mini)
 * - OPENAI_IMAGE_QUALITY: Image quality for GPT Image models (low, medium, high)
 * - GEMINI_MODEL_IMAGE: Gemini image model (default: gemini-2.5-flash-image)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
// OpenAI Image Generation
// ===========================================
async function generateImage_OpenAI(prompt: string): Promise<{ url: string; isBase64?: boolean }> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in Supabase secrets.");
  }

  const imageModel = OPENAI_IMAGE_MODEL;
  const isGptImage = imageModel.startsWith("gpt-image");
  const isDallE3 = imageModel === "dall-e-3";

  console.log(`📷 OpenAI: Generating image with model "${imageModel}" (quality: ${isGptImage ? OPENAI_IMAGE_QUALITY : "standard"})`);

  // Build request body based on model type
  const requestBody: Record<string, unknown> = {
    model: imageModel,
    prompt,
    n: 1,
  };

  if (isGptImage) {
    // GPT Image models (gpt-image-1, gpt-image-1-mini)
    requestBody.quality = OPENAI_IMAGE_QUALITY; // low, medium, high
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

  // GPT Image models return base64, DALL-E returns URL
  if (isGptImage && data.data[0]?.b64_json) {
    return {
      url: `data:image/png;base64,${data.data[0].b64_json}`,
      isBase64: true,
    };
  }

  return { url: data.data[0]?.url };
}

// ===========================================
// Google Gemini Image Generation
// ===========================================
async function generateImage_Gemini(prompt: string): Promise<{ url: string; isBase64?: boolean }> {
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

  // Return base64 data URL
  const { mimeType, data: base64Data } = imagePart.inlineData;
  return {
    url: `data:${mimeType};base64,${base64Data}`,
    isBase64: true,
  };
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
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎨 Provider: ${AI_PROVIDER}, Prompt length: ${prompt.length}`);

    // Call the appropriate provider
    let result;
    if (AI_PROVIDER === "gemini") {
      result = await generateImage_Gemini(prompt);
    } else {
      result = await generateImage_OpenAI(prompt);
    }

    console.log(`✅ Image generated successfully (isBase64: ${result.isBase64 || false})`);

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

