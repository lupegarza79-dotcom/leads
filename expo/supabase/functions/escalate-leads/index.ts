import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";
const ESCALATION_WHATSAPP_TO = Deno.env.get("ESCALATION_WHATSAPP_TO") || "whatsapp:+19562179089";
const OPERATIONAL_WHATSAPP_TO = Deno.env.get("OPERATIONAL_WHATSAPP_TO") || "whatsapp:+19567738844";

const WORKING_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: { open: 540, close: 1020 },
  2: { open: 540, close: 1020 },
  3: { open: 540, close: 1020 },
  4: { open: 540, close: 1020 },
  5: { open: 540, close: 1020 },
  6: { open: 600, close: 900 },
};

const OPERATIONAL_MINUTES = 30;
const ESCALATION_MINUTES = 60;
const COOLDOWN_MINUTES = 60;

// Follow-up rule (must match SQL trigger mg_set_contacted_at):
//   call, whatsapp, email, follow_up  -> always count
//   note                              -> ONLY if note starts with "[FOLLOW-UP]"
const FOLLOWUP_ACTIVITY_TYPES = ["call", "whatsapp", "email", "note", "follow_up"];
const FOLLOWUP_NOTE_PREFIX = "[FOLLOW-UP]";

function isWithinBusinessHours(date: Date): boolean {
  const day = date.getDay();
  const config = WORKING_HOURS[day];
  if (!config) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= config.open && mins < config.close;
}

function getBusinessMinutesBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let total = 0;
  const current = new Date(start);

  while (current < end) {
    const day = current.getDay();
    const config = WORKING_HOURS[day];

    if (!config) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const openH = Math.floor(config.open / 60);
    const openM = config.open % 60;
    const closeH = Math.floor(config.close / 60);
    const closeM = config.close % 60;

    const dayOpen = new Date(current);
    dayOpen.setHours(openH, openM, 0, 0);
    const dayClose = new Date(current);
    dayClose.setHours(closeH, closeM, 0, 0);

    if (current < dayOpen) {
      current.setHours(openH, openM, 0, 0);
    }

    if (current >= dayClose) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const effectiveEnd = end < dayClose ? end : dayClose;
    const periodMinutes = Math.max(0, (effectiveEnd.getTime() - current.getTime()) / 60000);
    total += periodMinutes;

    current.setTime(dayClose.getTime());
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return Math.round(total);
}

async function hasFollowUp(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  createdAt: string,
): Promise<boolean> {
  const { data: activities } = await supabase
    .from("mg_activity_log")
    .select("id, type, note")
    .eq("lead_id", leadId)
    .in("type", FOLLOWUP_ACTIVITY_TYPES)
    .gt("created_at", createdAt);

  const realFollowUp = (activities ?? []).find((a) => {
    const type = (a as { type: string }).type;
    if (type === "note") {
      const note = ((a as { note: string | null }).note ?? "").trim();
      return note.toUpperCase().startsWith(FOLLOWUP_NOTE_PREFIX);
    }
    return type === "call" || type === "whatsapp" || type === "email" || type === "follow_up";
  });

  if (realFollowUp) {
    console.log(`[Escalation] Lead ${leadId}: follow-up found in mg_activity_log, skipping`);
    return true;
  }

  const { data: lead } = await supabase
    .from("mg_leads")
    .select("contacted_at")
    .eq("id", leadId)
    .maybeSingle();

  if (lead?.contacted_at) {
    console.log(`[Escalation] Lead ${leadId}: contacted_at is set (${lead.contacted_at}), skipping`);
    return true;
  }

  return false;
}

async function wasAlreadySent(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  type: "operational" | "escalation",
  cooldownMs: number,
  now: Date,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();

  const { data } = await supabase
    .from("mg_escalation_log")
    .select("id")
    .eq("lead_id", leadId)
    .eq("type", type)
    .eq("status", "sent")
    .gte("created_at", cutoff)
    .limit(1);

  return (data && data.length > 0) || false;
}

async function sendTwilioWhatsApp(
  to: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const params = new URLSearchParams();
  params.set("From", TWILIO_WHATSAPP_FROM);
  params.set("To", to);
  params.set("Body", body);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await resp.json();

    if (resp.ok) {
      console.log(`[Twilio] Message sent to ${to}, SID: ${data.sid}`);
      return { success: true, sid: data.sid };
    } else {
      console.error(`[Twilio] Failed: ${data.message || data.code}`);
      return { success: false, error: data.message || `HTTP ${resp.status}` };
    }
  } catch (err) {
    console.error(`[Twilio] Network error:`, err);
    return { success: false, error: String(err) };
  }
}

