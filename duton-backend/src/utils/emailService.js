import { getSettings } from "../config.js";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

const settings = getSettings();

// ---------------------------------------------------------------------------
// Two providers:
//   SendGrid  -> OTP, magic link, assignee credentials   (sendEmail)
//   Brevo SMTP -> sensor alerts, ticket notifications    (sendSmtpEmail, sendSensorAlertEmail)
// ---------------------------------------------------------------------------
if (settings.SENDGRID_API_KEY) {
  sgMail.setApiKey(settings.SENDGRID_API_KEY);
}

// SMTP transport (Brevo relay). Created once, on first use.
let transporter = null;

function isSmtpConfigured() {
  return Boolean(settings.SMTP_HOST && settings.SMTP_USER && settings.SMTP_PASS);
}

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: settings.SMTP_HOST,
      port: settings.SMTP_PORT,
      secure: settings.SMTP_SECURE,
      auth: {
        user: settings.SMTP_USER,
        pass: settings.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function fromAddress() {
  return { name: settings.SMTP_FROM_NAME, address: settings.SMTP_FROM_EMAIL };
}

// Verify SMTP login without sending an email (used at startup / diagnostics)
export async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.");
  }
  await getTransporter().verify();
  return true;
}

function renderTemplate(template, variables = {}) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return "";
  });
}

function buildMagicLinkTemplate() {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Sensor Access Link</h2>
      <p>You have been granted temporary access to:</p>
      <p style="font-size: 18px; font-weight: bold; color: #0066cc;">{{sensorLabel}}</p>
      <p>Click the button below to access the sensor dashboard:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{magicLink}}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Sensor Dashboard</a>
      </div>
      <p style="color: #666; font-size: 12px;">Or copy and paste this link into your browser:<br>{{magicLink}}</p>
      <p style="color: #999; font-size: 11px; margin-top: 30px;">
        This link expires in {{expiresInHours}} hours and can only be used once.<br>
        If you did not request this access, please ignore this email.
      </p>
    </div>
  `;
}

function buildOtpTemplate() {
  return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2e5aac;">Password Reset OTP</h2>
    <p>Your OTP for password reset is:</p>
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
      <h1 style="color: #2e5aac; font-size: 32px; letter-spacing: 5px; margin: 0;">{{otp}}</h1>
    </div>
    <p>This OTP is valid for <strong>10 minutes</strong> only.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
    <br>
    <p>Best regards,<br>Duton Ticket System Team</p>
  </div>
</body>
</html>
  `;
}

function buildTicketTableTemplate({ introLine, actionLine }) {
  return `
    <div style="font-family: Arial, sans-serif;">
      <p>Hello {{assigneeName}},</p>
      <p>${introLine}</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Ticket Number</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Ticket Name</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Sensor Number</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Issue Type</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Status</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Issue Date</th>
          </tr>
        </thead>
        <tbody>{{rows}}</tbody>
      </table>
      <p style="margin-top: 16px;">${actionLine}</p>
      <p>Duton Ticket System</p>
    </div>
  `;
}

// Generate random OTP
export function generateOTP(length = 6) {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, "0");
}

// Send magic link email for sensor access
export async function sendMagicLinkEmail(toEmail, sensorId, sensorName, magicLink, expiresInHours) {
  const subject = `Sensor Access Link - ${sensorName || sensorId}`;
  const sensorLabel = sensorName || sensorId;
  
  const text = `
You have been granted temporary access to Sensor: ${sensorLabel}

Click the link below to access the sensor dashboard:
${magicLink}

This link expires in ${expiresInHours} hours and can only be used once.

If you did not request this access, please ignore this email.

Best regards,
Duton Sensor Monitoring Team
  `;
  const variables = { sensorLabel, magicLink, expiresInHours };
  const html = renderTemplate(buildMagicLinkTemplate(), variables);
  
  return sendEmail(toEmail, subject, text, html);
}

// Send OTP email
export async function sendOTPEmail(toEmail, otp) {
  const subject = "Password Reset OTP - Duton Ticket System";
  
  const text = `
Your OTP for password reset is: ${otp}

This OTP is valid for 10 minutes only.

If you did not request this password reset, please ignore this email.

Best regards,
Duton Ticket System Team
  `;

  const variables = { otp };
  const html = renderTemplate(buildOtpTemplate(), variables);

  return await sendEmail(toEmail, subject, text, html);
}

