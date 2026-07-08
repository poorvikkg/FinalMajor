import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

// Configure S3 client for MinIO compatibility
const s3Client = new S3Client({
  endpoint: env.minio.endpoint,
  region: 'us-east-1', // dummy region
  credentials: {
    accessKeyId: env.minio.accessKey,
    secretAccessKey: env.minio.secretKey,
  },
  forcePathStyle: true, // required for MinIO path resolving
});

/**
 * Initializes the MinIO bucket.
 * Creates it if not present, and sets a public read policy so assets load in browser.
 */
export async function initializeMinio(): Promise<void> {
  const bucketName = env.minio.bucket;
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[MinIO] Bucket "${bucketName}" is ready.`);
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`[MinIO] Bucket "${bucketName}" not found. Creating bucket...`);
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`[MinIO] Bucket "${bucketName}" created successfully.`);

        // Apply public read access policy
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };

        await s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(policy),
          })
        );
        console.log(`[MinIO] Public read policy applied to bucket "${bucketName}".`);
      } catch (createErr) {
        console.error(`[MinIO] Failed to create and configure bucket:`, createErr);
      }
    } else {
      console.error(`[MinIO] Failed to verify bucket status:`, err);
    }
  }
}

/**
 * Uploads a local file to MinIO object storage.
 * Returns the public web URL of the uploaded object.
 * @param localFilePath Path to the file on disk
 * @param destinationFolder S3 directory prefix (e.g. 'attachments')
 */
export async function uploadToMinio(
  localFilePath: string,
  destinationFolder = 'attachments'
): Promise<string> {
  const filename = path.basename(localFilePath);
  const objectKey = `${destinationFolder}/${filename}`;
  const bucketName = env.minio.bucket;

  try {
    const fileStream = fs.createReadStream(localFilePath);
    
    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.mp4') contentType = 'video/mp4';

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fileStream,
        ContentType: contentType,
      })
    );

    // Return the public web access URL for this object
    // E.g., http://localhost:9000/sentinel-bucket/attachments/attachment_1712345.jpg
    return `${env.minio.endpoint}/${bucketName}/${objectKey}`;
  } catch (err) {
    console.error(`[MinIO] Failed to upload object "${objectKey}":`, err);
    throw err;
  }
}
