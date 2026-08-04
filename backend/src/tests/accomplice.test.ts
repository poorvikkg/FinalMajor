/**
 * accomplice.test.ts
 *
 * Automated test script to verify accomplice detection / link analysis.
 * Seeds mock suspects and sightings, runs the detection algorithm, asserts the link is found,
 * and cleans up the database.
 * Run with: npx ts-node src/tests/accomplice.test.ts
 */

import assert from 'assert';
import mongooseConn from 'mongoose';
import { getLinkAnalysis } from '../services/accomplice.service';
import { Sighting } from '../models/Sighting';
import { Camera } from '../models/Camera';
import { Complaint } from '../models/Complaint';
import { UnknownPerson } from '../models/UnknownPerson';
import { User } from '../models/User';

import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  console.log('--- Accomplice Detection Logic Verification ---');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/surveillance_db';
  console.log(`Connecting to database: ${mongoUri}`);

  let mockUser: any = null;
  let createdMockUser = false;
  let mockCamera: any = null;
  let mockComplaint: any = null;
  let mockUnknown: any = null;
  let sightingA: any = null;
  let sightingB: any = null;

  try {
    await mongooseConn.connect(mongoUri);
    console.log('Database connected successfully.');

    // Find a user or create a temporary one for addedBy
    mockUser = await User.findOne();
    if (!mockUser) {
      console.log('No user found, creating a temporary test user...');
      mockUser = await User.create({
        name: 'Test Admin',
        email: `test_admin_${Date.now()}@example.com`,
        password: 'password123',
        role: 'admin'
      });
      createdMockUser = true;
    }

    // 1. Create mock Camera
    console.log('Seeding mock camera...');
    mockCamera = await Camera.create({
      name: 'Test Entry Gate CCTV',
      rtspUrl: 'rtsp://127.0.0.1/live',
      ipAddress: '192.168.1.100',
      type: 'rtsp',
      location: {
        name: 'Test Location Gate',
        latitude: 12.9716,
        longitude: 77.5946,
        locationGeoJson: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      status: 'online',
      addedBy: mockUser._id
    });

    // 2. Create mock Complaint (Known Missing Person)
    console.log('Seeding mock missing person...');
    mockComplaint = await Complaint.create({
      complaintId: `MP-${Date.now()}-TEST`,
      missingPersonName: 'Suspect Alice',
      lastSeenLocation: 'Bangalore',
      lastSeenTime: new Date(),
      reporterName: 'Reporter Bob',
      reporterMobile: '9999999999',
      status: 'complaint_registered'
    });

    // 3. Create mock UnknownPerson (Unknown Recurring Suspect)
    console.log('Seeding mock unknown suspect...');
    mockUnknown = await UnknownPerson.create({
      unknownId: `U-${Math.floor(Math.random() * 900000 + 100000)}`,
      representativeSnapshot: 'http://localhost/snaps/unk_123.jpg',
      status: 'RECURRING',
      appearanceCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date()
    });

    // 4. Create mock Sightings close in time (10 seconds apart at same camera)
    const baseTime = new Date();
    const timeA = new Date(baseTime.getTime() - 20000);
    const timeB = new Date(baseTime.getTime() - 10000); // 10s difference

    console.log('Seeding mock sightings...');
    sightingA = await Sighting.create({
      identityType: 'KNOWN',
      personId: mockComplaint._id,
      cameraId: mockCamera._id,
      sourceType: 'LIVE_CCTV',
      location: {
        name: 'Test Location Gate',
        latitude: 12.9716,
        longitude: 77.5946,
        locationGeoJson: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      detectedAt: timeA,
      similarity: 0.85
    });

    sightingB = await Sighting.create({
      identityType: 'UNKNOWN',
      unknownPersonId: mockUnknown._id,
      cameraId: mockCamera._id,
      sourceType: 'LIVE_CCTV',
      location: {
        name: 'Test Location Gate',
        latitude: 12.9716,
        longitude: 77.5946,
        locationGeoJson: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      detectedAt: timeB,
      similarity: 0.90
    });

    // 5. Run Link Analysis
    console.log('Running link analysis...');
    const result = await getLinkAnalysis({
      timeWindowSeconds: 120, // 2 minutes window
      distanceThresholdMeters: 50,
      minCoOccurrences: 1
    });

    console.log(`Suspect Nodes Found: ${result.nodes.length}`);
    console.log(`Accomplice Links Found: ${result.links.length}`);

    // Verification Assertions
    console.log('Verifying analysis outcomes...');
    assert.strictEqual(result.nodes.length >= 2, true, 'Should find at least 2 nodes');
    assert.strictEqual(result.links.length >= 1, true, 'Should find at least 1 co-occurrence link');

    const link = result.links.find(
      (l) =>
        (l.source === `person:${mockComplaint._id}` && l.target === `unknown:${mockUnknown._id}`) ||
        (l.source === `unknown:${mockUnknown._id}` && l.target === `person:${mockComplaint._id}`)
    );

    assert.ok(link, 'Link between Alice and Unknown should exist');
    assert.strictEqual(link.value, 1, 'Link co-occurrences count should be 1');
    assert.strictEqual(link.coOccurrences[0].cameraId, mockCamera._id.toString(), 'Camera ID should match');
    assert.strictEqual(link.coOccurrences[0].timeDifferenceSeconds, 10, 'Time offset should be 10 seconds');

    console.log('✅ ALL TEST EXPECTATIONS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    // 6. Cleanup Database
    console.log('Cleaning up mock documents...');
    if (sightingA) await Sighting.deleteOne({ _id: sightingA._id });
    if (sightingB) await Sighting.deleteOne({ _id: sightingB._id });
    if (mockCamera) await Camera.deleteOne({ _id: mockCamera._id });
    if (mockComplaint) await Complaint.deleteOne({ _id: mockComplaint._id });
    if (mockUnknown) await UnknownPerson.deleteOne({ _id: mockUnknown._id });
    if (createdMockUser && mockUser) await User.deleteOne({ _id: mockUser._id });
    console.log('Cleanup completed.');

    await mongooseConn.disconnect();
    console.log('Database disconnected.');
  }
}

runTests();