async function logEscalation(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  type: "operational" | "escalation",
  toPhone: string,
  message: string,
  twilioResult: { success: boolean; sid?: string; error?: string },
) {
  const { error: logErr } = await supabase.from("mg_escalation_log").insert({
    lead_id: leadId,
    type,
    channel: "whatsapp",
    to_phone: toPhone,
    message,
    status: twilioResult.success ? "sent" : "failed",
    provider_message_id: twilioResult.sid || null,
    error_detail: twilioResult.error || null,
  });

  if (logErr) {
    console.error(`[Escalation] Log insert error (${type}):`, logErr.message);
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const isTest = url.searchParams.get("test") === "1";
    const testLeadId = url.searchParams.get("lead_id");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    if (!isTest && !isWithinBusinessHours(now)) {
      console.log(`[Escalation] Outside business hours (${now.toISOString()}), skipping.`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "outside_business_hours" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("mg_leads")
      .select("id, full_name, phone, source, owner_id, created_at, contacted_at")
      .eq("status", "New");

    if (isTest && testLeadId) {
      query = query.eq("id", testLeadId);
    }

    const { data: candidates, error: leadsErr } = await query;

    if (leadsErr) {
      console.error("[Escalation] Error fetching leads:", leadsErr.message);
      return new Response(
        JSON.stringify({ error: leadsErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[Escalation] Found ${candidates?.length ?? 0} 'New' leads to evaluate`);

    const results: Array<{
      lead_id: string;
      lead_name: string;
      minutes_elapsed: number;
      stage: "operational" | "escalation" | "skipped";
      action: string;
      message_sid?: string;
      error?: string;
    }> = [];

    for (const lead of candidates ?? []) {
      const createdAt = new Date(lead.created_at);
      const elapsed = getBusinessMinutesBetween(createdAt, now);

      console.log(`[Escalation] Lead "${lead.full_name}" (${lead.id}): ${elapsed} business minutes elapsed`);

      if (!isTest && elapsed < OPERATIONAL_MINUTES) {
        console.log(`[Escalation] Lead ${lead.id}: ${elapsed}min < ${OPERATIONAL_MINUTES}min threshold, skipping`);
        continue;
      }

      const followedUp = await hasFollowUp(supabase, lead.id, lead.created_at);
      if (!isTest && followedUp) {
        results.push({
          lead_id: lead.id,
          lead_name: lead.full_name,
          minutes_elapsed: elapsed,
          stage: "skipped",
          action: "follow_up_exists",
        });
        continue;
      }

      const ownerName = lead.owner_id
        ? await (async () => {
            const { data: u } = await supabase
              .from("mg_users")
              .select("full_name")
              .eq("id", lead.owner_id)
              .maybeSingle();
            return u?.full_name || "Unassigned";
          })()
        : "Unassigned";

      if (elapsed >= ESCALATION_MINUTES || (isTest && elapsed >= 0)) {
        const alreadySentEscalation = await wasAlreadySent(
          supabase,
          lead.id,
          "escalation",
          COOLDOWN_MINUTES * 60000,
          now,
        );

        if (!isTest && alreadySentEscalation) {
          console.log(`[Escalation] Lead ${lead.id}: escalation already sent within ${COOLDOWN_MINUTES}min cooldown`);
        } else {
          const message =
            `🚨 ESCALATION ALERT (GAGL)\n` +
            `Lead: ${lead.full_name}\n` +
            `Phone: ${lead.phone}\n` +
            `Source: ${lead.source}\n` +
            `Owner: ${ownerName}\n` +
            `Uncontacted for: ${elapsed} business minutes\n` +
            `Created: ${createdAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}\n` +
            `MG team did not follow up. Action required: Contact immediately or reassign.`;

          const twilioResult = await sendTwilioWhatsApp(ESCALATION_WHATSAPP_TO, message);
          await logEscalation(supabase, lead.id, "escalation", ESCALATION_WHATSAPP_TO, message, twilioResult);

          results.push({
            lead_id: lead.id,
            lead_name: lead.full_name,
            minutes_elapsed: elapsed,
            stage: "escalation",
            action: twilioResult.success ? "sent" : "failed",
            message_sid: twilioResult.sid,
            error: twilioResult.error,
          });

          console.log(
            `[Escalation] Lead "${lead.full_name}" (${lead.id}): ESCALATION ${twilioResult.success ? "SENT" : "FAILED"} to GAGL after ${elapsed}min`,
          );
        }
      } else if (elapsed >= OPERATIONAL_MINUTES) {
        const alreadySentOperational = await wasAlreadySent(
          supabase,
          lead.id,
          "operational",
          COOLDOWN_MINUTES * 60000,
          now,
        );

        if (!isTest && alreadySentOperational) {
          console.log(`[Escalation] Lead ${lead.id}: operational already sent within ${COOLDOWN_MINUTES}min cooldown`);
        } else {
          const message =
            `⚠️ OPERATIONAL ALERT (MG Team)\n` +
            `Lead: ${lead.full_name}\n` +
            `Phone: ${lead.phone}\n` +
            `Source: ${lead.source}\n` +
            `Owner: ${ownerName}\n` +
            `Uncontacted for: ${elapsed} business minutes\n` +
            `Created: ${createdAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}\n` +
            `Action required: Follow up with this lead now.`;

          const twilioResult = await sendTwilioWhatsApp(OPERATIONAL_WHATSAPP_TO, message);
          await logEscalation(supabase, lead.id, "operational", OPERATIONAL_WHATSAPP_TO, message, twilioResult);

          results.push({
            lead_id: lead.id,
            lead_name: lead.full_name,
            minutes_elapsed: elapsed,
            stage: "operational",
            action: twilioResult.success ? "sent" : "failed",
            message_sid: twilioResult.sid,
            error: twilioResult.error,
          });

          console.log(
            `[Escalation] Lead "${lead.full_name}" (${lead.id}): OPERATIONAL ${twilioResult.success ? "SENT" : "FAILED"} to MG after ${elapsed}min`,
          );
        }
      }
    }

    const response = {
      timestamp: now.toISOString(),
      test_mode: isTest,
      thresholds: {
        operational_minutes: OPERATIONAL_MINUTES,
        escalation_minutes: ESCALATION_MINUTES,
        cooldown_minutes: COOLDOWN_MINUTES,
      },
      candidates_evaluated: candidates?.length ?? 0,
      operational_sent: results.filter((r) => r.stage === "operational" && r.action === "sent").length,
      escalations_sent: results.filter((r) => r.stage === "escalation" && r.action === "sent").length,
      skipped_followup: results.filter((r) => r.stage === "skipped").length,
      results,
    };

    console.log(`[Escalation] Complete:`, JSON.stringify(response));

    return new Response(JSON.stringify(response, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Escalation] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
