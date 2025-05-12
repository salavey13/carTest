import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto'; // Using Node.js crypto module for server-side

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function validateTelegramHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  if (!BOT_TOKEN) {
    console.error("SERVER ERROR: TELEGRAM_BOT_TOKEN environment variable is not set.");
    return { isValid: false, error: "Bot token not configured on server." };
  }

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    return { isValid: false, error: "Hash not found in initData." };
  }

  params.delete("hash"); // Remove hash from params for data-check-string
  const dataToCheck: string[] = [];
  // URLSearchParams.entries() returns an iterator. Convert to array and sort.
  // Keys must be sorted alphabetically.
  const sortedParams = Array.from(params.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  
  for (const [key, value] of sortedParams) {
    dataToCheck.push(`${key}=${value}`);
  }

  const dataCheckString = dataToCheck.join("\n");

  try {
    const secretKey = await webcrypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("WebAppData"), // "WebAppData" is the salt for the first HMAC
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const botTokenKey = await webcrypto.subtle.sign( // This produces the key for the second HMAC
      "HMAC",
      secretKey,
      new TextEncoder().encode(BOT_TOKEN)
    );
    
    // Now use this derived key to sign the data_check_string
     const finalKeyForSigning = await webcrypto.subtle.importKey(
      "raw",
      botTokenKey, // This is the result of HMAC_SHA256(BOT_TOKEN, "WebAppData")
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await webcrypto.subtle.sign(
      "HMAC",
      finalKeyForSigning, 
      new TextEncoder().encode(dataCheckString)
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signatureHex === hash) {
      const userParam = params.get("user"); // Use original params to get user, as it was part of dataCheckString
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          return { isValid: true, user };
        } catch (e) {
          console.error("Error parsing user data from initData:", e);
          return { isValid: false, error: "Failed to parse user data." };
        }
      }
      return { isValid: true }; 
    } else {
      console.warn("Hash validation failed. Generated:", signatureHex, "Received:", hash, "DataChecked:", dataCheckString);
      return { isValid: false, error: "Hash mismatch." };
    }
  } catch (e: any) {
    console.error("Error during crypto operations:", e);
    return { isValid: false, error: `Crypto error: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData } = body;

    if (typeof initData !== "string") {
      return NextResponse.json({ error: "initData must be a string." }, { status: 400 });
    }

    if (!BOT_TOKEN) {
        console.error("FATAL API ERROR: TELEGRAM_BOT_TOKEN is not set on the server.");
        return NextResponse.json({ error: "Server configuration error: Bot token missing." }, { status: 500 });
    }
    
    const validationResult = await validateTelegramHash(initData);
    
    return NextResponse.json(validationResult, { 
        status: validationResult.isValid ? 200 : 401 
    });

  } catch (e: any) {
    console.error("Error processing POST request in /api/validate-telegram-auth:", e);
    return NextResponse.json({ error: `Server error: ${e.message}` }, { status: 500 });
  }
}