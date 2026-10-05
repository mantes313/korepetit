import { Suspense } from 'react';
import CreateLessonPage from '@/features/lessons/CreateLessonPage';
import RoleGuard from '@/components/RoleGuard';

export const metadata = { title: 'Request Lesson — Korepetitor' };

export default function Page() {
  return (
    <RoleGuard allow="student">
      <Suspense fallback={null}>
        <CreateLessonPage />
      </Suspense>
    </RoleGuard>
  );
}
