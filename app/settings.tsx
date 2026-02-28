import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Building2, Clock, AlertTriangle, Mail, MessageCircle, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { OFFICES, USERS, SLA_THRESHOLDS, WORKING_HOURS, NOTIFICATION_CHANNELS, FOLLOW_UP_SCHEDULE_DAYS } from '@/constants/config';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Building2 size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Offices</Text>
        </View>
        {OFFICES.map(office => (
          <View key={office} style={styles.row}>
            <Text style={styles.rowText}>{office}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Users</Text>
        </View>
        {USERS.map(user => (
          <View key={user.id} style={styles.row}>
            <Text style={styles.rowText}>{user.name}</Text>
            <Text style={styles.rowMeta}>{user.role} · {user.office}</Text>
          </View>
        ))}
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
        {NOTIFICATION_CHANNELS.email.recipients.map(email => (
          <View key={email} style={styles.row}>
            <Text style={styles.rowText}>{email}</Text>
          </View>
        ))}
      </View>

      <View style={styles.versionRow}>
        <Text style={styles.versionText}>MG Leads Engine v1.0.0</Text>
        <Text style={styles.versionSub}>Single-tenant · MG Offices</Text>
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
  rowMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
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
