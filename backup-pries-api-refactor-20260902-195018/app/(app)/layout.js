import AppShell from '@/components/AppShell';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function AppLayout({ children }) {
  return (
    <ProtectedLayout>
      <AppShell>{children}</AppShell>
    </ProtectedLayout>
  );
}