export async function sendAssigneeCredentialsEmail(toEmail, fullName, username, password, dashboardUrl) {
  const subject = "Your Assignee Dashboard Credentials - Duton";
  const displayName = fullName || username;
  const loginUrl = dashboardUrl || "http://localhost:3000/login";

  const text = `
Hello ${displayName},

Your assignee account has been created by admin.

Username: ${username}
Password: ${password}

Dashboard URL: ${loginUrl}

Please login and update your password as soon as possible.

Best regards,
Duton Ticket System Team
  `;

  const html = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2e5aac;">Assignee Account Created</h2>
    <p>Hello ${displayName},</p>
    <p>Your assignee account has been created by admin.</p>
    <div style="background-color: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Username:</strong> ${username}</p>
      <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
    </div>
    <p>
      <a href="${loginUrl}" style="background-color: #2e5aac; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 4px; display: inline-block;">
        Open Dashboard
      </a>
    </p>
    <p style="color: #666; font-size: 13px;">Please login and update your password as soon as possible.</p>
    <p>Best regards,<br>Duton Ticket System Team</p>
  </div>
</body>
</html>
  `;

  return await sendEmail(toEmail, subject, text, html);
}

export async function sendTicketBatchAssignmentEmail(toEmail, assigneeName, tickets) {
  const subject = `Duton Ticket Assignment Batch (${tickets.length})`;
  const ticketLines = tickets.map((ticket, index) => {
    return `${index + 1}. ${ticket.ticket_number} | ${ticket.ticket_name} | ${ticket.sensor_number} | ${ticket.issue_type} | ${ticket.status}`;
  });

  const text = [
    `Hello ${assigneeName},`,
    "",
    "The following tickets were assigned to you in today's batch:",
    ...ticketLines,
    "",
    "Please review and start working on them in the Ticket Centre.",
    "",
    "Duton Ticket System",
  ].join("\n");

  const htmlRows = tickets
    .map((ticket) => {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.ticket_number}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.ticket_name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.sensor_number}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.issue_type}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.description}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.status}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.issue_date}</td>
        </tr>
      `;
    })
    .join("");

  const variables = { assigneeName, rows: htmlRows };
  const html = renderTemplate(
    buildTicketTableTemplate({
      introLine: "The following tickets were assigned to you in today's batch:",
      actionLine: "Please review and start working on them in the Ticket Centre.",
    }),
    variables
  );

  return sendSmtpEmail(toEmail, subject, text, html);
}

export async function sendPendingTicketReminderEmail(toEmail, assigneeName, tickets) {
  const subject = `Duton Pending Tickets Reminder (${tickets.length})`;
  const ticketLines = tickets.map((ticket, index) => {
    return `${index + 1}. ${ticket.ticket_number} | ${ticket.ticket_name} | ${ticket.sensor_number} | ${ticket.issue_type} | ${ticket.status}`;
  });

  const text = [
    `Hello ${assigneeName},`,
    "",
    "You still have these pending tickets:",
    ...ticketLines,
    "",
    "Please update progress in the Ticket Centre.",
    "",
    "Duton Ticket System",
  ].join("\n");

  const htmlRows = tickets
    .map((ticket) => {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.ticket_number}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.ticket_name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.sensor_number}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.issue_type}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.description}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.status}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ticket.issue_date}</td>
        </tr>
      `;
    })
    .join("");

  const variables = { assigneeName, rows: htmlRows };
  const html = renderTemplate(
    buildTicketTableTemplate({
      introLine: "You still have these pending tickets:",
      actionLine: "Please update progress in the Ticket Centre.",
    }),
    variables
  );

  return sendSmtpEmail(toEmail, subject, text, html);
}

function buildSensorAlertTemplate() {
  return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: {{headerColor}};">{{alertTitle}}</h2>
    <p>Dear {{clientName}},</p>
    <p>{{introLine}}</p>
    <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
      <tbody>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 40%;">Client Name</td><td style="padding: 8px; border: 1px solid #ddd;">{{clientName}}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Site Name</td><td style="padding: 8px; border: 1px solid #ddd;">{{siteName}}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Site Address</td><td style="padding: 8px; border: 1px solid #ddd;">{{siteAddress}}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Sensor ID</td><td style="padding: 8px; border: 1px solid #ddd;">{{sensorId}}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Alert Type</td><td style="padding: 8px; border: 1px solid #ddd;">{{alertTypeLabel}}</td></tr>
        {{detailRow}}
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Alert Generated At</td><td style="padding: 8px; border: 1px solid #ddd;">{{generatedAt}}</td></tr>
      </tbody>
    </table>
    <p style="color: #666; font-size: 13px;">{{footerLine}}</p>
    <p>Best regards,<br>Duton Monitoring System</p>
  </div>
</body>
</html>
  `;
}

/**
 * Send an automated sensor alert email (offline / abnormal reading).
 * alert = { alertType: "offline"|"abnormal_reading", clientName, siteName, siteAddress,
 *           sensorId, readingValue, offlineDurationHours, generatedAt }
 */
