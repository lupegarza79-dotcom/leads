import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'implicit',
  },
});

export async function handleWebAuthHash(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  try {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return false;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      console.log('[Auth:Web] Hash contains error:', error, errorDescription);
      window.location.hash = '';
      return false;
    }

    if (accessToken && refreshToken) {
      console.log('[Auth:Web] Found tokens in URL hash, setting session...');
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      window.location.hash = '';
      if (sessionError) {
        console.log('[Auth:Web] setSession error:', sessionError.message);
        return false;
      }
      console.log('[Auth:Web] Session set successfully for:', data.user?.email);
      return true;
    }

    return false;
  } catch (e) {
    console.log('[Auth:Web] handleWebAuthHash error:', e);
    return false;
  }
}
