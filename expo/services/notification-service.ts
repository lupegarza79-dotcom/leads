import { NOTIFICATION_CHANNELS } from '@/constants/config';

export interface NotificationPayload {
  subject: string;
  body: string;
  leadId?: string;
  severity: 'info' | 'warning' | 'critical' | 'escalation';
}

export interface ChannelAdapter {
  send(payload: NotificationPayload): Promise<boolean>;
}

class WhatsAppAdapter implements ChannelAdapter {
  private phone: string;

  constructor(phone: string) {
    this.phone = phone;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    console.log(`[WhatsApp -> ${this.phone}] ${payload.severity.toUpperCase()}: ${payload.subject}`);
    console.log(`[WhatsApp -> ${this.phone}] Body: ${payload.body}`);
    return true;
  }
}

class EmailAdapter implements ChannelAdapter {
  private recipients: readonly string[];

  constructor(recipients: readonly string[]) {
    this.recipients = recipients;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    console.log(`[Email -> ${this.recipients.join(', ')}] ${payload.severity.toUpperCase()}: ${payload.subject}`);
    console.log(`[Email] Body: ${payload.body}`);
    return true;
  }
}

class NotificationService {
  private whatsAppPrimary: WhatsAppAdapter;
  private whatsAppEscalation: WhatsAppAdapter;
  private emailAdapter: EmailAdapter;
  private queue: Array<{ channel: string; payload: NotificationPayload; timestamp: string }> = [];

  constructor() {
    this.whatsAppPrimary = new WhatsAppAdapter(NOTIFICATION_CHANNELS.whatsapp.primary);
    this.whatsAppEscalation = new WhatsAppAdapter(NOTIFICATION_CHANNELS.whatsapp.escalation);
    this.emailAdapter = new EmailAdapter(NOTIFICATION_CHANNELS.email.recipients);
  }

  async sendAlert(payload: NotificationPayload): Promise<void> {
    this.queue.push({ channel: 'whatsapp_primary', payload, timestamp: new Date().toISOString() });
    await this.whatsAppPrimary.send(payload);
    console.log(`[NotificationService] Alert queued and sent: ${payload.subject}`);
  }

  async sendEscalation(payload: NotificationPayload): Promise<void> {
    this.queue.push({ channel: 'whatsapp_escalation', payload, timestamp: new Date().toISOString() });
    this.queue.push({ channel: 'email', payload, timestamp: new Date().toISOString() });
    await this.whatsAppEscalation.send(payload);
    await this.emailAdapter.send(payload);
    console.log(`[NotificationService] Escalation queued and sent: ${payload.subject}`);
  }

  async sendDailyReport(payload: NotificationPayload): Promise<void> {
    this.queue.push({ channel: 'email', payload, timestamp: new Date().toISOString() });
    await this.emailAdapter.send(payload);
    console.log(`[NotificationService] Daily report sent: ${payload.subject}`);
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
  }
}

export const notificationService = new NotificationService();
