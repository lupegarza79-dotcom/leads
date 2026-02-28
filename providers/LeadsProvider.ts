import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import type { Lead, ActivityLogEntry, FollowUpTask, LeadCreateInput, DashboardMetrics } from '@/types/leads';
import type { PipelineStatus } from '@/constants/config';
import { USERS, FOLLOW_UP_SCHEDULE_DAYS } from '@/constants/config';
import { addBusinessDays } from '@/utils/business-hours';
import { getLeadSLAStatus } from '@/utils/sla-engine';
import { generateId } from '@/utils/formatters';

const STORAGE_KEYS = {
  leads: 'mg_leads',
  activities: 'mg_activities',
  followups: 'mg_followups',
} as const;

async function loadFromStorage<T>(key: string, fallback: T[]): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.log(`[Storage] Error loading ${key}:`, e);
    return fallback;
  }
}

async function saveToStorage<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log(`[Storage] Error saving ${key}:`, e);
  }
}

export const [LeadsProvider, useLeads] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);

  const leadsQuery = useQuery({
    queryKey: ['leads'],
    queryFn: () => loadFromStorage<Lead>(STORAGE_KEYS.leads, []),
  });

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: () => loadFromStorage<ActivityLogEntry>(STORAGE_KEYS.activities, []),
  });

  const followUpsQuery = useQuery({
    queryKey: ['followups'],
    queryFn: () => loadFromStorage<FollowUpTask>(STORAGE_KEYS.followups, []),
  });

  useEffect(() => {
    if (leadsQuery.data) setLeads(leadsQuery.data);
  }, [leadsQuery.data]);

  useEffect(() => {
    if (activitiesQuery.data) setActivities(activitiesQuery.data);
  }, [activitiesQuery.data]);

  useEffect(() => {
    if (followUpsQuery.data) setFollowUps(followUpsQuery.data);
  }, [followUpsQuery.data]);

  const persistLeads = useCallback(async (updated: Lead[]) => {
    setLeads(updated);
    await saveToStorage(STORAGE_KEYS.leads, updated);
    queryClient.setQueryData(['leads'], updated);
  }, [queryClient]);

  const persistActivities = useCallback(async (updated: ActivityLogEntry[]) => {
    setActivities(updated);
    await saveToStorage(STORAGE_KEYS.activities, updated);
    queryClient.setQueryData(['activities'], updated);
  }, [queryClient]);

  const persistFollowUps = useCallback(async (updated: FollowUpTask[]) => {
    setFollowUps(updated);
    await saveToStorage(STORAGE_KEYS.followups, updated);
    queryClient.setQueryData(['followups'], updated);
  }, [queryClient]);

  const addLeadMutation = useMutation({
    mutationFn: async (input: LeadCreateInput) => {
      const now = new Date().toISOString();
      const newLead: Lead = {
        id: generateId(),
        created_at: now,
        full_name: input.full_name,
        phone: input.phone,
        email: input.email ?? null,
        office: input.office,
        source: input.source,
        owner: input.owner,
        status: 'New',
        notes: input.notes ?? '',
        last_touch_at: now,
        next_followup_at: null,
        quoted_at: null,
        closed_at: null,
        renewal_date: null,
        premium_amount: input.premium_amount ?? null,
        commission_estimate: null,
      };

      const updated = [newLead, ...leads];
      await persistLeads(updated);

      const activity: ActivityLogEntry = {
        id: generateId(),
        lead_id: newLead.id,
        created_at: now,
        user_id: input.owner,
        type: 'note',
        note: `Lead created from ${input.source}`,
      };
      await persistActivities([activity, ...activities]);

      console.log(`[LeadsEngine] Lead created: ${newLead.full_name} (${newLead.id})`);
      return newLead;
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const now = new Date().toISOString();
      const updated = leads.map(l =>
        l.id === id ? { ...l, ...updates, last_touch_at: now } : l,
      );
      await persistLeads(updated);
      return updated.find(l => l.id === id)!;
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status, userId }: { id: string; status: PipelineStatus; userId: string }) => {
      const now = new Date().toISOString();
      const lead = leads.find(l => l.id === id);
      if (!lead) throw new Error('Lead not found');

      const updates: Partial<Lead> = { status, last_touch_at: now };

      if (status === 'Quoted') {
        updates.quoted_at = now;
      }
      if (status === 'Closed') {
        updates.closed_at = now;
        updates.next_followup_at = null;
      }
      if (status === 'Lost') {
        updates.next_followup_at = null;
      }

      const updatedLeads = leads.map(l => (l.id === id ? { ...l, ...updates } : l));
      await persistLeads(updatedLeads);

      const activity: ActivityLogEntry = {
        id: generateId(),
        lead_id: id,
        created_at: now,
        user_id: userId,
        type: 'status_change',
        note: `Status changed: ${lead.status} → ${status}`,
      };
      await persistActivities([activity, ...activities]);

      if (status === 'Quoted') {
        const newFollowUps: FollowUpTask[] = FOLLOW_UP_SCHEDULE_DAYS.map(days => ({
          id: generateId(),
          lead_id: id,
          scheduled_at: addBusinessDays(new Date(), days).toISOString(),
          completed: false,
          completed_at: null,
          overdue: false,
        }));
        await persistFollowUps([...newFollowUps, ...followUps]);
        console.log(`[LeadsEngine] Follow-up tasks created for ${lead.full_name}: +1d, +3d, +7d`);

        const firstFollowUp = newFollowUps[0];
        if (firstFollowUp) {
          const fUpdated = updatedLeads.map(l =>
            l.id === id ? { ...l, next_followup_at: firstFollowUp.scheduled_at } : l,
          );
          await persistLeads(fUpdated);
        }
      }

      if (status === 'Closed' || status === 'Lost') {
        const cancelledFollowUps = followUps.map(f =>
          f.lead_id === id && !f.completed ? { ...f, completed: true, completed_at: now } : f,
        );
        await persistFollowUps(cancelledFollowUps);
        console.log(`[LeadsEngine] Follow-ups cancelled for ${lead.full_name} (${status})`);
      }

      console.log(`[LeadsEngine] Status changed: ${lead.full_name} -> ${status}`);
      return updatedLeads.find(l => l.id === id)!;
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>) => {
      const now = new Date().toISOString();
      const newEntry: ActivityLogEntry = {
        ...entry,
        id: generateId(),
        created_at: now,
      };
      await persistActivities([newEntry, ...activities]);

      const updatedLeads = leads.map(l =>
        l.id === entry.lead_id ? { ...l, last_touch_at: now } : l,
      );
      await persistLeads(updatedLeads);

      console.log(`[LeadsEngine] Activity logged: ${entry.type} for lead ${entry.lead_id}`);
      return newEntry;
    },
  });

  const completeFollowUpMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const now = new Date().toISOString();
      const updated = followUps.map(f =>
        f.id === taskId ? { ...f, completed: true, completed_at: now } : f,
      );
      await persistFollowUps(updated);

      const task = followUps.find(f => f.id === taskId);
      if (task) {
        const leadFollowUps = updated
          .filter(f => f.lead_id === task.lead_id && !f.completed)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        if (leadFollowUps.length > 0) {
          const next = leadFollowUps[0];
          const updatedLeads = leads.map(l =>
            l.id === task.lead_id ? { ...l, next_followup_at: next.scheduled_at } : l,
          );
          await persistLeads(updatedLeads);
        }
      }
    },
  });

  const getLeadById = useCallback((id: string) => {
    return leads.find(l => l.id === id) ?? null;
  }, [leads]);

  const getActivitiesForLead = useCallback((leadId: string) => {
    return activities.filter(a => a.lead_id === leadId);
  }, [activities]);

  const getFollowUpsForLead = useCallback((leadId: string) => {
    return followUps.filter(f => f.lead_id === leadId);
  }, [followUps]);

  const getLeadsByStatus = useCallback((status: PipelineStatus) => {
    return leads.filter(l => l.status === status);
  }, [leads]);

  const metrics = useMemo((): DashboardMetrics => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart).length;
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekStart).length;
    const leadsUnassigned = leads.filter(l => !l.owner || l.owner === '').length;
    const leadsNeedingContact = leads.filter(l => l.status === 'New').length;

    const followUpDueToday = followUps.filter(f => {
      if (f.completed) return false;
      const scheduled = new Date(f.scheduled_at);
      return scheduled <= now;
    }).length;

    const totalLeads = leads.length;
    const contactedIn10 = leads.filter(l => {
      if (l.status === 'New') return false;
      return true;
    }).length;
    const contactSpeedPercent = totalLeads > 0 ? Math.round((contactedIn10 / totalLeads) * 100) : 0;

    const closedLeads = leads.filter(l => l.status === 'Closed');
    const conversionPercent = totalLeads > 0 ? Math.round((closedLeads.length / totalLeads) * 100) : 0;

    const closedPerProducer: Record<string, number> = {};
    USERS.filter(u => u.role === 'producer').forEach(u => {
      closedPerProducer[u.name] = closedLeads.filter(l => l.owner === u.id).length;
    });

    const stuckLeads = leads.filter(l => {
      const sla = getLeadSLAStatus(l, followUps);
      return sla === 'critical' || sla === 'escalated';
    }).length;

    const commissionProjection = leads
      .filter(l => l.status !== 'Lost')
      .reduce((sum, l) => sum + (l.commission_estimate ?? 0), 0);

    const leadsAtRisk = leads.filter(l => {
      const sla = getLeadSLAStatus(l, followUps);
      return sla !== 'ok';
    }).length;

    const followUpOverdue = followUps.filter(f => !f.completed && new Date(f.scheduled_at) < now).length;

    return {
      leadsToday,
      leadsThisWeek,
      leadsUnassigned,
      leadsNeedingContact,
      followUpDueToday,
      contactSpeedPercent,
      conversionPercent,
      closedPerProducer,
      stuckLeads,
      commissionProjection,
      leadsAtRisk,
      leadsClosed: closedLeads.length,
      followUpOverdue,
    };
  }, [leads, followUps]);

  const isLoading = leadsQuery.isLoading || activitiesQuery.isLoading || followUpsQuery.isLoading;

  return {
    leads,
    activities,
    followUps,
    metrics,
    isLoading,
    addLead: addLeadMutation.mutateAsync,
    addingLead: addLeadMutation.isPending,
    updateLead: updateLeadMutation.mutateAsync,
    changeStatus: changeStatusMutation.mutateAsync,
    addActivity: addActivityMutation.mutateAsync,
    completeFollowUp: completeFollowUpMutation.mutateAsync,
    getLeadById,
    getActivitiesForLead,
    getFollowUpsForLead,
    getLeadsByStatus,
  };
});
