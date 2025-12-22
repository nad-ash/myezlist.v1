// supabase/functions/ai-invoke-llm/index.ts
/**
 * AI Invoke LLM Edge Function
 * 
 * Securely handles LLM calls to OpenAI or Gemini based on configuration.
 * API keys are stored as Supabase secrets, never exposed to the client.
 * 
 * Input: { prompt: string, response_json_schema?: object, useCase?: 'default' | 'recipe' | 'image' }
 * Output: Parsed JSON response from the LLM
 * 
 * Required Supabase Secrets:
 * - AI_PROVIDER: 'openai' or 'gemini'
 * - OPENAI_API_KEY: OpenAI API key
 * - GEMINI_API_KEY: Google Gemini API key
 * - OPENAI_MODEL_DEFAULT, OPENAI_MODEL_RECIPE, OPENAI_MODEL_IMAGE
 * - GEMINI_MODEL_DEFAULT, GEMINI_MODEL_RECIPE, GEMINI_MODEL_IMAGE
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

const OPENAI_MODELS = {
  image: Deno.env.get("OPENAI_MODEL_IMAGE") || "gpt-image-1-mini",
  recipe: Deno.env.get("OPENAI_MODEL_RECIPE") || "gpt-4o",
  default: Deno.env.get("OPENAI_MODEL_DEFAULT") || "gpt-4o-mini",
};

// Gemini Configuration
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

const GEMINI_MODELS = {
  image: Deno.env.get("GEMINI_MODEL_IMAGE") || "gemini-2.5-flash-image",
  recipe: Deno.env.get("GEMINI_MODEL_RECIPE") || "gemini-2.5-flash",
  default: Deno.env.get("GEMINI_MODEL_DEFAULT") || "gemini-2.5-flash-lite",
};

// ===========================================
// Helper Functions
// ===========================================
const getOpenAIModel = (useCase: string = "default"): string => {
  return OPENAI_MODELS[useCase as keyof typeof OPENAI_MODELS] || OPENAI_MODELS.default;
};

const getGeminiModel = (useCase: string = "default"): string => {
  return GEMINI_MODELS[useCase as keyof typeof GEMINI_MODELS] || GEMINI_MODELS.default;
};

// ===========================================
// OpenAI Implementation
// ===========================================
async function invokeLLM_OpenAI(prompt: string, responseJsonSchema: object | null, useCase: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in Supabase secrets.");
  }

  const model = getOpenAIModel(useCase);
  console.log(`🤖 OpenAI: Using model "${model}" for useCase "${useCase}"`);

  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant. Always respond with valid JSON matching the EXACT schema requested. Follow the schema strictly:\n- If a field is specified as a string, return a string, not an object.\n- If ingredients are specified as an array of strings, return strings like '2 cups flour', not objects.\n- If steps are specified with 'title' and 'instruction' properties, use those exact property names, not alternatives like 'name', 'description', 'text', etc.\n- For recipe instructions, ALWAYS include ingredient quantities (e.g., 'Add 2 cups of flour' instead of 'Add flour').",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  // Some models (gpt-5-mini, o1, etc.) don't support custom temperature
  const supportsTemperature = !model.includes("gpt-5") && !model.includes("o1");

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    response_format: responseJsonSchema ? { type: "json_object" } : undefined,
    max_completion_tokens: 2000,
  };

  if (supportsTemperature) {
    requestBody.temperature = 0.7;
  }

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("OpenAI API error:", error);
    throw new Error(error.error?.message || "OpenAI API error");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch {
    return { response: content };
  }
}

// ===========================================
// Google Gemini Implementation
// ===========================================
async function invokeLLM_Gemini(prompt: string, responseJsonSchema: object | null, useCase: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in Supabase secrets.");
  }

  const model = getGeminiModel(useCase);
  console.log(`🤖 Gemini: Using model "${model}" for useCase "${useCase}"`);

  const systemPrompt = responseJsonSchema
    ? "You are a helpful assistant. Always respond with valid JSON matching the requested schema. Output ONLY the JSON, no markdown or explanation."
    : "You are a helpful assistant.";

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
            parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          responseMimeType: responseJsonSchema ? "application/json" : "text/plain",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Gemini API error:", error);
    throw new Error(error.error?.message || "Gemini API error");
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("No response from Gemini");
  }

  try {
    // Clean up potential markdown code blocks
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleanContent);
  } catch {
    return { response: content };
  }
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

    console.log(`🤖 AI LLM request from user: ${user.id}`);

    // Parse request body
    const { prompt, response_json_schema, useCase = "default" } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📝 Use case: ${useCase}, Provider: ${AI_PROVIDER}`);

    // Call the appropriate provider
    let result;
    if (AI_PROVIDER === "gemini") {
      result = await invokeLLM_Gemini(prompt, response_json_schema, useCase);
    } else {
      result = await invokeLLM_OpenAI(prompt, response_json_schema, useCase);
    }

    console.log(`✅ LLM response generated successfully`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI LLM error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

