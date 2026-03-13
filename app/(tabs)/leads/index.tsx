import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, Filter, X, Users } from 'lucide-react-native';
import { Colors, StatusColors } from '@/constants/colors';
import { PIPELINE_STATUSES, UI_OFFICES } from '@/constants/config';
import type { PipelineStatus, Office } from '@/constants/config';
import { useLeads } from '@/providers/LeadsProvider';
import { LeadCard } from '@/components/LeadCard';
import { EmptyState } from '@/components/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';
import type { Lead } from '@/types/leads';

export default function LeadsScreen() {
  const router = useRouter();
  const { leads, followUps, getUserById } = useLeads();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'All'>('All');
  const [officeFilter, setOfficeFilter] = useState<Office | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const { isWide } = useResponsive();

  const filtered = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email && l.email.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'All') {
      result = result.filter(l => l.status === statusFilter);
    }
    if (officeFilter !== 'All') {
      result = result.filter(l => l.office === officeFilter);
    }
    return result;
  }, [leads, search, statusFilter, officeFilter]);

  const handlePress = useCallback((id: string) => {
    router.push(`/lead/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Lead }) => (
    <View style={isWide ? listStyles.wideItem : undefined}>
      <LeadCard
        lead={item}
        followUps={followUps}
        onPress={handlePress}
        ownerName={getUserById(item.owner_id)?.name ?? null}
      />
    </View>
  ), [followUps, handlePress, isWide, getUserById]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchRow, isWide && styles.searchRowWide]}>
        <View style={[styles.searchBar, isWide && styles.searchBarWide]}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            testID="search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
        {isWide && (
          <TouchableOpacity
            style={styles.addBtnInline}
            onPress={() => router.push('/add-lead')}
          >
            <Plus size={16} color={Colors.white} />
            <Text style={styles.addBtnText}>New Lead</Text>
          </TouchableOpacity>
        )}
      </View>

      {showFilters && (
        <View style={[styles.filterSection, isWide && styles.filterSectionWide]}>
          <View style={isWide ? styles.filterGroupWide : undefined}>
            <Text style={styles.filterLabel}>Status</Text>
            <ScrollableChips
              items={['All', ...PIPELINE_STATUSES]}
              selected={statusFilter}
              onSelect={(v) => setStatusFilter(v as PipelineStatus | 'All')}
            />
          </View>
          <View style={isWide ? styles.filterGroupWide : undefined}>
            <Text style={[styles.filterLabel, !isWide && { marginTop: 10 }]}>Office</Text>
            <ScrollableChips
              items={['All', ...UI_OFFICES]}
              selected={officeFilter}
              onSelect={(v) => setOfficeFilter(v as Office | 'All')}
            />
          </View>
        </View>
      )}

      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, isWide && styles.listContentWide]}
        showsVerticalScrollIndicator={false}
        numColumns={isWide ? 2 : 1}
        key={isWide ? 'wide' : 'narrow'}
        columnWrapperStyle={isWide ? listStyles.columnWrapper : undefined}
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={40} color={Colors.textTertiary} />}
            title="No leads found"
            message={search ? "Try a different search term" : "Add your first lead to get started"}
          />
        }
      />

      {!isWide && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-lead')}
          activeOpacity={0.8}
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function ScrollableChips({
  items,
  selected,
  onSelect,
}: {
  items: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={chipStyles.row}>
      {items.map(item => {
        const isActive = item === selected;
        const statusColor = StatusColors[item];
        return (
          <TouchableOpacity
            key={item}
            style={[
              chipStyles.chip,
              isActive && {
                backgroundColor: statusColor?.bg ?? Colors.primaryMuted,
                borderColor: statusColor?.dot ?? Colors.primary,
              },
            ]}
            onPress={() => onSelect(item)}
          >
            <Text
              style={[
                chipStyles.chipText,
                isActive && { color: statusColor?.text ?? Colors.primary },
              ]}
              numberOfLines={1}
            >
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
});

const listStyles = StyleSheet.create({
  wideItem: {
    flex: 1,
    maxWidth: '50%' as unknown as number,
    paddingHorizontal: 4,
  },
  columnWrapper: {
    gap: 0,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchRowWide: {
    paddingHorizontal: 24,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBarWide: {
    maxWidth: 400,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  addBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterSectionWide: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
  },
  filterGroupWide: {
    flex: 1,
  },
  filterLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  countText: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listContentWide: {
    paddingHorizontal: 20,
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
