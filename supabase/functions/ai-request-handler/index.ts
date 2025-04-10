import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// NOTE: Use the @google/generative-ai library as shown in the user's *example*
// It seems more standard for Node/Deno environments than @google/genai
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://esm.sh/@google/generative-ai"; // Use esm.sh for Deno
import { corsHeaders } from '../_shared/cors.ts'; // Assuming you have CORS setup

// Define the structure of the request record coming from the trigger
interface AiRequestRecord {
  id: string;
  user_id: string | null;
  prompt: string;
  model_name?: string;
  generation_config?: Record<string, any>;
  safety_settings?: any[]; // Adjust type based on actual structure if used
  // other fields if needed...
}

// Function to safely get environment variables
function getEnvVar(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`Error: Environment variable ${name} is not set.`);
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

// Initialize Google AI Client
async function initializeGenAI() {
  try {
    const apiKey = getEnvVar("GEMINI_API_KEY");
    return new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error("Failed to initialize GoogleGenerativeAI:", error);
    return null;
  }
}

// --- Main Function Logic ---
serve(async (req: Request) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Initialize Supabase Admin Client (essential for updating the request status)
  let supabaseAdmin: SupabaseClient;
  try {
    const supabaseUrl = getEnvVar("SUPABASE_URL");
    const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        // For server-side usage, disable session persistence
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
    console.log("Supabase admin client initialized.");
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return new Response(JSON.stringify({ error: "Internal configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Extract request data from the webhook payload
  let requestRecord: AiRequestRecord | null = null;
  let requestId: string | null = null;
  try {
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload, null, 2)); // Log the full payload

    // Check payload structure (Supabase webhooks wrap the record)
    if (payload.type !== 'INSERT' || !payload.record) {
      console.warn("Payload is not an INSERT event or missing 'record'. Skipping.");
      return new Response("Payload format not recognized or not an INSERT event.", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requestRecord = payload.record as AiRequestRecord;
    requestId = requestRecord.id;

    if (!requestId || !requestRecord.prompt) {
      throw new Error("Request ID or prompt missing in the record.");
    }

    console.log(`Processing AI request ID: ${requestId}`);

    // 4. Update status to 'processing' in the database
    const { error: updateError } = await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'processing' })
      .eq("id", requestId);

    if (updateError) {
      throw new Error(`Failed to update request ${requestId} status to processing: ${updateError.message}`);
    }
    console.log(`Request ${requestId} status updated to 'processing'.`);

  } catch (error) {
    console.error("Error processing request payload or updating status:", error);
    // Attempt to update status to 'failed' if we have an ID, but don't crash if this fails
    if (requestId && supabaseAdmin) {
       await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: `Payload processing error: ${error.message}` }).eq("id", requestId).catch(e => console.error("Secondary error updating status to failed:", e));
    }
    return new Response(JSON.stringify({ error: `Failed to process request: ${error.message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Initialize Google AI Client (do this after validating payload)
  const genAI = await initializeGenAI();
  if (!genAI) {
    // Update status to failed if AI client fails
    await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: "AI client initialization failed (check GEMINI_API_KEY)." }).eq("id", requestId);
    return new Response(JSON.stringify({ error: "AI client initialization failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. Perform the AI Generation
  try {
    const modelName = requestRecord.model_name || "gemini-1.5-pro-latest"; // Use default if not provided
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Calling Gemini model '${modelName}' for request ${requestId}...`);

    // Use default generation/safety settings or those from the record
    const generationConfig = requestRecord.generation_config || {
      // Add sensible defaults if needed, or leave empty
      // temperature: 0.7,
      // maxOutputTokens: 8192, // Adjust as needed
    };

    const safetySettings = requestRecord.safety_settings || [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // Using generateContent approach (simpler than chat for single turn)
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: requestRecord.prompt }] }],
      generationConfig,
      safetySettings,
    });

    const response = result.response;

    // --- Handle Safety Blocks & Finish Reasons ---
    const promptFeedback = response.promptFeedback;
    if (promptFeedback?.blockReason) {
        const blockReason = promptFeedback.blockReason;
        const safetyRatings = promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'N/A';
        const errorMsg = `Blocked by safety settings. Reason: ${blockReason}. Ratings: [${safetyRatings}]`;
        console.error(`[AI Request ${requestId}] ${errorMsg}`);
        await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg }).eq("id", requestId);
        return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
         const errorMsg = `Generation stopped unexpectedly. Reason: ${finishReason}`;
         console.warn(`[AI Request ${requestId}] ${errorMsg}`);
         await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg }).eq("id", requestId);
         return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // --- Extract Text ---
    let text = "";
    try {
       if (response.candidates && response.candidates.length > 0) {
           text = response.text(); // Use the built-in text() method
       } else {
           const errorMsg = "AI returned no response candidates.";
           console.warn(`[AI Request ${requestId}] ${errorMsg}`);
           await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg }).eq("id", requestId);
           return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
       }
    } catch (e: any) {
       const errorMsg = `Error extracting text from response: ${e.message || 'Unknown text extraction error'}`;
       console.error(`[AI Request ${requestId}] ${errorMsg}`, e);
       await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg }).eq("id", requestId);
       return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

     if (!text || text.trim().length === 0) {
         const errorMsg = "AI returned an empty response.";
         console.warn(`[AI Request ${requestId}] ${errorMsg}`);
         // Check again for block reason in case it was missed earlier
         if (promptFeedback?.blockReason) {
             const blockErrorMsg = `AI returned empty response, likely blocked. Reason: ${promptFeedback.blockReason}`;
             console.error(`[AI Request ${requestId}] ${blockErrorMsg}`);
             await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: blockErrorMsg }).eq("id", requestId);
             return new Response(JSON.stringify({ error: blockErrorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
         }
         // If not blocked, treat as failed empty response
         await supabaseAdmin.from("ai_requests").update({ status: 'failed', error_message: errorMsg }).eq("id", requestId);
         return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
     }

    // 7. Update database with the successful result
    console.log(`[AI Request ${requestId}] Success. Response length: ${text.length}`);
    const { error: finalUpdateError } = await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'completed', response: text, error_message: null })
      .eq("id", requestId);

    if (finalUpdateError) {
      // Log error but function likely succeeded in getting AI response
      console.error(`[AI Request ${requestId}] Failed to update status to completed: ${finalUpdateError.message}`);
       // Don't necessarily return an error response to the trigger, as the core task finished
       // The Realtime listener will eventually see the 'processing' state timeout or client can handle it.
    } else {
       console.log(`[AI Request ${requestId}] Status updated to 'completed'.`);
    }

    // 8. Return success response to the trigger source
    return new Response(JSON.stringify({ message: `Request ${requestId} processed.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    // Catch errors during the AI call itself
    console.error(`[AI Request ${requestId}] Error during AI generation:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown AI generation error";
    // Update status to failed in the database
    await supabaseAdmin
      .from("ai_requests")
      .update({ status: 'failed', error_message: `AI API Error: ${errorMessage}` })
      .eq("id", requestId)
      .catch(e => console.error("Secondary error updating status to failed after AI error:", e));

    return new Response(JSON.stringify({ error: `AI generation failed: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});