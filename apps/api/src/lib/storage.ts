// S3 uyumlu belge deposu (şartname 2 ve 9.6). Yerelde MinIO, üretimde ör. Cloudflare R2; kod yalnız
// S3 API'sini kullanır. Bucket herkese kapalıdır; tarayıcı yalnız süreli imzalı adreslerle erişir.

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
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
  /** Boyutu önceden bilinmeyen akışı parça parça yazar (dışa aktarma paketi); bellekte tamamı tutulmaz. */
  putStream(key: string, body: AsyncIterable<Buffer>, contentType: string): Promise<void>;
  /** Nesne yoksa da başarılı sayılır. */
  remove(key: string): Promise<void>;
  /**
   * Önek altındaki bütün nesneleri siler ve yarım çok parçalı yüklemeleri iptal eder (firma kalıcı
   * silme). Silinen nesne sayısını döner.
   */
  removePrefix(prefix: string): Promise<number>;
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

  /** Çok parçalı yükleme; S3 ve R2'de son parça dışındakiler en az 5 MB olmalı. */
  async putStream(key: string, body: AsyncIterable<Buffer>, contentType: string) {
    const created = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    const uploadId = created.UploadId!;
    const parts: { ETag: string; PartNumber: number }[] = [];
    const sendPart = async (chunk: Buffer) => {
      const PartNumber = parts.length + 1;
      const result = await this.client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber,
          Body: chunk,
        }),
      );
      parts.push({ ETag: result.ETag!, PartNumber });
    };
    try {
      let pending: Buffer[] = [];
      let pendingBytes = 0;
      for await (const chunk of body) {
        pending.push(chunk);
        pendingBytes += chunk.length;
        if (pendingBytes >= MULTIPART_PART_BYTES) {
          await sendPart(Buffer.concat(pending));
          pending = [];
          pendingBytes = 0;
        }
      }
      if (pendingBytes > 0 || parts.length === 0) await sendPart(Buffer.concat(pending));
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
    } catch (error) {
      await this.client
        .send(
          new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
        )
        .catch(() => undefined);
      throw error;
    }
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // Toplu silme (DeleteObjects) yerine tek tek silinir: R2 ve MinIO'da sağlama toplamı farkları
  // sorun çıkarmaz; işlem seyrek olduğu için hız önemli değildir.
  async removePrefix(prefix: string) {
    let uploadMarker: { KeyMarker?: string; UploadIdMarker?: string } = {};
    for (;;) {
      const page = await this.client.send(
        new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: prefix, ...uploadMarker }),
      );
      for (const upload of page.Uploads ?? []) {
        await this.client.send(
          new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: upload.Key,
            UploadId: upload.UploadId,
          }),
        );
      }
      if (!page.IsTruncated) break;
      uploadMarker = { KeyMarker: page.NextKeyMarker, UploadIdMarker: page.NextUploadIdMarker };
    }

    let removed = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue;
        await this.remove(object.Key);
        removed += 1;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return removed;
  }
}

/** Çok parçalı yüklemede parça boyutu: 10.000 parça sınırıyla yaklaşık 160 GB'a kadar paket. */
const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

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
  putStream = () => this.fail();
  remove = () => this.fail();
  removePrefix = () => this.fail();
}
