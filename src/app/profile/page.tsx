import { redirect } from 'next/navigation';
import { ProfileClient } from '@/components/ProfileClient';
import { getUserId } from '@/lib/auth';
import { getProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const userId = await getUserId();
  if (!userId) redirect('/login?next=/profile');
  return <ProfileClient initial={await getProfile(userId)} />;
}
