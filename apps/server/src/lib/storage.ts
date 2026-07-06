import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import '../config/env';

const requiredEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const storageConfig = {
  region: requiredEnv('S3_REGION') ?? 'us-east-2',
  accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'),
  secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY'),
  bucket: requiredEnv('S3_BUCKET'),
  publicBaseUrl: requiredEnv('S3_PUBLIC_BASE_URL'),
  imageBucket: requiredEnv('S3_IMAGE_BUCKET'),
  filesBucket: requiredEnv('S3_FILES_BUCKET'),
  imagePublicBaseUrl: requiredEnv('S3_IMAGE_PUBLIC_BASE_URL'),
  filesPublicBaseUrl: requiredEnv('S3_FILES_PUBLIC_BASE_URL'),
} as const;

const hasAnyS3Bucket = Boolean(storageConfig.bucket || storageConfig.imageBucket || storageConfig.filesBucket);
const resolvedMode = (process.env.PO_STORAGE_MODE ?? (hasAnyS3Bucket ? 's3' : 'file')).toLowerCase();
const useS3 = resolvedMode === 's3';

export const storageMode = useS3 ? 's3' : 'file';
export const isS3StorageEnabled = useS3;

const localUploadsRoot = path.resolve(process.env.PO_STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'uploads'));

const serverPublicUrl = (() => {
  const explicit = process.env.SERVER_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT ?? '5001'}`;
})();

const s3Client = useS3 && hasAnyS3Bucket
  ? new S3Client({
      region: storageConfig.region,
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      ...(process.env.S3_FORCE_PATH_STYLE === 'true' ? { forcePathStyle: true } : {}),
      credentials: storageConfig.accessKeyId && storageConfig.secretAccessKey
        ? { accessKeyId: storageConfig.accessKeyId, secretAccessKey: storageConfig.secretAccessKey }
        : undefined, // falls back to EC2 instance role on prod
    })
  : null;

function getStorageTarget(key: string) {
  const k = key.replace(/^\/+/g, '');
  if (k.startsWith('images/') || k.startsWith('videos/')) {
    return { bucket: storageConfig.imageBucket || storageConfig.bucket, publicBaseUrl: storageConfig.imagePublicBaseUrl || storageConfig.publicBaseUrl };
  }
  if (k.startsWith('files/')) {
    return { bucket: storageConfig.filesBucket || storageConfig.bucket, publicBaseUrl: storageConfig.filesPublicBaseUrl || storageConfig.publicBaseUrl };
  }
  return { bucket: storageConfig.bucket, publicBaseUrl: storageConfig.publicBaseUrl };
}

function trimSlash(s: string) { return s.replace(/\/+$/g, ''); }

function buildPublicUrl(key: string): string {
  const k = key.replace(/^\/+/g, '');
  const target = getStorageTarget(k);
  if (target.publicBaseUrl) return `${trimSlash(target.publicBaseUrl)}/${k}`;
  if (!target.bucket) throw new Error('Storage public URL could not be resolved — set S3_IMAGE_PUBLIC_BASE_URL');
  return `https://${target.bucket}.s3.${storageConfig.region}.amazonaws.com/${k}`;
}

function buildLocalUrl(key: string): string {
  return `${trimSlash(serverPublicUrl)}/uploads/${key.replace(/^\/+/g, '')}`;
}

export type StorageUploadResult = { key: string; url: string };

export function generateStorageKey(prefix: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${prefix.replace(/\/+$/, '')}/${randomUUID()}${ext}`;
}

export async function uploadBufferToStorage(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<StorageUploadResult> {
  if (useS3) {
    const target = getStorageTarget(params.key);
    if (!target.bucket || !s3Client) throw new Error('Object storage is not configured. Set S3_* environment variables.');
    await s3Client.send(new PutObjectCommand({ Bucket: target.bucket, Key: params.key, Body: params.body, ContentType: params.contentType }));
    return { key: params.key, url: buildPublicUrl(params.key) };
  }
  const dest = path.join(localUploadsRoot, params.key.replace(/^\/+/g, ''));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body));
  return { key: params.key, url: buildLocalUrl(params.key) };
}

export async function deleteFromStorage(key: string): Promise<void> {
  const k = key.replace(/^\/+/g, '');
  if (useS3) {
    const target = getStorageTarget(k);
    if (!target.bucket || !s3Client) throw new Error('Object storage is not configured');
    await s3Client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: k }));
    return;
  }
  await fs.unlink(path.join(localUploadsRoot, k));
}

export function resolveStorageUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  return useS3 ? buildPublicUrl(key) : buildLocalUrl(key);
}
