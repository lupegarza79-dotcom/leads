import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Shield, Mail, ArrowRight, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const { signIn, signInPending } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSignIn = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }

    try {
      await signIn(trimmed);
      setSent(true);
      console.log('[Login] Magic link sent to:', trimmed);
    } catch (e: any) {
      console.log('[Login] Error:', e);
      Alert.alert('Error', e?.message ?? 'Failed to send magic link. Please try again.');
    }
  }, [email, signIn]);

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.successIcon}>
            <CheckCircle size={48} color={Colors.success} />
          </View>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a magic link to{'\n'}
            <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
          </Text>
          <Text style={styles.hint}>
            Click the link in your email to sign in. Check your spam folder if you don{"'"}t see it.
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setSent(false)}
          >
            <Text style={styles.secondaryBtnText}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBg}>
            <Shield size={32} color={Colors.primary} />
          </View>
        </View>
        <Text style={styles.brand}>MG LEADS ENGINE</Text>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>
          Internal access only. Enter your authorized email to receive a magic link.
        </Text>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrap}>
            <Mail size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!signInPending}
              testID="login-email"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, signInPending && styles.submitBtnDisabled]}
          onPress={handleSignIn}
          disabled={signInPending}
          activeOpacity={0.8}
          testID="login-submit"
        >
          {signInPending ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <View style={styles.submitInner}>
              <Text style={styles.submitText}>Send Magic Link</Text>
              <ArrowRight size={18} color={Colors.white} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.accessNote}>
          Only Supabase-invited users with a matching mg_users record can access this app.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBg: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  hint: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  accessNote: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center' as const,
    marginTop: 16,
    lineHeight: 16,
  },
});
