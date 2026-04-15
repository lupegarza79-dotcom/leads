import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  DollarSign,
  MessageCircle,
  FileText,
  ChevronRight,
  CheckCircle,
  XCircle,
  Edit3,
  Save,
  X,
  CalendarPlus,
  Home,
  AlertTriangle,
  User,
  Target,
  ShieldAlert,
  Handshake,
  CircleDot,
  ArrowRight,
} from 'lucide-react-native';
import { Colors, StatusColors } from '@/constants/colors';
import { PIPELINE_STATUSES, ACTIVITY_TYPES } from '@/constants/config';
import type { PipelineStatus, ActivityType } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { StatusBadge } from '@/components/StatusBadge';
import { ActivityItem } from '@/components/ActivityItem';
import { ActionToast, type ToastType } from '@/components/ActionToast';
import { ObservabilityPanel } from '@/components/ObservabilityPanel';
import { formatPhone, formatDateTime, formatDate, formatCurrency, getWhatsAppUrl, getDialerUrl } from '@/utils/formatters';
import { getEscalationInfo, formatEscalationTime } from '@/utils/escalation';
import { withTimeout } from '@/utils/with-timeout';
import { isLeadIncomplete, getMissingQuoteFields, CARRIERS } from '@/utils/lead-helpers';

type Section = 'details' | 'activity' | 'followups' | 'status';

interface LastActionResult {
  type: 'success' | 'error';
  message: string;
  at: string;
}

interface Commitment {
  id: string;
  note: string;
  date: string;
}

