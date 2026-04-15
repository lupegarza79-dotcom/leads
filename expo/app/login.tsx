import React, { useState, useCallback, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { Shield, Mail, ArrowRight, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';

type Screen = 'login' | 'forgot';

export default function LoginScreen() {
  const {
    signIn,
    signInPending,
    resetPassword,
    resetPasswordPending,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [screen, setScreen] = useState<Screen>('login');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[Login] Session detected, redirecting to /...');
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSignIn = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    if (!trimmedPassword) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }
    setError(null);

    try {
      await signIn(trimmedEmail, trimmedPassword);
      console.log('[Login] Sign in successful, navigating to /');
      router.replace('/');
    } catch (e: any) {
      console.log('[Login] Sign in error:', e);
      const msg = e?.message ?? 'Sign in failed. Check your credentials and try again.';
      if (msg.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (msg.includes('timed out')) {
        setError('Connection timed out. Please check your internet and try again.');
      } else {
        setError(msg);
      }
    }
  }, [email, password, signIn, router]);

  const handleForgotPassword = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Required', 'Please enter your email address first.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setResetSent(false);

    try {
      await resetPassword(trimmedEmail);
      setResetSent(true);
      console.log('[Login] Password reset sent to:', trimmedEmail);
    } catch (e: any) {
      console.log('[Login] Reset password error:', e);
      const msg = e?.message ?? 'Failed to send reset email. Try again.';
      if (msg.includes('timed out')) {
        setError('Connection timed out. Please check your internet and try again.');
      } else {
        setError(msg);
      }
    }
  }, [email, resetPassword]);

  const goToForgot = useCallback(() => {
    setScreen('forgot');
    setError(null);
    setResetSent(false);
  }, []);

  const goToLogin = useCallback(() => {
    setScreen('login');
    setError(null);
    setResetSent(false);
  }, []);

  if (screen === 'forgot') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <View style={styles.logoBg}>
                <Mail size={32} color={Colors.primary} />
              </View>
            </View>
            <Text style={styles.brand}>MG LEADS ENGINE</Text>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send a password reset link.
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {resetSent ? (
              <View style={styles.successBox}>
                <CheckCircle size={16} color={Colors.success} />
                <Text style={styles.successText}>
                  Reset link sent to {email.trim().toLowerCase()}. Check your inbox.
                </Text>
              </View>
            ) : null}

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
                  editable={!resetPasswordPending}
                  testID="forgot-email"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, resetPasswordPending && styles.submitBtnDisabled]}
              onPress={handleForgotPassword}
              disabled={resetPasswordPending}
              activeOpacity={0.8}
              testID="forgot-submit"
            >
              {resetPasswordPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToLogin}
              style={styles.backLink}
              testID="forgot-back"
            >
              <Text style={styles.backLinkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
            Internal access only. Enter your credentials to continue.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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

          <View style={styles.inputGroup}>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!signInPending}
                onSubmitEditing={handleSignIn}
                returnKeyType="go"
                testID="login-password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="login-toggle-password"
              >
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textTertiary} />
                ) : (
                  <Eye size={18} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
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
                <Text style={styles.submitText}>Sign In</Text>
                <ArrowRight size={18} color={Colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToForgot}
            style={styles.forgotLink}
            testID="login-forgot"
          >
            <Text style={styles.forgotLinkText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Text style={styles.accessNote}>
            Only authorized mg_users can access this app.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
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
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputWrap: {
    flexDirection: 'row' as const,
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
    marginTop: 4,
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
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  forgotLinkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  backLinkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  accessNote: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center' as const,
    marginTop: 4,
    lineHeight: 16,
  },
});
