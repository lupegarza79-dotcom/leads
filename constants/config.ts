export const OFFICES = ['McAllen', 'San Juan'] as const;
export type Office = (typeof OFFICES)[number];

export const LEAD_SOURCES = ['WhatsApp', 'Call', 'FB', 'Referral', 'Other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PIPELINE_STATUSES = [
  'New',
  'Contacted',
  'Ready to Quote',
  'Quoted',
  'Follow-Up',
  'Closed',
  'Lost',
  'Renewal Scheduled',
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'note', 'status_change'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const USERS: User[] = [
  { id: 'josefina', name: 'Josefina', role: 'orchestrator', office: 'McAllen', email: 'mgincometax@gmail.com' },
  { id: 'nayeli', name: 'Nayeli', role: 'producer', office: 'McAllen', email: 'nayelicano655@gmail.com' },
  { id: 'patricia', name: 'Patricia', role: 'producer', office: 'San Juan', email: 'patricia.mgoficinas@gmail.com' },
  { id: 'gagl', name: 'GAGL', role: 'manager', office: 'McAllen', email: 'vitamg6512@gmail.com' },
];

export interface User {
  id: string;
  name: string;
  role: 'orchestrator' | 'producer' | 'manager';
  office: Office;
  email: string;
}

export interface WorkingHoursConfig {
  [day: number]: { open: string; close: string } | null;
}

export const WORKING_HOURS: WorkingHoursConfig = {
  0: null,
  1: { open: '09:00', close: '17:00' },
  2: { open: '09:00', close: '17:00' },
  3: { open: '09:00', close: '17:00' },
  4: { open: '09:00', close: '17:00' },
  5: { open: '09:00', close: '17:00' },
  6: { open: '10:00', close: '15:00' },
};

export interface SLAThresholds {
  newLeadAlertMinutes: number;
  newLeadEscalateMinutes: number;
  quotedAlertHours: number;
  quotedEscalateHours: number;
  followUpOverdueConsecutiveEscalate: number;
}

export const SLA_THRESHOLDS: SLAThresholds = {
  newLeadAlertMinutes: 10,
  newLeadEscalateMinutes: 30,
  quotedAlertHours: 24,
  quotedEscalateHours: 48,
  followUpOverdueConsecutiveEscalate: 2,
};

export const FOLLOW_UP_SCHEDULE_DAYS = [1, 3, 7] as const;

export const NOTIFICATION_CHANNELS = {
  whatsapp: {
    primary: '+19567738844',
    escalation: '+19562179089',
  },
  email: {
    recipients: [
      'mgincometax@gmail.com',
      'nayelicano655@gmail.com',
      'vitamg6512@gmail.com',
      'patricia.mgoficinas@gmail.com',
    ],
  },
} as const;
