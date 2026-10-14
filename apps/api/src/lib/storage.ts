// S3 uyumlu belge deposu (şartname 2 ve 9.6). Yerelde MinIO, üretimde ör. Cloudflare R2; kod yalnız
// S3 API'sini kullanır. Bucket herkese kapalıdır; tarayıcı yalnız süreli imzalı adreslerle erişir.

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../http/errors.js';

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export interface DownloadOptions {
  expiresInSeconds: number;
  fileName: string;
  contentType: string;
  /** Tarayıcıda açılır (önizleme) veya dosya olarak iner. */
  inline: boolean;
}

export interface ObjectStorage {
  /** İstemcinin dosyayı doğrudan yükleyeceği süreli PUT adresi. */
  presignUpload(
    key: string,
    options: { contentType: string; expiresInSeconds: number },
  ): Promise<string>;
  presignDownload(key: string, options: DownloadOptions): Promise<string>;
  /** Nesnenin depodaki gerçek boyutu; yoksa null. */
  size(key: string): Promise<number | null>;
  /** `length` verilirse yalnız ilk baytlar okunur. */
  read(key: string, length?: number): Promise<Buffer>;
  copy(sourceKey: string, targetKey: string): Promise<void>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Nesne yoksa da başarılı sayılır. */
  remove(key: string): Promise<void>;
}

/** `Content-Disposition`: ASCII yedek ad ve Türkçe karakterli asıl ad (RFC 6266). */
export function contentDisposition(fileName: string, inline: boolean): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata.httpStatusCode === 404)
  );
}

export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      // MinIO ve R2 bu bölge adını kabul eder; R2'de "auto" ile aynıdır.
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
  }

  presignUpload(key: string, options: { contentType: string; expiresInSeconds: number }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: options.contentType }),
      // Tür imzaya girer; istemci yalnız bildirdiği türle yükleyebilir.
      { expiresIn: options.expiresInSeconds, signableHeaders: new Set(['content-type']) },
    );
  }

  presignDownload(key: string, options: DownloadOptions) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: options.contentType,
        ResponseContentDisposition: contentDisposition(options.fileName, options.inline),
      }),
      { expiresIn: options.expiresInSeconds },
    );
  }

  async size(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? 0;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async read(key: string, length?: number) {
    const object = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(length !== undefined ? { Range: `bytes=0-${Math.max(length - 1, 0)}` } : {}),
      }),
    );
    return Buffer.from((await object.Body?.transformToByteArray()) ?? []);
  }

  async copy(sourceKey: string, targetKey: string) {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: targetKey,
        CopySource: `${this.bucket}/${sourceKey}`,
      }),
    );
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** Geliştirmede depo ayarları boşsa API açılır; yalnız belge işlemleri açık hatayla reddedilir. */
export class UnconfiguredStorage implements ObjectStorage {
  private fail(): Promise<never> {
    return Promise.reject(new AppError('INTERNAL', 'Belge deposu yapılandırılmadı.'));
  }
  presignUpload = () => this.fail();
  presignDownload = () => this.fail();
  size = () => this.fail();
  read = () => this.fail();
  copy = () => this.fail();
  put = () => this.fail();
  remove = () => this.fail();
}
