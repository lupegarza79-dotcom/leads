import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  Target,
  Zap,
  Phone,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  Timer,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLeads } from '@/providers/LeadsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { MetricCard } from '@/components/MetricCard';
import { formatCurrency, formatPhone } from '@/utils/formatters';
import { isWithinBusinessHours } from '@/utils/business-hours';
import { getEscalationState, formatEscalationTime } from '@/utils/escalation';
import type { EscalationState } from '@/utils/escalation';
import { useResponsive } from '@/hooks/useResponsive';
import type { Lead } from '@/types/leads';

type DashboardView = 'my_items' | 'all_items' | 'manager';

interface EscalationBucket {
  state: EscalationState;
  leads: Lead[];
}

export default function DashboardScreen() {
  const router = useRouter();
  const { metrics, leads, activities, mgUsers, getUserById } = useLeads();
  const { appUser } = useAuth();
  const isOpen = isWithinBusinessHours();
  const { isWide, isDesktop } = useResponsive();

  const isProducer = appUser?.role === 'producer';

  const defaultView: DashboardView = isProducer ? 'my_items' : 'all_items';
  const [view, setView] = useState<DashboardView>(defaultView);

  const producers = mgUsers.filter(u => u.role === 'producer');

  const conversionColor = metrics.conversionPercent >= 20
    ? Colors.success
    : metrics.conversionPercent >= 13
    ? Colors.warning
    : Colors.danger;

  const escalationBuckets = useMemo((): EscalationBucket[] => {
    const activeLeads = leads.filter(l => l.status !== 'Closed' && l.status !== 'Lost');
    const filteredLeads = view === 'my_items' && appUser?.id
      ? activeLeads.filter(l => l.owner_id === appUser.id)
      : activeLeads;

    const buckets: Record<EscalationState, Lead[]> = {
      escalated: [],
      overdue: [],
      due_now: [],
      due_soon: [],
      healthy: [],
      incomplete: [],
    };

    filteredLeads.forEach(lead => {
      const state = getEscalationState(lead, activities);
      buckets[state].push(lead);
    });

    return [
      { state: 'escalated', leads: buckets.escalated },
      { state: 'overdue', leads: buckets.overdue },
      { state: 'due_now', leads: buckets.due_now },
      { state: 'due_soon', leads: buckets.due_soon },
      { state: 'incomplete', leads: buckets.incomplete },
    ];
  }, [leads, activities, view, appUser?.id]);

  const escalatedCount = escalationBuckets.find(b => b.state === 'escalated')?.leads.length ?? 0;
  const overdueCount = escalationBuckets.find(b => b.state === 'overdue')?.leads.length ?? 0;
  const dueNowCount = escalationBuckets.find(b => b.state === 'due_now')?.leads.length ?? 0;
  const dueSoonCount = escalationBuckets.find(b => b.state === 'due_soon')?.leads.length ?? 0;
  const incompleteCount = escalationBuckets.find(b => b.state === 'incomplete')?.leads.length ?? 0;
  const actionNeeded = escalatedCount + overdueCount + dueNowCount;

  const handleLeadPress = useCallback((id: string) => {
    router.push(`/lead/${id}`);
  }, [router]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: isOpen ? Colors.success : Colors.textTertiary }]} />
          <Text style={styles.statusText}>
            {isOpen ? 'Office Hours — Active' : 'After Hours — Queued'}
          </Text>
          {actionNeeded > 0 && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>{actionNeeded} need action</Text>
            </View>
          )}
        </View>

        <View style={[styles.viewToggle, isWide && styles.viewToggleWide]}>
          {isProducer && (
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'my_items' && styles.toggleBtnActive]}
              onPress={() => setView('my_items')}
            >
              <Text style={[styles.toggleText, view === 'my_items' && styles.toggleTextActive]}>My Items</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'all_items' && styles.toggleBtnActive]}
            onPress={() => setView('all_items')}
          >
            <Text style={[styles.toggleText, view === 'all_items' && styles.toggleTextActive]}>All Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'manager' && styles.toggleBtnActive]}
            onPress={() => setView('manager')}
          >
            <Text style={[styles.toggleText, view === 'manager' && styles.toggleTextActive]}>Manager</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
        <View style={[styles.row, isDesktop && styles.rowDesktop]}>
          <MetricCard
            label="Escalated"
            value={escalatedCount}
            color={escalatedCount > 0 ? '#DC2626' : Colors.success}
            icon={<ShieldAlert size={14} color={escalatedCount > 0 ? '#DC2626' : Colors.success} />}
          />
          <MetricCard
            label="Overdue"
            value={overdueCount}
            color={overdueCount > 0 ? Colors.danger : Colors.success}
            icon={<AlertTriangle size={14} color={overdueCount > 0 ? Colors.danger : Colors.success} />}
          />
          <MetricCard
            label="Due Now"
            value={dueNowCount}
            color={dueNowCount > 0 ? '#F97316' : Colors.success}
            icon={<AlertCircle size={14} color={dueNowCount > 0 ? '#F97316' : Colors.success} />}
          />
          <MetricCard
            label="Due Soon"
            value={dueSoonCount}
            color={dueSoonCount > 0 ? Colors.warning : Colors.success}
            icon={<Timer size={14} color={dueSoonCount > 0 ? Colors.warning : Colors.success} />}
          />
        </View>

        {escalationBuckets
          .filter(b => b.leads.length > 0 && b.state !== 'healthy')
          .map(bucket => (
            <EscalationSection
              key={bucket.state}
              state={bucket.state}
              leads={bucket.leads}
              getUserById={getUserById}
              onPress={handleLeadPress}
              isWide={isWide}
              activities={activities}
            />
          ))}

        {view === 'manager' && (
          <>
            <View style={[styles.row, isDesktop && styles.rowDesktop]}>
              <MetricCard
                label="Today"
                value={metrics.leadsToday}
                subtitle={`${metrics.leadsThisWeek} this week`}
                color={Colors.primary}
                icon={<TrendingUp size={14} color={Colors.primary} />}
              />
              <MetricCard
                label="Conversion"
                value={`${metrics.conversionPercent}%`}
                subtitle="Target: 20-25%"
                color={conversionColor}
                icon={<Target size={14} color={conversionColor} />}
              />
              <MetricCard
                label="Contact Speed"
                value={`${metrics.contactSpeedPercent}%`}
                color={Colors.cyan}
                icon={<Zap size={14} color={Colors.cyan} />}
              />
              <MetricCard
                label="Commission"
                value={formatCurrency(metrics.commissionProjection)}
                subtitle="projection"
                color={Colors.success}
                icon={<DollarSign size={14} color={Colors.success} />}
              />
            </View>

            <View style={[styles.cardsRow, isWide && styles.cardsRowWide]}>
              <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
                <Text style={styles.sectionTitle}>Closed Per Producer</Text>
                <View style={styles.alertCard}>
                  {producers.length === 0 ? (
                    <View style={styles.alertRow}>
                      <Text style={styles.alertText}>No producers loaded</Text>
                    </View>
                  ) : (
                    producers.map((user, i, arr) => (
                      <React.Fragment key={user.id}>
                        <View style={styles.alertRow}>
                          <CheckCircle size={16} color={Colors.success} />
                          <Text style={styles.alertText}>{user.name}</Text>
                          <Text style={[styles.alertCount, { color: Colors.success }]}>
                            {metrics.closedPerProducer[user.name] ?? 0}
                          </Text>
                        </View>
                        {i < arr.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    ))
                  )}
                </View>
              </View>

              <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
                <Text style={styles.sectionTitle}>Pipeline Health</Text>
                <View style={styles.alertCard}>
                  <View style={styles.alertRow}>
                    <AlertTriangle size={16} color={Colors.danger} />
                    <Text style={styles.alertText}>Stuck Leads</Text>
                    <Text style={[styles.alertCount, { color: metrics.stuckLeads > 0 ? Colors.danger : Colors.success }]}>
                      {metrics.stuckLeads}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.alertRow}>
                    <Users size={16} color={Colors.primary} />
                    <Text style={styles.alertText}>Unassigned</Text>
                    <Text style={[styles.alertCount, { color: metrics.leadsUnassigned > 0 ? Colors.warning : Colors.success }]}>
                      {metrics.leadsUnassigned}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.alertRow}>
                    <Clock size={16} color={Colors.textTertiary} />
                    <Text style={styles.alertText}>No Follow-up</Text>
                    <Text style={[styles.alertCount, { color: incompleteCount > 0 ? Colors.warning : Colors.success }]}>
                      {incompleteCount}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.alertRow}>
                    <CheckCircle size={16} color={Colors.success} />
                    <Text style={styles.alertText}>Closed</Text>
                    <Text style={[styles.alertCount, { color: Colors.success }]}>{metrics.leadsClosed}</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {view !== 'manager' && (
          <View style={[styles.cardsRow, isWide && styles.cardsRowWide]}>
            <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
              <Text style={styles.sectionTitle}>Quick Status</Text>
              <View style={styles.alertCard}>
                <View style={styles.alertRow}>
                  <Users size={16} color={Colors.primary} />
                  <Text style={styles.alertText}>Need Contact</Text>
                  <Text style={[styles.alertCount, { color: metrics.leadsNeedingContact > 0 ? Colors.danger : Colors.success }]}>
                    {metrics.leadsNeedingContact}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.alertRow}>
                  <Clock size={16} color={Colors.textTertiary} />
                  <Text style={styles.alertText}>Unassigned</Text>
                  <Text style={[styles.alertCount, { color: metrics.leadsUnassigned > 0 ? Colors.warning : Colors.success }]}>
                    {metrics.leadsUnassigned}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
              <Text style={styles.sectionTitle}>Conversion</Text>
              <View style={styles.alertCard}>
                <View style={styles.alertRow}>
                  <TrendingUp size={16} color={Colors.primary} />
                  <Text style={styles.alertText}>Total Leads</Text>
                  <Text style={[styles.alertCount, { color: Colors.primary }]}>{leads.length}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.alertRow}>
                  <Target size={16} color={conversionColor} />
                  <Text style={styles.alertText}>Rate</Text>
                  <Text style={[styles.alertCount, { color: conversionColor }]}>{metrics.conversionPercent}%</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const ESCALATION_DISPLAY: Record<string, { color: string; icon: React.ElementType; title: string }> = {
  escalated: { color: '#DC2626', icon: ShieldAlert, title: 'Escalated — Manager Action Required' },
  overdue: { color: '#EF4444', icon: AlertTriangle, title: 'Overdue' },
  due_now: { color: '#F97316', icon: AlertCircle, title: 'Due Now' },
  due_soon: { color: '#F59E0B', icon: Timer, title: 'Due Soon' },
  incomplete: { color: '#64748B', icon: Clock, title: 'No Follow-up Set' },
};

