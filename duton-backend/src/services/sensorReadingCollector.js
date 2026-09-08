import * as database from "./database.js";
import { getSettings } from "../config.js";

const settings = getSettings();
const COLLECTION_INTERVAL_MS = 10 * 60 * 1000;

let collectionInterval = null;
let isRunning = false;

async function fetchSensorReadingFromFloroSense(sensorId) {
  const url = `${settings.FLOROSENSE_BASE_URL}/api/v1/dashboard/sensors/${encodeURIComponent(sensorId)}/latest/`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": settings.FLOROSENSE_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DutonBackgroundCollector/1.0",
        "Accept": "application/json"
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`FloroSense API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("Request timeout: FloroSense API did not respond within 30 seconds");
    }
    throw error;
  }
}

async function collectAndStoreSensorReading(sensorId) {
  try {
    const readingData = await fetchSensorReadingFromFloroSense(sensorId);
    await database.storeSensorReading(sensorId, readingData);
    
    return { success: true, sensorId, timestamp: readingData.timestamp || new Date().toISOString() };
  } catch (error) {
    console.error(`[SensorReadingCollector] Error collecting reading for sensor ${sensorId}:`, error.message);
    return { success: false, sensorId, error: error.message };
  }
}

async function collectAllSensorReadings() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  
  try {
    const filters = { is_active: true };
    const sensors = await database.getAllSensors(filters);
    
    if (!sensors || sensors.length === 0) {
      return;
    }
    
    const results = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < sensors.length; i += BATCH_SIZE) {
      const batch = sensors.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(sensor => 
        collectAndStoreSensorReading(sensor.sensor_id)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const sensorId = batch[index]?.sensor_id || 'unknown';
          console.error(`[SensorReadingCollector] Failed to process sensor ${sensorId}:`, result.reason);
          results.push({ success: false, sensorId, error: result.reason?.message || 'Unknown error' });
        }
      });
      
      if (i + BATCH_SIZE < sensors.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
  } catch (error) {
    console.error("[SensorReadingCollector] Error during collection:", error);
  } finally {
    isRunning = false;
  }
}

export function startSensorReadingCollector() {
  if (collectionInterval) {
    return;
  }
  
  setTimeout(() => {
    collectAllSensorReadings().catch(error => {
      console.error("[SensorReadingCollector] Error in initial collection:", error);
    });
  }, 5000);
  
  collectionInterval = setInterval(() => {
    collectAllSensorReadings().catch(error => {
      console.error("[SensorReadingCollector] Error in scheduled collection:", error);
    });
  }, COLLECTION_INTERVAL_MS);
}

export function stopSensorReadingCollector() {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
  }
}

export async function triggerCollection() {
  await collectAllSensorReadings();
}