function parseCommitments(activities: { id: string; note: string; created_at: string }[]): Commitment[] {
  return activities
    .filter(a => a.note.includes('[COMMITMENT]') || a.note.includes('[PROMISE]'))
    .map(a => ({
      id: a.id,
      note: a.note.replace('[COMMITMENT]', '').replace('[PROMISE]', '').trim(),
      date: a.created_at,
    }));
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getLeadById,
    getActivitiesForLead,
    getFollowUpsForLead,
    changeStatus,
    addActivity,
    updateLead,
    completeFollowUp,
    followUps: allFollowUps,
    activities: allActivities,
    getUserById,
    mgUsers,
  } = useLeads();
  const { appUser } = useAuth();

  const lead = getLeadById(id ?? '');
  const leadActivities = getActivitiesForLead(id ?? '');
  const leadFollowUps = getFollowUpsForLead(id ?? '');

  const [activeSection, setActiveSection] = useState<Section>('details');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('call');
  const [activityNote, setActivityNote] = useState('');
  const [commitmentNote, setCommitmentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);
  const [editCarrier, setEditCarrier] = useState('');
  const [editQuotePrice, setEditQuotePrice] = useState('');
  const [editPremiumAmount, setEditPremiumAmount] = useState('');
  const [editDownPayment, setEditDownPayment] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastMessage, setToastMessage] = useState('');

  const [lastActionResult, setLastActionResult] = useState<LastActionResult | null>(null);

  const submittingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToastType(type);
    setToastMessage(message);
    setToastVisible(true);
    setLastActionResult({ type: type === 'warning' ? 'error' : type, message, at: new Date().toISOString() });
  }, []);

  const dismissToast = useCallback(() => setToastVisible(false), []);

  const incomplete = useMemo(() => {
    if (!lead) return false;
    return isLeadIncomplete(lead);
  }, [lead]);

  const missingFields = useMemo(() => {
    if (!lead) return [];
    return getMissingQuoteFields(lead);
  }, [lead]);

  const escalation = useMemo(() => {
    if (!lead) return null;
    return getEscalationInfo(lead, allActivities);
  }, [lead, allActivities]);

  const owner = useMemo(() => getUserById(lead?.owner_id ?? null), [lead?.owner_id, getUserById]);

  const assignableUsers = useMemo(() => {
    return mgUsers.filter(u => u.role === 'producer' || u.role === 'orchestrator');
  }, [mgUsers]);

  const commitments = useMemo(() => {
    return parseCommitments(leadActivities);
  }, [leadActivities]);

  const isActive = lead ? lead.status !== 'Closed' && lead.status !== 'Lost' : false;

  const nextActionLabel = useMemo(() => {
    if (!lead) return null;
    if (!isActive) return null;

    if (lead.status === 'New') {
      return { action: 'Contact this lead immediately', urgency: 'critical' as const };
    }
    if (!lead.next_followup_at) {
      return { action: 'No follow-up scheduled — set one now', urgency: 'warning' as const };
    }
    const now = new Date();
    const fuDate = new Date(lead.next_followup_at);
    const diffMs = fuDate.getTime() - now.getTime();

    if (diffMs < 0) {
      const overdueMin = Math.abs(Math.round(diffMs / 60000));
      return { action: `Follow-up overdue by ${formatEscalationTime(overdueMin)}`, urgency: 'critical' as const };
    }
    if (diffMs < 30 * 60000) {
      return { action: `Follow-up due in ${formatEscalationTime(Math.round(diffMs / 60000))}`, urgency: 'warning' as const };
    }
    return { action: `Next follow-up: ${formatDateTime(lead.next_followup_at)}`, urgency: 'ok' as const };
  }, [lead, isActive]);

  const resetSubmitting = useCallback(() => {
    setIsSubmitting(false);
    submittingRef.current = false;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const startEdit = useCallback(() => {
    if (!lead) return;
    setEditName(lead.full_name);
    setEditPhone(lead.phone);
    setEditAmount(lead.amount_due != null ? String(lead.amount_due) : '');
    setEditNotes(lead.notes ?? '');
    setEditOwnerId(lead.owner_id);
    setEditCarrier(lead.carrier ?? '');
    setEditQuotePrice(lead.quote_price != null ? String(lead.quote_price) : '');
    setEditPremiumAmount(lead.premium_amount != null ? String(lead.premium_amount) : '');
    setEditDownPayment(lead.down_payment != null ? String(lead.down_payment) : '');
    setEditMonthlyPayment(lead.monthly_payment != null ? String(lead.monthly_payment) : '');
    setEditEffectiveDate(lead.effective_date ?? '');
    setIsEditing(true);
  }, [lead]);

  const handleSaveEdit = useCallback(async () => {
    if (!lead || !appUser?.id || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    saveTimeoutRef.current = setTimeout(() => {
      console.log('[LeadDetail] Save safety timeout triggered at 15s');
      resetSubmitting();
      showToast('warning', 'Save timed out. Changes may not have been saved.');
    }, 15000);

    try {
      const changes: string[] = [];
      const updates: Record<string, unknown> = {};

      if (editName.trim() && editName.trim() !== lead.full_name) {
        updates.full_name = editName.trim();
        changes.push(`Name: ${lead.full_name} → ${editName.trim()}`);
      }
      if (editPhone.trim() && editPhone.trim() !== lead.phone) {
        updates.phone = editPhone.trim();
        updates.phone_norm = editPhone.trim().replace(/\D/g, '');
        changes.push(`Phone updated`);
      }
      const newAmount = editAmount ? parseFloat(editAmount) : null;
      if (newAmount !== lead.amount_due) {
        updates.amount_due = newAmount;
        changes.push(`Amount: ${lead.amount_due ?? 'none'} → ${newAmount ?? 'none'}`);
      }
      if (editNotes.trim() !== (lead.notes ?? '')) {
        updates.notes = editNotes.trim();
        changes.push(`Notes updated`);
      }
      if (editOwnerId !== lead.owner_id) {
        updates.owner_id = editOwnerId;
        const newOwner = getUserById(editOwnerId);
        changes.push(`Assigned: ${owner?.name ?? 'unassigned'} → ${newOwner?.name ?? 'unassigned'}`);
      }

      const newCarrier = editCarrier.trim() || null;
      if (newCarrier !== (lead.carrier ?? null)) {
        updates.carrier = newCarrier;
        changes.push(`Carrier: ${lead.carrier ?? 'none'} → ${newCarrier ?? 'none'}`);
      }
      const newQuotePrice = editQuotePrice ? parseFloat(editQuotePrice) : null;
      if (newQuotePrice !== lead.quote_price) {
        updates.quote_price = newQuotePrice;
        changes.push(`Quote price updated`);
      }
      const newPremium = editPremiumAmount ? parseFloat(editPremiumAmount) : null;
      if (newPremium !== lead.premium_amount) {
        updates.premium_amount = newPremium;
        changes.push(`Premium updated`);
      }
      const newDown = editDownPayment ? parseFloat(editDownPayment) : null;
      if (newDown !== lead.down_payment) {
        updates.down_payment = newDown;
        changes.push(`Down payment updated`);
      }
      const newMonthly = editMonthlyPayment ? parseFloat(editMonthlyPayment) : null;
      if (newMonthly !== lead.monthly_payment) {
        updates.monthly_payment = newMonthly;
        changes.push(`Monthly payment updated`);
      }
      if ((newDown != null || newMonthly != null)) {
        const computedTotal = (newDown ?? 0) + (newMonthly ?? 0);
        if (computedTotal > 0 && computedTotal !== lead.total_premium) {
          updates.total_premium = computedTotal;
        }
      }
      const newEffective = editEffectiveDate.trim() || null;
      if (newEffective !== (lead.effective_date ?? null)) {
        updates.effective_date = newEffective;
        changes.push(`Effective date updated`);
      }

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        resetSubmitting();
        return;
      }

      await withTimeout(updateLead({ id: lead.id, updates: updates as any }), 12000);

      if (changes.length > 0) {
        try {
          await withTimeout(addActivity({
            lead_id: lead.id,
            user_id: appUser.id,
            type: 'note',
            note: `Lead edited: ${changes.join(', ')}`,
          }), 8000);
        } catch (actErr) {
          console.log('[LeadDetail] Non-critical: activity log failed:', actErr);
        }
      }

      if (editOwnerId !== lead.owner_id) {
        try {
          await withTimeout(addActivity({
            lead_id: lead.id,
            user_id: appUser.id,
            type: 'note',
            note: `[REASSIGNMENT] Reassigned to ${getUserById(editOwnerId)?.name ?? 'unassigned'}`,
          }), 8000);
        } catch (actErr) {
          console.log('[LeadDetail] Non-critical: reassignment activity log failed:', actErr);
        }
      }

      setIsEditing(false);
      resetSubmitting();
      showToast('success', 'Lead saved successfully');
      console.log('[LeadDetail] Edit saved');
    } catch (e: any) {
      console.log('[LeadDetail] Save error:', e?.message);
      resetSubmitting();
      showToast('error', e?.message ?? 'Failed to save changes');
    }
  }, [lead, editName, editPhone, editAmount, editNotes, editOwnerId, editCarrier, editQuotePrice, editPremiumAmount, editDownPayment, editMonthlyPayment, editEffectiveDate, appUser, updateLead, addActivity, getUserById, owner, showToast, resetSubmitting]);

  const handleStatusChange = useCallback(async (status: PipelineStatus) => {
    if (!lead || !appUser?.id || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await withTimeout(changeStatus({ id: lead.id, status, userId: appUser.id }));
      setShowStatusPicker(false);
      showToast('success', `Status changed to ${status}`);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to update status');
    } finally {
      resetSubmitting();
    }
  }, [lead, changeStatus, appUser, showToast, resetSubmitting]);

  const handleAddActivity = useCallback(async () => {
    if (!lead || !activityNote.trim() || !appUser?.id || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await withTimeout(addActivity({
        lead_id: lead.id,
        user_id: appUser.id,
        type: activityType,
        note: activityNote.trim(),
      }));
      setActivityNote('');
      setShowActivityForm(false);
      setActiveSection('activity');
      showToast('success', 'Activity logged');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to log activity');
    } finally {
      resetSubmitting();
    }
  }, [lead, activityType, activityNote, addActivity, appUser, showToast, resetSubmitting]);

  const handleAddCommitment = useCallback(async () => {
    if (!lead || !commitmentNote.trim() || !appUser?.id || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await withTimeout(addActivity({
        lead_id: lead.id,
        user_id: appUser.id,
        type: 'note',
        note: `[COMMITMENT] ${commitmentNote.trim()}`,
      }));
      setCommitmentNote('');
      setShowCommitmentForm(false);
      showToast('success', 'Commitment recorded');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to save commitment');
    } finally {
      resetSubmitting();
    }
  }, [lead, commitmentNote, addActivity, appUser, showToast, resetSubmitting]);

  const handleCompleteFollowUp = useCallback(async (taskId: string) => {
    try {
      await withTimeout(completeFollowUp(taskId));
      showToast('success', 'Follow-up completed');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to complete follow-up');
    }
  }, [completeFollowUp, showToast]);

  const handleCall = useCallback(() => {
    if (!lead) return;
    const url = getDialerUrl(lead.phone);
    console.log('[LeadDetail] Opening dialer:', url);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open dialer'));
  }, [lead]);

  const handleWhatsApp = useCallback(() => {
    if (!lead) return;
    const url = getWhatsAppUrl(lead.phone);
    console.log('[LeadDetail] Opening WhatsApp:', url);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
  }, [lead]);

  const handleOpenComposer = useCallback(() => {
    if (!lead) return;
    router.push(`/follow-up?leadId=${lead.id}`);
  }, [lead, router]);

  const handleGoHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    resetSubmitting();
  }, [resetSubmitting]);

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Lead not found</Text>
      </View>
    );
  }

  const urgencyColors = {
    critical: { bg: Colors.dangerMuted, border: Colors.danger + '33', text: Colors.danger, icon: Colors.danger },
    warning: { bg: Colors.warningMuted, border: Colors.warning + '33', text: Colors.warning, icon: Colors.warning },
    ok: { bg: Colors.surfaceElevated, border: Colors.border, text: Colors.textSecondary, icon: Colors.textTertiary },
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: lead.full_name,
          headerRight: () => (
            <TouchableOpacity onPress={handleGoHome} style={styles.headerBtn} hitSlop={8}>
              <Home size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.wrapper}>
        <ActionToast visible={toastVisible} type={toastType} message={toastMessage} onDismiss={dismissToast} />
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* === HEADER === */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerBadges}>
                <StatusBadge status={lead.status} />
                {incomplete && (
                  <View style={styles.incompletePill}>
                    <AlertTriangle size={10} color={Colors.warning} />
                    <Text style={styles.incompletePillText}>Incomplete</Text>
                  </View>
                )}
              </View>
              {escalation && escalation.state !== 'healthy' && (
                <View style={[styles.escalationPill, { backgroundColor: escalation.bgColor }]}>
                  <View style={[styles.escalationDot, { backgroundColor: escalation.color }]} />
                  <Text style={[styles.escalationText, { color: escalation.color }]}>
                    {escalation.label}
                    {escalation.minutesOverdue != null && escalation.minutesOverdue > 0
                      ? ` +${formatEscalationTime(escalation.minutesOverdue)}`
                      : ''}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.leadName}>{lead.full_name}</Text>

            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Phone size={14} color={Colors.textTertiary} />
                <Text style={styles.infoText}>{formatPhone(lead.phone)}</Text>
              </View>
              {lead.email && (
                <View style={styles.infoRow}>
                  <Mail size={14} color={Colors.textTertiary} />
                  <Text style={styles.infoText}>{lead.email}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <MapPin size={14} color={Colors.textTertiary} />
                <Text style={styles.infoText}>{lead.office} · {lead.source}</Text>
              </View>
            </View>

            {/* OWNER ROW */}
            <View style={styles.ownerRow}>
              <User size={14} color={owner ? Colors.primary : Colors.warning} />
              <Text style={[styles.ownerText, !owner && { color: Colors.warning }]}>
                {owner ? owner.name : 'Unassigned'}
              </Text>
              {owner && <Text style={styles.ownerRole}>{owner.role}</Text>}
            </View>
          </View>

          {/* === NEXT ACTION CARD === */}
          {nextActionLabel && (
            <TouchableOpacity
              style={[
                styles.nextActionCard,
                {
                  backgroundColor: urgencyColors[nextActionLabel.urgency].bg,
                  borderColor: urgencyColors[nextActionLabel.urgency].border,
                },
              ]}
              onPress={handleOpenComposer}
              activeOpacity={0.8}
            >
              <View style={styles.nextActionLeft}>
                <Target size={16} color={urgencyColors[nextActionLabel.urgency].icon} />
                <View style={styles.nextActionTextWrap}>
                  <Text style={styles.nextActionTitle}>NEXT ACTION</Text>
                  <Text style={[styles.nextActionBody, { color: urgencyColors[nextActionLabel.urgency].text }]}>
                    {nextActionLabel.action}
                  </Text>
                </View>
              </View>
              <ArrowRight size={16} color={urgencyColors[nextActionLabel.urgency].icon} />
            </TouchableOpacity>
          )}

          {/* === QUICK ACTIONS === */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.qaBtn} onPress={handleCall}>
              <Phone size={18} color="#22C55E" />
              <Text style={[styles.qaText, { color: '#22C55E' }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qaBtn} onPress={handleWhatsApp}>
              <MessageCircle size={18} color="#25D366" />
              <Text style={[styles.qaText, { color: '#25D366' }]}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qaBtn, styles.qaBtnAccent]} onPress={handleOpenComposer}>
              <CalendarPlus size={18} color={Colors.primary} />
              <Text style={[styles.qaText, { color: Colors.primary }]}>Follow-up</Text>
            </TouchableOpacity>
          </View>

          {/* === ACTION BUTTONS === */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
              <ChevronRight size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowActivityForm(!showActivityForm)}>
              <MessageCircle size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={startEdit}>
              <Edit3 size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* === MISSING ITEMS SECTION === */}
          {incomplete && missingFields.length > 0 && (
            <View style={styles.missingSection}>
              <View style={styles.missingSectionHeader}>
                <ShieldAlert size={14} color={Colors.warning} />
                <Text style={styles.missingSectionTitle}>MISSING ITEMS</Text>
              </View>
              <View style={styles.missingList}>
                {missingFields.map((field, idx) => (
                  <View key={idx} style={styles.missingItem}>
                    <CircleDot size={10} color={Colors.warning} />
                    <Text style={styles.missingItemText}>{field}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.missingFixBtn} onPress={startEdit}>
                <Edit3 size={12} color={Colors.warning} />
                <Text style={styles.missingFixText}>Fill missing fields</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* === COMMITMENTS SECTION === */}
          <View style={styles.commitmentsSection}>
            <View style={styles.commitmentsSectionHeader}>
              <Handshake size={14} color={Colors.cyan} />
              <Text style={styles.commitmentsSectionTitle}>COMMITMENTS & PROMISES</Text>
              <TouchableOpacity
                style={styles.addCommitmentBtn}
                onPress={() => setShowCommitmentForm(!showCommitmentForm)}
              >
                <Text style={styles.addCommitmentText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {showCommitmentForm && (
              <View style={styles.commitmentForm}>
                <TextInput
                  style={styles.commitmentInput}
                  value={commitmentNote}
                  onChangeText={setCommitmentNote}
                  placeholder="e.g. Promised to send docs by Friday"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
                <View style={styles.commitmentFormActions}>
                  <TouchableOpacity
                    style={[styles.commitmentSaveBtn, (!commitmentNote.trim() || isSubmitting) && styles.btnDisabled]}
                    onPress={handleAddCommitment}
                    disabled={!commitmentNote.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.commitmentSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowCommitmentForm(false); setCommitmentNote(''); }}>
                    <Text style={styles.commitmentCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {commitments.length === 0 && !showCommitmentForm ? (
              <Text style={styles.emptyCommitmentsText}>No commitments recorded</Text>
            ) : (
              commitments.map(c => (
                <View key={c.id} style={styles.commitmentRow}>
                  <Handshake size={11} color={Colors.cyan} />
                  <View style={styles.commitmentContent}>
                    <Text style={styles.commitmentText}>{c.note}</Text>
                    <Text style={styles.commitmentDate}>{formatDateTime(c.date)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* === EDIT FORM === */}
          {isEditing && (
            <View style={styles.editForm}>
              <View style={styles.editHeader}>
                <Text style={styles.formTitle}>Edit Lead</Text>
                <TouchableOpacity onPress={cancelEdit}>
                  <X size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.editSectionLabel}>CONTACT</Text>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Name</Text>
                <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Phone</Text>
                <TextInput style={styles.editInput} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Assigned To</Text>
                <View style={styles.editChips}>
                  <TouchableOpacity
                    style={[styles.editChip, editOwnerId === null && styles.editChipActive]}
                    onPress={() => setEditOwnerId(null)}
                  >
                    <Text style={[styles.editChipText, editOwnerId === null && styles.editChipTextActive]}>Unassigned</Text>
                  </TouchableOpacity>
                  {assignableUsers.map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.editChip, editOwnerId === u.id && styles.editChipActive]}
                      onPress={() => setEditOwnerId(u.id)}
                    >
                      <Text style={[styles.editChipText, editOwnerId === u.id && styles.editChipTextActive]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.editSectionLabel}>QUOTE & FINANCIALS</Text>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Carrier</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.editChips}>
                    {CARRIERS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.editChip, editCarrier === c && styles.editChipActive]}
                        onPress={() => setEditCarrier(editCarrier === c ? '' : c)}
                      >
                        <Text style={[styles.editChipText, editCarrier === c && styles.editChipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.editFieldRow}>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Amount Due</Text>
                  <TextInput style={styles.editInput} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Quote Price</Text>
                  <TextInput style={styles.editInput} value={editQuotePrice} onChangeText={setEditQuotePrice} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
              <View style={styles.editFieldRow}>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Premium Amount</Text>
                  <TextInput style={styles.editInput} value={editPremiumAmount} onChangeText={setEditPremiumAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Effective Date</Text>
                  <TextInput style={styles.editInput} value={editEffectiveDate} onChangeText={setEditEffectiveDate} placeholder="MM/DD/YYYY" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
              <View style={styles.editFieldRow}>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Down Payment</Text>
                  <TextInput style={styles.editInput} value={editDownPayment} onChangeText={setEditDownPayment} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editLabel}>Monthly Payment</Text>
                  <TextInput style={styles.editInput} value={editMonthlyPayment} onChangeText={setEditMonthlyPayment} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>

              <Text style={styles.editSectionLabel}>NOTES</Text>
              <View style={styles.editField}>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleSaveEdit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Save size={16} color={Colors.white} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* === STATUS PICKER === */}
          {showStatusPicker && (
            <View style={styles.statusPicker}>
              {isSubmitting && <ActivityIndicator color={Colors.primary} style={styles.loader} />}
              {PIPELINE_STATUSES.map(status => {
                const sc = StatusColors[status];
                const isCurrentStatus = status === lead.status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusOption, isCurrentStatus && styles.statusOptionCurrent]}
                    onPress={() => !isCurrentStatus && handleStatusChange(status)}
                    disabled={isCurrentStatus || isSubmitting}
                  >
                    <View style={[styles.statusOptionDot, { backgroundColor: sc?.dot ?? Colors.primary }]} />
                    <Text style={[styles.statusOptionText, isCurrentStatus && { color: Colors.textTertiary }]}>{status}</Text>
                    {isCurrentStatus && <Text style={styles.currentLabel}>current</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* === ACTIVITY FORM === */}
          {showActivityForm && (
            <View style={styles.activityForm}>
              <Text style={styles.formTitle}>Log Activity</Text>
              <View style={styles.typeChips}>
                {ACTIVITY_TYPES.filter(t => t !== 'status_change' && t !== 'follow_up' && t !== 'reassignment' && t !== 'escalation').map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, activityType === type && styles.typeChipActive]}
                    onPress={() => setActivityType(type)}
                  >
                    <Text style={[styles.typeChipText, activityType === type && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.noteInput}
                value={activityNote}
                onChangeText={setActivityNote}
                placeholder="Add a note..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.submitBtn, (!activityNote.trim() || isSubmitting) && styles.btnDisabled]}
                onPress={handleAddActivity}
                disabled={!activityNote.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.submitText}>Save Activity</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* === TABS === */}
          <View style={styles.tabs}>
            {(['details', 'activity', 'followups', 'status'] as Section[]).map(section => (
              <TouchableOpacity
                key={section}
                style={[styles.tab, activeSection === section && styles.tabActive]}
                onPress={() => setActiveSection(section)}
              >
                <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
                  {section === 'followups' ? 'Follow-ups' : section === 'status' ? 'Status' : section.charAt(0).toUpperCase() + section.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeSection === 'details' && (
            <View style={styles.detailsSection}>
              <DetailRow icon={<Clock size={14} color={Colors.textTertiary} />} label="Created" value={formatDateTime(lead.created_at)} />
              <DetailRow icon={<Clock size={14} color={Colors.textTertiary} />} label="Last Touch" value={formatDateTime(lead.last_touch_at)} />
              {lead.quoted_at && <DetailRow icon={<Calendar size={14} color={Colors.info} />} label="Quoted" value={formatDateTime(lead.quoted_at)} />}
              {lead.closed_at && <DetailRow icon={<CheckCircle size={14} color={Colors.success} />} label="Closed" value={formatDateTime(lead.closed_at)} />}
              {lead.next_followup_at && <DetailRow icon={<Calendar size={14} color={Colors.warning} />} label="Next Follow-up" value={formatDateTime(lead.next_followup_at)} />}
              {lead.carrier && <DetailRow icon={<FileText size={14} color={Colors.textTertiary} />} label="Carrier" value={lead.carrier} />}
              {lead.quote_price != null && <DetailRow icon={<DollarSign size={14} color={Colors.cyan} />} label="Quote Price" value={formatCurrency(lead.quote_price)} />}
              {lead.premium_amount != null && <DetailRow icon={<DollarSign size={14} color={Colors.success} />} label="Premium" value={formatCurrency(lead.premium_amount)} />}
              {lead.amount_due != null && <DetailRow icon={<DollarSign size={14} color={Colors.primary} />} label="Le quedó en" value={formatCurrency(lead.amount_due)} />}
              {lead.down_payment != null && <DetailRow icon={<DollarSign size={14} color={Colors.info} />} label="Down Payment" value={formatCurrency(lead.down_payment)} />}
              {lead.monthly_payment != null && <DetailRow icon={<DollarSign size={14} color={Colors.warning} />} label="Monthly" value={formatCurrency(lead.monthly_payment)} />}
              {lead.total_premium != null && <DetailRow icon={<DollarSign size={14} color={Colors.success} />} label="Total Premium" value={formatCurrency(lead.total_premium)} />}
              {lead.effective_date && <DetailRow icon={<Calendar size={14} color={Colors.success} />} label="Effective Date" value={lead.effective_date} />}
              {lead.renewal_date && <DetailRow icon={<Calendar size={14} color={Colors.info} />} label="Renewal" value={formatDate(lead.renewal_date)} />}
              {lead.notes ? (
                <View style={styles.notesBox}>
                  <FileText size={14} color={Colors.textTertiary} />
                  <Text style={styles.notesText}>{lead.notes}</Text>
                </View>
              ) : null}
            </View>
          )}

          {activeSection === 'activity' && (
            <View>
              {leadActivities.length === 0 ? (
                <Text style={styles.emptyTabText}>No activity recorded yet</Text>
              ) : (
                leadActivities.map(a => <ActivityItem key={a.id} activity={a} />)
              )}
            </View>
          )}

          {activeSection === 'followups' && (
            <View style={styles.followUpsSection}>
              {leadFollowUps.length === 0 ? (
                <Text style={styles.emptyTabText}>No follow-ups scheduled</Text>
              ) : (
                leadFollowUps
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                  .map(task => {
                    const isOverdue = !task.completed && new Date(task.scheduled_at) < new Date();
                    return (
                      <View key={task.id} style={[styles.followUpRow, task.completed && styles.followUpDone]}>
                        <TouchableOpacity
                          onPress={() => !task.completed && handleCompleteFollowUp(task.id)}
                          disabled={task.completed}
                          style={styles.followUpCheck}
                        >
                          {task.completed ? (
                            <CheckCircle size={20} color={Colors.success} />
                          ) : isOverdue ? (
                            <XCircle size={20} color={Colors.danger} />
                          ) : (
                            <View style={styles.unchecked} />
                          )}
                        </TouchableOpacity>
                        <View style={styles.followUpInfo}>
                          <Text style={[
                            styles.followUpDate,
                            task.completed && styles.followUpDateDone,
                            isOverdue && !task.completed && { color: Colors.danger },
                          ]}>
                            {formatDateTime(task.scheduled_at)}
                          </Text>
                          {isOverdue && !task.completed && <Text style={styles.overdueLabel}>OVERDUE</Text>}
                          {task.completed && task.completed_at && (
                            <Text style={styles.completedLabel}>Done {formatDateTime(task.completed_at)}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
              )}
            </View>
          )}

          {activeSection === 'status' && (
            <ObservabilityPanel
              lead={lead}
              activities={allActivities}
              followUps={allFollowUps}
              lastActionResult={lastActionResult}
            />
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      {icon}
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  headerBtn: { padding: 4 },

  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incompletePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warning + '33',
  },
  incompletePillText: { color: Colors.warning, fontSize: 10, fontWeight: '700' as const },
  escalationPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  escalationDot: { width: 6, height: 6, borderRadius: 3 },
  escalationText: { fontSize: 11, fontWeight: '700' as const },
  leadName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' as const, marginBottom: 12, letterSpacing: -0.5 },
  infoRows: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: Colors.textSecondary, fontSize: 14 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ownerText: { color: Colors.primary, fontSize: 14, fontWeight: '700' as const },
  ownerRole: { color: Colors.textTertiary, fontSize: 12, textTransform: 'capitalize' as const },

  nextActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  nextActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nextActionTextWrap: { flex: 1 },
  nextActionTitle: { color: Colors.textTertiary, fontSize: 9, fontWeight: '800' as const, letterSpacing: 1, marginBottom: 2 },
  nextActionBody: { fontSize: 13, fontWeight: '600' as const },

  quickActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  qaBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qaBtnAccent: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary + '33' },
  qaText: { fontSize: 12, fontWeight: '700' as const },
  actions: { flexDirection: 'row', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  actionText: { color: Colors.primary, fontSize: 12, fontWeight: '600' as const },

  missingSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.warningMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warning + '22',
    overflow: 'hidden',
  },
  missingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '15',
  },
  missingSectionTitle: { color: Colors.warning, fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.8 },
  missingList: { paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  missingItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missingItemText: { color: Colors.warning, fontSize: 12, fontWeight: '500' as const },
  missingFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.warning + '15',
  },
  missingFixText: { color: Colors.warning, fontSize: 12, fontWeight: '700' as const },

  commitmentsSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  commitmentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commitmentsSectionTitle: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.8, flex: 1 },
  addCommitmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.cyanMuted,
  },
  addCommitmentText: { color: Colors.cyan, fontSize: 11, fontWeight: '700' as const },
  commitmentForm: { paddingHorizontal: 14, paddingVertical: 10 },
  commitmentInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 13,
    minHeight: 50,
  },
  commitmentFormActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  commitmentSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.cyan,
  },
  commitmentSaveText: { color: Colors.white, fontSize: 12, fontWeight: '700' as const },
  commitmentCancelText: { color: Colors.textTertiary, fontSize: 12 },
  emptyCommitmentsText: { color: Colors.textTertiary, fontSize: 12, paddingHorizontal: 14, paddingVertical: 12 },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commitmentContent: { flex: 1 },
  commitmentText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' as const },
  commitmentDate: { color: Colors.textTertiary, fontSize: 10, marginTop: 2 },

  editForm: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  editSectionLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 10,
  },
  formTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' as const },
  editField: { marginBottom: 12 },
  editFieldRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  editFieldHalf: { flex: 1 },
  editLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' as const, marginBottom: 4 },
  editInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  editTextArea: { minHeight: 60, paddingTop: 10 },
  editChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  editChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' as const },
  editChipTextActive: { color: Colors.primary },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  statusPicker: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  loader: { marginBottom: 8 },
  statusOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, gap: 10, marginBottom: 4 },
  statusOptionCurrent: { backgroundColor: Colors.surface },
  statusOptionDot: { width: 8, height: 8, borderRadius: 4 },
  statusOptionText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' as const, flex: 1 },
  currentLabel: { color: Colors.textTertiary, fontSize: 11, fontStyle: 'italic' as const },
  activityForm: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  typeChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' as const, textTransform: 'capitalize' as const },
  typeChipTextActive: { color: Colors.primary },
  noteInput: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14, color: Colors.textPrimary, fontSize: 14, minHeight: 80, marginBottom: 12 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 4 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: Colors.transparent },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textTertiary, fontSize: 13, fontWeight: '600' as const },
  tabTextActive: { color: Colors.primary },
  detailsSection: { padding: 16, gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { color: Colors.textTertiary, fontSize: 13, width: 100 },
  detailValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' as const, flex: 1 },
  notesBox: { flexDirection: 'row', gap: 10, paddingVertical: 14, alignItems: 'flex-start' },
  notesText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
  emptyTabText: { color: Colors.textTertiary, fontSize: 14, textAlign: 'center' as const, paddingVertical: 40 },
  followUpsSection: { padding: 16 },
  followUpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  followUpDone: { opacity: 0.5 },
  followUpCheck: { padding: 2 },
  unchecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.textTertiary },
  followUpInfo: { flex: 1 },
  followUpDate: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' as const },
  followUpDateDone: { textDecorationLine: 'line-through' as const, color: Colors.textTertiary },
  overdueLabel: { color: Colors.danger, fontSize: 10, fontWeight: '700' as const, marginTop: 2 },
  completedLabel: { color: Colors.success, fontSize: 11, marginTop: 2 },
  bottomPad: { height: 40 },
});
