export type FranchizeOrderDocStatus = 'sent' | 'failed' | 'pending' | 'missing';

type MaybeLogRow = {
  send_status?: string | null;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (value: number) => {
              maybeSingle: () => Promise<{ data: MaybeLogRow | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };
};

export async function ensureFranchizeOrderDocDelivery(params: {
  supabase: SupabaseLike;
  slug: string;
  orderId?: string;
  retry: (payload: { slug: string; orderId: string }) => Promise<{ success: boolean; error?: string }>;
}): Promise<FranchizeOrderDocStatus> {
  const { supabase, slug, orderId, retry } = params;
  if (!orderId) {
    return 'missing';
  }

  const { data, error } = await supabase
    .from('franchize_order_notifications')
    .select('send_status')
    .eq('slug', slug)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load doc status for ${slug}/${orderId}: ${error.message}`);
  }

  const status = String(data?.send_status ?? '').trim();
  if (!status) {
    return 'missing';
  }

  if (status === 'sent') {
    return 'sent';
  }

  const retryResult = await retry({ slug, orderId });
  if (!retryResult.success) {
    throw new Error(retryResult.error || 'Doc retry after payment failed');
  }

  return 'pending';
}
