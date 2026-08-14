import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, Loader2 } from 'lucide-react';

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, adminCheckLoading, signOut } = useAuth();
  const [, setLocation] = useLocation();

  // All hooks MUST be called unconditionally before any early returns.
  // Redirect unauthenticated / non-admin visitors to login.
  useEffect(() => {
    if (!loading && !adminCheckLoading && (!user || !isAdmin)) {
      setLocation('/login');
    }
  }, [user, loading, isAdmin, adminCheckLoading, setLocation]);

  if (loading || adminCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-semibold text-sm leading-tight text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
