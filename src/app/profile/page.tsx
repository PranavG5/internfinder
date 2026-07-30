import { ProfileClient } from '@/components/ProfileClient';
import { getProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return <ProfileClient initial={getProfile()} />;
}
