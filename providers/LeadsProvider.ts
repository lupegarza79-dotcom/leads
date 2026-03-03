import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { Lead, ActivityLogEntry, FollowUpTask, LeadCreateInput, DashboardMetrics } from '@/types/leads';
import type { PipelineStatus } from '@/constants/config';
import { FOLLOW_UP_SCHEDULE_DAYS } from '@/constants/config';
import { addBusinessDays } from '@/utils/business-hours';
import { getLeadSLAStatus } from '@/utils/sla-engine';

async function fetchLeads(): Promise<Lead[]> {
  console.log('[Supabase] Fetching mg_leads...');
  const { data, error } = await supabase
    .from('mg_leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[Supabase] Error fetching mg_leads:', error.message);
    throw error;
  }
  console.log('[Supabase] Fetched', data?.length ?? 0, 'leads');
  return (data ?? []) as Lead[];
}

async function fetchActivities(): Promise<ActivityLogEntry[]> {
  console.log('[Supabase] Fetching mg_activity_log...');
  const { data, error } = await supabase
    .from('mg_activity_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[Supabase] Error fetching mg_activity_log:', error.message);
    throw error;
  }
  return (data ?? []) as ActivityLogEntry[];
}

async function fetchFollowUps(): Promise<FollowUpTask[]> {
  console.log('[Supabase] Fetching mg_follow_up_tasks...');
  const { data, error } = await supabase
    .from('mg_follow_up_tasks')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.log('[Supabase] Error fetching mg_follow_up_tasks:', error.message);
    throw error;
  }
  return (data ?? []) as FollowUpTask[];
}

async function fetchMgUsers(): Promise<{ id: string; name: string; role: string; office: string; email: string }[]> {
  console.log('[Supabase] Fetching mg_users...');
  const { data, error } = await supabase
    .from('mg_users')
    .select('*');

  if (error) {
    console.log('[Supabase] Error fetching mg_users:', error.message);
    return [];
  }
  return (data ?? []).map((u: Record<string, unknown>) => ({
    id: u.id as string,
    email: u.email as string,
    name: (u.full_name ?? u.name ?? '') as string,
    role: u.role as string,
    office: u.office as string,
  }));
}

const defaultLeadsValue = {
  leads: [] as Lead[],
  activities: [] as ActivityLogEntry[],
  followUps: [] as FollowUpTask[],
  mgUsers: [] as { id: string; name: string; role: string; office: string; email: string }[],
  metrics: {
    leadsToday: 0, leadsThisWeek: 0, leadsUnassigned: 0, leadsNeedingContact: 0,
    followUpDueToday: 0, contactSpeedPercent: 0, conversionPercent: 0,
    closedPerProducer: {}, stuckLeads: 0, commissionProjection: 0,
    leadsAtRisk: 0, leadsClosed: 0, followUpOverdue: 0,
  } as DashboardMetrics,
  isLoading: true,
  addLead: async () => ({} as Lead),
  addingLead: false,
  updateLead: async () => ({} as Lead),
  changeStatus: async () => ({} as Lead),
  addActivity: async () => ({} as ActivityLogEntry),
  completeFollowUp: async () => {},
  getLeadById: () => null as Lead | null,
  getActivitiesForLead: () => [] as ActivityLogEntry[],
  getFollowUpsForLead: () => [] as FollowUpTask[],
  getLeadsByStatus: () => [] as Lead[],
  getUserById: () => null as { id: string; name: string; role: string; office: string; email: string } | null,
  refetch: () => {},
};

