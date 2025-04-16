import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://esm.sh/@google/generative-ai"; // Use esm.sh for Deno
import { corsHeaders } from '../_shared/cors.ts';
import type { AiRequestRecord } from '../../types/ai.types.ts'; // Import shared type

console.log("Function ai-request-handler starting up...");

// Function to safely get environment variables
function getEnvVar(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`FATAL: Environment variable ${name} is not set.`);
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

// --- Initialize Supabase Admin Client ---
let supabaseAdmin: SupabaseClient;
try {
    const supabaseUrl = getEnvVar("SUPABASE_URL");
    const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    console.log("Supabase admin client initialized.");
} catch (error) {
    console.error("CRITICAL: Failed to initialize Supabase client on startup:", error);
    // We cannot proceed without Supabase client
}

// --- Initialize Google AI Client ---
let genAI: GoogleGenerativeAI | null = null;
try {
    const apiKey = getEnvVar("GEMINI_API_KEY");
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("GoogleGenerativeAI client initialized.");
} catch (error) {
    console.error("CRITICAL: Failed to initialize GoogleGenerativeAI on startup:", error);
    // Function can still run, but AI calls will fail later if genAI is null
}

// --- Main Request Handler ---
serve(async (req: Request) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Check if clients are initialized
  if (!supabaseAdmin) {
    console.error("Supabase client not initialized. Cannot process request.");
    return new Response(JSON.stringify({ error: "Internal configuration error (Supabase)." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
  if (!genAI) {
     console.error("Google AI client not initialized. Cannot process AI task.");
     // Note: We might still proceed to update status if possible, but the AI call will fail.
     // Let's handle this specifically before the AI call.
  }

  // 3. Extract request data from the webhook payload
  let requestRecord: AiRequestRecord | null = null;
  let requestId: string | null = null;
  try {
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    if (payload.type !== 'INSERT' || !payload.record) {
      console.warn("Payload not an INSERT or missing 'record'.");
      return new Response("Invalid payload format.", { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    requestRecord = payload.record as AiRequestRecord;
    requestId = requestRecord.id;

    if (!requestId || !requestRecord.prompt) {
      throw new Error("Request ID or prompt missing in record.");
    }

    console.log(`Processing AI request ID: ${requestId}`);

    // 4. Update status to 'processing'
    const { error: updateError } = await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'processing', updated_at: new Date().toISOString() }) // Also update updated_at
      .eq("id", requestId);

    if (updateError) {
      throw new Error(`Failed to update request ${requestId} status to processing: ${updateError.message}`);
    }
    console.log(`Request ${requestId} status updated to 'processing'.`);

  } catch (error) {
    console.error("Error processing request payload or updating status:", error);
    if (requestId && supabaseAdmin) {
       await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: `Payload processing error: ${error.message}`, updated_at: new Date().toISOString() }).eq("id", requestId).catch(e => console.error("Secondary error updating status to failed:", e));
    }
    return new Response(JSON.stringify({ error: `Failed to process request: ${error.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 5. Check AI Client again before making the call
  if (!genAI) {
      const errorMsg = "AI client not available (initialization failed).";
      console.error(`[AI Request ${requestId}] ${errorMsg}`);
      await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }

  // 6. Perform the AI Generation
  try {
    const modelName = requestRecord.model_name || "gemini-1.5-flash-latest"; // Default model
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Calling Gemini model '${modelName}' for request ${requestId}...`);

    const generationConfig = requestRecord.generation_config || {
      // temperature: 0.7, // Example default
       maxOutputTokens: 8192, // Gemini 1.5 default is 8192
       topP: 0.95,          // Example default
       topK: 64,            // Example default
    };

    const safetySettings = requestRecord.safety_settings || [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // Using generateContent approach
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: requestRecord.prompt }] }],
      generationConfig,
      safetySettings,
    });

    const ai_response = result.response; // Renamed variable
    const promptFeedback = ai_response.promptFeedback;

    // --- Handle Safety Blocks & Finish Reasons ---
    if (promptFeedback?.blockReason) {
        const blockReason = promptFeedback.blockReason;
        const safetyRatings = promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'N/A';
        const errorMsg = `Blocked by safety settings. Reason: ${blockReason}. Ratings: [${safetyRatings}]`;
        console.error(`[AI Request ${requestId}] ${errorMsg}`);
        await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
        return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    const finishReason = ai_response.candidates?.[0]?.finishReason;
    if (finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason)) { // Allow MAX_TOKENS as a potentially valid (though incomplete) finish
         const errorMsg = `Generation stopped unexpectedly. Reason: ${finishReason}`;
         console.warn(`[AI Request ${requestId}] ${errorMsg}`);
         // If MAX_TOKENS, we might still want to save the partial response but mark as potentially incomplete?
         // For now, treat other reasons as failure.
         await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
         return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // --- Extract Text ---
    let text = "";
    try {
       if (ai_response.candidates && ai_response.candidates.length > 0) {
           text = ai_response.text();
       } else {
           throw new Error("AI returned no response candidates.");
       }
    } catch (e: any) {
       const errorMsg = `Error extracting text from response: ${e.message || 'Unknown text extraction error'}`;
       console.error(`[AI Request ${requestId}] ${errorMsg}`, e);
       await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
       return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

     if (!text || text.trim().length === 0) {
         const errorMsg = "AI returned an empty response.";
         console.warn(`[AI Request ${requestId}] ${errorMsg}`);
         if (promptFeedback?.blockReason) {
             const blockErrorMsg = `AI returned empty response, likely blocked. Reason: ${promptFeedback.blockReason}`;
             console.error(`[AI Request ${requestId}] ${blockErrorMsg}`);
             await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: blockErrorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
             return new Response(JSON.stringify({ error: blockErrorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
         }
         await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() }).eq("id", requestId);
         return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
     }

    // 7. Update database with the successful result
    console.log(`[AI Request ${requestId}] Success. Response length: ${text.length}`);
    const { error: finalUpdateError } = await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'completed', response: text, error_message: null, updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (finalUpdateError) {
      console.error(`[AI Request ${requestId}] Failed to update status to completed: ${finalUpdateError.message}`);
       // Log error but proceed to return success as AI call worked
    } else {
       console.log(`[AI Request ${requestId}] Status updated to 'completed'.`);
    }

    // 8. Return success response
    return new Response(JSON.stringify({ message: `Request ${requestId} processed.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    // Catch errors during the AI call itself
    console.error(`[AI Request ${requestId}] Error during AI generation:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown AI generation error";
    await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'failed', error_message: `AI API Error: ${errorMessage}`, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .catch(e => console.error("Secondary error updating status to failed after AI error:", e));

    return new Response(JSON.stringify({ error: `AI generation failed: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

console.log("Function ai-request-handler deployed and listening.");