export async function sendSensorAlertEmail(recipients, cc, alert) {
  if (!isSmtpConfigured()) {
    console.error("[emailService] SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASS in config.");
    return false;
  }

  const isOffline = alert.alertType === "offline";
  const alertTypeLabel = isOffline ? "Offline" : "Abnormal Reading";
  const alertTitle = isOffline
    ? `Sensor Offline Alert - ${alert.sensorId}`
    : `Abnormal Sensor Reading Alert - ${alert.sensorId}`;
  const introLine = isOffline
    ? `Our monitoring system has detected that the sensor below has been offline for more than ${alert.offlineDurationHours} hours. Please check the power and network connectivity of the device.`
    : `Our monitoring system has detected that the sensor below has been continuously reporting abnormal readings for more than 24 hours. Please inspect the device.`;
  const detailRow = isOffline
    ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Offline Duration</td><td style="padding: 8px; border: 1px solid #ddd;">${alert.offlineDurationHours} hours</td></tr>`
    : `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reading Value</td><td style="padding: 8px; border: 1px solid #ddd;">${alert.readingValue}</td></tr>`;

  const variables = {
    headerColor: isOffline ? "#c0392b" : "#e67e22",
    alertTitle,
    introLine,
    clientName: alert.clientName || "Client",
    siteName: alert.siteName || "-",
    siteAddress: alert.siteAddress || "-",
    sensorId: alert.sensorId,
    alertTypeLabel,
    detailRow,
    generatedAt: alert.generatedAt,
    footerLine: "You will keep receiving these alerts until the issue is resolved. This is an automated notification - please do not reply to this email.",
  };

  const html = renderTemplate(buildSensorAlertTemplate(), variables);

  const text = [
    `${alertTitle}`,
    "",
    `Dear ${variables.clientName},`,
    "",
    introLine,
    "",
    `Client Name: ${variables.clientName}`,
    `Site Name: ${variables.siteName}`,
    `Site Address: ${variables.siteAddress}`,
    `Sensor ID: ${alert.sensorId}`,
    `Alert Type: ${alertTypeLabel}`,
    isOffline
      ? `Offline Duration: ${alert.offlineDurationHours} hours`
      : `Reading Value: ${alert.readingValue}`,
    `Alert Generated At: ${alert.generatedAt}`,
    "",
    "Best regards,",
    "Duton Monitoring System",
  ].join("\n");

  try {
    const message = {
      from: fromAddress(),
      to: recipients,
      subject: alertTitle,
      text,
      html,
    };
    // CC must not duplicate a "to" address
    const ccList = (cc || []).filter((email) => !recipients.includes(email));
    if (ccList.length > 0) {
      message.cc = ccList;
    }

    const info = await getTransporter().sendMail(message);
    console.info("[emailService] Sensor alert email sent:", {
      to: recipients,
      cc: ccList,
      sensorId: alert.sensorId,
      alertType: alert.alertType,
      messageId: info?.messageId || null,
    });
    return true;
  } catch (error) {
    const details = error?.response || error?.message || error;
    console.error("[emailService] sendSensorAlertEmail failed:", {
      to: recipients,
      sensorId: alert.sensorId,
      alertType: alert.alertType,
      error: details,
    });
    return false;
  }
}

// Ticket notification emails via Brevo SMTP (from alerts@florosense.com)
export async function sendSmtpEmail(toEmail, subject, text, html = null) {
  if (!isSmtpConfigured()) {
    console.error("[emailService] SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASS in config.");
    return false;
  }

  try {
    console.info("[emailService] Email send attempt:", {
      to: toEmail,
      subject,
      provider: "smtp",
    });

    const info = await getTransporter().sendMail({
      from: fromAddress(),
      to: toEmail,
      subject,
      text,
      html: html || `<pre>${text}</pre>`,
    });

    console.info("[emailService] Email sent successfully:", {
      to: toEmail,
      subject,
      messageId: info?.messageId || null,
      accepted: info?.accepted || [],
      rejected: info?.rejected || [],
      provider: "smtp",
    });

    return (info?.rejected || []).length === 0;
  } catch (error) {
    const details = error?.response || error?.message || error;
    console.error("[emailService] SMTP sendSmtpEmail failed:", {
      to: toEmail,
      subject,
      error: details,
    });
    return false;
  }
}

// OTP, magic link and credential emails via SendGrid (from ticketcenter@florosense.com)
export async function sendEmail(toEmail, subject, text, html = null) {
  if (!settings.SENDGRID_API_KEY) {
    console.error("[emailService] SendGrid is not configured. Check SENDGRID_API_KEY in config.");
    return false;
  }

  try {
    console.info("[emailService] Email send attempt:", {
      to: toEmail,
      subject,
      provider: "sendgrid",
    });

    const [response] = await sgMail.send({
      to: toEmail,
      from: {
        email: settings.SENDGRID_FROM_EMAIL,
        name: settings.SENDGRID_FROM_NAME,
      },
      subject,
      text,
      html: html || `<pre>${text}</pre>`,
    });

    const messageId =
      response?.headers?.["x-message-id"] ||
      response?.headers?.["X-Message-Id"] ||
      null;

    console.info("[emailService] Email sent successfully:", {
      to: toEmail,
      subject,
      statusCode: response?.statusCode || null,
      messageId,
      provider: "sendgrid",
    });

    return true;
  } catch (error) {
    const details = error?.response?.body || error?.message || error;
    console.error("[emailService] SendGrid sendEmail failed:", {
      to: toEmail,
      subject,
      error: details,
    });
    return false;
  }
}

