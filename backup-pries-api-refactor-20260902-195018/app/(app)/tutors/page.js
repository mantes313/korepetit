import TutorsPage from '@/features/tutors/TutorsPage';
import RoleGuard from '@/components/RoleGuard';

export const metadata = { title: 'Find a Tutor — Korepetitor' };

export default function Page() {
  return (
    <RoleGuard allow="student">
      <TutorsPage />
    </RoleGuard>
  );
}
