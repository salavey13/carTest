import { redirect } from 'next/navigation';
import { getTodayRentalsAnalytics } from '@/app/franchize/actions-runtime';
import { getCachedFranchizeBySlug } from '@/app/franchize/actions';
import { AnalyticsClient } from './components/AnalyticsClient';
import { supabaseAdmin } from '@/hooks/supabase';

interface AnalyticsPageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: AnalyticsPageProps) {
  const { slug } = params;

  // Get crew data
  const crewResult = await getCachedFranchizeBySlug({ slug });
  if (!crewResult.ok || !crewResult.data?.crew) {
    redirect('/franchize/' + slug);
  }

  const crew = crewResult.data.crew;

  // Get analytics data
  const analyticsResult = await getTodayRentalsAnalytics({ slug });

  if (!analyticsResult.ok) {
    // Return error state, component will handle it
    return (
      <AnalyticsClient
        crew={crew}
        slug={slug}
        rentals={[]}
        summary={null}
        error={analyticsResult.error || 'Failed to load analytics'}
      />
    );
  }

  return (
    <AnalyticsClient
      crew={crew}
      slug={slug}
      rentals={analyticsResult.rentals || []}
      summary={analyticsResult.summary}
      error={null}
    />
  );
}