interface EscalationSectionProps {
  state: EscalationState;
  leads: Lead[];
  getUserById: (id: string | null) => { id: string; name: string } | null;
  onPress: (id: string) => void;
  isWide: boolean;
  activities: any[];
}

const EscalationSection = React.memo(function EscalationSection({
  state,
  leads: sectionLeads,
  getUserById,
  onPress,
  isWide,
}: EscalationSectionProps) {
  const display = ESCALATION_DISPLAY[state] ?? ESCALATION_DISPLAY.incomplete;
  const IconComp = display.icon;

  return (
    <View style={[fuStyles.section, isWide && fuStyles.sectionWide]}>
      <View style={fuStyles.headerRow}>
        <IconComp size={16} color={display.color} />
        <Text style={fuStyles.headerTitle}>{display.title}</Text>
        <View style={[fuStyles.badge, { backgroundColor: display.color + '1A' }]}>
          <Text style={[fuStyles.badgeText, { color: display.color }]}>{sectionLeads.length}</Text>
        </View>
      </View>
      <View style={fuStyles.listCard}>
        {sectionLeads.map((lead, i) => {
          const owner = getUserById(lead.owner_id ?? null);
          const now = new Date();
          const fuAt = lead.next_followup_at ? new Date(lead.next_followup_at) : null;
          const diffMin = fuAt ? Math.round((now.getTime() - fuAt.getTime()) / 60000) : 0;
          const timeLabel = fuAt
            ? diffMin > 0
              ? `+${formatEscalationTime(diffMin)} overdue`
              : `in ${formatEscalationTime(Math.abs(diffMin))}`
            : 'No follow-up';

          return (
            <React.Fragment key={lead.id}>
              <TouchableOpacity
                style={fuStyles.leadRow}
                onPress={() => onPress(lead.id)}
                activeOpacity={0.7}
              >
                <View style={[fuStyles.accent, { backgroundColor: display.color }]} />
                <View style={fuStyles.leadInfo}>
                  <Text style={fuStyles.leadName} numberOfLines={1}>{lead.full_name}</Text>
                  <View style={fuStyles.leadMeta}>
                    <Phone size={10} color={Colors.textTertiary} />
                    <Text style={fuStyles.leadPhone}>{formatPhone(lead.phone)}</Text>
                    {lead.amount_due != null && (
                      <Text style={fuStyles.leadAmount}>${lead.amount_due}</Text>
                    )}
                  </View>
                  <Text style={[fuStyles.leadFuDate, { color: display.color }]}>
                    {timeLabel}
                  </Text>
                </View>
                <View style={fuStyles.leadRight}>
                  {owner && <Text style={fuStyles.ownerName}>{owner.name}</Text>}
                  {!owner && <Text style={fuStyles.unassigned}>Unassigned</Text>}
                  <ChevronRight size={14} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
              {i < sectionLeads.length - 1 && <View style={fuStyles.divider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
});

const fuStyles = StyleSheet.create({
  section: { marginTop: 8 },
  sectionWide: { marginTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' as const, flex: 1, letterSpacing: 0.3 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' as const },
  listCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  leadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 14 },
  accent: { width: 3, alignSelf: 'stretch', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  leadInfo: { flex: 1, paddingLeft: 12, gap: 2 },
  leadName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' as const },
  leadMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leadPhone: { color: Colors.textTertiary, fontSize: 11 },
  leadAmount: { color: Colors.primary, fontSize: 11, fontWeight: '700' as const },
  leadFuDate: { fontSize: 11, fontWeight: '500' as const, marginTop: 1 },
  leadRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerName: { color: Colors.textTertiary, fontSize: 11, fontWeight: '500' as const },
  unassigned: { color: Colors.warning, fontSize: 11, fontWeight: '500' as const },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { paddingHorizontal: 20, paddingTop: 12 },
  topBarWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' as const },
  urgentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  urgentBadgeText: { color: Colors.danger, fontSize: 11, fontWeight: '700' as const },
  viewToggle: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewToggleWide: { marginTop: 0, maxWidth: 360 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.primaryMuted },
  toggleText: { color: Colors.textTertiary, fontSize: 13, fontWeight: '600' as const },
  toggleTextActive: { color: Colors.primary },
  metricsGrid: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  metricsGridWide: { paddingHorizontal: 24 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  rowDesktop: { flexWrap: 'nowrap' },
  cardsRow: { gap: 12 },
  cardsRowWide: { flexDirection: 'row', gap: 12 },
  alertSection: { marginTop: 8 },
  alertSectionWide: { flex: 1, marginTop: 0 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 10, letterSpacing: 0.3 },
  alertCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  alertText: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  alertCount: { fontSize: 18, fontWeight: '800' as const },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 44 },
  bottomPad: { height: 40 },
});
