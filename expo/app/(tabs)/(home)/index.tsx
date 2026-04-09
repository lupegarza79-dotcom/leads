import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, StatusColors } from '@/constants/colors';
import { PIPELINE_STATUSES } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { LeadCard } from '@/components/LeadCard';
import { ActionToast, type ToastType } from '@/components/ActionToast';
import { useResponsive } from '@/hooks/useResponsive';
import { addBusinessDays } from '@/utils/business-hours';
import { withTimeout } from '@/utils/with-timeout';

export default function PipelineScreen() {
  const router = useRouter();
  const { leads, followUps, activities, getLeadsByStatus, getUserById, changeStatus, updateLead, addActivity } = useLeads();
  const { appUser } = useAuth();
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const { width, isWide, isDesktop } = useResponsive();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  const isProducer = appUser?.role === 'producer';

  const getFilteredLeadsByStatus = useCallback((status: string) => {
    let result = getLeadsByStatus(status as any);
    if (isProducer && appUser?.id) {
      result = result.filter(l => l.owner_id === appUser.id);
    }
    return result;
  }, [getLeadsByStatus, isProducer, appUser?.id]);

  const activeStatuses = useMemo(
    () => PIPELINE_STATUSES.filter(s => s !== 'Lost' && s !== 'Renewal Scheduled'),
    []
  );

  const handleLeadPress = useCallback((id: string) => {
    router.push(`/lead/${id}`);
  }, [router]);

  const handleMarkContacted = useCallback(async (id: string) => {
    try {
      console.log('[Pipeline] Mark Contacted:', id);
      await withTimeout(changeStatus({ id, status: 'Contacted', userId: appUser?.id ?? 'system' }));
      showToast('success', 'Lead marked as Contacted');
    } catch (e: any) {
      console.log('[Pipeline] Error marking contacted:', e?.message);
      showToast('error', e?.message ?? 'Failed to update lead');
    }
  }, [changeStatus, appUser, showToast]);

  const handleSetFollowUp = useCallback(async (id: string) => {
    try {
      console.log('[Pipeline] Set Follow-up +1 biz day:', id);
      const nextBizDay = addBusinessDays(new Date(), 1);
      nextBizDay.setHours(10, 0, 0, 0);
      await withTimeout(updateLead({ id, updates: { next_followup_at: nextBizDay.toISOString() } }));
      if (appUser?.id) {
        await withTimeout(addActivity({
          lead_id: id,
          user_id: appUser.id,
          type: 'note',
          note: `Follow-up set to ${nextBizDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 10:00 AM`,
        }));
      }
      showToast('success', 'Follow-up set for next biz day 10am');
    } catch (e: any) {
      console.log('[Pipeline] Error setting follow-up:', e?.message);
      showToast('error', e?.message ?? 'Failed to set follow-up');
    }
  }, [updateLead, addActivity, appUser, showToast]);

  const handleOpenComposer = useCallback((id: string) => {
    router.push(`/follow-up?leadId=${id}`);
  }, [router]);

  const visibleCount = isDesktop ? activeStatuses.length : isWide ? 3 : 1;
  const columnWidth = isDesktop
    ? Math.floor((width - 60 - (activeStatuses.length - 1) * 12) / activeStatuses.length)
    : isWide
    ? Math.floor((width - 48 - 24) / 3)
    : width - 40;

  const scrollToColumn = useCallback((index: number) => {
    setActiveColumnIndex(Math.max(0, Math.min(index, activeStatuses.length - 1)));
  }, [activeStatuses.length]);

  const goLeft = useCallback(() => {
    if (activeColumnIndex > 0) scrollToColumn(activeColumnIndex - 1);
  }, [activeColumnIndex, scrollToColumn]);

  const goRight = useCallback(() => {
    if (activeColumnIndex < activeStatuses.length - visibleCount) scrollToColumn(activeColumnIndex + 1);
  }, [activeColumnIndex, activeStatuses.length, visibleCount, scrollToColumn]);

  const visibleStatuses = isDesktop
    ? activeStatuses
    : activeStatuses.slice(activeColumnIndex, activeColumnIndex + visibleCount);

  return (
    <View style={styles.container}>
      <ActionToast visible={toastVisible} type={toastType} message={toastMsg} onDismiss={() => setToastVisible(false)} />
      {isProducer && (
        <View style={styles.filterIndicator}>
          <Text style={styles.filterIndicatorText}>Showing: My Leads</Text>
        </View>
      )}
      {!isDesktop && (
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={goLeft}
            style={[styles.navButton, activeColumnIndex === 0 && styles.navDisabled]}
            disabled={activeColumnIndex === 0}
          >
            <ChevronLeft size={20} color={activeColumnIndex === 0 ? Colors.textTertiary : Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.statusTabs}>
            {activeStatuses.map((status, i) => {
              const statusColor = StatusColors[status];
              const isActive = i >= activeColumnIndex && i < activeColumnIndex + visibleCount;
              const count = getFilteredLeadsByStatus(status).length;
              return (
                <TouchableOpacity
                  key={status}
                  onPress={() => scrollToColumn(i)}
                  style={[
                    styles.statusTab,
                    isActive && { backgroundColor: statusColor?.bg ?? Colors.primaryMuted },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor?.dot ?? Colors.primary }]} />
                  {isActive && (
                    <Text style={[styles.statusTabText, { color: statusColor?.text ?? Colors.primary }]}>
                      {status} ({count})
                    </Text>
                  )}
                  {!isActive && count > 0 && (
                    <Text style={styles.countBubble}>{count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={goRight}
            style={[styles.navButton, activeColumnIndex >= activeStatuses.length - visibleCount && styles.navDisabled]}
            disabled={activeColumnIndex >= activeStatuses.length - visibleCount}
          >
            <ChevronRight size={20} color={activeColumnIndex >= activeStatuses.length - visibleCount ? Colors.textTertiary : Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.columnsRow, isDesktop && styles.columnsRowDesktop]}>
        {visibleStatuses.map((status) => {
          const statusLeads = getFilteredLeadsByStatus(status);
          const statusColor = StatusColors[status];
          return (
            <View
              key={status}
              style={[
                styles.column,
                { width: isDesktop ? undefined : columnWidth },
                isDesktop && styles.columnDesktop,
              ]}
            >
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleRow}>
                  <View style={[styles.columnDot, { backgroundColor: statusColor?.dot ?? Colors.primary }]} />
                  <Text style={styles.columnTitle}>{status}</Text>
                </View>
                <View style={[styles.columnCount, { backgroundColor: statusColor?.bg ?? Colors.primaryMuted }]}>
                  <Text style={[styles.columnCountText, { color: statusColor?.text ?? Colors.primary }]}>
                    {statusLeads.length}
                  </Text>
                </View>
              </View>

              <ScrollView
                style={styles.columnScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.columnContent}
              >
                {statusLeads.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Text style={styles.emptyColumnText}>No leads</Text>
                  </View>
                ) : (
                  statusLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      followUps={followUps}
                      activities={activities}
                      onPress={handleLeadPress}
                      ownerName={getUserById(lead.owner_id)?.name ?? null}
                      compact
                      showQuickActions
                      onMarkContacted={handleMarkContacted}
                      onSetFollowUp={handleSetFollowUp}
                      onOpenComposer={handleOpenComposer}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-lead')}
        activeOpacity={0.8}
        testID="add-lead-fab"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.primaryMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterIndicatorText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, gap: 4 },
  navButton: { padding: 4 },
  navDisabled: { opacity: 0.3 },
  statusTabs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', flexWrap: 'wrap' },
  statusTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTabText: { fontSize: 11, fontWeight: '600' as const },
  countBubble: { color: Colors.textTertiary, fontSize: 10, fontWeight: '600' as const },
  columnsRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  columnsRowDesktop: { paddingHorizontal: 16, gap: 10 },
  column: { marginRight: 0 },
  columnDesktop: { flex: 1, minWidth: 0 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  columnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columnDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' as const },
  columnCount: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  columnCountText: { fontSize: 13, fontWeight: '700' as const },
  columnScroll: { flex: 1 },
  columnContent: { paddingBottom: 100 },
  emptyColumn: { paddingVertical: 40, alignItems: 'center' },
  emptyColumnText: { color: Colors.textTertiary, fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
