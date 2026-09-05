import SiteClient from '@/components/site-client';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  return <SiteClient requestedCompetition={(await searchParams).competition} />;
}
