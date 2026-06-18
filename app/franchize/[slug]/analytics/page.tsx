import { redirect } from 'next/navigation';
import { getTodayRentalsAnalytics } from '@/app/franchize/actions-runtime';
import { getFranchizeBySlug } from '@/app/franchize/server-actions/catalog';
import { AnalyticsClient } from './components/AnalyticsClient';
import { headers } from 'next/headers';

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
  const franchizeData = await getFranchizeBySlug(slug);
  if (!franchizeData?.crew) {
    redirect('/franchize/' + slug);
  }

  const crew = franchizeData.crew;

  // Get actorUserId from headers for auth check
  const headersList = await headers();
  const actorUserId = headersList.get('x-user-id') || undefined;

  // Get analytics data
  const analyticsResult = await getTodayRentalsAnalytics({ slug, actorUserId });

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
