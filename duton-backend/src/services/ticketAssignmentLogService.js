import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { getSettings } from "../config.js";

const settings = getSettings();
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const SHEET_NAME = "TicketAssignments";
let logWriteQueue = Promise.resolve();

const LOG_HEADERS = [
  "ticketNumber",
  "ticketName",
  "sensorNumber",
  "issueType",
  "description",
  "status",
  "issueDate",
  "assignedOwner",
  "isAssigned",
  "isEmailSent",
  "queuedAt",
  "assignedAt",
  "emailSentAt",
];

function withLogFileLock(task) {
  const result = logWriteQueue.then(task);
  logWriteQueue = result.catch(() => {});
  return result;
}

async function writeWorkbookAtomically(workbook, filePath) {
  const tempPath = `${filePath}.tmp`;
  await workbook.xlsx.writeFile(tempPath);
  await fs.rename(tempPath, filePath);
}

function getLogFilePath() {
  if (path.isAbsolute(settings.TICKET_ASSIGNMENT_LOG_FILE)) {
    return settings.TICKET_ASSIGNMENT_LOG_FILE;
  }
  return path.resolve(PROJECT_ROOT, settings.TICKET_ASSIGNMENT_LOG_FILE);
}

async function ensureWorkbookExists() {
  const filePath = getLogFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let isValid = false;
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > 0) {
      isValid = true;
    }
  } catch {
    // File does not exist or cannot be accessed
  }

  if (!isValid) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(SHEET_NAME);
    worksheet.addRow(LOG_HEADERS);
    await writeWorkbookAtomically(workbook, filePath);
  }
}

function normalizeCellValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function readRows(workbook) {
  const worksheet = workbook.getWorksheet(SHEET_NAME);
  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headers = LOG_HEADERS.map((header, index) => {
    const actualHeader = headerRow.getCell(index + 1).value;
    return normalizeCellValue(actualHeader) || header;
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = normalizeCellValue(row.getCell(index + 1).value);
    });
    rows.push(rowData);
  });

  return rows;
}

function writeRows(workbook, rows) {
  let worksheet = workbook.getWorksheet(SHEET_NAME);
  if (!worksheet) {
    worksheet = workbook.addWorksheet(SHEET_NAME);
  }

  if (worksheet.rowCount > 0) {
    worksheet.spliceRows(1, worksheet.rowCount);
  }

  worksheet.addRow(LOG_HEADERS);
  rows.forEach((row) => {
    worksheet.addRow(LOG_HEADERS.map((header) => row[header] ?? ""));
  });
}

async function upsertAssignmentLogImpl(ticket) {
  await ensureWorkbookExists();
  const filePath = getLogFilePath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = readRows(workbook);

  const rowIndex = rows.findIndex((row) => row.ticketNumber === ticket.ticketNumber);
  const nextRow = {
    ticketNumber: ticket.ticketNumber,
    ticketName: ticket.ticketName || "",
    sensorNumber: ticket.sensorNumber || "",
    issueType: ticket.issueType || "",
    description: ticket.description || "",
    status: ticket.status || "",
    issueDate: ticket.issueDate || "",
    assignedOwner: ticket.assignedOwner || "",
    isAssigned: ticket.isAssigned ? "true" : "false",
    isEmailSent: ticket.isEmailSent ? "true" : "false",
    queuedAt: ticket.queuedAt || "",
    assignedAt: ticket.assignedAt || "",
    emailSentAt: ticket.emailSentAt || "",
  };

  if (rowIndex >= 0) {
    rows[rowIndex] = { ...rows[rowIndex], ...nextRow };
  } else {
    rows.push(nextRow);
  }

  writeRows(workbook, rows);
  await writeWorkbookAtomically(workbook, filePath);
}

export function upsertAssignmentLog(ticket) {
  return withLogFileLock(() => upsertAssignmentLogImpl(ticket));
}

export function logSuccessfulAssignment(ticket, owner, dispatchedAtIso) {
  return withLogFileLock(() =>
    upsertAssignmentLogImpl({
      ticketNumber: ticket.id,
      ticketName: ticket.issue_type || ticket.sensor_name || "",
      sensorNumber: ticket.sensor_id || "",
      issueType: ticket.issue_type || "",
      description: ticket.description || "",
      status: ticket.status || "Open",
      issueDate: ticket.created_at || "",
      assignedOwner: owner,
      isAssigned: true,
      isEmailSent: true,
      queuedAt: ticket.updated_at || ticket.created_at || dispatchedAtIso,
      assignedAt: dispatchedAtIso,
      emailSentAt: dispatchedAtIso,
    })
  );
}

async function markAssignmentDispatchedImpl(ticketNumber, emailSent = false) {
  await ensureWorkbookExists();
  const filePath = getLogFilePath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = readRows(workbook);
  const rowIndex = rows.findIndex((row) => row.ticketNumber === String(ticketNumber));
  const nowIso = new Date().toISOString();

  if (rowIndex === -1) {
    return;
  }

  rows[rowIndex] = {
    ...rows[rowIndex],
    isAssigned: "true",
    assignedAt: nowIso,
    isEmailSent: emailSent ? "true" : rows[rowIndex].isEmailSent || "false",
    emailSentAt: emailSent ? nowIso : rows[rowIndex].emailSentAt || "",
  };

  writeRows(workbook, rows);
  await writeWorkbookAtomically(workbook, filePath);
}

export function markAssignmentDispatched(ticketNumber, emailSent = false) {
  return withLogFileLock(() => markAssignmentDispatchedImpl(ticketNumber, emailSent));
}

async function markEmailSentForOwnerImpl(ownerUsername) {
  await ensureWorkbookExists();
  const filePath = getLogFilePath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = readRows(workbook);
  const nowIso = new Date().toISOString();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.assignedOwner === ownerUsername && row.isAssigned === "true" && row.isEmailSent !== "true") {
      rows[index] = {
        ...row,
        isEmailSent: "true",
        emailSentAt: nowIso,
      };
    }
  }

  writeRows(workbook, rows);
  await writeWorkbookAtomically(workbook, filePath);
}

export function markEmailSentForOwner(ownerUsername) {
  return withLogFileLock(() => markEmailSentForOwnerImpl(ownerUsername));
}
