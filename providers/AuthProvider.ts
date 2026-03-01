import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { User as AppUser } from '@/constants/config';
import { USERS } from '@/constants/config';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: any } }) => {
      console.log('[Auth] Initial session:', s?.user?.email ?? 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const matched = USERS.find(u => u.email === s.user.email);
        setAppUser(matched ?? null);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, s: any) => {
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

  const { mutateAsync: signInAsync } = signInMutation;
  const { mutateAsync: signOutAsync } = signOutMutation;

  const signIn = useCallback((email: string) => {
    return signInAsync(email);
  }, [signInAsync]);

  const signOut = useCallback(() => {
    return signOutAsync();
  }, [signOutAsync]);

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
