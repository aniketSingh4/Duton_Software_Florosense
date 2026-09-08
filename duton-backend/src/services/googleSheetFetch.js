import { parseString } from "@fast-csv/parse";

const SHEET_EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/1A8E5cu-j3aD2K-HK-ywkO4P11usqXuUCLcv_9BlgWxs/export?format=csv&gid=0";

function rowToSite(values) {
  const rowSensorId = values[6] ? String(values[6]).trim() : "";
  if (!rowSensorId) {
    return null;
  }
  return {
    sl_no: values[0] ? String(values[0]).trim() : "",
    site_name: values[1] ? String(values[1]).trim() : "",
    latitude: values[2] ? String(values[2]).trim() : "",
    longitude: values[3] ? String(values[3]).trim() : "",
    site_address: values[4] ? String(values[4]).trim() : "",
    developers_builders: values[5] ? String(values[5]).trim() : "",
    sensor_id: rowSensorId,
  };
}

async function fetchSheetRows() {
  const response = await fetch(SHEET_EXPORT_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch data from Google Sheets");
  }

  const csvData = await response.text();
  return new Promise((resolve, reject) => {
    const parsedRows = [];
    parseString(csvData, { headers: false, ignoreEmpty: true })
      .on("error", reject)
      .on("data", (row) => parsedRows.push(row))
      .on("end", () => resolve(parsedRows));
  });
}

export async function fetchAllSitesFromGoogleSheet() {
  const rows = await fetchSheetRows();
  const allSitesData = [];

  for (let i = 1; i < rows.length; i++) {
    const site = rowToSite(rows[i] || []);
    if (site) {
      allSitesData.push(site);
    }
  }

  return allSitesData;
}

export async function fetchSiteBySensorIdFromGoogleSheet(sensorId) {
  const normalizedSensorId = String(sensorId || "").trim().toLowerCase();
  if (!normalizedSensorId) {
    return null;
  }

  const rows = await fetchSheetRows();

  for (let i = 1; i < rows.length; i++) {
    const site = rowToSite(rows[i] || []);
    if (site && site.sensor_id.toLowerCase() === normalizedSensorId) {
      return site;
    }
  }

  return null;
}
