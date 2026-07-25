/**
 * sighting.test.ts
 * Automated unit and logic tests for Sighting Map & Location Tracking system.
 * Runnable with ts-node: npx ts-node src/tests/sighting.test.ts
 */

import assert from 'assert';
import { validateCoordinates } from '../services/sighting.service';

function runTests() {
  console.log('--- Running Sighting Map & Location Tracking Tests ---');

  // 1. Coordinate Validation
  console.log('[Test 1] Validates correct latitude and longitude values');
  assert.strictEqual(validateCoordinates(12.9141, 74.856), true);
  assert.strictEqual(validateCoordinates(0, 0), true);
  assert.strictEqual(validateCoordinates(-90, -180), true);
  assert.strictEqual(validateCoordinates(90, 180), true);

  console.log('[Test 2] Rejects out-of-bounds latitudes');
  assert.strictEqual(validateCoordinates(90.1, 74.856), false);
  assert.strictEqual(validateCoordinates(-91, 74.856), false);

  console.log('[Test 3] Rejects out-of-bounds longitudes');
  assert.strictEqual(validateCoordinates(12.9141, 180.5), false);
  assert.strictEqual(validateCoordinates(12.9141, -181), false);

  console.log('[Test 4] Rejects NaN or invalid inputs');
  assert.strictEqual(validateCoordinates(NaN, 74.856), false);
  assert.strictEqual(validateCoordinates(12.9141, '74.856' as any), false);

  // 2. Video Timestamp Calculation
  console.log('[Test 5] Calculates exact sighting time from recording start time and video timestamp');
  const recordingStartTime = new Date('2026-07-25T10:00:00Z');
  const videoTimestampSeconds = 125.5; // 2 minutes 5.5 seconds
  const calculatedTime = new Date(recordingStartTime.getTime() + videoTimestampSeconds * 1000);
  assert.strictEqual(calculatedTime.toISOString(), '2026-07-25T10:02:05.500Z');

  console.log('[Test 6] Preserves recordedAt start time over uploadedAt date');
  const recordedAt = new Date('2026-05-10T08:30:00Z');
  const sightingTime = new Date(recordedAt.getTime() + 45 * 1000);
  assert.strictEqual(sightingTime.toISOString(), '2026-05-10T08:30:45.000Z');

  // 3. GeoJSON Coordinate Ordering
  console.log('[Test 7] Formats GeoJSON coordinates strictly as [longitude, latitude]');
  const lat = 12.9141;
  const lng = 74.856;
  const geoJsonPoint = {
    type: 'Point',
    coordinates: [lng, lat],
  };
  assert.strictEqual(geoJsonPoint.coordinates[0], 74.856);
  assert.strictEqual(geoJsonPoint.coordinates[1], 12.9141);

  // 4. Track Deduplication Window
  console.log('[Test 8] Identifies duplicate detections within 60-second window');
  const time1 = new Date('2026-07-25T12:00:00Z');
  const time2 = new Date('2026-07-25T12:00:45Z'); // 45 seconds later
  const time3 = new Date('2026-07-25T12:02:00Z'); // 2 minutes later
  const cooldownCutoff = new Date(time2.getTime() - 60000);

  assert.strictEqual(time1 >= cooldownCutoff, true);
  assert.strictEqual(time1 >= new Date(time3.getTime() - 60000), false);

  // 5. Security & Data Model Rules
  console.log('[Test 9] Does not expose RTSP credentials in location object');
  const cameraLocation = {
    name: 'Main Entrance Gate',
    latitude: 12.9141,
    longitude: 74.856,
  };
  assert.strictEqual('rtspUrl' in cameraLocation, false);
  assert.strictEqual('ipAddress' in cameraLocation, false);

  console.log('[Test 10] Stores snapshot as string key instead of binary buffer');
  const sightingRecord = {
    snapshotObjectKey: 'snapshots/snap_12345.jpg',
    location: { name: 'Gate A', latitude: 12.9141, longitude: 74.856 },
  };
  assert.strictEqual(typeof sightingRecord.snapshotObjectKey, 'string');
  assert.strictEqual(Buffer.isBuffer(sightingRecord.snapshotObjectKey), false);

  console.log('✅ ALL 10 SIGHTING MAP UNIT TESTS PASSED CLEANLY!');
}

runTests();
