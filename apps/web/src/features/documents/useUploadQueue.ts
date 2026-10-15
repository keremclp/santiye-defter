// Dosya başına yükleme durumu (şartname 4.4 "Belge satırı", 9.7 "Belge"):
// bekliyor / yükleniyor / yüklendi / başarısız; başarısız dosya tek başına yeniden denenir.

import type { DocumentMimeType } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { keys } from '../../api/queries';
import { newIdempotencyKey } from '../../api/submission';
import {
  createUploader,
  fileProblem,
  localPreviewUrl,
  mimeTypeOf,
  UploadFailure,
  type DocumentOwner,
  type Uploader,
} from './upload';

export type UploadStatus = 'waiting' | 'uploading' | 'uploaded' | 'failed';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  mimeType: DocumentMimeType | null;
  status: UploadStatus;
  error: string | null;
  /** Gönderilmeden reddedilen veya aynı dosyayla tekrarı anlamsız olan hata. */
  retryable: boolean;
  /** Sunucudaki belge (yükleme niyeti alındıktan sonra). */
  documentId: string | null;
  progress: number | null;
  localUrl: string | null;
}

export interface UploadSummary {
  uploaded: number;
  failed: number;
}

export interface UploadQueue {
  items: UploadItem[];
  /** Sırada bekleyen veya yüklenmekte olan dosya var mı. */
  busy: boolean;
  add: (files: File[]) => void;
  remove: (id: string) => void;
  /** Bekleyen ve yeniden denenebilir başarısız dosyaları sırayla yükler. */
  uploadAll: (owner: DocumentOwner) => Promise<UploadSummary>;
  retry: (id: string, owner: DocumentOwner) => Promise<boolean>;
  clear: () => void;
}

export function useUploadQueue(): UploadQueue {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const uploaders = useRef(new Map<string, Uploader>());
  /** Gönderilmeden veya kesin olarak reddedilen dosyalar; yeniden denenmez. */
  const rejected = useRef(new Set<string>());
  const running = useRef(new Set<string>());
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
      created.clear();
    };
  }, []);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const add = useCallback((files: File[]) => {
    const next = files.map((file): UploadItem => {
      const id = newIdempotencyKey();
      const mimeType = mimeTypeOf(file);
      const problem = fileProblem(file, mimeType);
      const localUrl = problem ? null : localPreviewUrl(file, mimeType);
      if (problem) rejected.current.add(id);
      else uploaders.current.set(id, createUploader(file, mimeType!));
      if (localUrl) urls.current.set(id, localUrl);
      return {
        id,
        name: file.name,
        size: file.size,
        mimeType,
        status: problem ? 'failed' : 'waiting',
        error: problem,
        retryable: false,
        documentId: null,
        progress: null,
        localUrl,
      };
    });
    setItems((list) => [...list, ...next]);
  }, []);

  const remove = useCallback((id: string) => {
    if (running.current.has(id)) return;
    uploaders.current.delete(id);
    rejected.current.delete(id);
    const url = urls.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(id);
    }
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const runOne = useCallback(
    async (id: string, owner: DocumentOwner): Promise<boolean> => {
      const uploader = uploaders.current.get(id);
      if (!uploader || running.current.has(id)) return false;
      if (uploader.done) return true;
      running.current.add(id);
      update(id, { status: 'uploading', error: null, progress: null });
      try {
        await uploader.run(owner, {
          onDocument: (documentId) => update(id, { documentId }),
          onProgress: (progress) => update(id, { progress }),
        });
        update(id, { status: 'uploaded', progress: null });
        return true;
      } catch (error) {
        const failure =
          error instanceof UploadFailure
            ? error
            : new UploadFailure('Belge yüklenemedi. Yeniden deneyin.', true);
        update(id, {
          status: 'failed',
          error: failure.message,
          retryable: failure.retryable,
          progress: null,
        });
        if (!failure.retryable) {
          uploaders.current.delete(id);
          rejected.current.add(id);
        }
        // Kapasite dolduysa yükleme düğmeleri nedeni göstersin.
        if (failure.code === 'STORAGE_FULL') {
          void queryClient.invalidateQueries({ queryKey: keys.company });
        }
        return false;
      } finally {
        running.current.delete(id);
      }
    },
    [queryClient, update],
  );

  const uploadAll = useCallback(
    async (owner: DocumentOwner) => {
      const summary: UploadSummary = { uploaded: 0, failed: 0 };
      for (const [id, uploader] of [...uploaders.current]) {
        if (uploader.done) continue;
        if (await runOne(id, owner)) summary.uploaded += 1;
        else if (!rejected.current.has(id)) summary.failed += 1;
      }
      summary.failed += rejected.current.size;
      return summary;
    },
    [runOne],
  );

  const clear = useCallback(() => {
    if (running.current.size > 0) return;
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
    uploaders.current.clear();
    rejected.current.clear();
    setItems([]);
  }, []);

  return {
    items,
    busy: items.some((item) => item.status === 'uploading'),
    add,
    remove,
    uploadAll,
    retry: runOne,
    clear,
  };
}

/** Kayıttaki 10 belge sınırına sayılan yerel dosyalar (gönderilmeden reddedilenler sayılmaz). */
export function countsTowardLimit(item: UploadItem): boolean {
  return item.status !== 'failed' || item.retryable;
}
