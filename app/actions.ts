// app/actions.ts
'use server';
import { createAdminClient, supabase } from "@/hooks/supabase"

export async function saveUser(tgUser: TelegramUser) {
  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: tgUser.id.toString(),
        avatar_url: tgUser.photo_url,
        full_name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
        telegram_username: tgUser.username,
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving user:', error);
    return null;
  }
}

export async function sendResult(chatId: string, result: any) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: result.imageUrl,
        caption: `*${result.car}*\n${result.description}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text: 'Rent This Car 🚗',
            url: `https://your-domain.com/rent/${result.slug}`
          }, {
            text: 'Try Again 🔄',
            web_app: { url: 'https://your-domain.com' }
          }]]
        }
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}

export const generateEmbeddings = async () => {
  const supabaseAdmin = createAdminClient();
  const { data: cars } = await supabaseAdmin
    .from('cars')
    .select('id,description')
    .is('embedding', null);

  if (!cars?.length) return;

  const pipe = await pipeline(
    'feature-extraction',
    'Supabase/gte-small',
    { quantized: true }
  );

  for (const car of cars) {
    const output = await pipe(car.description, {
      pooling: 'mean',
      normalize: true
    });
    
    await supabaseAdmin
      .from('cars')
      .update({ embedding: JSON.stringify(Array.from(output.data)) })
      .eq('id', car.id);
  }
};

// app/actions.ts old openai embeddings(don't use)
export async function findSimilarCars(resultEmbedding: number[]) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc('search_cars', {
    query_embedding: resultEmbedding,
    match_count: 3
  });

  return data?.map(car => ({
    ...car,
    similarity: Math.round(car.similarity * 100)
  }));
}

