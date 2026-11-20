import { RouterProvider } from 'react-router';
import { LoginScreen, OnboardingFlow, SplashScreen, useSession } from '@/features/auth';
import { ActiveGroupProvider, useMyGroups } from '@/features/groups';
import { useMyProfile } from '@/features/profile';
import { Button } from '@/shared/ui';
import { router } from './router';

/**
 * Decides what the user sees:
 * restoring session → splash · signed out → login ·
 * no profile or no group yet → onboarding · otherwise → app (with active group).
 */
export function AppGate() {
  const sessionState = useSession();
  const session = sessionState.status === 'ready' ? sessionState.session : null;
  const userId = session?.user.id ?? null;
  const profile = useMyProfile(userId);
  const groups = useMyGroups(userId);

  if (sessionState.status === 'loading') return <SplashScreen />;
  if (!session) return <LoginScreen />;

  if (profile.isError || groups.isError) {
    return (
      <LoadError
        onRetry={() => {
          void profile.refetch();
          void groups.refetch();
        }}
      />
    );
  }
  if (profile.isPending || groups.isPending) return <SplashScreen />;

  if (!profile.data || groups.data.length === 0) {
    const metadata = session.user.user_metadata as Record<string, unknown>;
    const fullName = metadata.full_name ?? metadata.name;
    const suggestedName = typeof fullName === 'string' ? (fullName.split(' ')[0] ?? '') : '';
    return <OnboardingFlow hasProfile={profile.data !== null} suggestedName={suggestedName} />;
  }

  return (
    <ActiveGroupProvider groups={groups.data}>
      <RouterProvider router={router} />
    </ActiveGroupProvider>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-gutter text-center">
      <p className="text-body text-text-muted">
        Deine Daten konnten nicht geladen werden. Prüf deine Verbindung.
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Erneut versuchen
      </Button>
    </main>
  );
}
