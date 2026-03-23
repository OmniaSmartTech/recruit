const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

const REGION = process.env.AWS_REGION || "eu-west-2";
const BUCKET = process.env.AWS_S3_BUCKET || "";

const s3 = BUCKET ? new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined,
}) : null;

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

/**
 * Upload file to S3 or local filesystem fallback.
 * Returns the storage key (S3 key or local path).
 */
async function uploadFile(key, buffer, contentType) {
  if (s3 && BUCKET) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      return key;
    } catch (err) {
      console.warn(`[s3] Upload to S3 failed, falling back to local: ${err.message}`);
    }
  }

  // Local filesystem fallback
  const localPath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, buffer);
  console.log(`[s3] File saved locally: ${localPath}`);
  return key;
}

/**
 * Get a download URL for a file.
 * Returns presigned S3 URL or local path.
 */
async function getDownloadUrl(key, expiresIn = 3600) {
  if (s3 && BUCKET) {
    try {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn }
      );
    } catch (err) {
      console.warn(`[s3] Presigned URL failed: ${err.message}`);
    }
  }

  // Local fallback — return API path
  return `/api/files/${encodeURIComponent(key)}`;
}

/**
 * Read a file from S3 or local filesystem.
 * Returns { buffer, contentType } or null.
 */
async function readFile(key) {
  if (s3 && BUCKET) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const chunks = [];
      for await (const chunk of res.Body) chunks.push(chunk);
      return { buffer: Buffer.concat(chunks), contentType: res.ContentType };
    } catch (err) {
      console.warn(`[s3] S3 read failed, trying local: ${err.message}`);
    }
  }

  // Local fallback
  const localPath = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(localPath)) {
    return { buffer: fs.readFileSync(localPath), contentType: "application/octet-stream" };
  }

  return null;
}

async function deleteFile(key) {
  if (s3 && BUCKET) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return;
    } catch (err) {
      console.warn(`[s3] S3 delete failed: ${err.message}`);
    }
  }

  const localPath = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

function isS3Configured() {
  return !!(s3 && BUCKET);
}

module.exports = { uploadFile, getDownloadUrl, readFile, deleteFile, isS3Configured };
