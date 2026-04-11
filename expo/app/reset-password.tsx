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
  ScrollView,
} from 'react-native';
import { Lock, Eye, EyeOff, CheckCircle, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';

type ScreenState = 'form' | 'success';

export default function ResetPasswordScreen() {
  const {
    updatePassword,
    updatePasswordPending,
    signOut,
    clearRecoveryMode,
    isRecoveryMode,
  } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('form');

  const passwordMinLength = 8;
  const passwordValid = password.length >= passwordMinLength;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleUpdatePassword = useCallback(async () => {
    setError(null);

    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < passwordMinLength) {
      setError(`Password must be at least ${passwordMinLength} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await updatePassword(password);
      console.log('[ResetPassword] Password updated successfully');
      setScreenState('success');
    } catch (e: any) {
      console.log('[ResetPassword] Update error:', e);
      const msg = e?.message ?? 'Failed to update password. Please try again.';
      if (msg.includes('not authorized')) {
        setError(msg);
      } else if (msg.includes('same_password') || msg.includes('should be different')) {
        setError('New password must be different from your current password.');
      } else if (msg.includes('weak_password') || msg.includes('too short')) {
        setError('Password is too weak. Use at least 8 characters with a mix of letters and numbers.');
      } else {
        setError(msg);
      }
    }
  }, [password, confirmPassword, updatePassword]);

  const handleGoToLogin = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    clearRecoveryMode();
    router.replace('/login');
  }, [signOut, clearRecoveryMode, router]);

  const handleContinueToApp = useCallback(() => {
    router.replace('/');
  }, [router]);

  if (screenState === 'success') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <View style={styles.successLogoBg}>
                <CheckCircle size={36} color={Colors.success} />
              </View>
            </View>
            <Text style={styles.brand}>MG LEADS ENGINE</Text>
            <Text style={styles.title}>Password Updated</Text>
            <Text style={styles.subtitle}>
              Your password has been set successfully. You can now sign in with your new password.
            </Text>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleContinueToApp}
              activeOpacity={0.8}
              testID="reset-continue"
            >
              <Text style={styles.submitText}>Continue to App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGoToLogin}
              style={styles.backLink}
              testID="reset-go-login"
            >
              <Text style={styles.backLinkText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
              <ShieldCheck size={32} color={Colors.primary} />
            </View>
          </View>
          <Text style={styles.brand}>MG LEADS ENGINE</Text>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            {isRecoveryMode
              ? 'Enter your new password below to complete the reset.'
              : 'Create a secure password for your account.'}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <AlertTriangle size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 characters"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updatePasswordPending}
                testID="reset-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textTertiary} />
                ) : (
                  <Eye size={18} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            </View>
            {password.length > 0 ? (
              <View style={styles.validationRow}>
                <View style={[styles.validationDot, passwordValid && styles.validationDotOk]} />
                <Text style={[styles.validationText, passwordValid && styles.validationTextOk]}>
                  {passwordValid ? 'Meets minimum length' : `${passwordMinLength - password.length} more characters needed`}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updatePasswordPending}
                onSubmitEditing={handleUpdatePassword}
                returnKeyType="go"
                testID="reset-confirm-input"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm((p) => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showConfirm ? (
                  <EyeOff size={18} color={Colors.textTertiary} />
                ) : (
                  <Eye size={18} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 ? (
              <View style={styles.validationRow}>
                <View style={[styles.validationDot, passwordsMatch && styles.validationDotOk]} />
                <Text style={[styles.validationText, passwordsMatch && styles.validationTextOk]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!passwordValid || !passwordsMatch || updatePasswordPending) && styles.submitBtnDisabled,
            ]}
            onPress={handleUpdatePassword}
            disabled={!passwordValid || !passwordsMatch || updatePasswordPending}
            activeOpacity={0.8}
            testID="reset-submit"
          >
            {updatePasswordPending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGoToLogin}
            style={styles.backLink}
            testID="reset-back-login"
          >
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
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
  successLogoBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.successMuted,
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
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 6,
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
  validationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  validationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
  validationDotOk: {
    backgroundColor: Colors.success,
  },
  validationText: {
    color: Colors.danger,
    fontSize: 12,
  },
  validationTextOk: {
    color: Colors.success,
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
    opacity: 0.5,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
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
});
