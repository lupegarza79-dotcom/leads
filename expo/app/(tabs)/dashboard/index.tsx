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
  Calendar,
  Phone,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLeads } from '@/providers/LeadsProvider';
import { MetricCard } from '@/components/MetricCard';
import { formatCurrency, formatPhone, formatDateTime } from '@/utils/formatters';
import { isWithinBusinessHours } from '@/utils/business-hours';
import { useResponsive } from '@/hooks/useResponsive';
import type { Lead } from '@/types/leads';

type DashboardView = 'orchestrator' | 'manager';

export default function DashboardScreen() {
  const router = useRouter();
  const { metrics, leads, mgUsers, getUserById } = useLeads();
  const [view, setView] = useState<DashboardView>('orchestrator');
  const isOpen = isWithinBusinessHours();
  const { isWide, isDesktop } = useResponsive();

  const producers = mgUsers.filter(u => u.role === 'producer');

  const conversionColor = metrics.conversionPercent >= 20
    ? Colors.success
    : metrics.conversionPercent >= 13
    ? Colors.warning
    : Colors.danger;

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const todayEnd = useMemo(() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [now]);

  const followUpsDueToday = useMemo(() => {
    return leads.filter(l => {
      if (!l.next_followup_at) return false;
      if (l.status === 'Closed' || l.status === 'Lost') return false;
      const fu = new Date(l.next_followup_at);
      return fu >= todayStart && fu <= todayEnd;
    });
  }, [leads, todayStart, todayEnd]);

  const followUpsOverdue = useMemo(() => {
    return leads.filter(l => {
      if (!l.next_followup_at) return false;
      if (l.status === 'Closed' || l.status === 'Lost') return false;
      const fu = new Date(l.next_followup_at);
      return fu < todayStart;
    });
  }, [leads, todayStart]);

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
        </View>

        <View style={[styles.viewToggle, isWide && styles.viewToggleWide]}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'orchestrator' && styles.toggleBtnActive]}
            onPress={() => setView('orchestrator')}
          >
            <Text style={[styles.toggleText, view === 'orchestrator' && styles.toggleTextActive]}>
              Orchestrator
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'manager' && styles.toggleBtnActive]}
            onPress={() => setView('manager')}
          >
            <Text style={[styles.toggleText, view === 'manager' && styles.toggleTextActive]}>
              Manager
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'orchestrator' ? (
        <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
          <View style={[styles.row, isDesktop && styles.rowDesktop]}>
            <MetricCard
              label="New Today"
              value={metrics.leadsToday}
              color={Colors.primary}
              icon={<Zap size={14} color={Colors.primary} />}
            />
            <MetricCard
              label="Unassigned"
              value={metrics.leadsUnassigned}
              color={metrics.leadsUnassigned > 0 ? Colors.warning : Colors.success}
              icon={<Users size={14} color={metrics.leadsUnassigned > 0 ? Colors.warning : Colors.success} />}
            />
            <MetricCard
              label="Need Contact"
              value={metrics.leadsNeedingContact}
              color={metrics.leadsNeedingContact > 0 ? Colors.danger : Colors.success}
              icon={<Clock size={14} color={metrics.leadsNeedingContact > 0 ? Colors.danger : Colors.success} />}
            />
            <MetricCard
              label="Follow-Up Due"
              value={metrics.followUpDueToday}
              color={metrics.followUpDueToday > 0 ? Colors.warning : Colors.success}
              icon={<Calendar size={14} color={metrics.followUpDueToday > 0 ? Colors.warning : Colors.success} />}
            />
          </View>

          <FollowUpSection
            title="Overdue Follow-ups"
            leads={followUpsOverdue}
            emptyText="No overdue follow-ups"
            accentColor={Colors.danger}
            icon={<AlertTriangle size={16} color={Colors.danger} />}
            getUserById={getUserById}
            onPress={handleLeadPress}
            isWide={isWide}
          />

          <FollowUpSection
            title="Due Today"
            leads={followUpsDueToday}
            emptyText="No follow-ups due today"
            accentColor={Colors.warning}
            icon={<Calendar size={16} color={Colors.warning} />}
            getUserById={getUserById}
            onPress={handleLeadPress}
            isWide={isWide}
          />

          <View style={[styles.cardsRow, isWide && styles.cardsRowWide]}>
            <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
              <Text style={styles.sectionTitle}>Quick Status</Text>
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
                  <Target size={16} color={Colors.info} />
                  <Text style={styles.alertText}>Leads at Risk</Text>
                  <Text style={[styles.alertCount, { color: metrics.leadsAtRisk > 0 ? Colors.warning : Colors.success }]}>
                    {metrics.leadsAtRisk}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
              <Text style={styles.sectionTitle}>Conversion Funnel</Text>
              <View style={styles.alertCard}>
                <View style={styles.alertRow}>
                  <TrendingUp size={16} color={Colors.primary} />
                  <Text style={styles.alertText}>Total Leads</Text>
                  <Text style={[styles.alertCount, { color: Colors.primary }]}>{leads.length}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.alertRow}>
                  <Target size={16} color={conversionColor} />
                  <Text style={styles.alertText}>Conversion Rate</Text>
                  <Text style={[styles.alertCount, { color: conversionColor }]}>{metrics.conversionPercent}%</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.alertRow}>
                  <Zap size={16} color={Colors.cyan} />
                  <Text style={styles.alertText}>Contact Speed</Text>
                  <Text style={[styles.alertCount, { color: Colors.cyan }]}>{metrics.contactSpeedPercent}%</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
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

          <FollowUpSection
            title="Overdue Follow-ups"
            leads={followUpsOverdue}
            emptyText="No overdue follow-ups"
            accentColor={Colors.danger}
            icon={<AlertTriangle size={16} color={Colors.danger} />}
            getUserById={getUserById}
            onPress={handleLeadPress}
            isWide={isWide}
          />

          <FollowUpSection
            title="Due Today"
            leads={followUpsDueToday}
            emptyText="No follow-ups due today"
            accentColor={Colors.warning}
            icon={<Calendar size={16} color={Colors.warning} />}
            getUserById={getUserById}
            onPress={handleLeadPress}
            isWide={isWide}
          />

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
                  <Text style={styles.alertText}>Total Leads</Text>
                  <Text style={[styles.alertCount, { color: Colors.primary }]}>{leads.length}</Text>
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
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

