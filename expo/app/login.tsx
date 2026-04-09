import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Shield, Mail, ArrowRight, KeyRound, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const {
    sendOtp,
    sendOtpPending,
    verifyOtp,
    verifyOtpPending,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[Login] Session detected, redirecting to /...');
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    setError(null);

    try {
      await sendOtp(trimmed);
      setStep('otp');
      setOtpCode('');
      startCooldown();
      console.log('[Login] OTP sent to:', trimmed);
    } catch (e: any) {
      console.log('[Login] Send OTP error:', e);
      const msg = e?.message ?? 'Failed to send code. Please try again.';
      setError(msg);
    }
  }, [email, sendOtp, startCooldown]);

  const handleVerifyCode = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    const code = otpCode.trim();
    if (!code || code.length < 6) {
      Alert.alert('Required', 'Please enter the verification code from your email.');
      return;
    }
    setError(null);

    const verifyTimeout = setTimeout(() => {
      console.log('[Login] Verify timed out after 15s, checking session...');
      setError('Verification is taking too long. Please try again.');
    }, 15000);

    try {
      await verifyOtp(trimmed, code);
      clearTimeout(verifyTimeout);
      console.log('[Login] OTP verified successfully, navigating to /');
      router.replace('/');
    } catch (e: any) {
      clearTimeout(verifyTimeout);
      console.log('[Login] Verify OTP error:', e);
      const msg = e?.message ?? 'Verification failed. Please check your code and try again.';
      setError(msg);
    }
  }, [email, otpCode, verifyOtp, router]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setError(null);
    const trimmed = email.trim().toLowerCase();

    try {
      await sendOtp(trimmed);
      startCooldown();
      console.log('[Login] OTP resent to:', trimmed);
    } catch (e: any) {
      console.log('[Login] Resend OTP error:', e);
      setError(e?.message ?? 'Failed to resend code.');
    }
  }, [email, sendOtp, resendCooldown, startCooldown]);

  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setOtpCode('');
    setError(null);
  }, []);

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.logoWrap}>
            <View style={styles.logoBg}>
              <KeyRound size={32} color={Colors.primary} />
            </View>
          </View>
          <Text style={styles.brand}>MG LEADS ENGINE</Text>
          <Text style={styles.title}>Enter Code</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{'\n'}
            <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <View style={styles.inputWrap}>
              <KeyRound size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="00000000"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
                editable={!verifyOtpPending}
                testID="login-otp"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, verifyOtpPending && styles.submitBtnDisabled]}
            onPress={handleVerifyCode}
            disabled={verifyOtpPending}
            activeOpacity={0.8}
            testID="login-verify"
          >
            {verifyOtpPending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <View style={styles.submitInner}>
                <Text style={styles.submitText}>Verify Code</Text>
                <ArrowRight size={18} color={Colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0 || sendOtpPending}
              style={styles.secondaryBtn}
            >
              <RotateCcw size={14} color={resendCooldown > 0 ? Colors.textTertiary : Colors.primary} />
              <Text
                style={[
                  styles.secondaryBtnText,
                  resendCooldown > 0 && styles.secondaryBtnTextDisabled,
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleBackToEmail} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Change Email</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.accessNote}>
            Only users with a matching mg_users record can access this app.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
          Internal access only. Enter your authorized email to receive a verification code.
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
              editable={!sendOtpPending}
              testID="login-email"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, sendOtpPending && styles.submitBtnDisabled]}
          onPress={handleSendCode}
          disabled={sendOtpPending}
          activeOpacity={0.8}
          testID="login-submit"
        >
          {sendOtpPending ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <View style={styles.submitInner}>
              <Text style={styles.submitText}>Send Code</Text>
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
  inputGroup: {
    marginBottom: 16,
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
  otpInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700' as const,
    paddingVertical: 14,
    letterSpacing: 4,
    textAlign: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  secondaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  secondaryBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  accessNote: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center' as const,
    marginTop: 16,
    lineHeight: 16,
  },
});
