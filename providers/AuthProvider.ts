import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { MgUser } from '@/types/leads';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [appUser, setAppUser] = useState<MgUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveAppUser = useCallback(async (email: string) => {
    console.log('[Auth] Resolving mg_users for:', email);
    const { data, error } = await supabase
      .from('mg_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.log('[Auth] mg_users lookup error:', error.message);
      return null;
    }
    if (data) {
      const mapped: MgUser = {
        id: data.id,
        email: data.email,
        name: data.full_name ?? data.name ?? '',
        role: data.role,
        office: data.office,
      };
      console.log('[Auth] Resolved mg_user:', mapped.name, mapped.role);
      return mapped;
    }
    console.log('[Auth] No mg_user found for:', email);
    return null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }: { data: { session: any } }) => {
      console.log('[Auth] Initial session:', s?.user?.email ?? 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const resolved = await resolveAppUser(s.user.email);
        setAppUser(resolved);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, s: any) => {
      console.log('[Auth] State changed:', _event, s?.user?.email ?? 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const resolved = await resolveAppUser(s.user.email);
        setAppUser(resolved);
      } else {
        setAppUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [resolveAppUser]);

  const signInMutation = useMutation({
    mutationFn: async (email: string) => {
      console.log('[Auth] Sending magic link to:', email);
      const redirectUrl = 'https://rork.com/p/04bqv2vrl4xpgxvv6560n';
      console.log('[Auth] emailRedirectTo:', redirectUrl);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectUrl,
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
