import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (Platform.OS === 'web') {
          const hash = window.location.hash;
          console.log('[AuthCallback] Hash present:', !!hash, 'length:', hash?.length);

          if (hash && hash.length > 1) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const error = params.get('error');
            const errorDescription = params.get('error_description');

            if (error) {
              console.log('[AuthCallback] Error in hash:', error, errorDescription);
              setStatus('Sign in failed. Redirecting...');
              setTimeout(() => router.replace('/login'), 1500);
              return;
            }

            if (accessToken && refreshToken) {
              console.log('[AuthCallback] Found tokens, setting session...');
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              window.location.hash = '';

              if (sessionError) {
                console.log('[AuthCallback] setSession error:', sessionError.message);
                setStatus('Sign in failed. Redirecting...');
                setTimeout(() => router.replace('/login'), 1500);
                return;
              }

              console.log('[AuthCallback] Session set for:', data.user?.email);
              setStatus('Success! Redirecting...');
              setTimeout(() => router.replace('/'), 500);
              return;
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AuthCallback] Existing session found, redirecting home');
          router.replace('/');
        } else {
          console.log('[AuthCallback] No session found, redirecting to login');
          router.replace('/login');
        }
      } catch (e) {
        console.log('[AuthCallback] Error:', e);
        setStatus('Something went wrong. Redirecting...');
        setTimeout(() => router.replace('/login'), 1500);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
