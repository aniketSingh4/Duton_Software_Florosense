import cron from "node-cron";
import * as database from "./database.js";
import { sendSensorAlertEmail } from "../utils/emailService.js";

// Alert thresholds (hours)
const OFFLINE_THRESHOLD_HOURS = 24; // first offline alert after 24h offline
const OFFLINE_ESCALATION_HOURS = 48; // after 48h offline, alert every 12h
const OFFLINE_DAILY_INTERVAL_HOURS = 24; // one alert per day between 24h and 48h
const OFFLINE_ESCALATED_INTERVAL_HOURS = 12; // one alert every 12h after 48h
const ABNORMAL_CONTINUOUS_HOURS = 24; // abnormal readings must persist 24h continuously
const ABNORMAL_ALERT_INTERVAL_HOURS = 24; // max one abnormal alert per day per sensor

// Abnormal reading range: 0, negative, or greater than 500
const ABNORMAL_MAX_VALUE = 500;

const HOUR_MS = 60 * 60 * 1000;
const CRON_SCHEDULE = "*/15 * * * *"; // check every 15 minutes

let scheduledTask = null;
let isRunning = false;

function isAbnormalValue(value) {
  if (value === null || value === undefined || isNaN(value)) return false;
  return value <= 0 || value > ABNORMAL_MAX_VALUE;
}

// Primary reading value for a reading document (PM2.5, falling back to PM10)
function primaryReadingValue(reading) {
  const value =
    reading.pm2_5 ??
    reading.pms_2_5 ??
    reading.pm10_0 ??
    reading.pms_10 ??
    null;
  return value === null || value === undefined ? null : Number(value);
}

