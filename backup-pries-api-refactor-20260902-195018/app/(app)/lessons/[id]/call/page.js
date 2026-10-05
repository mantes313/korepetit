import CallRoomPage from '@/features/call/CallRoomPage';

export const metadata = { title: 'Lesson Room — Korepetitor' };

export default async function Page({ params }) {
  const { id } = await params;
  return <CallRoomPage lessonId={id} />;
}
