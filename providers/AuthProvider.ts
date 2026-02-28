import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { User as AppUser } from '@/constants/config';
import { USERS } from '@/constants/config';

interface AuthState {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[Auth] Initial session:', s?.user?.email ?? 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const matched = USERS.find(u => u.email === s.user.email);
        setAppUser(matched ?? null);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[Auth] State changed:', _event, s?.user?.email ?? 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const matched = USERS.find(u => u.email === s.user.email);
        setAppUser(matched ?? null);
      } else {
        setAppUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInMutation = useMutation({
    mutationFn: async (email: string) => {
      console.log('[Auth] Sending magic link to:', email);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      return email;
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      console.log('[Auth] Signing out');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  });

  const signIn = useCallback((email: string) => {
    return signInMutation.mutateAsync(email);
  }, [signInMutation]);

  const signOut = useCallback(() => {
    return signOutMutation.mutateAsync();
  }, [signOutMutation]);

  return {
    session,
    user,
    appUser,
    isLoading,
    isAuthenticated: !!session && !!user,
    signIn,
    signInPending: signInMutation.isPending,
    signInError: signInMutation.error,
    signOut,
    signOutPending: signOutMutation.isPending,
  };
});
