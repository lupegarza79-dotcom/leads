import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const isRecoveryModeRef = useRef(false);
  const signInInFlightRef = useRef(false);

  const setRecoveryMode = useCallback((value: boolean) => {
    console.log('[Auth] Setting recovery mode:', value);
    setIsRecoveryMode(value);
    isRecoveryModeRef.current = value;
  }, []);

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
            if (!resolved && !isRecoveryModeRef.current) {
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
        setRecoveryMode(true);
        setIsLoading(false);
        return;
      }

      if (isRecoveryModeRef.current) {
        console.log('[Auth] Skipping auth event during recovery mode:', _event);
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
      console.log('[Auth][signIn] START for:', email);
      signInInFlightRef.current = true;

      try {
        console.log('[Auth][signIn] signInWithPassword START');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.log('[Auth][signIn] signInWithPassword FAIL:', error.message);
          throw error;
        }
        console.log('[Auth][signIn] signInWithPassword SUCCESS, user:', data.user?.email);

        const userEmail = data.user?.email;
        if (!userEmail) {
          throw new Error('Sign in succeeded but no user email returned.');
        }

        console.log('[Auth][signIn] resolveAppUser START');
        const resolved = await Promise.race([
          resolveAppUser(userEmail),
          new Promise<null>((resolve) => {
            setTimeout(() => {
              console.log('[Auth][signIn] resolveAppUser TIMED OUT after 8s');
              resolve(null);
            }, 8000);
          }),
        ]);
        console.log('[Auth][signIn] resolveAppUser RESULT:', resolved ? `${resolved.name} / ${resolved.role}` : 'null');

        if (!resolved) {
          console.log('[Auth][signIn] No mg_user match — unauthorized, signing out');
          setSession(null);
          setUser(null);
          setAppUser(null);

          try {
            console.log('[Auth][signIn] signOut (unauthorized) START');
            await Promise.race([
              supabase.auth.signOut(),
              new Promise<{ error: null }>((resolve) =>
                setTimeout(() => {
                  console.log('[Auth][signIn] signOut (unauthorized) TIMED OUT after 3s');
                  resolve({ error: null });
                }, 3000)
              ),
            ]);
            console.log('[Auth][signIn] signOut (unauthorized) DONE');
          } catch (signOutErr) {
            console.log('[Auth][signIn] signOut (unauthorized) ERROR (non-fatal):', signOutErr);
          }

          throw new Error('Unauthorized. Your email is not registered in this system.');
        }

        console.log('[Auth][signIn] Setting session + appUser');
        setSession(data.session);
        setUser(data.user ?? null);
        setAppUser(resolved);
        setIsLoading(false);

        console.log('[Auth][signIn] END — success');
        return resolved;
      } catch (err) {
        console.log('[Auth][signIn] ERROR:', err);
        throw err;
      } finally {
        signInInFlightRef.current = false;
        console.log('[Auth][signIn] FINALLY — signInInFlightRef reset');
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
      console.log('[Auth] updatePasswordMutation: START');
      console.log('[Auth] updatePasswordMutation: calling supabase.auth.updateUser');
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.log('[Auth] updatePasswordMutation: updateUser FAILED:', error.message);
        throw error;
      }
      console.log('[Auth] updatePasswordMutation: updateUser SUCCESS for:', data.user?.email);

      setSession(null);
      setUser(null);
      setAppUser(null);
      console.log('[Auth] updatePasswordMutation: state cleared, returning immediately');

      const signOutWithTimeout = async () => {
        try {
          console.log('[Auth] updatePasswordMutation: fire-and-forget signOut START');
          const result = await Promise.race([
            supabase.auth.signOut(),
            new Promise<{ error: null }>((resolve) =>
              setTimeout(() => {
                console.log('[Auth] updatePasswordMutation: signOut TIMED OUT after 3s');
                resolve({ error: null });
              }, 3000)
            ),
          ]);
          console.log('[Auth] updatePasswordMutation: fire-and-forget signOut DONE', result);
        } catch (e) {
          console.log('[Auth] updatePasswordMutation: fire-and-forget signOut ERROR (non-fatal):', e);
        }
      };
      signOutWithTimeout();

      console.log('[Auth] updatePasswordMutation: END — user must re-login');
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
    setRecoveryMode(false);
  }, [setRecoveryMode]);

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
