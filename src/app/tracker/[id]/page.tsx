import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApplicationDetail } from '@/components/ApplicationDetail';
import { getUserId } from '@/lib/auth';
import { getApplication, listChildren, listEvents } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const userId = await getUserId();
  if (!userId) redirect('/login?next=/tracker');

  const application = await getApplication(userId, applicationId);
  if (!application) {
    return (
      <div className="p-6">
        <p className="text-[0.9375rem] font-medium">That application no longer exists.</p>
        <Link href="/tracker" className="link mt-2 inline-block text-[0.8125rem]">
          ← Back to your applications
        </Link>
      </div>
    );
  }

  return (
    <ApplicationDetail
      application={application}
      initialEvents={(await listEvents(userId, applicationId)) as never[]}
      initialInterviews={(await listChildren('interviews', userId, applicationId)) as never[]}
      initialContacts={(await listChildren('contacts', userId, applicationId)) as never[]}
      initialOffers={(await listChildren('offers', userId, applicationId)) as never[]}
      initialTasks={(await listChildren('tasks', userId, applicationId)) as never[]}
    />
  );
}
