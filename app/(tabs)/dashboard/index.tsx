import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLeads } from '@/providers/LeadsProvider';
import { MetricCard } from '@/components/MetricCard';
import { formatCurrency } from '@/utils/formatters';
import { isWithinBusinessHours } from '@/utils/business-hours';
import { USERS } from '@/constants/config';
import { useResponsive } from '@/hooks/useResponsive';

type DashboardView = 'orchestrator' | 'manager';

export default function DashboardScreen() {
  const { metrics, leads } = useLeads();
  const [view, setView] = useState<DashboardView>('orchestrator');
  const isOpen = isWithinBusinessHours();
  const { isWide, isDesktop } = useResponsive();

  const conversionColor = metrics.conversionPercent >= 20
    ? Colors.success
    : metrics.conversionPercent >= 13
    ? Colors.warning
    : Colors.danger;

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
                  <Clock size={16} color={Colors.warning} />
                  <Text style={styles.alertText}>Overdue Follow-ups</Text>
                  <Text style={[styles.alertCount, { color: metrics.followUpOverdue > 0 ? Colors.warning : Colors.success }]}>
                    {metrics.followUpOverdue}
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

          <View style={[styles.cardsRow, isWide && styles.cardsRowWide]}>
            <View style={[styles.alertSection, isWide && styles.alertSectionWide]}>
              <Text style={styles.sectionTitle}>Closed Per Producer</Text>
              <View style={styles.alertCard}>
                {USERS.filter(u => u.role === 'producer').map((user, i, arr) => (
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
                ))}
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
