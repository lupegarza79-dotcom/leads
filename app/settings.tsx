import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Building2, Clock, AlertTriangle, Mail, MessageCircle, Users, LogOut, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { OFFICES, SLA_THRESHOLDS, WORKING_HOURS, NOTIFICATION_CHANNELS, FOLLOW_UP_SCHEDULE_DAYS } from '@/constants/config';
import { useAuth } from '@/providers/AuthProvider';
import { useLeads } from '@/providers/LeadsProvider';

export default function SettingsScreen() {
  const { user, appUser, signOut, signOutPending } = useAuth();
  const { mgUsers } = useLeads();

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Current User</Text>
        </View>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {appUser?.name?.charAt(0) ?? '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{appUser?.name ?? 'Unknown'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
            <Text style={styles.userRole}>{appUser?.role ?? 'user'} · {appUser?.office ?? ''}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signOutPending}
        >
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Building2 size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Offices</Text>
        </View>
        {OFFICES.map(office => (
          <View key={office} style={styles.row}>
            <Text style={styles.rowText}>{office}</Text>
            {office === 'San Juan' && (
              <Text style={styles.rowMetaWarn}>Transitional</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Team (from mg_users)</Text>
        </View>
        {mgUsers.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.rowTextMuted}>No users loaded from Supabase</Text>
          </View>
        ) : (
          mgUsers.map(u => (
            <View key={u.id} style={styles.row}>
              <Text style={styles.rowText}>{u.name}</Text>
              <Text style={styles.rowMeta}>{u.role} · {u.office}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Clock size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Working Hours</Text>
        </View>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
          const config = WORKING_HOURS[i];
          return (
            <View key={day} style={styles.row}>
              <Text style={styles.rowText}>{day}</Text>
              <Text style={[styles.rowMeta, !config && { color: Colors.textTertiary }]}>
                {config ? `${config.open} – ${config.close}` : 'Closed'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AlertTriangle size={16} color={Colors.warning} />
          <Text style={styles.sectionTitle}>SLA Thresholds</Text>
        </View>
        <ConfigRow label="New Lead Alert" value={`${SLA_THRESHOLDS.newLeadAlertMinutes} min`} />
        <ConfigRow label="New Lead Escalate" value={`${SLA_THRESHOLDS.newLeadEscalateMinutes} min`} />
        <ConfigRow label="Quoted Alert" value={`${SLA_THRESHOLDS.quotedAlertHours} hrs`} />
        <ConfigRow label="Quoted Escalate" value={`${SLA_THRESHOLDS.quotedEscalateHours} hrs`} />
        <ConfigRow label="Overdue to Escalate" value={`${SLA_THRESHOLDS.followUpOverdueConsecutiveEscalate} consecutive`} />
        <ConfigRow label="Follow-up Schedule" value={FOLLOW_UP_SCHEDULE_DAYS.map(d => `+${d}d`).join(', ')} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MessageCircle size={16} color={Colors.success} />
          <Text style={styles.sectionTitle}>WhatsApp Channels</Text>
        </View>
        <ConfigRow label="Primary" value={NOTIFICATION_CHANNELS.whatsapp.primary} />
        <ConfigRow label="Escalation" value={NOTIFICATION_CHANNELS.whatsapp.escalation} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Mail size={16} color={Colors.info} />
          <Text style={styles.sectionTitle}>Email Recipients</Text>
        </View>
        {NOTIFICATION_CHANNELS.email.recipients.map(emailAddr => (
          <View key={emailAddr} style={styles.row}>
            <Text style={styles.rowText}>{emailAddr}</Text>
          </View>
        ))}
      </View>

      <View style={styles.versionRow}>
        <Text style={styles.versionText}>MG Leads Engine v1.0.0</Text>
        <Text style={styles.versionSub}>Single-tenant · MG Offices · Supabase</Text>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  userAvatarText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  userEmail: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  userRole: {
    color: Colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize' as const,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowText: {
    color: Colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  rowTextMuted: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontStyle: 'italic' as const,
  },
  rowMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  rowMetaWarn: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  rowValue: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  versionRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  versionSub: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  bottomPad: {
    height: 40,
  },
});
