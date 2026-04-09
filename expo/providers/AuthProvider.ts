import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { MgUser } from '@/types/leads';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [appUser, setAppUser] = useState<MgUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const verifyInFlightRef = useRef(false);

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

      if (verifyInFlightRef.current) {
        console.log('[Auth] Skipping listener — verifyOtp is handling state');
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

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      console.log('[Auth] Sending OTP to:', email);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      console.log('[Auth] OTP sent successfully to:', email);
      return email;
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, token }: { email: string; token: string }) => {
      console.log('[Auth] Verifying OTP for:', email);
      verifyInFlightRef.current = true;

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });
        if (error) throw error;

        const userEmail = data.user?.email;
        if (!userEmail) {
          throw new Error('Verification succeeded but no user email returned.');
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

        console.log('[Auth] OTP verified, setting session + appUser immediately');
        setSession(data.session);
        setUser(data.user ?? null);
        setAppUser(resolved);
        setIsLoading(false);

        return resolved;
      } finally {
        verifyInFlightRef.current = false;
      }
    },
  });

  const sendOtp = useCallback((email: string) => {
    return sendOtpMutation.mutateAsync(email);
  }, [sendOtpMutation.mutateAsync]);

  const verifyOtp = useCallback((email: string, token: string) => {
    return verifyOtpMutation.mutateAsync({ email, token });
  }, [verifyOtpMutation.mutateAsync]);

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
    sendOtp,
    sendOtpPending: sendOtpMutation.isPending,
    sendOtpError: sendOtpMutation.error,
    verifyOtp,
    verifyOtpPending: verifyOtpMutation.isPending,
    verifyOtpError: verifyOtpMutation.error,
    signOut,
    signOutPending: signOutMutation.isPending,
  };
});
