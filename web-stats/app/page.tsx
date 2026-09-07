import SiteClient from '@/components/site-client';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string; view?: string }>;
}) {
  const params = await searchParams;
  return <SiteClient requestedCompetition={params.competition} requestedView={params.view} />;
}
