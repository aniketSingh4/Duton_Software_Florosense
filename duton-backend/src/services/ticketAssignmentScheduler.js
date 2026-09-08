import cron from "node-cron";
import * as database from "./database.js";
import { getSettings } from "../config.js";
import { logSuccessfulAssignment } from "./ticketAssignmentLogService.js";
import { sendPendingTicketReminderEmail, sendTicketBatchAssignmentEmail } from "../utils/emailService.js";

const settings = getSettings();
let assignmentScheduledTask = null;
let reminderScheduledTask = null;

function formatTicketForEmail(ticket) {
  return {
    ticket_number: ticket.id || ticket.ticket_id || "N/A",
    ticket_name: ticket.issue_type || ticket.sensor_name || "N/A",
    sensor_number: ticket.sensor_id || "N/A",
    issue_type: ticket.issue_type || "N/A",
    description: ticket.description || "N/A",
    status: ticket.status || "Open",
    issue_date: ticket.created_at || "",
  };
}

async function processTicketAssignmentsBatch() {
  const queuedTickets = await database.listQueuedAssignmentsForBatch();
  if (!queuedTickets.length) {
    return;
  }

  const groupedByOwner = new Map();

  for (const ticket of queuedTickets) {
    const owner = ticket.pending_assignee;
    if (!owner) {
      continue;
    }

    if (!groupedByOwner.has(owner)) {
      groupedByOwner.set(owner, []);
    }
    groupedByOwner.get(owner).push(formatTicketForEmail(ticket));
  }

  for (const [owner, tickets] of groupedByOwner.entries()) {
    const assigneeContact = await database.getAssigneeContactByUsername(owner);
    if (!assigneeContact || !assigneeContact.email) {
      console.error(`[TicketAssignmentScheduler] Missing assignee email for username "${owner}".`);
      continue;
    }

    const emailSent = await sendTicketBatchAssignmentEmail(
      assigneeContact.email,
      assigneeContact.full_name || owner,
      tickets
    );

    if (emailSent) {
      console.log(
        `[TicketAssignmentScheduler] Sent assignment email to "${assigneeContact.email}" for owner "${owner}" (${tickets.length} tickets).`
      );

      const now = new Date();
      const dispatchedAtIso = now.toISOString();
      for (const ticket of queuedTickets) {
        if (ticket.pending_assignee !== owner) continue;

        await database.updateTicket(ticket.id, {
          assignee: owner,
          assignment_dispatched: true,
          assignment_dispatched_at: now,
          pending_assignee: null,
        });

        try {
          await logSuccessfulAssignment(ticket, owner, dispatchedAtIso);
        } catch (excelError) {
          console.error(
            `[TicketAssignmentScheduler] Failed to write assignment log for ticket "${ticket.id}":`,
            excelError
          );
        }
      }
    } else {
      console.error(
        `[TicketAssignmentScheduler] Failed to send assignment email for owner "${owner}". Tickets remain queued for retry.`
      );
    }
  }
}

async function processPendingTicketReminders() {
  const pendingTickets = await database.listPendingReminderTicketsForBatch();
  if (!pendingTickets.length) {
    return;
  }

  const groupedByOwner = new Map();
  for (const ticket of pendingTickets) {
    const owner = ticket.assignee;
    if (!owner) {
      continue;
    }

    if (!groupedByOwner.has(owner)) {
      groupedByOwner.set(owner, []);
    }

    groupedByOwner.get(owner).push(formatTicketForEmail(ticket));
  }

  for (const [owner, tickets] of groupedByOwner.entries()) {
    const assigneeContact = await database.getAssigneeContactByUsername(owner);
    if (!assigneeContact || !assigneeContact.email) {
      continue;
    }

    const emailSent = await sendPendingTicketReminderEmail(
      assigneeContact.email,
      assigneeContact.full_name || owner,
      tickets
    );

    if (emailSent) {
      await database.markReminderSentForTickets(
        tickets.map((ticket) => ticket.ticket_number).filter((ticketNumber) => ticketNumber !== "N/A")
      );
    }
  }
}

export function startTicketAssignmentScheduler() {
  if (assignmentScheduledTask || reminderScheduledTask) {
    return;
  }

  assignmentScheduledTask = cron.schedule(
    settings.TICKET_ASSIGNMENT_CRON,
    async () => {
      try {
        await processTicketAssignmentsBatch();
      } catch (error) {
        console.error("[TicketAssignmentScheduler] Assignment batch failed:", error);
      }
    },
    { timezone: settings.TICKET_CRON_TIMEZONE }
  );

  reminderScheduledTask = cron.schedule(
    settings.TICKET_REMINDER_CRON,
    async () => {
      try {
        await processPendingTicketReminders();
      } catch (error) {
        console.error("[TicketAssignmentScheduler] Reminder batch failed:", error);
      }
    },
    { timezone: settings.TICKET_CRON_TIMEZONE }
  );
}

export function stopTicketAssignmentScheduler() {
  if (assignmentScheduledTask) {
    assignmentScheduledTask.stop();
    assignmentScheduledTask = null;
  }
  if (reminderScheduledTask) {
    reminderScheduledTask.stop();
    reminderScheduledTask = null;
  }
}

export { processPendingTicketReminders, processTicketAssignmentsBatch };