function formatAlertTimestamp(date) {
  return date.toLocaleString("en-IN", {
    timeZone: process.env.ALERT_TIMEZONE || "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Resolve email recipients for a sensor: all active builder/contractor users
 * assigned to the sensor's site with alert notifications enabled, plus any
 * extra recipient/CC addresses configured by the admin.
 */
async function resolveRecipients(sensor, usersByUsername) {
  const siteKeys = [...new Set([sensor.site_name, sensor.site_id].filter(Boolean))];

  const assignments = [];
  for (const key of siteKeys) {
    const siteAssignments = await database.getUsersForSite(key);
    assignments.push(...siteAssignments);
  }

  const to = new Set();
  const cc = new Set();

  for (const assignment of assignments) {
    const user = usersByUsername[assignment.username];
    if (!user) continue;
    if (user.is_active === false) continue;
    if (user.alert_notifications_enabled === false) continue; // admin toggle off

    if (user.email) to.add(user.email);
    for (const email of user.alert_emails || []) to.add(email);
    for (const email of user.alert_cc || []) cc.add(email);
  }

  return { to: [...to], cc: [...cc] };
}

async function sendAndLogAlert(sensor, recipients, alertDetails) {
  const now = new Date();
  const sent = await sendSensorAlertEmail(recipients.to, recipients.cc, {
    ...alertDetails,
    clientName: sensor.client_name,
    siteName: sensor.site_name,
    siteAddress: sensor.site_address,
    sensorId: sensor.sensor_id,
    generatedAt: formatAlertTimestamp(now),
  });

  await database.createAlertLog({
    alert_type: alertDetails.alertType,
    sensor_id: sensor.sensor_id,
    client_name: sensor.client_name || null,
    site_name: sensor.site_name || null,
    site_address: sensor.site_address || null,
    reading_value: alertDetails.readingValue ?? null,
    offline_duration_hours: alertDetails.offlineDurationHours ?? null,
    recipients: recipients.to,
    cc: recipients.cc,
    delivery_status: sent ? "sent" : "failed",
  });

  return sent;
}

async function checkOfflineStatus(sensor, lastReading, state, now, getRecipients) {
  const offlineMs = now.getTime() - new Date(lastReading.timestamp).getTime();
  const offlineHours = offlineMs / HOUR_MS;

  if (offlineHours <= OFFLINE_THRESHOLD_HOURS) {
    // Sensor is online - close out any pending offline alert cycle
    if (state?.last_offline_alert_at) {
      await database.resolveOpenAlerts(sensor.sensor_id, "offline");
      await database.updateAlertState(sensor.sensor_id, { last_offline_alert_at: null });
      console.log(`[AlertMonitor] Sensor ${sensor.sensor_id} back online - offline alerts resolved`);
    }
    return false; // not offline
  }

  // Offline for more than 24h: 1/day until 48h, then every 12h
  const intervalHours =
    offlineHours > OFFLINE_ESCALATION_HOURS
      ? OFFLINE_ESCALATED_INTERVAL_HOURS
      : OFFLINE_DAILY_INTERVAL_HOURS;

  const lastAlertAt = state?.last_offline_alert_at ? new Date(state.last_offline_alert_at) : null;
  const hoursSinceLastAlert = lastAlertAt ? (now.getTime() - lastAlertAt.getTime()) / HOUR_MS : Infinity;

  if (hoursSinceLastAlert >= intervalHours) {
    const recipients = await getRecipients();
    if (recipients.to.length === 0) {
      return true; // offline, but nobody to notify (unassigned site or alerts disabled)
    }

    await sendAndLogAlert(sensor, recipients, {
      alertType: "offline",
      offlineDurationHours: Math.floor(offlineHours),
    });
    await database.updateAlertState(sensor.sensor_id, { last_offline_alert_at: now });
    console.log(
      `[AlertMonitor] Offline alert sent for sensor ${sensor.sensor_id} (offline ${Math.floor(offlineHours)}h)`
    );
  }

  return true; // sensor is offline
}

async function checkAbnormalReadings(sensor, lastReading, state, now, getRecipients) {
  const latestValue = primaryReadingValue(lastReading);
  if (latestValue === null) {
    return; // no PM data to evaluate
  }

  if (!isAbnormalValue(latestValue)) {
    // Reading back to normal - close out any pending abnormal alert cycle
    if (state?.last_abnormal_alert_at) {
      await database.resolveOpenAlerts(sensor.sensor_id, "abnormal_reading");
      await database.updateAlertState(sensor.sensor_id, { last_abnormal_alert_at: null });
      console.log(`[AlertMonitor] Sensor ${sensor.sensor_id} reading back to normal - abnormal alerts resolved`);
    }
    return;
  }

  // Latest reading is abnormal - verify it has been abnormal continuously for 24h
  const windowStart = new Date(now.getTime() - ABNORMAL_CONTINUOUS_HOURS * HOUR_MS);
  const readings = await database.getRawSensorReadingsSince(sensor.sensor_id, windowStart);

  if (readings.length === 0) return;

  // Continuity requires: coverage from the start of the 24h window (with 30min slack
  // for the collector interval) and no normal reading anywhere in the window.
  const coverageStart = new Date(readings[0].timestamp).getTime();
  const coversFullWindow = coverageStart <= windowStart.getTime() + 30 * 60 * 1000;
  const anyNormal = readings.some((reading) => {
    const value = primaryReadingValue(reading);
    return value !== null && !isAbnormalValue(value);
  });

  if (!coversFullWindow || anyNormal) {
    return; // not yet 24 continuous hours of abnormal readings
  }

  const lastAlertAt = state?.last_abnormal_alert_at ? new Date(state.last_abnormal_alert_at) : null;
  const hoursSinceLastAlert = lastAlertAt ? (now.getTime() - lastAlertAt.getTime()) / HOUR_MS : Infinity;

  if (hoursSinceLastAlert >= ABNORMAL_ALERT_INTERVAL_HOURS) {
    const recipients = await getRecipients();
    if (recipients.to.length === 0) {
      return;
    }

    await sendAndLogAlert(sensor, recipients, {
      alertType: "abnormal_reading",
      readingValue: latestValue,
    });
    await database.updateAlertState(sensor.sensor_id, { last_abnormal_alert_at: now });
    console.log(
      `[AlertMonitor] Abnormal reading alert sent for sensor ${sensor.sensor_id} (value: ${latestValue})`
    );
  }
}

export async function runAlertChecks() {
  if (isRunning) {
    return;
  }
  isRunning = true;

  try {
    const now = new Date();
    const sensors = await database.getAllSensors({ is_active: true });
    if (!sensors || sensors.length === 0) {
      return;
    }

    const sensorIds = sensors.map((sensor) => sensor.sensor_id);
    const [latestReadings, states, clientUsers] = await Promise.all([
      database.getAllLatestSensorReadings(sensorIds),
      database.getAlertStates(),
      database.getAllUsers({ roles: ["builder", "contractor"] }),
    ]);

    const usersByUsername = {};
    for (const user of clientUsers) {
      usersByUsername[user.username] = user;
    }

    for (const sensor of sensors) {
      try {
        const lastReading = latestReadings[sensor.sensor_id];
        if (!lastReading || !lastReading.timestamp) {
          continue; // sensor has never reported - nothing to monitor yet
        }

        const state = states[sensor.sensor_id];

        // Lazily resolve recipients only when an alert actually needs sending
        let cachedRecipients = null;
        const getRecipients = async () => {
          if (!cachedRecipients) {
            cachedRecipients = await resolveRecipients(sensor, usersByUsername);
          }
          return cachedRecipients;
        };

        const isOffline = await checkOfflineStatus(sensor, lastReading, state, now, getRecipients);

        // Abnormal readings are only evaluated while the sensor is online
        if (!isOffline) {
          await checkAbnormalReadings(sensor, lastReading, state, now, getRecipients);
        }
      } catch (error) {
        console.error(`[AlertMonitor] Error processing sensor ${sensor.sensor_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[AlertMonitor] Error during alert checks:", error);
  } finally {
    isRunning = false;
  }
}

export function startAlertMonitor() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(CRON_SCHEDULE, () => {
    runAlertChecks().catch((error) => {
      console.error("[AlertMonitor] Error in scheduled alert check:", error);
    });
  });

  // Initial check shortly after startup
  setTimeout(() => {
    runAlertChecks().catch((error) => {
      console.error("[AlertMonitor] Error in initial alert check:", error);
    });
  }, 15000);

  console.log(`[AlertMonitor] Started (schedule: ${CRON_SCHEDULE})`);
}

export function stopAlertMonitor() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
