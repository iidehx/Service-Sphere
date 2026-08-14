import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { signInWithEmailAndPassword, getFirebase } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isAdmin, loading, adminCheckLoading, firebaseConfigured, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-card p-8 rounded-xl border shadow-sm text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Firebase Not Configured</h1>
          <p className="text-muted-foreground text-sm">
            Please add the EXPO_PUBLIC_FIREBASE_* secrets to your environment variables to use the admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Redirect to reports once auth+admin check is confirmed — effect to avoid render-phase setState.
  useEffect(() => {
    if (!loading && !adminCheckLoading && user && isAdmin) {
      setLocation('/reports');
    }
  }, [user, loading, isAdmin, adminCheckLoading, setLocation]);

  // Logged in but not an admin → show access denied instead of the sign-in form.
  if (!loading && user && !adminCheckLoading && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-card p-8 rounded-xl border shadow-sm text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            Your account ({user.email}) does not have administrator privileges.
          </p>
          <Button onClick={signOut} variant="outline" className="w-full mt-4">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, email, password);
      // Let the onAuthStateChanged in use-auth handle the redirect
    } catch (error: any) {
      toast({
        title: 'Sign in failed',
        description: error.message || 'Check your credentials and try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/30 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          Trust & Safety Panel
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in with your administrator account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px]">
        <div className="bg-card py-8 px-4 shadow-sm border sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@platform.com"
                disabled={isLoading || loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || loading}
            >
              {isLoading || loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