interface FollowUpSectionProps {
  title: string;
  leads: Lead[];
  emptyText: string;
  accentColor: string;
  icon: React.ReactNode;
  getUserById: (id: string | null) => { id: string; name: string } | null;
  onPress: (id: string) => void;
  isWide: boolean;
}

const FollowUpSection = React.memo(function FollowUpSection({
  title,
  leads: sectionLeads,
  emptyText,
  accentColor,
  icon,
  getUserById,
  onPress,
  isWide,
}: FollowUpSectionProps) {
  if (sectionLeads.length === 0) {
    return (
      <View style={[fuStyles.section, isWide && fuStyles.sectionWide]}>
        <View style={fuStyles.headerRow}>
          {icon}
          <Text style={fuStyles.headerTitle}>{title}</Text>
          <View style={[fuStyles.badge, { backgroundColor: Colors.successMuted }]}>
            <Text style={[fuStyles.badgeText, { color: Colors.success }]}>0</Text>
          </View>
        </View>
        <View style={fuStyles.emptyCard}>
          <Text style={fuStyles.emptyText}>{emptyText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[fuStyles.section, isWide && fuStyles.sectionWide]}>
      <View style={fuStyles.headerRow}>
        {icon}
        <Text style={fuStyles.headerTitle}>{title}</Text>
        <View style={[fuStyles.badge, { backgroundColor: accentColor + '1A' }]}>
          <Text style={[fuStyles.badgeText, { color: accentColor }]}>{sectionLeads.length}</Text>
        </View>
      </View>
      <View style={fuStyles.listCard}>
        {sectionLeads.map((lead, i) => {
          const owner = getUserById(lead.owner_id ?? null);
          return (
            <React.Fragment key={lead.id}>
              <TouchableOpacity
                style={fuStyles.leadRow}
                onPress={() => onPress(lead.id)}
                activeOpacity={0.7}
              >
                <View style={[fuStyles.accent, { backgroundColor: accentColor }]} />
                <View style={fuStyles.leadInfo}>
                  <Text style={fuStyles.leadName} numberOfLines={1}>{lead.full_name}</Text>
                  <View style={fuStyles.leadMeta}>
                    <Phone size={10} color={Colors.textTertiary} />
                    <Text style={fuStyles.leadPhone}>{formatPhone(lead.phone)}</Text>
                    {lead.amount_due != null && (
                      <Text style={fuStyles.leadAmount}>${lead.amount_due}</Text>
                    )}
                  </View>
                  {lead.next_followup_at && (
                    <Text style={[fuStyles.leadFuDate, { color: accentColor }]}>
                      {formatDateTime(lead.next_followup_at)}
                    </Text>
                  )}
                </View>
                <View style={fuStyles.leadRight}>
                  {owner && <Text style={fuStyles.ownerName}>{owner.name}</Text>}
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
  section: {
    marginTop: 8,
  },
  sectionWide: {
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 14,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  leadInfo: {
    flex: 1,
    paddingLeft: 12,
    gap: 2,
  },
  leadName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  leadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadPhone: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  leadAmount: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  leadFuDate: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  leadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerName: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 15,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topBarWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  viewToggle: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewToggleWide: {
    marginTop: 0,
    maxWidth: 280,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.primaryMuted,
  },
  toggleText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  toggleTextActive: {
    color: Colors.primary,
  },
  metricsGrid: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  metricsGridWide: {
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowDesktop: {
    flexWrap: 'nowrap',
  },
  cardsRow: {
    gap: 12,
  },
  cardsRowWide: {
    flexDirection: 'row',
    gap: 12,
  },
  alertSection: {
    marginTop: 8,
  },
  alertSectionWide: {
    flex: 1,
    marginTop: 0,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  alertText: {
    color: Colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  alertCount: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 44,
  },
  bottomPad: {
    height: 40,
  },
});
