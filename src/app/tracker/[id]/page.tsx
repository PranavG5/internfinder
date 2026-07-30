import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApplicationDetail } from '@/components/ApplicationDetail';
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

  const application = getApplication(applicationId);
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
      initialEvents={listEvents(applicationId) as never[]}
      initialInterviews={listChildren('interviews', applicationId) as never[]}
      initialContacts={listChildren('contacts', applicationId) as never[]}
      initialOffers={listChildren('offers', applicationId) as never[]}
      initialTasks={listChildren('tasks', applicationId) as never[]}
    />
  );
}
