import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
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
} from 'lucide-react-native';
import { Colors, StatusColors } from '@/constants/colors';
import { PIPELINE_STATUSES, ACTIVITY_TYPES } from '@/constants/config';
import type { PipelineStatus, ActivityType } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { StatusBadge } from '@/components/StatusBadge';
import { ActivityItem } from '@/components/ActivityItem';
import { formatPhone, formatDateTime, formatDate, formatCurrency } from '@/utils/formatters';
import { getLeadSLAStatus } from '@/utils/sla-engine';

type Section = 'details' | 'activity' | 'followups';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getLeadById,
    getActivitiesForLead,
    getFollowUpsForLead,
    changeStatus,
    addActivity,
    completeFollowUp,
    followUps: allFollowUps,
    getUserById,
  } = useLeads();

  const lead = getLeadById(id ?? '');
  const leadActivities = getActivitiesForLead(id ?? '');
  const leadFollowUps = getFollowUpsForLead(id ?? '');

  const [activeSection, setActiveSection] = useState<Section>('details');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('call');
  const [activityNote, setActivityNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slaStatus = useMemo(() => {
    if (!lead) return 'ok';
    return getLeadSLAStatus(lead, allFollowUps);
  }, [lead, allFollowUps]);

  const owner = useMemo(() => getUserById(lead?.owner_id ?? null), [lead?.owner_id, getUserById]);

  const handleStatusChange = useCallback(async (status: PipelineStatus) => {
    if (!lead) return;
    setIsSubmitting(true);
    try {
      await changeStatus({ id: lead.id, status, userId: lead.owner_id ?? 'system' });
      setShowStatusPicker(false);
      console.log(`[LeadDetail] Status changed to ${status}`);
    } catch (_err) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  }, [lead, changeStatus]);

  const handleAddActivity = useCallback(async () => {
    if (!lead || !activityNote.trim()) return;
    setIsSubmitting(true);
    try {
      await addActivity({
        lead_id: lead.id,
        user_id: lead.owner_id ?? 'system',
        type: activityType,
        note: activityNote.trim(),
      });
      setActivityNote('');
      setShowActivityForm(false);
      setActiveSection('activity');
      console.log(`[LeadDetail] Activity added: ${activityType}`);
    } catch (_err) {
      Alert.alert('Error', 'Failed to log activity');
    } finally {
      setIsSubmitting(false);
    }
  }, [lead, activityType, activityNote, addActivity]);

  const handleCompleteFollowUp = useCallback(async (taskId: string) => {
    try {
      await completeFollowUp(taskId);
      console.log(`[LeadDetail] Follow-up completed: ${taskId}`);
    } catch (_err) {
      Alert.alert('Error', 'Failed to complete follow-up');
    }
  }, [completeFollowUp]);

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Lead not found</Text>
      </View>
    );
  }

  const slaColor = slaStatus === 'escalated' ? Colors.danger
    : slaStatus === 'critical' ? Colors.warning
    : slaStatus === 'warning' ? Colors.warning
    : Colors.success;

  return (
    <>
      <Stack.Screen options={{ title: lead.full_name }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <StatusBadge status={lead.status} />
            <View style={[styles.slaPill, { backgroundColor: slaColor + '1A' }]}>
              <View style={[styles.slaDot, { backgroundColor: slaColor }]} />
              <Text style={[styles.slaText, { color: slaColor }]}>
                {slaStatus === 'ok' ? 'Healthy' : slaStatus.toUpperCase()}
              </Text>
            </View>
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
              <Text style={styles.infoText}>{lead.office} Office</Text>
            </View>
            {owner && (
              <View style={styles.infoRow}>
                <Text style={styles.ownerLabel}>Assigned:</Text>
                <Text style={styles.ownerName}>{owner.name}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
          >
            <ChevronRight size={16} color={Colors.primary} />
            <Text style={styles.actionText}>Change Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowActivityForm(!showActivityForm)}
          >
            <MessageCircle size={16} color={Colors.primary} />
            <Text style={styles.actionText}>Log Activity</Text>
          </TouchableOpacity>
        </View>

        {showStatusPicker && (
          <View style={styles.statusPicker}>
            {isSubmitting && <ActivityIndicator color={Colors.primary} style={styles.loader} />}
            {PIPELINE_STATUSES.map(status => {
              const sc = StatusColors[status];
              const isCurrentStatus = status === lead.status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    isCurrentStatus && styles.statusOptionCurrent,
                  ]}
                  onPress={() => !isCurrentStatus && handleStatusChange(status)}
                  disabled={isCurrentStatus || isSubmitting}
                >
                  <View style={[styles.statusOptionDot, { backgroundColor: sc?.dot ?? Colors.primary }]} />
                  <Text style={[
                    styles.statusOptionText,
                    isCurrentStatus && { color: Colors.textTertiary },
                  ]}>
                    {status}
                  </Text>
                  {isCurrentStatus && <Text style={styles.currentLabel}>current</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {showActivityForm && (
          <View style={styles.activityForm}>
            <Text style={styles.formTitle}>Log Activity</Text>
            <View style={styles.typeChips}>
              {ACTIVITY_TYPES.filter(t => t !== 'status_change').map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, activityType === type && styles.typeChipActive]}
                  onPress={() => setActivityType(type)}
                >
                  <Text style={[styles.typeChipText, activityType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
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
              style={[styles.submitBtn, (!activityNote.trim() || isSubmitting) && styles.submitBtnDisabled]}
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

        <View style={styles.tabs}>
          {(['details', 'activity', 'followups'] as Section[]).map(section => (
            <TouchableOpacity
              key={section}
              style={[styles.tab, activeSection === section && styles.tabActive]}
              onPress={() => setActiveSection(section)}
            >
              <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
                {section === 'followups' ? 'Follow-ups' : section.charAt(0).toUpperCase() + section.slice(1)}
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
            {lead.premium_amount != null && <DetailRow icon={<DollarSign size={14} color={Colors.success} />} label="Premium" value={formatCurrency(lead.premium_amount)} />}
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
                        {isOverdue && !task.completed && (
                          <Text style={styles.overdueLabel}>OVERDUE</Text>
                        )}
                        {task.completed && task.completed_at && (
                          <Text style={styles.completedLabel}>
                            Done {formatDateTime(task.completed_at)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })
            )}
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  slaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  slaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  slaText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  leadName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  infoRows: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  ownerLabel: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  ownerName: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  actionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusPicker: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  loader: {
    marginBottom: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 10,
    marginBottom: 4,
  },
  statusOptionCurrent: {
    backgroundColor: Colors.surface,
  },
  statusOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOptionText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  currentLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontStyle: 'italic' as const,
  },
  activityForm: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  formTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  typeChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
    textTransform: 'capitalize' as const,
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.transparent,
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  detailsSection: {
    padding: 16,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textTertiary,
    fontSize: 13,
    width: 100,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  notesBox: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  notesText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  emptyTabText: {
    color: Colors.textTertiary,
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 40,
  },
  followUpsSection: {
    padding: 16,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  followUpDone: {
    opacity: 0.5,
  },
  followUpCheck: {
    padding: 2,
  },
  unchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
  },
  followUpInfo: {
    flex: 1,
  },
  followUpDate: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  followUpDateDone: {
    textDecorationLine: 'line-through' as const,
    color: Colors.textTertiary,
  },
  overdueLabel: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  completedLabel: {
    color: Colors.success,
    fontSize: 11,
    marginTop: 2,
  },
  bottomPad: {
    height: 40,
  },
});
