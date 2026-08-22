import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

if (!BOT_TOKEN) {
  console.error("FATAL: TELEGRAM_BOT_TOKEN environment variable is not set.");
  // In a real scenario, you might want to prevent the function from serving
  // or return a specific error, but for now, it will proceed and fail hash validation.
}

async function validateHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  if (!BOT_TOKEN) {
    return { isValid: false, error: "Bot token not configured on server." };
  }

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    return { isValid: false, error: "Hash not found in initData." };
  }

  const dataToCheck: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") {
      dataToCheck.push(`${key}=${value}`);
    }
  });

  dataToCheck.sort(); // Sort alphabetically
  const dataCheckString = dataToCheck.join("\n");

  try {
    const secretKeyData = new TextEncoder().encode("WebAppData");
    const secretKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(BOT_TOKEN),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const intermediateHashBuffer = await crypto.subtle.sign(
      "HMAC",
      secretKey,
      secretKeyData
    );
    
    const finalSecretKey = await crypto.subtle.importKey(
      "raw",
      intermediateHashBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      finalSecretKey,
      new TextEncoder().encode(dataCheckString)
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signatureHex === hash) {
      const userParam = params.get("user");
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          return { isValid: true, user };
        } catch (e) {
          console.error("Error parsing user data from initData:", e);
          return { isValid: false, error: "Failed to parse user data." };
        }
      }
      return { isValid: true }; // Valid hash but no user data found (should not happen with WebApp)
    } else {
      console.warn("Hash validation failed. Generated:", signatureHex, "Received:", hash);
      return { isValid: false, error: "Hash mismatch." };
    }
  } catch (e) {
    console.error("Error during crypto operations:", e);
    return { isValid: false, error: `Crypto error: ${e.message}` };
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { initData } = await req.json();
    if (typeof initData !== "string") {
      return new Response(JSON.stringify({ error: "initData must be a string." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validationResult = await validateHash(initData);
    
    return new Response(JSON.stringify(validationResult), {
      status: validationResult.isValid ? 200 : 401, // Unauthorized if not valid
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Error processing request in Edge Function:", e);
    return new Response(JSON.stringify({ error: `Server error: ${e.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/*
Test with curl:
curl -X POST 'http://localhost:54321/functions/v1/validate-telegram-auth' \
-H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-d '{
  "initData": "user=%7B%22id%22%3A413553377%2C%22first_name%22%3A%22Sergey%22%2C%22last_name%22%3A%22%F0%9F%AA%A6%22%2C%22username%22%3A%22SALAVEY%22%2C%22language_code%22%3A%22en%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%7D&chat_instance=8177329295040631650&chat_type=sender&auth_date=1715551981&hash=YOUR_ACTUAL_HASH_FROM_TELEGRAM"
}'

Replace YOUR_SUPABASE_ANON_KEY and YOUR_ACTUAL_HASH_FROM_TELEGRAM.
The initData string should be URL encoded as Telegram sends it.
*/