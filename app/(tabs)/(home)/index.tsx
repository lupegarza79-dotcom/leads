import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, StatusColors } from '@/constants/colors';
import { PIPELINE_STATUSES } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { LeadCard } from '@/components/LeadCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH - 40;

export default function PipelineScreen() {
  const router = useRouter();
  const { followUps, getLeadsByStatus } = useLeads();
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const activeStatuses = PIPELINE_STATUSES.filter(s => s !== 'Lost' && s !== 'Renewal Scheduled');

  const handleLeadPress = useCallback((id: string) => {
    router.push(`/lead/${id}`);
  }, [router]);

  const scrollToColumn = useCallback((index: number) => {
    setActiveColumnIndex(index);
    scrollRef.current?.scrollTo({ x: index * (COLUMN_WIDTH + 12), animated: true });
  }, []);

  const goLeft = useCallback(() => {
    if (activeColumnIndex > 0) scrollToColumn(activeColumnIndex - 1);
  }, [activeColumnIndex, scrollToColumn]);

  const goRight = useCallback(() => {
    if (activeColumnIndex < activeStatuses.length - 1) scrollToColumn(activeColumnIndex + 1);
  }, [activeColumnIndex, activeStatuses.length, scrollToColumn]);

  return (
    <View style={styles.container}>
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
            const isActive = i === activeColumnIndex;
            const count = getLeadsByStatus(status).length;
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
          style={[styles.navButton, activeColumnIndex === activeStatuses.length - 1 && styles.navDisabled]}
          disabled={activeColumnIndex === activeStatuses.length - 1}
        >
          <ChevronRight size={20} color={activeColumnIndex === activeStatuses.length - 1 ? Colors.textTertiary : Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={COLUMN_WIDTH + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContainer}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (COLUMN_WIDTH + 12));
          setActiveColumnIndex(Math.max(0, Math.min(index, activeStatuses.length - 1)));
        }}
      >
        {activeStatuses.map((status) => {
          const statusLeads = getLeadsByStatus(status);
          const statusColor = StatusColors[status];
          return (
            <View key={status} style={[styles.column, { width: COLUMN_WIDTH }]}>
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
                      onPress={handleLeadPress}
                      compact
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  navButton: {
    padding: 4,
  },
  navDisabled: {
    opacity: 0.3,
  },
  statusTabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  statusTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTabText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  countBubble: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  columnsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  column: {
    marginRight: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  columnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  columnCount: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  columnCountText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  columnScroll: {
    flex: 1,
  },
  columnContent: {
    paddingBottom: 100,
  },
  emptyColumn: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyColumnText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
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
