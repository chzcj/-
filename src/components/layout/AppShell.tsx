import { PageTransition } from './PageTransition';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
