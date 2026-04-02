import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Clock,
  AlertTriangle,
  Zap,
  Send,
  Calendar,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  FOLLOW_UP_CHANNELS,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_REASONS,
} from '@/constants/config';
import type { FollowUpChannel, FollowUpPriority, FollowUpReason } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { addBusinessDays } from '@/utils/business-hours';
import { getWhatsAppUrl, getDialerUrl, formatPhone } from '@/utils/formatters';

const CHANNEL_CONFIG: Record<FollowUpChannel, { icon: React.ElementType; color: string; label: string }> = {
  call: { icon: Phone, color: '#22C55E', label: 'Call' },
  whatsapp: { icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  email: { icon: Mail, color: '#4F8CFF', label: 'Email' },
  note: { icon: FileText, color: '#94A3B8', label: 'Note' },
};

const PRIORITY_CONFIG: Record<FollowUpPriority, { color: string; label: string }> = {
  normal: { color: '#4F8CFF', label: 'Normal' },
  high: { color: '#F59E0B', label: 'High' },
  critical: { color: '#EF4444', label: 'Critical' },
};

function getQuickPresets(): { label: string; value: Date; icon: React.ElementType }[] {
  const now = new Date();
  const presets: { label: string; value: Date; icon: React.ElementType }[] = [];

  const plus30 = new Date(now.getTime() + 30 * 60000);
  presets.push({ label: '+30 min', value: plus30, icon: Clock });

  const plus2h = new Date(now.getTime() + 2 * 60 * 60000);
  presets.push({ label: '+2 hours', value: plus2h, icon: Clock });

  const tomorrow10 = new Date(now);
  tomorrow10.setDate(tomorrow10.getDate() + 1);
  tomorrow10.setHours(10, 0, 0, 0);
  presets.push({ label: 'Tomorrow 10am', value: tomorrow10, icon: Calendar });

  const nextBizDay = addBusinessDays(now, 1);
  nextBizDay.setHours(10, 0, 0, 0);
  presets.push({ label: 'Next biz day 10am', value: nextBizDay, icon: Zap });

  return presets;
}

function formatPickerDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FollowUpComposerScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const router = useRouter();
  const { getLeadById, updateLead, addActivity, mgUsers } = useLeads();
  const { appUser } = useAuth();

  const lead = getLeadById(leadId ?? '');

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [channel, setChannel] = useState<FollowUpChannel>('call');
  const [priority, setPriority] = useState<FollowUpPriority>('normal');
  const [reason, setReason] = useState<FollowUpReason>('Quote follow-up');
  const [assignedTo, setAssignedTo] = useState<string | null>(lead?.owner_id ?? null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');

  const assignableUsers = useMemo(() => {
    return mgUsers.filter(u => u.role === 'producer' || u.role === 'orchestrator');
  }, [mgUsers]);

  const quickPresets = useMemo(() => getQuickPresets(), []);

  const handlePresetSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setManualDate('');
    setManualTime('');
  }, []);

  const handleManualDateApply = useCallback(() => {
    if (!manualDate || !manualTime) {
      Alert.alert('Required', 'Enter both date (MM/DD) and time (HH:MM)');
      return;
    }
    const now = new Date();
    const year = now.getFullYear();
    const parts = manualDate.split('/');
    if (parts.length !== 2) {
      Alert.alert('Format', 'Use MM/DD format for date');
      return;
    }
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const timeParts = manualTime.split(':');
    if (timeParts.length !== 2) {
      Alert.alert('Format', 'Use HH:MM format for time (24h)');
      return;
    }
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const date = new Date(year, month, day, hours, minutes, 0, 0);
    if (isNaN(date.getTime())) {
      Alert.alert('Invalid', 'Could not parse date/time');
      return;
    }
    setSelectedDate(date);
  }, [manualDate, manualTime]);

  const buildActivityNote = useCallback(() => {
    const parts: string[] = [];
    parts.push(`Follow-up scheduled: ${selectedDate ? formatPickerDateTime(selectedDate) : 'N/A'}`);
    parts.push(`Channel: ${channel}`);
    if (priority !== 'normal') parts.push(`Priority: ${priority.toUpperCase()}`);
    parts.push(`Reason: ${reason}`);
    if (notes.trim()) parts.push(`Notes: ${notes.trim()}`);
    return parts.join(' | ');
  }, [selectedDate, channel, priority, reason, notes]);

  const handleSave = useCallback(async (action: 'save' | 'save_log' | 'save_whatsapp' | 'save_call') => {
    if (!lead || !selectedDate) {
      Alert.alert('Required', 'Please select a follow-up date/time');
      return;
    }
    if (!appUser?.id) {
      Alert.alert('Error', 'No authenticated user');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[FollowUp] Saving follow-up for lead:', lead.id, 'at:', selectedDate.toISOString());

      const updates: Record<string, unknown> = {
        next_followup_at: selectedDate.toISOString(),
      };
      if (assignedTo && assignedTo !== lead.owner_id) {
        updates.owner_id = assignedTo;
      }

      await updateLead({ id: lead.id, updates: updates as any });

      if (action !== 'save') {
        await addActivity({
          lead_id: lead.id,
          user_id: appUser.id,
          type: 'follow_up',
          note: buildActivityNote(),
        });
      }

      if (assignedTo && assignedTo !== lead.owner_id) {
        await addActivity({
          lead_id: lead.id,
          user_id: appUser.id,
          type: 'reassignment',
          note: `Reassigned lead with follow-up`,
        });
      }

      console.log('[FollowUp] Follow-up saved successfully');

      if (action === 'save_whatsapp' && lead.phone) {
        const url = getWhatsAppUrl(lead.phone);
        console.log('[FollowUp] Opening WhatsApp:', url);
        Linking.openURL(url).catch(() => {
          Alert.alert('WhatsApp', 'Could not open WhatsApp');
        });
      }

      if (action === 'save_call' && lead.phone) {
        const url = getDialerUrl(lead.phone);
        console.log('[FollowUp] Opening dialer:', url);
        Linking.openURL(url).catch(() => {
          Alert.alert('Call', 'Could not open dialer');
        });
      }

      router.back();
    } catch (e: any) {
      console.log('[FollowUp] Error saving:', e?.message);
      Alert.alert('Error', e?.message ?? 'Failed to save follow-up');
    } finally {
      setIsSubmitting(false);
    }
  }, [lead, selectedDate, assignedTo, appUser, updateLead, addActivity, buildActivityNote, router]);

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Lead not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Follow-up: ${lead.full_name}` }} />
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
          <View style={styles.leadSummary}>
            <Text style={styles.leadName}>{lead.full_name}</Text>
            <Text style={styles.leadPhone}>{formatPhone(lead.phone)}</Text>
            {lead.next_followup_at && (
              <Text style={styles.currentFu}>
                Current: {formatPickerDateTime(new Date(lead.next_followup_at))}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            <View style={styles.presetsRow}>
              {quickPresets.map((preset, idx) => {
                const isActive = selectedDate?.getTime() === preset.value.getTime();
                const IconComp = preset.icon;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.presetBtn, isActive && styles.presetBtnActive]}
                    onPress={() => handlePresetSelect(preset.value)}
                  >
                    <IconComp size={13} color={isActive ? Colors.primary : Colors.textTertiary} />
                    <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.manualRow}>
              <TextInput
                style={[styles.manualInput, styles.manualInputDate]}
                value={manualDate}
                onChangeText={setManualDate}
                placeholder="MM/DD"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.manualInput, styles.manualInputTime]}
                value={manualTime}
                onChangeText={setManualTime}
                placeholder="HH:MM"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity style={styles.manualApplyBtn} onPress={handleManualDateApply}>
                <Text style={styles.manualApplyText}>Set</Text>
              </TouchableOpacity>
            </View>

            {selectedDate && (
              <View style={styles.selectedBox}>
                <Calendar size={14} color={Colors.primary} />
                <Text style={styles.selectedText}>{formatPickerDateTime(selectedDate)}</Text>
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Channel</Text>
            <View style={styles.chipsRow}>
              {FOLLOW_UP_CHANNELS.map(ch => {
                const config = CHANNEL_CONFIG[ch];
                const isActive = channel === ch;
                const IconComp = config.icon;
                return (
                  <TouchableOpacity
                    key={ch}
                    style={[styles.channelChip, isActive && { backgroundColor: config.color + '1A', borderColor: config.color + '55' }]}
                    onPress={() => setChannel(ch)}
                  >
                    <IconComp size={14} color={isActive ? config.color : Colors.textTertiary} />
                    <Text style={[styles.chipLabel, isActive && { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Priority</Text>
            <View style={styles.chipsRow}>
              {FOLLOW_UP_PRIORITIES.map(p => {
                const config = PRIORITY_CONFIG[p];
                const isActive = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, isActive && { backgroundColor: config.color + '1A', borderColor: config.color + '55' }]}
                    onPress={() => setPriority(p)}
                  >
                    {p === 'critical' && <AlertTriangle size={12} color={isActive ? config.color : Colors.textTertiary} />}
                    <Text style={[styles.chipLabel, isActive && { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason</Text>
            <View style={styles.chipsRow}>
              {FOLLOW_UP_REASONS.map(r => {
                const isActive = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                    onPress={() => setReason(r)}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned To</Text>
            <View style={styles.chipsRow}>
              {assignableUsers.map(u => {
                const isActive = assignedTo === u.id;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                    onPress={() => setAssignedTo(u.id)}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this follow-up..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.actionBtnPrimary, (!selectedDate || isSubmitting) && styles.actionBtnDisabled]}
              onPress={() => handleSave('save_log')}
              disabled={!selectedDate || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Send size={16} color={Colors.white} />
                  <Text style={styles.actionBtnPrimaryText}>Save + Log Activity</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={[styles.actionBtnSecondary, (!selectedDate || isSubmitting) && styles.actionBtnDisabled]}
                onPress={() => handleSave('save')}
                disabled={!selectedDate || isSubmitting}
              >
                <Text style={styles.actionBtnSecondaryText}>Save Only</Text>
              </TouchableOpacity>

              {channel === 'whatsapp' && (
                <TouchableOpacity
                  style={[styles.actionBtnWhatsApp, (!selectedDate || isSubmitting) && styles.actionBtnDisabled]}
                  onPress={() => handleSave('save_whatsapp')}
                  disabled={!selectedDate || isSubmitting}
                >
                  <MessageCircle size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnWhatsAppText}>Save + WhatsApp</Text>
                </TouchableOpacity>
              )}

              {channel === 'call' && (
                <TouchableOpacity
                  style={[styles.actionBtnCall, (!selectedDate || isSubmitting) && styles.actionBtnDisabled]}
                  onPress={() => handleSave('save_call')}
                  disabled={!selectedDate || isSubmitting}
                >
                  <Phone size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnCallText}>Save + Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  leadSummary: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leadName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' as const },
  leadPhone: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  currentFu: { color: Colors.warning, fontSize: 12, fontWeight: '500' as const, marginTop: 6 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '55',
  },
  presetText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
  presetTextActive: { color: Colors.primary },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  manualInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  manualInputDate: { flex: 1 },
  manualInputTime: { flex: 1 },
  manualApplyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  manualApplyText: { color: Colors.primary, fontSize: 13, fontWeight: '600' as const },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  selectedText: { color: Colors.primary, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  clearText: { color: Colors.textTertiary, fontSize: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '55',
  },
  chipLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' as const },
  chipLabelActive: { color: Colors.primary },
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 70,
  },
  actionsSection: { marginTop: 8, gap: 10 },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' as const },
  actionBtnDisabled: { opacity: 0.4 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  actionBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnSecondaryText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' as const },
  actionBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#25D366',
  },
  actionBtnWhatsAppText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' as const },
  actionBtnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  actionBtnCallText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' as const },
  bottomPad: { height: 40 },
});
