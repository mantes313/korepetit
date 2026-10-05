import ScheduleLessonPage from '@/features/lessons/ScheduleLessonPage';
import RoleGuard from '@/components/RoleGuard';

export const metadata = { title: 'Schedule Lesson — Korepetitor' };

export default function Page() {
  return (
    <RoleGuard allow="teacher">
      <ScheduleLessonPage />
    </RoleGuard>
  );
}
