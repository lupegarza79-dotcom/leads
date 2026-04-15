import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  SLA_THRESHOLDS,
  ESCALATION_THRESHOLDS,
  WORKING_HOURS,
  FOLLOW_UP_SCHEDULE_DAYS,
} from '@/constants/config';
import type { SLAThresholds, WorkingHoursConfig } from '@/constants/config';

const SETTINGS_KEY = 'mg_app_settings';

export interface EscalationConfig {
  dueSoonMinutes: number;
  overdueMinutes: number;
  escalatedMinutes: number;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
}

export interface AppSettings {
  sla: SLAThresholds;
  escalation: EscalationConfig;
  businessHours: WorkingHoursConfig;
  followUpScheduleDays: number[];
  whatsappTemplates: WhatsAppTemplate[];
  autoFollowUpEnabled: boolean;
  autoFollowUpDefaultDays: number;
}

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl_followup',
    name: 'Quote Follow-up',
    body: 'Hi {name}, following up on your insurance quote. Do you have any questions?',
  },
  {
    id: 'tpl_checkin',
    name: 'Check-in',
    body: 'Hi {name}, just checking in about your policy. Let me know if you need anything.',
  },
  {
    id: 'tpl_payment',
    name: 'Payment Reminder',
    body: 'Hi {name}, your payment of {amount} is due. Please let us know if you need help.',
  },
  {
    id: 'tpl_docs',
    name: 'Documents Needed',
    body: 'Hi {name}, we still need your documents to proceed. Can you send them today?',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  sla: { ...SLA_THRESHOLDS },
  escalation: {
    dueSoonMinutes: ESCALATION_THRESHOLDS.dueSoonMinutes,
    overdueMinutes: ESCALATION_THRESHOLDS.overdueMinutes,
    escalatedMinutes: ESCALATION_THRESHOLDS.escalatedMinutes,
  },
  businessHours: { ...WORKING_HOURS },
  followUpScheduleDays: [...FOLLOW_UP_SCHEDULE_DAYS],
  whatsappTemplates: DEFAULT_TEMPLATES,
  autoFollowUpEnabled: true,
  autoFollowUpDefaultDays: 1,
};

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const settingsQuery = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      console.log('[Settings] Loading settings from AsyncStorage...');
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<AppSettings>;
          const merged: AppSettings = {
            sla: { ...DEFAULT_SETTINGS.sla, ...(parsed.sla ?? {}) },
            escalation: { ...DEFAULT_SETTINGS.escalation, ...(parsed.escalation ?? {}) },
            businessHours: parsed.businessHours ?? DEFAULT_SETTINGS.businessHours,
            followUpScheduleDays: parsed.followUpScheduleDays ?? DEFAULT_SETTINGS.followUpScheduleDays,
            whatsappTemplates: parsed.whatsappTemplates ?? DEFAULT_SETTINGS.whatsappTemplates,
            autoFollowUpEnabled: parsed.autoFollowUpEnabled ?? DEFAULT_SETTINGS.autoFollowUpEnabled,
            autoFollowUpDefaultDays: parsed.autoFollowUpDefaultDays ?? DEFAULT_SETTINGS.autoFollowUpDefaultDays,
          };
          console.log('[Settings] Loaded settings from AsyncStorage');
          return merged;
        } catch (e) {
          console.log('[Settings] Failed to parse stored settings, using defaults');
          return DEFAULT_SETTINGS;
        }
      }
      console.log('[Settings] No stored settings, using defaults');
      return DEFAULT_SETTINGS;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      console.log('[Settings] Saving settings...');
      const merged: AppSettings = {
        ...settings,
        ...updates,
        sla: updates.sla ? { ...settings.sla, ...updates.sla } : settings.sla,
        escalation: updates.escalation ? { ...settings.escalation, ...updates.escalation } : settings.escalation,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      console.log('[Settings] Settings saved');
      return merged;
    },
    onSuccess: (data) => {
      setSettings(data);
      queryClient.setQueryData(['app_settings'], data);
    },
  });

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => updateSettingsMutation.mutateAsync(updates),
    [updateSettingsMutation.mutateAsync],
  );

  const resetSettings = useCallback(async () => {
    console.log('[Settings] Resetting to defaults');
    await AsyncStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    queryClient.setQueryData(['app_settings'], DEFAULT_SETTINGS);
  }, [queryClient]);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoading: settingsQuery.isLoading,
    isSaving: updateSettingsMutation.isPending,
  };
});
