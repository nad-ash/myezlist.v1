// supabase/functions/ai-invoke-llm/index.ts
/**
 * AI Invoke LLM Edge Function
 * 
 * Securely handles LLM calls to OpenAI or Gemini based on configuration.
 * API keys are stored as Supabase secrets, never exposed to the client.
 * 
 * Input: { 
 *   prompt: string, 
 *   response_json_schema?: object, 
 *   useCase?: 'default' | 'recipe' | 'image' | 'categorization' | 'extraction' | 'parsing',
 *   temperature?: number (0.0 - 2.0, optional override)
 * }
 * Output: Parsed JSON response from the LLM
 * 
 * Temperature Configuration (use-case based defaults):
 * - recipe/recipe_generation: 0.7 (creative, varied outputs)
 * - default/categorization/extraction/parsing/image: 0.2 (deterministic, consistent outputs)
 * 
 * Note: Some models don't support custom temperature:
 * - Reasoning models (o1, o3) - only support default
 * - GPT-5 series (gpt-5-mini, gpt-5-nano) - only support default (1)
 * 
 * OpenAI Specific Settings:
 * - max_completion_tokens: 2500
 * - reasoning_effort: "low" (for reasoning models: o1, o3, and GPT-5 series)
 * 
 * You can override the default by passing an explicit temperature parameter.
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
// Temperature Configuration by Use Case
// ===========================================
// Recipe generation needs creativity (0.7)
// Data extraction/categorization needs consistency (0.2)
const TEMPERATURE_CONFIG: Record<string, number> = {
  // Creative tasks - higher temperature for variety
  recipe: 0.7,
  recipe_generation: 0.7,
  
  // Data extraction/categorization - low temperature for consistency
  default: 0.2,
  categorization: 0.2,
  extraction: 0.2,
  parsing: 0.2,
  image: 0.2,  // Image prompt generation should be consistent
};

// Get temperature for a use case (explicit override takes priority)
const getTemperature = (useCase: string, explicitTemp?: number): number => {
  if (explicitTemp !== undefined) {
    return explicitTemp;
  }
  return TEMPERATURE_CONFIG[useCase] ?? TEMPERATURE_CONFIG.default;
};

// ===========================================
// Debug Logging Helpers
// ===========================================
const DEBUG_LOGGING = Deno.env.get("DEBUG_LLM_LOGGING") === "true";

// Truncate long strings for logging (keeps first and last N chars)
const truncateForLog = (str: string, maxLength: number = 500): string => {
  if (str.length <= maxLength) return str;
  const half = Math.floor(maxLength / 2) - 3;
  return `${str.substring(0, half)}...⟨${str.length - maxLength} chars omitted⟩...${str.substring(str.length - half)}`;
};

// Log request payload (always logs summary, DEBUG mode logs full payload)
const logRequestPayload = (provider: string, payload: Record<string, unknown>, prompt: string) => {
  console.log(`📤 ${provider} Request:`);
  console.log(`   - Model: ${payload.model}`);
  console.log(`   - Temperature: ${payload.temperature ?? 'not set'}`);
  console.log(`   - Max tokens: ${payload.max_completion_tokens || payload.generationConfig?.maxOutputTokens || 'default'}`);
  if (payload.reasoning_effort) {
    console.log(`   - Reasoning effort: ${payload.reasoning_effort}`);
  }
  console.log(`   - Response format: ${payload.response_format ? 'json_object' : 'text'}`);
  console.log(`   - Prompt length: ${prompt.length} chars`);
  
  if (DEBUG_LOGGING) {
    console.log(`   📝 Full prompt:\n${prompt}`);
    console.log(`   📦 Full request body:\n${JSON.stringify(payload, null, 2)}`);
  } else {
    console.log(`   📝 Prompt preview: ${truncateForLog(prompt, 300)}`);
  }
};

// Log response (always logs summary, DEBUG mode logs full response)
const logResponse = (provider: string, rawContent: string, parsedResult: unknown) => {
  console.log(`📥 ${provider} Response:`);
  console.log(`   - Raw content length: ${rawContent?.length ?? 0} chars`);
  console.log(`   - Parsed successfully: ${parsedResult !== null}`);
  
  if (DEBUG_LOGGING) {
    console.log(`   📝 Raw response:\n${rawContent}`);
    console.log(`   📦 Parsed result:\n${JSON.stringify(parsedResult, null, 2)}`);
  } else {
    console.log(`   📝 Response preview: ${truncateForLog(rawContent || '', 300)}`);
  }
};

// ===========================================
// OpenAI Implementation
// ===========================================
async function invokeLLM_OpenAI(prompt: string, responseJsonSchema: object | null, useCase: string, temperature?: number) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in Supabase secrets.");
  }

  const model = getOpenAIModel(useCase);
  const effectiveTemperature = getTemperature(useCase, temperature);
  console.log(`🤖 OpenAI: Using model "${model}" for useCase "${useCase}" (temp: ${effectiveTemperature})`);

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

  // Models that support reasoning_effort:
  // - Reasoning models (o1, o3)
  // - GPT-5 series (gpt-5-mini, gpt-5-nano)
  const supportsReasoningEffort = model.includes("o1") || model.includes("o3") || model.includes("gpt-5");
  
  // Models that don't support custom temperature:
  // - Reasoning models (o1, o3)
  // - GPT-5 series (gpt-5-mini, gpt-5-nano) - only support default temperature of 1
  const supportsTemperature = !model.includes("o1") && !model.includes("o3") && !model.includes("gpt-5");

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    response_format: responseJsonSchema ? { type: "json_object" } : undefined,
    max_completion_tokens: 2500,
  };

  // Add reasoning_effort for models that support it
  if (supportsReasoningEffort) {
    requestBody.reasoning_effort = "low";
  }

  if (supportsTemperature) {
    requestBody.temperature = effectiveTemperature;
  }

  // Log the request payload
  logRequestPayload("OpenAI", requestBody, prompt);

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
    console.error("❌ OpenAI API error:", JSON.stringify(error, null, 2));
    throw new Error(error.error?.message || "OpenAI API error");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  // Log usage stats if available
  if (data.usage) {
    console.log(`📊 OpenAI Usage: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}`);
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(content);
  } catch {
    parsedResult = { response: content };
  }

  // Log the response
  logResponse("OpenAI", content, parsedResult);

  return parsedResult;
}

// ===========================================
// Google Gemini Implementation
// ===========================================
async function invokeLLM_Gemini(prompt: string, responseJsonSchema: object | null, useCase: string, temperature?: number) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in Supabase secrets.");
  }

  const model = getGeminiModel(useCase);
  const effectiveTemperature = getTemperature(useCase, temperature);
  console.log(`🤖 Gemini: Using model "${model}" for useCase "${useCase}" (temp: ${effectiveTemperature})`);

  const systemPrompt = responseJsonSchema
    ? "You are a helpful assistant. Always respond with valid JSON matching the requested schema. Output ONLY the JSON, no markdown or explanation."
    : "You are a helpful assistant.";

  const fullPrompt = `${systemPrompt}\n\n${prompt}`;
  
  const requestBody = {
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: effectiveTemperature,
      maxOutputTokens: 2000,
      responseMimeType: responseJsonSchema ? "application/json" : "text/plain",
    },
  };

  // Log the request payload
  logRequestPayload("Gemini", { ...requestBody, model }, fullPrompt);

  const response = await fetch(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("❌ Gemini API error:", JSON.stringify(error, null, 2));
    throw new Error(error.error?.message || "Gemini API error");
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  // Log usage stats if available
  if (data.usageMetadata) {
    console.log(`📊 Gemini Usage: prompt=${data.usageMetadata.promptTokenCount}, completion=${data.usageMetadata.candidatesTokenCount}, total=${data.usageMetadata.totalTokenCount}`);
  }

  if (!content) {
    console.error("❌ Empty response from Gemini. Full response:", JSON.stringify(data, null, 2));
    throw new Error("No response from Gemini");
  }

  let parsedResult;
  try {
    // Clean up potential markdown code blocks
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsedResult = JSON.parse(cleanContent);
  } catch {
    parsedResult = { response: content };
  }

  // Log the response
  logResponse("Gemini", content, parsedResult);

  return parsedResult;
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

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🤖 AI LLM Request from user: ${user.id}`);
    console.log(`${"=".repeat(60)}`);

    // Parse request body
    const { prompt, response_json_schema, useCase = "default", temperature } = await req.json();

    if (!prompt) {
      console.error("❌ Missing prompt in request");
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate temperature if provided (0.0 - 2.0 range)
    const validTemperature = temperature !== undefined 
      ? Math.max(0, Math.min(2, Number(temperature))) 
      : undefined;

    // Log incoming request details
    console.log(`📋 Request Details:`);
    console.log(`   - Use case: ${useCase}`);
    console.log(`   - Provider: ${AI_PROVIDER}`);
    console.log(`   - Temperature requested: ${temperature ?? 'not specified'}`);
    console.log(`   - Temperature effective: ${validTemperature ?? `default for ${useCase}`}`);
    console.log(`   - JSON schema provided: ${response_json_schema ? 'yes' : 'no'}`);
    if (response_json_schema && DEBUG_LOGGING) {
      console.log(`   📦 Response JSON schema:\n${JSON.stringify(response_json_schema, null, 2)}`);
    }

    // Call the appropriate provider
    let result;
    if (AI_PROVIDER === "gemini") {
      result = await invokeLLM_Gemini(prompt, response_json_schema, useCase, validTemperature);
    } else {
      result = await invokeLLM_OpenAI(prompt, response_json_schema, useCase, validTemperature);
    }

    console.log(`✅ LLM response generated successfully`);
    console.log(`${"=".repeat(60)}\n`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`❌ AI LLM error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.log(`${"=".repeat(60)}\n`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

