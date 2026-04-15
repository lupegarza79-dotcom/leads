import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  Building2,
  Clock,
  AlertTriangle,
  Mail,
  MessageCircle,
  Users,
  LogOut,
  User,
  Zap,
  Shield,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { OFFICES, NOTIFICATION_CHANNELS } from '@/constants/config';
import { useAuth } from '@/providers/AuthProvider';
import { useLeads } from '@/providers/LeadsProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { ActionToast, type ToastType } from '@/components/ActionToast';

type ExpandedSection = string | null;

export default function SettingsScreen() {
  const { user, appUser, signOut, signOutPending } = useAuth();
  const { mgUsers } = useLeads();
  const { settings, updateSettings, resetSettings, isSaving } = useSettings();

  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastMsg, setToastMsg] = useState('');

  const [editSLA, setEditSLA] = useState({ ...settings.sla });
  const [editEscalation, setEditEscalation] = useState({ ...settings.escalation });
  const [editFollowUpDays, setEditFollowUpDays] = useState(settings.followUpScheduleDays.join(', '));
  const [editAutoFU, setEditAutoFU] = useState(settings.autoFollowUpEnabled);
  const [editAutoFUDays, setEditAutoFUDays] = useState(String(settings.autoFollowUpDefaultDays));

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateBody, setEditTemplateBody] = useState('');

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpanded(prev => prev === section ? null : section);
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.log('[Settings] Sign out error:', e);
          }
        },
      },
    ]);
  };

  const handleSaveSLA = useCallback(async () => {
    try {
      await updateSettings({ sla: editSLA });
      showToast('success', 'SLA thresholds saved');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to save');
    }
  }, [editSLA, updateSettings, showToast]);

  const handleSaveEscalation = useCallback(async () => {
    try {
      await updateSettings({ escalation: editEscalation });
      showToast('success', 'Escalation thresholds saved');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to save');
    }
  }, [editEscalation, updateSettings, showToast]);

  const handleSaveFollowUp = useCallback(async () => {
    try {
      const days = editFollowUpDays.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      if (days.length === 0) {
        showToast('error', 'Enter at least one follow-up day');
        return;
      }
      await updateSettings({
        followUpScheduleDays: days,
        autoFollowUpEnabled: editAutoFU,
        autoFollowUpDefaultDays: parseInt(editAutoFUDays, 10) || 1,
      });
      showToast('success', 'Follow-up settings saved');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to save');
    }
  }, [editFollowUpDays, editAutoFU, editAutoFUDays, updateSettings, showToast]);

  const handleAddTemplate = useCallback(async () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) {
      showToast('error', 'Name and body are required');
      return;
    }
    try {
      const newTemplate = {
        id: `tpl_${Date.now()}`,
        name: newTemplateName.trim(),
        body: newTemplateBody.trim(),
      };
      await updateSettings({
        whatsappTemplates: [...settings.whatsappTemplates, newTemplate],
      });
      setNewTemplateName('');
      setNewTemplateBody('');
      showToast('success', 'Template added');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to add template');
    }
  }, [newTemplateName, newTemplateBody, settings.whatsappTemplates, updateSettings, showToast]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    Alert.alert('Delete Template', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateSettings({
              whatsappTemplates: settings.whatsappTemplates.filter(t => t.id !== id),
            });
            showToast('success', 'Template deleted');
          } catch (e: any) {
            showToast('error', e?.message ?? 'Failed to delete');
          }
        },
      },
    ]);
  }, [settings.whatsappTemplates, updateSettings, showToast]);

  const handleSaveTemplateEdit = useCallback(async (id: string) => {
    try {
      await updateSettings({
        whatsappTemplates: settings.whatsappTemplates.map(t =>
          t.id === id ? { ...t, body: editTemplateBody.trim() } : t
        ),
      });
      setEditingTemplateId(null);
      setEditTemplateBody('');
      showToast('success', 'Template updated');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Failed to update');
    }
  }, [editTemplateBody, settings.whatsappTemplates, updateSettings, showToast]);

  const handleResetAll = useCallback(() => {
    Alert.alert('Reset Settings', 'This will reset all settings to defaults. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetSettings();
          setEditSLA({ ...settings.sla });
          setEditEscalation({ ...settings.escalation });
          setEditFollowUpDays(settings.followUpScheduleDays.join(', '));
          showToast('success', 'Settings reset to defaults');
        },
      },
    ]);
  }, [resetSettings, settings, showToast]);

  const SectionHeader = ({ icon, title, section, accent }: { icon: React.ReactNode; title: string; section: string; accent?: string }) => (
    <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section)} activeOpacity={0.7}>
      <View style={styles.sectionHeaderLeft}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {expanded === section
        ? <ChevronUp size={16} color={accent ?? Colors.textTertiary} />
        : <ChevronDown size={16} color={accent ?? Colors.textTertiary} />
      }
    </TouchableOpacity>
  );

  return (
    <View style={styles.flex}>
      <ActionToast visible={toastVisible} type={toastType} message={toastMsg} onDismiss={() => setToastVisible(false)} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* USER */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderStatic}>
            <User size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Current User</Text>
          </View>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{appUser?.name?.charAt(0) ?? '?'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{appUser?.name ?? 'Unknown'}</Text>
              <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
              <Text style={styles.userRole}>{appUser?.role ?? 'user'} · {appUser?.office ?? ''}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signOutPending}>
            {signOutPending ? (
              <ActivityIndicator color={Colors.danger} size="small" />
            ) : (
              <>
                <LogOut size={16} color={Colors.danger} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* SLA THRESHOLDS */}
        <View style={styles.section}>
          <SectionHeader
            icon={<AlertTriangle size={16} color={Colors.warning} />}
            title="SLA Thresholds"
            section="sla"
            accent={Colors.warning}
          />
          {expanded === 'sla' && (
            <View style={styles.sectionBody}>
              <NumberField
                label="New Lead Alert (min)"
                value={editSLA.newLeadAlertMinutes}
                onChange={v => setEditSLA(prev => ({ ...prev, newLeadAlertMinutes: v }))}
              />
              <NumberField
                label="New Lead Escalate (min)"
                value={editSLA.newLeadEscalateMinutes}
                onChange={v => setEditSLA(prev => ({ ...prev, newLeadEscalateMinutes: v }))}
              />
              <NumberField
                label="Quoted Alert (hrs)"
                value={editSLA.quotedAlertHours}
                onChange={v => setEditSLA(prev => ({ ...prev, quotedAlertHours: v }))}
              />
              <NumberField
                label="Quoted Escalate (hrs)"
                value={editSLA.quotedEscalateHours}
                onChange={v => setEditSLA(prev => ({ ...prev, quotedEscalateHours: v }))}
              />
              <NumberField
                label="Overdue Consecutive to Escalate"
                value={editSLA.followUpOverdueConsecutiveEscalate}
                onChange={v => setEditSLA(prev => ({ ...prev, followUpOverdueConsecutiveEscalate: v }))}
              />
              <TouchableOpacity style={styles.sectionSaveBtn} onPress={handleSaveSLA} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <>
                    <Save size={14} color={Colors.white} />
                    <Text style={styles.sectionSaveText}>Save SLA</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ESCALATION THRESHOLDS */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Shield size={16} color={Colors.danger} />}
            title="Escalation Thresholds"
            section="escalation"
            accent={Colors.danger}
          />
          {expanded === 'escalation' && (
            <View style={styles.sectionBody}>
              <NumberField
                label="Due Soon (min before due)"
                value={editEscalation.dueSoonMinutes}
                onChange={v => setEditEscalation(prev => ({ ...prev, dueSoonMinutes: v }))}
              />
              <NumberField
                label="Overdue (min after due)"
                value={editEscalation.overdueMinutes}
                onChange={v => setEditEscalation(prev => ({ ...prev, overdueMinutes: v }))}
              />
              <NumberField
                label="Escalated (min after due)"
                value={editEscalation.escalatedMinutes}
                onChange={v => setEditEscalation(prev => ({ ...prev, escalatedMinutes: v }))}
              />
              <TouchableOpacity style={styles.sectionSaveBtn} onPress={handleSaveEscalation} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <>
                    <Save size={14} color={Colors.white} />
                    <Text style={styles.sectionSaveText}>Save Escalation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* FOLLOW-UP SCHEDULE */}
        <View style={styles.section}>
          <SectionHeader
            icon={<CalendarClock size={16} color={Colors.primary} />}
            title="Follow-up & Auto Actions"
            section="followup"
            accent={Colors.primary}
          />
          {expanded === 'followup' && (
            <View style={styles.sectionBody}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Schedule Days (after quote)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editFollowUpDays}
                  onChangeText={setEditFollowUpDays}
                  placeholder="1, 3, 7"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <Text style={styles.fieldHint}>Comma-separated days: e.g. 1, 3, 7</Text>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setEditAutoFU(!editAutoFU)}
                activeOpacity={0.7}
              >
                <View style={styles.toggleLeft}>
                  {editAutoFU
                    ? <ToggleRight size={22} color={Colors.success} />
                    : <ToggleLeft size={22} color={Colors.textTertiary} />
                  }
                  <Text style={styles.toggleLabel}>Auto-set follow-up for new leads</Text>
                </View>
              </TouchableOpacity>

              {editAutoFU && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Default follow-up (biz days)</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputSmall]}
                    value={editAutoFUDays}
                    onChangeText={setEditAutoFUDays}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              )}

              <TouchableOpacity style={styles.sectionSaveBtn} onPress={handleSaveFollowUp} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <>
                    <Save size={14} color={Colors.white} />
                    <Text style={styles.sectionSaveText}>Save Follow-up Settings</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* WHATSAPP TEMPLATES */}
        <View style={styles.section}>
          <SectionHeader
            icon={<MessageCircle size={16} color="#25D366" />}
            title="WhatsApp Templates"
            section="templates"
            accent="#25D366"
          />
          {expanded === 'templates' && (
            <View style={styles.sectionBody}>
              {settings.whatsappTemplates.map(tpl => (
                <View key={tpl.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateName}>{tpl.name}</Text>
                    <View style={styles.templateActions}>
                      {editingTemplateId === tpl.id ? (
                        <TouchableOpacity onPress={() => handleSaveTemplateEdit(tpl.id)}>
                          <Save size={14} color={Colors.success} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => { setEditingTemplateId(tpl.id); setEditTemplateBody(tpl.body); }}>
                          <Text style={styles.templateEditBtn}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 size={14} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {editingTemplateId === tpl.id ? (
                    <TextInput
                      style={styles.templateEditInput}
                      value={editTemplateBody}
                      onChangeText={setEditTemplateBody}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  ) : (
                    <Text style={styles.templateBody}>{tpl.body}</Text>
                  )}
                  <Text style={styles.templateVars}>Variables: {'{name}'}, {'{amount}'}, {'{date}'}</Text>
                </View>
              ))}

              <View style={styles.addTemplateForm}>
                <Text style={styles.addTemplateTitle}>Add Template</Text>
                <TextInput
                  style={styles.templateNameInput}
                  value={newTemplateName}
                  onChangeText={setNewTemplateName}
                  placeholder="Template name"
                  placeholderTextColor={Colors.textTertiary}
                />
                <TextInput
                  style={styles.templateBodyInput}
                  value={newTemplateBody}
                  onChangeText={setNewTemplateBody}
                  placeholder="Message body..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.addTemplateBtn, (!newTemplateName.trim() || !newTemplateBody.trim()) && styles.btnDisabled]}
                  onPress={handleAddTemplate}
                  disabled={!newTemplateName.trim() || !newTemplateBody.trim()}
                >
                  <Plus size={14} color={Colors.white} />
                  <Text style={styles.addTemplateBtnText}>Add Template</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* BUSINESS HOURS */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Clock size={16} color={Colors.primary} />}
            title="Business Hours"
            section="hours"
            accent={Colors.primary}
          />
          {expanded === 'hours' && (
            <View style={styles.sectionBody}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                const config = settings.businessHours[i];
                return (
                  <View key={day} style={styles.hoursRow}>
                    <Text style={styles.hoursDay}>{day}</Text>
                    <Text style={[styles.hoursTime, !config && { color: Colors.textTertiary }]}>
                      {config ? `${config.open} – ${config.close}` : 'Closed'}
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.fieldHint}>Business hours are currently read-only. Contact admin to change.</Text>
            </View>
          )}
        </View>

        {/* TEAM */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Users size={16} color={Colors.primary} />}
            title={`Team (${mgUsers.length})`}
            section="team"
          />
          {expanded === 'team' && (
            <View style={styles.sectionBody}>
              {mgUsers.length === 0 ? (
                <Text style={styles.emptyText}>No users loaded</Text>
              ) : (
                mgUsers.map(u => (
                  <View key={u.id} style={styles.teamRow}>
                    <View style={styles.teamAvatar}>
                      <Text style={styles.teamAvatarText}>{u.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{u.name}</Text>
                      <Text style={styles.teamMeta}>{u.role} · {u.office}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* OFFICES */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Building2 size={16} color={Colors.primary} />}
            title="Offices"
            section="offices"
          />
          {expanded === 'offices' && (
            <View style={styles.sectionBody}>
              {OFFICES.map(office => (
                <View key={office} style={styles.officeRow}>
                  <Text style={styles.officeText}>{office}</Text>
                  {office === 'San Juan' && <Text style={styles.officeWarn}>Transitional</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* NOTIFICATION CHANNELS */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Zap size={16} color={Colors.info} />}
            title="Notification Channels"
            section="notifications"
          />
          {expanded === 'notifications' && (
            <View style={styles.sectionBody}>
              <View style={styles.notifGroup}>
                <View style={styles.notifGroupHeader}>
                  <MessageCircle size={12} color="#25D366" />
                  <Text style={styles.notifGroupTitle}>WhatsApp</Text>
                </View>
                <ConfigRow label="Primary" value={NOTIFICATION_CHANNELS.whatsapp.primary} />
                <ConfigRow label="Escalation" value={NOTIFICATION_CHANNELS.whatsapp.escalation} />
              </View>
              <View style={styles.notifGroup}>
                <View style={styles.notifGroupHeader}>
                  <Mail size={12} color={Colors.info} />
                  <Text style={styles.notifGroupTitle}>Email Recipients</Text>
                </View>
                {NOTIFICATION_CHANNELS.email.recipients.map(emailAddr => (
                  <View key={emailAddr} style={styles.notifRow}>
                    <Text style={styles.notifRowText}>{emailAddr}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* RESET */}
        <TouchableOpacity style={styles.resetBtn} onPress={handleResetAll}>
          <RotateCcw size={14} color={Colors.danger} />
          <Text style={styles.resetBtnText}>Reset All Settings to Defaults</Text>
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <Text style={styles.versionText}>MG Leads Engine v1.1.0</Text>
          <Text style={styles.versionSub}>WhatsApp-First Follow-Up OS</Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, styles.fieldInputSmall]}
        value={String(value)}
        onChangeText={t => {
          const n = parseInt(t, 10);
          if (!isNaN(n)) onChange(n);
          else if (t === '') onChange(0);
        }}
        keyboardType="numeric"
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.notifRow}>
      <Text style={styles.notifRowLabel}>{label}</Text>
      <Text style={styles.notifRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12 },

  section: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: Colors.surfaceElevated,
  },
  sectionHeaderStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' as const },
  sectionBody: { padding: 14, gap: 10 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: Colors.primary, fontSize: 18, fontWeight: '800' as const },
  userInfo: { flex: 1 },
  userName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' as const },
  userEmail: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  userRole: { color: Colors.textTertiary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' as const },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { color: Colors.danger, fontSize: 14, fontWeight: '600' as const },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  fieldInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 14,
    textAlign: 'right' as const,
    minWidth: 120,
  },
  fieldInputSmall: { minWidth: 70, maxWidth: 80 },
  fieldHint: { color: Colors.textTertiary, fontSize: 11, fontStyle: 'italic' as const, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' as const },

  sectionSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  sectionSaveText: { color: Colors.white, fontSize: 13, fontWeight: '700' as const },
  btnDisabled: { opacity: 0.4 },

  templateCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  templateName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' as const },
  templateActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateEditBtn: { color: Colors.primary, fontSize: 12, fontWeight: '600' as const },
  templateBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  templateEditInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 12,
    minHeight: 60,
  },
  templateVars: { color: Colors.textTertiary, fontSize: 10, marginTop: 6, fontStyle: 'italic' as const },

  addTemplateForm: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 8,
  },
  addTemplateTitle: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  templateNameInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  templateBodyInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 13,
    minHeight: 60,
  },
  addTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#25D366',
  },
  addTemplateBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' as const },

  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hoursDay: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' as const },
  hoursTime: { color: Colors.textSecondary, fontSize: 13 },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  teamAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: { color: Colors.primary, fontSize: 13, fontWeight: '700' as const },
  teamInfo: { flex: 1 },
  teamName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' as const },
  teamMeta: { color: Colors.textTertiary, fontSize: 11, marginTop: 1 },
  emptyText: { color: Colors.textTertiary, fontSize: 13, fontStyle: 'italic' as const },

  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  officeText: { color: Colors.textPrimary, fontSize: 13 },
  officeWarn: { color: Colors.warning, fontSize: 11, fontWeight: '600' as const },

  notifGroup: { marginBottom: 8 },
  notifGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notifGroupTitle: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingLeft: 18,
  },
  notifRowText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  notifRowLabel: { color: Colors.textTertiary, fontSize: 12 },
  notifRowValue: { color: Colors.primary, fontSize: 12, fontWeight: '600' as const },

  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.danger + '33',
  },
  resetBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '600' as const },

  versionRow: { alignItems: 'center', paddingVertical: 16 },
  versionText: { color: Colors.textTertiary, fontSize: 13, fontWeight: '600' as const },
  versionSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  bottomPad: { height: 40 },
});
