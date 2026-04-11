import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { MgUser } from '@/types/leads';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [appUser, setAppUser] = useState<MgUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const signInInFlightRef = useRef(false);

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
    let mounted = true;

    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out')), 5000)
        );

        const { data: { session: s } } = await Promise.race([sessionPromise, timeoutPromise]);
        console.log('[Auth] Initial session:', s?.user?.email ?? 'none');
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.email) {
          try {
            const resolved = await Promise.race([
              resolveAppUser(s.user.email),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
            ]);
            if (!mounted) return;
            setAppUser(resolved);
            if (!resolved) {
              console.log('[Auth] No mg_user match on init, signing out');
              await supabase.auth.signOut().catch(() => {});
              setSession(null);
              setUser(null);
              setAppUser(null);
            }
          } catch (userError) {
            console.log('[Auth] Error resolving app user:', userError);
            if (!mounted) return;
            setSession(null);
            setUser(null);
            setAppUser(null);
          }
        }
      } catch (error) {
        console.log('[Auth] Init auth failed, showing login:', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setAppUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, s: any) => {
      console.log('[Auth] State changed:', _event, s?.user?.email ?? 'none');
      if (!mounted) return;

      if (_event === 'PASSWORD_RECOVERY') {
        console.log('[Auth] PASSWORD_RECOVERY event detected');
        setSession(s);
        setUser(s?.user ?? null);
        setIsRecoveryMode(true);
        setIsLoading(false);
        return;
      }

      if (signInInFlightRef.current) {
        console.log('[Auth] Skipping listener — signIn is handling state');
        return;
      }

      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        const resolved = await resolveAppUser(s.user.email);
        if (!mounted) return;
        setAppUser(resolved);
      } else {
        setAppUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveAppUser]);

  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('[Auth] Signing in with password for:', email);
      signInInFlightRef.current = true;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const userEmail = data.user?.email;
        if (!userEmail) {
          throw new Error('Sign in succeeded but no user email returned.');
        }

        const resolved = await resolveAppUser(userEmail);
        if (!resolved) {
          console.log('[Auth] No mg_user match, signing out unauthorized user');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setAppUser(null);
          throw new Error('Unauthorized. Your email is not registered in this system.');
        }

        console.log('[Auth] Password sign-in verified, setting session + appUser');
        setSession(data.session);
        setUser(data.user ?? null);
        setAppUser(resolved);
        setIsLoading(false);

        return resolved;
      } finally {
        signInInFlightRef.current = false;
      }
    },
  });

  const signIn = useCallback((email: string, password: string) => {
    return signInMutation.mutateAsync({ email, password });
  }, [signInMutation.mutateAsync]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      console.log('[Auth] Sending password reset to:', email);
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
      console.log('[Auth] Reset redirectTo:', redirectTo);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      console.log('[Auth] Password reset email sent to:', email);
      return email;
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      console.log('[Auth] Updating password via updateUser');
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      console.log('[Auth] Password updated successfully for:', data.user?.email);

      setIsRecoveryMode(false);

      const userEmail = data.user?.email;
      if (userEmail) {
        const resolved = await resolveAppUser(userEmail);
        setAppUser(resolved);
        if (!resolved) {
          console.log('[Auth] No mg_user match after password update, signing out');
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
          setAppUser(null);
          throw new Error('Password updated, but your email is not authorized in this system.');
        }
        setSession(session);
        setUser(data.user ?? null);
      }

      return data.user;
    },
  });

  const resetPassword = useCallback((email: string) => {
    return resetPasswordMutation.mutateAsync(email);
  }, [resetPasswordMutation.mutateAsync]);

  const updatePassword = useCallback((newPassword: string) => {
    return updatePasswordMutation.mutateAsync(newPassword);
  }, [updatePasswordMutation.mutateAsync]);

  const clearRecoveryMode = useCallback(() => {
    console.log('[Auth] Clearing recovery mode');
    setIsRecoveryMode(false);
  }, []);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      console.log('[Auth] Signing out');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      setAppUser(null);
    },
  });

  const signOut = useCallback(() => {
    return signOutMutation.mutateAsync();
  }, [signOutMutation.mutateAsync]);

  return {
    session,
    user,
    appUser,
    isLoading,
    isAuthenticated: !!session && !!appUser,
    isRecoveryMode,
    signIn,
    signInPending: signInMutation.isPending,
    signInError: signInMutation.error,
    resetPassword,
    resetPasswordPending: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
    updatePassword,
    updatePasswordPending: updatePasswordMutation.isPending,
    updatePasswordError: updatePasswordMutation.error,
    clearRecoveryMode,
    signOut,
    signOutPending: signOutMutation.isPending,
  };
});