export const [LeadsProvider, useLeads] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);

  const leadsQuery = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 30000,
  });

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
    refetchInterval: 30000,
  });

  const followUpsQuery = useQuery({
    queryKey: ['followups'],
    queryFn: fetchFollowUps,
    refetchInterval: 30000,
  });

  const mgUsersQuery = useQuery({
    queryKey: ['mg_users'],
    queryFn: fetchMgUsers,
    staleTime: 5 * 60 * 1000,
  });

  const mgUsers = useMemo(() => mgUsersQuery.data ?? [], [mgUsersQuery.data]);

  useEffect(() => {
    if (leadsQuery.data) setLeads(leadsQuery.data);
  }, [leadsQuery.data]);

  useEffect(() => {
    if (activitiesQuery.data) setActivities(activitiesQuery.data);
  }, [activitiesQuery.data]);

  useEffect(() => {
    if (followUpsQuery.data) setFollowUps(followUpsQuery.data);
  }, [followUpsQuery.data]);

  useEffect(() => {
    console.log('[Supabase] Setting up realtime subscriptions for mg_ tables...');
    const leadsChannel = supabase
      .channel('mg-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mg_leads' }, () => {
        console.log('[Realtime] mg_leads changed, refetching...');
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      })
      .subscribe();

    const activitiesChannel = supabase
      .channel('mg-activity-log-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mg_activity_log' }, () => {
        console.log('[Realtime] mg_activity_log changed, refetching...');
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      })
      .subscribe();

    const followUpsChannel = supabase
      .channel('mg-follow-up-tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mg_follow_up_tasks' }, () => {
        console.log('[Realtime] mg_follow_up_tasks changed, refetching...');
        queryClient.invalidateQueries({ queryKey: ['followups'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(followUpsChannel);
    };
  }, [queryClient]);

  const addLeadMutation = useMutation({
    mutationFn: async (input: LeadCreateInput) => {
      console.log('[LeadsEngine] addLead mutationFn called with:', input.full_name);
      const now = new Date().toISOString();
      const newLead = {
        full_name: input.full_name,
        phone: input.phone,
        email: input.email ?? null,
        office: input.office,
        source: input.source,
        owner_id: input.owner_id ?? null,
        status: 'New' as const,
        notes: input.notes ?? '',
        last_touch_at: now,
        next_followup_at: null,
        quoted_at: null,
        closed_at: null,
        renewal_date: null,
        premium_amount: input.premium_amount ?? null,
        commission_estimate: null,
      };

      console.log('[Supabase] Inserting into mg_leads...');
      const { data: leadData, error: leadError } = await supabase
        .from('mg_leads')
        .insert(newLead)
        .select()
        .single();

      if (leadError) {
        console.log('[Supabase] Error creating lead:', leadError.message, leadError.code, leadError.details);
        throw new Error(`Failed to create lead: ${leadError.message}`);
      }

      if (!leadData) {
        console.log('[Supabase] Lead insert returned no data (possible RLS issue)');
        throw new Error('Lead was not created. Check database permissions.');
      }

      console.log('[Supabase] Lead inserted:', leadData.id);

      try {
        const activityUserId = input.owner_id ?? leadData.id;
        const { error: activityError } = await supabase
          .from('mg_activity_log')
          .insert({
            lead_id: leadData.id,
            user_id: activityUserId,
            type: 'note',
            note: `Lead created from ${input.source}`,
          });

        if (activityError) {
          console.log('[Supabase] Non-critical: activity log insert failed:', activityError.message);
        }
      } catch (activityErr) {
        console.log('[Supabase] Non-critical: activity log insert threw:', activityErr);
      }

      console.log(`[LeadsEngine] Lead created: ${leadData.full_name} (${leadData.id})`);
      return leadData as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('mg_leads')
        .update({ ...updates, last_touch_at: now })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.log('[Supabase] Error updating lead:', error.message);
        throw error;
      }
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status, userId }: { id: string; status: PipelineStatus; userId: string }) => {
      const now = new Date().toISOString();
      const lead = leads.find(l => l.id === id);
      if (!lead) throw new Error('Lead not found');

      const updates: Record<string, unknown> = { status, last_touch_at: now };

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

      const { data: updatedLead, error: updateError } = await supabase
        .from('mg_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.log('[Supabase] Error changing status:', updateError.message);
        throw updateError;
      }

      const { error: activityError } = await supabase
        .from('mg_activity_log')
        .insert({
          lead_id: id,
          user_id: userId,
          type: 'status_change',
          note: `Status changed: ${lead.status} → ${status}`,
        });

      if (activityError) {
        console.log('[Supabase] Error creating status activity:', activityError.message);
      }

      if (status === 'Quoted') {
        const newFollowUps = FOLLOW_UP_SCHEDULE_DAYS.map(days => ({
          lead_id: id,
          scheduled_at: addBusinessDays(new Date(), days).toISOString(),
          completed: false,
          completed_at: null,
          overdue: false,
        }));

        const { data: insertedFollowUps, error: fuError } = await supabase
          .from('mg_follow_up_tasks')
          .insert(newFollowUps)
          .select();

        if (fuError) {
          console.log('[Supabase] Error creating follow-ups:', fuError.message);
        } else if (insertedFollowUps && insertedFollowUps.length > 0) {
          const first = insertedFollowUps[0];
          await supabase
            .from('mg_leads')
            .update({ next_followup_at: first.scheduled_at })
            .eq('id', id);
          console.log(`[LeadsEngine] Follow-up tasks created for ${lead.full_name}: +1d, +3d, +7d`);
        }
      }

      if (status === 'Closed' || status === 'Lost') {
        const { error: cancelError } = await supabase
          .from('mg_follow_up_tasks')
          .update({ completed: true, completed_at: now })
          .eq('lead_id', id)
          .eq('completed', false);

        if (cancelError) {
          console.log('[Supabase] Error cancelling follow-ups:', cancelError.message);
        } else {
          console.log(`[LeadsEngine] Follow-ups cancelled for ${lead.full_name} (${status})`);
        }
      }

      console.log(`[LeadsEngine] Status changed: ${lead.full_name} -> ${status}`);
      return updatedLead as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>) => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('mg_activity_log')
        .insert({
          lead_id: entry.lead_id,
          user_id: entry.user_id,
          type: entry.type,
          note: entry.note,
        })
        .select()
        .single();

      if (error) {
        console.log('[Supabase] Error adding activity:', error.message);
        throw error;
      }

      await supabase
        .from('mg_leads')
        .update({ last_touch_at: now })
        .eq('id', entry.lead_id);

      console.log(`[LeadsEngine] Activity logged: ${entry.type} for lead ${entry.lead_id}`);
      return data as ActivityLogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const completeFollowUpMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const now = new Date().toISOString();

      const { data: completedTask, error } = await supabase
        .from('mg_follow_up_tasks')
        .update({ completed: true, completed_at: now })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.log('[Supabase] Error completing follow-up:', error.message);
        throw error;
      }

      if (completedTask) {
        const { data: remainingTasks } = await supabase
          .from('mg_follow_up_tasks')
          .select('*')
          .eq('lead_id', completedTask.lead_id)
          .eq('completed', false)
          .order('scheduled_at', { ascending: true })
          .limit(1);

        if (remainingTasks && remainingTasks.length > 0) {
          await supabase
            .from('mg_leads')
            .update({ next_followup_at: remainingTasks[0].scheduled_at })
            .eq('id', completedTask.lead_id);
        } else {
          await supabase
            .from('mg_leads')
            .update({ next_followup_at: null })
            .eq('id', completedTask.lead_id);
        }
      }

      console.log(`[LeadsEngine] Follow-up completed: ${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
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

  const getUserById = useCallback((userId: string | null) => {
    if (!userId) return null;
    return mgUsers.find(u => u.id === userId) ?? null;
  }, [mgUsers]);

  const metrics = useMemo((): DashboardMetrics => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart).length;
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekStart).length;
    const leadsUnassigned = leads.filter(l => !l.owner_id).length;
    const leadsNeedingContact = leads.filter(l => l.status === 'New').length;

    const followUpDueToday = followUps.filter(f => {
      if (f.completed) return false;
      const scheduled = new Date(f.scheduled_at);
      return scheduled <= now;
    }).length;

    const totalLeads = leads.length;
    const contactedIn10 = leads.filter(l => l.status !== 'New').length;
    const contactSpeedPercent = totalLeads > 0 ? Math.round((contactedIn10 / totalLeads) * 100) : 0;

    const closedLeads = leads.filter(l => l.status === 'Closed');
    const conversionPercent = totalLeads > 0 ? Math.round((closedLeads.length / totalLeads) * 100) : 0;

    const closedPerProducer: Record<string, number> = {};
    const producers = mgUsers.filter(u => u.role === 'producer');
    producers.forEach(u => {
      closedPerProducer[u.name] = closedLeads.filter(l => l.owner_id === u.id).length;
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
  }, [leads, followUps, mgUsers]);

  const isLoading = leadsQuery.isLoading || activitiesQuery.isLoading || followUpsQuery.isLoading;

  return {
    leads,
    activities,
    followUps,
    mgUsers,
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
    getUserById,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
    },
  };
}, defaultLeadsValue);
