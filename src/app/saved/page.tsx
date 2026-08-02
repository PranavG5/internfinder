import { redirect } from 'next/navigation';
import { SavedClient } from '@/components/SavedClient';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  if (!(await getUserId())) redirect('/login?next=/saved');
  return <SavedClient />;
}
