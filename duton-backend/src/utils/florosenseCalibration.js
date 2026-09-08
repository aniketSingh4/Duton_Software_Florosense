const FLOROSENSE_BASE_URL = process.env.NEXT_PUBLIC_FLOROSENSE_API_URL || process.env.FLOROSENSE_BASE_URL || process.env.FLOROSENSE_API_URL;
const FLOROSENSE_API_KEY = process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY || process.env.FLOROSENSE_API_KEY;

if (!FLOROSENSE_BASE_URL) {
  throw new Error("FLOROSENSE_BASE_URL (or NEXT_PUBLIC_FLOROSENSE_API_URL) must be set in environment variables.");
}

if (!FLOROSENSE_API_KEY) {
  throw new Error("FLOROSENSE_API_KEY (or NEXT_PUBLIC_FLOROSENSE_API_KEY) must be set in environment variables.");
}

export async function fetchCalibrationFromFloroSense(sensorId) {
  if (!sensorId) {
    return null;
  }

  try {
    const url = `${FLOROSENSE_BASE_URL}/admin/calibration/sensors/${encodeURIComponent(sensorId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": FLOROSENSE_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

