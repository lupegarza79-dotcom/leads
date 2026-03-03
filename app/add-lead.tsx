import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { OFFICES, LEAD_SOURCES } from '@/constants/config';
import type { Office, LeadSource } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';

export default function AddLeadScreen() {
  const router = useRouter();
  const { addLead, mgUsers } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [office, setOffice] = useState<Office>('McAllen');
  const [source, setSource] = useState<LeadSource>('WhatsApp');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [premium, setPremium] = useState('');

  const assignableUsers = useMemo(() => {
    return mgUsers.filter(u => u.role === 'producer' || u.role === 'orchestrator');
  }, [mgUsers]);

  const handleSubmit = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter the lead\'s full name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter a phone number.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    console.log('[AddLead] Submitting lead...');
    try {
      await addLead({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        office,
        source,
        owner_id: ownerId,
        notes: notes.trim() || undefined,
        premium_amount: premium ? parseFloat(premium) : undefined,
      });
      console.log('[AddLead] Lead created successfully');
      router.back();
    } catch (e: any) {
      console.log('[AddLead] Error creating lead:', e?.message ?? e);
      Alert.alert('Error', e?.message ?? 'Failed to create lead. Please try again.');
    } finally {
      setIsSubmitting(false);
      console.log('[AddLead] Submit flow finished, loading reset');
    }
  }, [fullName, phone, email, office, source, ownerId, notes, premium, addLead, router, isSubmitting]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Maria Garcia"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              testID="input-fullname"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(956) 555-0123"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              testID="input-phone"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Office</Text>
            <View style={styles.chipRow}>
              {OFFICES.map(o => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, office === o && styles.chipActive]}
                  onPress={() => setOffice(o)}
                >
                  <Text style={[styles.chipText, office === o && styles.chipTextActive]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Source</Text>
            <View style={styles.chipRow}>
              {LEAD_SOURCES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, source === s && styles.chipActive]}
                  onPress={() => setSource(s)}
                >
                  <Text style={[styles.chipText, source === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Assigned To (optional)</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, ownerId === null && styles.chipActive]}
                onPress={() => setOwnerId(null)}
              >
                <Text style={[styles.chipText, ownerId === null && styles.chipTextActive]}>Unassigned</Text>
              </TouchableOpacity>
              {assignableUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.chip, ownerId === u.id && styles.chipActive]}
                  onPress={() => setOwnerId(u.id)}
                >
                  <Text style={[styles.chipText, ownerId === u.id && styles.chipTextActive]}>{u.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Premium Amount</Text>
            <TextInput
              style={styles.input}
              value={premium}
              onChangeText={setPremium}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this lead..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          testID="submit-lead"
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.submitText}>Create Lead</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomPad: {
    height: 40,
  },
});
