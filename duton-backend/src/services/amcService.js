// AMC & Warranty tracking logic.
//
// One record per sensor (keyed by sensor_id) with the client username it was
// configured for. Dates are stored at UTC midnight so day-level math is stable.
//
// Rules:
//   Warranty Expiry = Installation Date + 1 year
//   AMC Expiry      = AMC Renewal Date + 1 year
//   next expiry     = AMC Expiry if a renewal date exists, else Warranty Expiry
//   alert active    = tracked AND next expiry is <= ALERT_WINDOW_DAYS away (or already passed)

import * as database from "./database.js";

export const ALERT_WINDOW_DAYS = 90;
export const CLIENT_ROLES = ["builder", "contractor"];

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function parseYmd(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const text = String(value).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addYears(date, years) {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// "Today" using the server's local calendar date, normalised to UTC midnight.
export function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function daysUntil(date, from = today()) {
  if (!date) return null;
  return Math.round((date.getTime() - from.getTime()) / DAY_MS);
}

const toIso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null);

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

export function computeStatus(record, now = today()) {
  const tracked = record?.tracked === true;
  const installationDate = parseYmd(record?.installation_date);
  const warrantyExpiry = installationDate ? addYears(installationDate, 1) : null;
  const renewalDate = parseYmd(record?.amc_renewal_date);
  const amcExpiry = renewalDate ? addYears(renewalDate, 1) : null;

  const warrantyDays = daysUntil(warrantyExpiry, now);
  const amcDays = daysUntil(amcExpiry, now);

  const nextExpiry = amcExpiry || warrantyExpiry;
  const expiryType = amcExpiry ? "amc" : warrantyExpiry ? "warranty" : null;
  const daysRemaining = daysUntil(nextExpiry, now);

  const alertActive = tracked && daysRemaining !== null && daysRemaining <= ALERT_WINDOW_DAYS;
  // Renewal field appears once the warranty has expired, or once an AMC already exists.
  const renewalAllowed = Boolean(renewalDate) || (warrantyDays !== null && warrantyDays <= 0);

  return {
    tracked,
    installation_date: toIso(installationDate),
    warranty_expiry: toIso(warrantyExpiry),
    warranty_days_remaining: warrantyDays,
    amc_renewal_date: toIso(renewalDate),
    amc_expiry: toIso(amcExpiry),
    amc_days_remaining: amcDays,
    next_expiry: toIso(nextExpiry),
    expiry_type: expiryType,
    days_remaining: daysRemaining,
    alert_active: alertActive,
    renewal_allowed: renewalAllowed,
  };
}

// ---------------------------------------------------------------------------
// Sensor resolution for a client user (same rules as the client dashboard:
// sensors on assigned sites plus directly assigned sensors)
// ---------------------------------------------------------------------------

export async function getSensorsForClientUser(username) {
  const seen = new Map();

  const sites = await database.getUserSites(username);
  for (const site of sites) {
    // Sensors reference sites by display name (site_name); some may carry site_id. Match on both.
    const keys = Array.from(new Set([site.site_id, site.site_name].filter(Boolean)));
    for (const key of keys) {
      const siteSensors = await database.getSensorsForSite(key);
      for (const sensor of siteSensors) {
        if (sensor.sensor_id && !seen.has(sensor.sensor_id)) {
          seen.set(sensor.sensor_id, { ...sensor, site_address: sensor.site_address || site.site_address || null });
        }
      }
    }
  }

  const direct = await database.getUserSensors(username);
  for (const sensor of direct) {
    if (sensor.sensor_id && !seen.has(sensor.sensor_id)) {
      seen.set(sensor.sensor_id, sensor);
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Admin: clients list with AMC flags
// ---------------------------------------------------------------------------

export async function listClientsWithAmc({ search = null, skip = 0, limit = 10 } = {}) {
  const users = await database.getAllUsers({ roles: CLIENT_ROLES, search });
  const records = await database.getAmcRecords({ tracked: true });
  const now = today();

  const byUser = new Map();
  for (const record of records) {
    const bucket = byUser.get(record.username) || { tracked: 0, alerts: 0 };
    bucket.tracked += 1;
    if (computeStatus(record, now).alert_active) bucket.alerts += 1;
    byUser.set(record.username, bucket);
  }

  const rows = users.map((user) => {
    const bucket = byUser.get(user.username) || { tracked: 0, alerts: 0 };
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      client_name: user.client_name,
      site_name: user.site_name,
      site_address: user.site_address,
      spoc_name: user.spoc_name,
      spoc_contact: user.spoc_contact,
      amc_enabled: bucket.tracked > 0,
      tracked_sensor_count: bucket.tracked,
      alert_sensor_count: bucket.alerts,
      alert_active: bucket.alerts > 0,
    };
  });

  return {
    clients: rows.slice(skip, skip + limit),
    totalCount: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Admin: sensors for one client merged with AMC records
// ---------------------------------------------------------------------------

export async function getClientAmcSensors(username) {
  const user = await database.getUserByUsername(username);
  if (!user) return null;

  const sensors = await getSensorsForClientUser(username);
  const records = await database.getAmcRecordsForSensors(sensors.map((s) => s.sensor_id));
  const recordsById = new Map(records.map((r) => [r.sensor_id, r]));
  const now = today();

  const rows = sensors.map((sensor) => {
    const record = recordsById.get(sensor.sensor_id) || null;
    return {
      sensor_id: sensor.sensor_id,
      device_id: sensor.device_id,
      site_name: sensor.site_name || user.site_name || null,
      site_address: sensor.site_address || user.site_address || null,
      client_name: sensor.client_name || user.client_name || null,
      spoc_name: sensor.spoc_name || user.spoc_name || null,
      spoc_contact: sensor.spoc_contact || user.spoc_contact || null,
      is_active: sensor.is_active !== false,
      ...computeStatus(record, now),
      updated_at: record?.updated_at ? toIso(new Date(record.updated_at)) : null,
      updated_by: record?.updated_by || null,
    };
  });

  return {
    client: {
      username: user.username,
      client_name: user.client_name,
      email: user.email,
      site_name: user.site_name,
      site_address: user.site_address,
      spoc_name: user.spoc_name,
      spoc_contact: user.spoc_contact,
    },
    sensors: rows,
  };
}

// ---------------------------------------------------------------------------
// Admin: save sensor tracking for a client (validates, computes, audits)
// ---------------------------------------------------------------------------

export async function saveClientAmcSensors(username, updates, changedBy) {
  const user = await database.getUserByUsername(username);
  if (!user) {
    const error = new Error("Client not found");
    error.status = 404;
    throw error;
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    const error = new Error("sensors array is required");
    error.status = 400;
    throw error;
  }

  const clientSensors = await getSensorsForClientUser(username);
  const allowedIds = new Set(clientSensors.map((s) => s.sensor_id));

  // Validate every row before writing anything.
  const normalised = [];
  for (const item of updates) {
    const sensorId = String(item?.sensor_id || "").trim();
    if (!sensorId) {
      const error = new Error("sensor_id is required for every row");
      error.status = 400;
      throw error;
    }
    if (!allowedIds.has(sensorId)) {
      const error = new Error(`Sensor ${sensorId} is not assigned to client ${username}`);
      error.status = 400;
      throw error;
    }

    const tracked = item.tracked === true;
    const installationDate = parseYmd(item.installation_date);
    const renewalDate = parseYmd(item.amc_renewal_date);

    if (item.installation_date && !installationDate) {
      const error = new Error(`Invalid installation_date for sensor ${sensorId} (expected YYYY-MM-DD)`);
      error.status = 400;
      throw error;
    }
    if (item.amc_renewal_date && !renewalDate) {
      const error = new Error(`Invalid amc_renewal_date for sensor ${sensorId} (expected YYYY-MM-DD)`);
      error.status = 400;
      throw error;
    }
    if (tracked && !installationDate) {
      const error = new Error(`Installation date is required to track sensor ${sensorId}`);
      error.status = 400;
      throw error;
    }
    if (renewalDate && installationDate && renewalDate < installationDate) {
      const error = new Error(`AMC renewal date cannot be before installation date for sensor ${sensorId}`);
      error.status = 400;
      throw error;
    }

    normalised.push({
      sensor_id: sensorId,
      tracked,
      installation_date: installationDate,
      warranty_expiry: installationDate ? addYears(installationDate, 1) : null,
      amc_renewal_date: renewalDate,
      amc_expiry: renewalDate ? addYears(renewalDate, 1) : null,
    });
  }

  const existing = await database.getAmcRecordsForSensors(normalised.map((n) => n.sensor_id));
  const existingById = new Map(existing.map((r) => [r.sensor_id, r]));
  const changedAt = new Date();
  const auditEntries = [];

  const fieldsToAudit = ["tracked", "installation_date", "amc_renewal_date"];
  const asComparable = (value) => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "boolean") return value;
    return String(value);
  };

  for (const row of normalised) {
    const previous = existingById.get(row.sensor_id) || null;

    for (const field of fieldsToAudit) {
      const oldValue = field === "tracked" ? previous?.tracked === true : asComparable(previous?.[field]);
      const newValue = field === "tracked" ? row.tracked : asComparable(row[field]);
      if (oldValue !== newValue) {
        auditEntries.push({
          username,
          client_name: user.client_name || null,
          sensor_id: row.sensor_id,
          field,
          old_value: oldValue,
          new_value: newValue,
          changed_by: changedBy || "unknown",
          changed_at: changedAt,
        });
      }
    }

    await database.upsertAmcRecord(row.sensor_id, {
      username,
      client_name: user.client_name || null,
      tracked: row.tracked,
      installation_date: row.installation_date,
      warranty_expiry: row.warranty_expiry,
      amc_renewal_date: row.amc_renewal_date,
      amc_expiry: row.amc_expiry,
      updated_at: changedAt,
      updated_by: changedBy || "unknown",
    });
  }

  if (auditEntries.length > 0) {
    await database.insertAmcAuditLogs(auditEntries);
  }

  const result = await getClientAmcSensors(username);
  return { ...result, changes: auditEntries.length };
}

// Untrack every sensor of a client (toggle OFF)
export async function disableClientAmc(username, changedBy) {
  const records = await database.getAmcRecords({ username, tracked: true });
  if (records.length === 0) return { changes: 0 };
  const updates = records.map((r) => ({
    sensor_id: r.sensor_id,
    tracked: false,
    installation_date: r.installation_date,
    amc_renewal_date: r.amc_renewal_date,
  }));
  return saveClientAmcSensors(username, updates, changedBy);
}

// ---------------------------------------------------------------------------
// Client dashboard: is the marquee needed for this user?
// ---------------------------------------------------------------------------

export async function getAlertForUser(username) {
  const records = await database.getAmcRecords({ username, tracked: true });
  const now = today();
  const alerting = [];

  const sensors = await database.getSensorsByIds(records.map((r) => r.sensor_id));
  const sensorsById = new Map(sensors.map((s) => [s.sensor_id, s]));

  for (const record of records) {
    const status = computeStatus(record, now);
    if (status.alert_active) {
      const sensor = sensorsById.get(record.sensor_id) || {};
      alerting.push({
        sensor_id: record.sensor_id,
        site_name: sensor.site_name || null,
        site_address: sensor.site_address || null,
        expiry_type: status.expiry_type,
        installation_date: status.installation_date,
        next_expiry: status.next_expiry,
        days_remaining: status.days_remaining,
        expired: status.days_remaining !== null && status.days_remaining < 0,
      });
    }
  }

  // Expired first (most overdue on top), then expiring soonest
  alerting.sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));

  return {
    alert_active: alerting.length > 0,
    expired_count: alerting.filter((s) => s.expired).length,
    expiring_count: alerting.filter((s) => !s.expired).length,
    sensors: alerting,
  };
}

// ---------------------------------------------------------------------------
// Admin: expiry monitoring list
//   type = "warranty" | "amc" | "both"
// ---------------------------------------------------------------------------

export async function getExpiringList({ type = "both", windowDays = ALERT_WINDOW_DAYS } = {}) {
  const records = await database.getAmcRecords({ tracked: true });
  if (records.length === 0) return { rows: [], generated_at: new Date().toISOString(), window_days: windowDays };

  const now = today();
  const sensorIds = records.map((r) => r.sensor_id);
  const usernames = Array.from(new Set(records.map((r) => r.username).filter(Boolean)));

  const [sensors, users] = await Promise.all([
    database.getSensorsByIds(sensorIds),
    database.getUsersByUsernames(usernames),
  ]);
  const sensorsById = new Map(sensors.map((s) => [s.sensor_id, s]));
  const usersByName = new Map(users.map((u) => [u.username, u]));

  const rows = [];
  for (const record of records) {
    const status = computeStatus(record, now);
    const sensor = sensorsById.get(record.sensor_id) || {};
    const user = usersByName.get(record.username) || {};

    const warrantyDue =
      !status.amc_expiry && status.warranty_days_remaining !== null && status.warranty_days_remaining <= windowDays;
    const amcDue = status.amc_days_remaining !== null && status.amc_days_remaining <= windowDays;

    const include =
      type === "warranty" ? warrantyDue : type === "amc" ? amcDue : warrantyDue || amcDue;
    if (!include) continue;

    rows.push({
      expiry_type: amcDue ? "amc" : "warranty",
      username: record.username,
      client_name: sensor.client_name || user.client_name || record.client_name || "-",
      site_name: sensor.site_name || user.site_name || "-",
      site_address: sensor.site_address || user.site_address || "-",
      sensor_id: record.sensor_id,
      device_id: sensor.device_id || record.sensor_id,
      installation_date: status.installation_date,
      warranty_expiry: status.warranty_expiry,
      amc_renewal_date: status.amc_renewal_date,
      amc_expiry: status.amc_expiry,
      expiry_date: amcDue ? status.amc_expiry : status.warranty_expiry,
      days_remaining: amcDue ? status.amc_days_remaining : status.warranty_days_remaining,
      spoc_name: sensor.spoc_name || user.spoc_name || "-",
      spoc_contact: sensor.spoc_contact || user.spoc_contact || "-",
      email: user.email || "-",
    });
  }

  rows.sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));

  return { rows, generated_at: new Date().toISOString(), window_days: windowDays };
}
