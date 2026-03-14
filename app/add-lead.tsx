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
import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LEAD_SOURCES } from '@/constants/config';
import type { LeadSource } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { addBusinessDays, getNextBusinessOpen, isWithinBusinessHours } from '@/utils/business-hours';

function getQuickFollowUpOptions(): { label: string; value: Date }[] {
  const now = new Date();
  const options: { label: string; value: Date }[] = [];

  if (isWithinBusinessHours(now)) {
    const laterToday = new Date(now);
    laterToday.setHours(15, 0, 0, 0);
    if (laterToday > now) {
      options.push({ label: 'Later today 3pm', value: laterToday });
    }
  }

  const tomorrow10 = new Date(now);
  tomorrow10.setDate(tomorrow10.getDate() + 1);
  tomorrow10.setHours(10, 0, 0, 0);
  const nextOpen = getNextBusinessOpen(tomorrow10);
  options.push({ label: 'Tomorrow 10am', value: nextOpen });

  const nextBizDay = addBusinessDays(now, 1);
  nextBizDay.setHours(10, 0, 0, 0);
  if (nextBizDay.getTime() !== nextOpen.getTime()) {
    options.push({ label: 'Next biz day 10am', value: nextBizDay });
  }

  const twoBizDays = addBusinessDays(now, 2);
  twoBizDays.setHours(10, 0, 0, 0);
  options.push({ label: 'In 2 biz days', value: twoBizDays });

  return options;
}

function formatPickerDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AddLeadScreen() {
  const router = useRouter();
  const { addLead, mgUsers } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('WhatsApp');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [amountDue, setAmountDue] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const [showOptional, setShowOptional] = useState(false);
  const [downPayment, setDownPayment] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [totalPremium, setTotalPremium] = useState('');
  const [quotePrice, setQuotePrice] = useState('');
  const [carrier, setCarrier] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const assignableUsers = useMemo(() => {
    return mgUsers.filter(u => u.role === 'producer' || u.role === 'orchestrator');
  }, [mgUsers]);

  const quickOptions = useMemo(() => getQuickFollowUpOptions(), []);

  const handleSubmit = useCallback(async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter a phone number.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    console.log('[AddLead] Submitting lead...');
    try {
      const result = await addLead({
        full_name: fullName.trim() || phone.trim(),
        phone: phone.trim(),
        office: 'McAllen',
        source,
        owner_id: ownerId,
        notes: notes.trim() || undefined,
        amount_due: amountDue ? parseFloat(amountDue) : undefined,
        next_followup_at: nextFollowUp ? nextFollowUp.toISOString() : undefined,
        down_payment: downPayment ? parseFloat(downPayment) : undefined,
        monthly_payment: monthlyPayment ? parseFloat(monthlyPayment) : undefined,
        total_premium: totalPremium ? parseFloat(totalPremium) : undefined,
        quote_price: quotePrice ? parseFloat(quotePrice) : undefined,
        carrier: carrier.trim() || undefined,
        effective_date: effectiveDate.trim() || undefined,
      });
      if (result.wasUpdated) {
        console.log('[AddLead] Existing lead updated via phone match');
        Alert.alert(
          'Lead Updated',
          'Existing lead found. Updated instead of creating duplicate.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        console.log('[AddLead] Lead created successfully');
        router.back();
      }
    } catch (e: any) {
      console.log('[AddLead] Error creating lead:', e?.message ?? e);
      Alert.alert('Error', e?.message ?? 'Failed to create lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [fullName, phone, source, ownerId, notes, amountDue, nextFollowUp, downPayment, monthlyPayment, totalPremium, quotePrice, carrier, effectiveDate, addLead, router, isSubmitting]);

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
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(956) 555-0123"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              autoFocus
              testID="input-phone"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Maria Garcia"
              placeholderTextColor={Colors.textTertiary}
              testID="input-fullname"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount & Follow-up</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Le quedó en (Amount Due)</Text>
            <TextInput
              style={styles.input}
              value={amountDue}
              onChangeText={setAmountDue}
              placeholder="$0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              testID="input-amount-due"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Next Follow-up</Text>
            <View style={styles.quickBtnsRow}>
              {quickOptions.map((opt, idx) => {
                const isActive = nextFollowUp?.getTime() === opt.value.getTime();
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.quickBtn, isActive && styles.quickBtnActive]}
                    onPress={() => setNextFollowUp(isActive ? null : opt.value)}
                  >
                    <Clock size={12} color={isActive ? Colors.primary : Colors.textTertiary} />
                    <Text style={[styles.quickBtnText, isActive && styles.quickBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {nextFollowUp && (
              <View style={styles.selectedFollowUp}>
                <Text style={styles.selectedFollowUpText}>
                  {formatPickerDate(nextFollowUp)}
                </Text>
                <TouchableOpacity onPress={() => setNextFollowUp(null)}>
                  <Text style={styles.clearBtn}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assignment</Text>
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
            <Text style={styles.label}>Assigned To</Text>
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
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.field}>
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
          style={styles.optionalToggle}
          onPress={() => setShowOptional(!showOptional)}
          activeOpacity={0.7}
        >
          <Text style={styles.optionalToggleText}>Optional Quote Fields</Text>
          {showOptional ? (
            <ChevronUp size={18} color={Colors.textTertiary} />
          ) : (
            <ChevronDown size={18} color={Colors.textTertiary} />
          )}
        </TouchableOpacity>

        {showOptional && (
          <View style={styles.section}>
            <View style={styles.field}>
              <Text style={styles.label}>Down Payment</Text>
              <TextInput
                style={styles.input}
                value={downPayment}
                onChangeText={setDownPayment}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                testID="input-down-payment"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Monthly Payment</Text>
              <TextInput
                style={styles.input}
                value={monthlyPayment}
                onChangeText={setMonthlyPayment}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                testID="input-monthly-payment"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Total Premium</Text>
              <TextInput
                style={styles.input}
                value={totalPremium}
                onChangeText={setTotalPremium}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                testID="input-total-premium"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Quote Price</Text>
              <TextInput
                style={styles.input}
                value={quotePrice}
                onChangeText={setQuotePrice}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                testID="input-quote-price"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Carrier</Text>
              <TextInput
                style={styles.input}
                value={carrier}
                onChangeText={setCarrier}
                placeholder="e.g. Progressive, State Farm"
                placeholderTextColor={Colors.textTertiary}
                testID="input-carrier"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Effective Date</Text>
              <TextInput
                style={styles.input}
                value={effectiveDate}
                onChangeText={setEffectiveDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={Colors.textTertiary}
                testID="input-effective-date"
              />
            </View>
          </View>
        )}

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
  quickBtnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  quickBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  quickBtnTextActive: {
    color: Colors.primary,
  },
  selectedFollowUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  selectedFollowUpText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  clearBtn: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionalToggleText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600' as const,
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
