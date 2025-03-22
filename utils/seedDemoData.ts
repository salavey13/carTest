// /utils/seedDemoData.ts
import { createAdminClient } from "@/hooks/supabase"

const seedData = async () => {
  const supabaseAdmin = createAdminClient()

  // Import users
  await supabaseAdmin.from("users").upsert([
    {
      id: "413553377",
      avatar_url:
        "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/sign/avatars/public/w0zzl5u1bh8.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJhdmF0YXJzL3B1YmxpYy93MHp6bDV1MWJoOC53ZWJwIiwiaWF0IjoxNzM3OTczNzA1LCJleHAiOjE3Njk1MDk3MDV9.swSrE3QcczukXTJVJkMKUOtPJbrjHwS3G2NDz8i-BzY&t=2025-01-27T10%3A28%3A25.324Z",
      full_name: "John Speed",
      telegram_username: "@salavey13",
      role: "admin",
    },
    // Add other users similarly OR AS SQL seed EXAMPLE, CSV EXAMPLE
  ])

  // Import cars without embeddings
  await supabaseAdmin.from("cars").upsert([
    {
      make: "Tesla",
      model: "Roadster",
      description: "Futuristic electric supercar...",
      daily_price: 999,
      image_url: "https://example.com/tesla.jpg",
      rent_link: "/rent/tesla-roadster",
      is_test_result: true,
    },
    // Add other cars similarly OR AS CSV EXAMPLE
  ])
}

seedData()

