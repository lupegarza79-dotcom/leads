import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Activity as ActivityIcon } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLeads } from '@/providers/LeadsProvider';
import { ActivityItem } from '@/components/ActivityItem';
import { EmptyState } from '@/components/EmptyState';
import type { ActivityLogEntry } from '@/types/leads';

interface EnrichedActivity extends ActivityLogEntry {
  leadName: string;
  userName: string | null;
}

export default function ActivityScreen() {
  const { activities, leads, getUserById } = useLeads();

  const enrichedActivities = useMemo((): EnrichedActivity[] => {
    return activities.map(a => ({
      ...a,
      leadName: leads.find(l => l.id === a.lead_id)?.full_name ?? 'Unknown',
      userName: getUserById(a.user_id)?.name ?? null,
    }));
  }, [activities, leads, getUserById]);

  const renderItem = ({ item }: { item: EnrichedActivity }) => (
    <ActivityItem activity={item} showLeadName={item.leadName} userName={item.userName} />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={enrichedActivities}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon={<ActivityIcon size={40} color={Colors.textTertiary} />}
            title="No activity yet"
            message="Actions on leads will appear here"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
});
