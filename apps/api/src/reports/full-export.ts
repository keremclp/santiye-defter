// Tam firma veri çıkışının içeriği (şartname 7.10): her tablo bir Excel sayfası ve bir CSV dosyası;
// ilişkiler "Tablolar ve ilişkiler" tablosunda açıklanır. Belgeler eşleme tablosuyla zip'e konur.
// Toplamlar paketteki aynı satırlardan `packages/shared` fonksiyonlarıyla hesaplanır.

import {
  ACTIVE_STATUS_LABEL,
  cashTotalsOfRows,
  DELETED_STATUS_LABEL,
  FIELD_LABEL,
  formatTl,
  HISTORY_ACTION_LABEL,
  NO_OPENING_TEXT,
  TRACKING_START_WARNING,
  todayInIstanbul,
  type DocumentMimeType,
} from '@santiye/shared';
import type { Types } from 'mongoose';
import type { HistoryEntry } from '../db/company-scope.js';
import type { Agreement } from '../models/agreement.js';
import type { Category } from '../models/category.js';
import type { StoredDocument } from '../models/document.js';
import type { Party } from '../models/party.js';
import type { Project } from '../models/project.js';
import type { Transaction } from '../models/transaction.js';
import { agreementLabel } from '../services/finance-presenters.js';
import { summarizeObligations } from '../services/obligations.js';
import { SYSTEM_ACTOR_ID } from '../services/records.js';
import { renderCsv, renderCsvTable } from './csv.js';
import {
  cashSummary,
  displayDate,
  displayDateTime,
  KIND_LABEL,
  obligationSections,
  slug,
  type CellValue,
  type Column,
  type ColumnType,
  type ReportDocument,
  type TableRow,
  type TableSection,
} from './document.js';
import { renderXlsx } from './xlsx.js';

/** Tek tutarlı okumadan alınmış firma verisi. Silinmiş (geri alınabilir) kayıtlar dahildir. */
export interface FullExportSource {
  companyName: string;
  generatedAt: string;
  today: string;
  projects: Project[];
  parties: Party[];
  categories: Category[];
  agreements: Agreement[];
  transactions: Transaction[];
  /** Bütün belgeler (geçmiş için); dosyası pakete konanlar yalnız yüklenmiş olanlar */
  documents: StoredDocument[];
  companyHistory: HistoryEntry[];
  userNames: Map<string, string>;
  /** Depoda bulunamayan belge dosyaları (belge kimliği) */
  missingFiles: Set<string>;
}

export interface PackagedDocument {
  documentId: string;
  storageKey: string;
  /** Paket kökünden göreli yol */
  path: string;
  sizeBytes: number;
}

export interface TableFile {
  /** Paketteki CSV yolu */
  file: string;
  section: TableSection;
  description: string;
  /** Silinmiş (geri alınabilir) kayıt sayısı; tabloda karşılığı yoksa null */
  deletedCount: number | null;
}

export interface FullExportContent {
  /** Paket kök klasörü ve zip dosyasının adı (uzantısız) */
  fileBase: string;
  generatedAt: string;
  summary: ReportDocument;
  tables: TableFile[];
  documents: PackagedDocument[];
}

// ── Etiketler ve biçimler ────────────────────────────────────────────────────

const YES_NO = (value: boolean) => (value ? 'Evet' : 'Hayır');
const DIRECTION = { payable: 'Ödenecek (borç)', receivable: 'Tahsil edilecek (alacak)' } as const;
const SCOPE = { project: 'Şantiye', company: 'Firma geneli' } as const;
const PROJECT_STATUS = {
  active: 'Aktif',
  completed: 'Tamamlandı',
  archived: 'Arşivlendi',
} as const;
const WORK_STATUS = {
  ongoing: 'Devam ediyor',
  completed: 'İş tamamlandı',
  cancelled: 'İptal',
} as const;
const PARTY_KIND = { person: 'Kişi', company: 'Firma' } as const;
const PARTY_TAG = { supplier: 'Tedarikçi', subcontractor: 'Taşeron', customer: 'Müşteri' } as const;
const DOCUMENT_STATUS = {
  pending: 'Yükleniyor',
  uploaded: 'Yüklendi',
  failed: 'Başarısız',
  expired: 'Süresi doldu',
} as const;

const EXTENSION: Record<DocumentMimeType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function paymentStatus(agreement: Agreement): string {
  const payable = agreement.direction === 'payable';
  switch (agreement.paymentStatus) {
    case 'open':
      return payable ? 'Ödeme yok' : 'Tahsilat yok';
    case 'partial':
      return 'Kısmi';
    case 'settled':
      return 'Kapandı';
    case 'overpaid':
      return payable ? 'Fazla ödeme' : 'Fazla tahsilat';
  }
}

const recordStatus = (doc: { deletedAt: Date | null }) =>
  doc.deletedAt ? DELETED_STATUS_LABEL : ACTIVE_STATUS_LABEL;
const time = (date: Date | null | undefined) => (date ? displayDateTime(date.toISOString()) : null);
const idOf = (id: Types.ObjectId | null | undefined) => id?.toString() ?? null;

function column(key: string, header: string, type: ColumnType = 'text', width = 16): Column {
  return { key, header, type, width };
}

function table(title: string, columns: Column[], rows: Record<string, CellValue>[]): TableSection {
  return {
    kind: 'table',
    title,
    columns,
    rows: rows.map((cells): TableRow => ({ cells })),
    totals: [],
    empty: 'Kayıt yok.',
  };
}

const ID = column('id', 'Kimlik', 'text', 26);
const STATUS = column('status', 'Durum', 'text', 24);

/** Oluşturma, güncelleme ve silme bilgisi; her tabloda aynı sütunlar. */
const META_COLUMNS: Column[] = [
  column('createdBy', 'Oluşturan', 'text', 18),
  column('createdAt', 'Oluşturulma', 'text', 18),
  column('updatedBy', 'Son güncelleyen', 'text', 18),
  column('updatedAt', 'Son güncelleme', 'text', 18),
  column('deletedBy', 'Silen', 'text', 18),
  column('deletedAt', 'Silinme', 'text', 18),
  column('deleteReason', 'Silme gerekçesi', 'text', 24),
];

// ── İçerik ───────────────────────────────────────────────────────────────────

export function buildFullExport(source: FullExportSource): FullExportContent {
  const byId = <T extends { _id: Types.ObjectId }>(items: T[]) =>
    new Map(items.map((item) => [item._id.toString(), item]));
  const projects = byId(source.projects);
  const parties = byId(source.parties);
  const categories = byId(source.categories);
  const agreements = byId(source.agreements);
  const transactions = byId(source.transactions);
  const key = (id: Types.ObjectId | null | undefined) => id?.toString() ?? '';

  const actor = (id: Types.ObjectId | null | undefined): string | null => {
    if (!id) return null;
    if (id.equals(SYSTEM_ACTOR_ID)) return 'Sistem';
    return source.userNames.get(id.toString()) ?? 'Bilinmeyen kullanıcı';
  };
  const meta = (doc: {
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedBy: Types.ObjectId;
    updatedAt: Date;
    deletedBy: Types.ObjectId | null;
    deletedAt: Date | null;
    deleteReason: string | null;
  }) => ({
    createdBy: actor(doc.createdBy),
    createdAt: time(doc.createdAt),
    updatedBy: actor(doc.updatedBy),
    updatedAt: time(doc.updatedAt),
    deletedBy: actor(doc.deletedBy),
    deletedAt: time(doc.deletedAt),
    deleteReason: doc.deleteReason,
  });
  const projectName = (id: Types.ObjectId | null) => projects.get(key(id))?.name ?? null;
  const partyName = (id: Types.ObjectId | null) => parties.get(key(id))?.name ?? null;
  const agreementName = (id: Types.ObjectId | null) => {
    const agreement = agreements.get(key(id));
    return agreement ? agreementLabel(agreement) : null;
  };
  const allocationScope = (allocation: Transaction['allocations'][number]) =>
    allocation.scope === 'company'
      ? SCOPE.company
      : `${SCOPE.project}: ${projectName(allocation.projectId) ?? '—'}`;

  // Hareketler
  const transactionRows = source.transactions.map((transaction) => {
    const sourceTransaction = transaction.refundOf
      ? transactions.get(key(transaction.refundOf.transactionId))
      : undefined;
    return {
      id: transaction._id.toString(),
      recordNo: transaction.recordNo,
      status: recordStatus(transaction),
      kind: KIND_LABEL[transaction.kind],
      date: transaction.date,
      amount: transaction.amount,
      partyId: idOf(transaction.partyId),
      party: partyName(transaction.partyId),
      categoryId: idOf(transaction.categoryId),
      category: categories.get(key(transaction.categoryId))?.name ?? null,
      description: transaction.description,
      scope: [...new Set(transaction.allocations.map(allocationScope))].join('; '),
      allocationCount: transaction.allocations.length,
      linked: YES_NO(transaction.allocations.some((allocation) => allocation.agreementId)),
      sourceId: idOf(transaction.refundOf?.transactionId),
      sourceNo: sourceTransaction?.recordNo ?? null,
      excessAmount: transaction.excess?.amount ?? null,
      excessReason: transaction.excess?.reason ?? null,
      documentCount: transaction.documentCount,
      ...meta(transaction),
    };
  });

  const allocationRows = source.transactions.flatMap((transaction) =>
    transaction.allocations.map((allocation) => ({
      id: allocation._id.toString(),
      transactionId: transaction._id.toString(),
      recordNo: transaction.recordNo,
      transactionStatus: recordStatus(transaction),
      kind: KIND_LABEL[transaction.kind],
      date: transaction.date,
      scope: SCOPE[allocation.scope],
      projectId: idOf(allocation.projectId),
      project: projectName(allocation.projectId),
      agreementId: idOf(allocation.agreementId),
      agreement: agreementName(allocation.agreementId),
      amount: allocation.amount,
      refundedAmount: allocation.refundedAmount,
    })),
  );

  const refundRows = source.transactions.flatMap((transaction) => {
    const refundOf = transaction.refundOf;
    if (!refundOf) return [];
    const sourceTransaction = transactions.get(key(refundOf.transactionId));
    return refundOf.parts.map((part) => {
      const sourceAllocation = sourceTransaction?.allocations.find((allocation) =>
        allocation._id.equals(part.allocationId),
      );
      return {
        refundId: transaction._id.toString(),
        refundNo: transaction.recordNo,
        status: recordStatus(transaction),
        kind: KIND_LABEL[transaction.kind],
        date: transaction.date,
        sourceId: refundOf.transactionId.toString(),
        sourceNo: sourceTransaction?.recordNo ?? null,
        sourceAllocationId: part.allocationId.toString(),
        sourceScope: sourceAllocation ? allocationScope(sourceAllocation) : null,
        amount: part.amount,
      };
    });
  });

  const agreementRows = (kind: Agreement['kind']) =>
    source.agreements
      .filter((agreement) => agreement.kind === kind)
      .map((agreement) => ({
        id: agreement._id.toString(),
        status: recordStatus(agreement),
        label: agreementLabel(agreement),
        direction: DIRECTION[agreement.direction],
        scope: SCOPE[agreement.scope],
        projectId: idOf(agreement.projectId),
        project: projectName(agreement.projectId),
        partyId: agreement.partyId.toString(),
        party: partyName(agreement.partyId),
        description: agreement.description,
        initialAmount: agreement.initialAmount,
        currentAmount: agreement.currentAmount,
        netSettled: agreement.netSettled,
        remaining: agreement.remaining,
        excess: agreement.excess,
        paymentStatus: paymentStatus(agreement),
        workStatus: agreement.workStatus ? WORK_STATUS[agreement.workStatus] : null,
        settlementPending: YES_NO(agreement.settlementPending),
        agreementDate: agreement.agreementDate,
        trackingStartDate: agreement.trackingStartDate,
        dueDate: agreement.dueDate,
        documentCount: agreement.documentCount,
        ...meta(agreement),
      }));

  // Belgeler: yalnız yüklenmiş olanların dosyası pakete konur; silinmiş ama geri alınabilir olanlar dahil.
  const packaged: PackagedDocument[] = [];
  const documentRows = source.documents
    .filter((doc) => doc.status === 'uploaded' && doc.storageKey)
    .map((doc) => {
      const missing = source.missingFiles.has(doc._id.toString());
      const base = slug(doc.fileName.replace(/\.[^.]*$/, '')) || 'belge';
      const path = `belgeler/${doc._id.toString()}-${base}.${EXTENSION[doc.mimeType]}`;
      if (!missing) {
        packaged.push({
          documentId: doc._id.toString(),
          storageKey: doc.storageKey!,
          path,
          sizeBytes: doc.sizeBytes ?? 0,
        });
      }
      const owner =
        doc.ownerType === 'transaction'
          ? transactions.get(key(doc.ownerId))
          : agreements.get(key(doc.ownerId));
      const ownerAgreement =
        doc.ownerType === 'agreement' ? agreements.get(key(doc.ownerId)) : null;
      return {
        id: doc._id.toString(),
        status: recordStatus(doc),
        path: missing ? null : path,
        ownerType:
          doc.ownerType === 'transaction'
            ? 'Hareket'
            : ownerAgreement?.kind === 'opening'
              ? 'Başlangıç kaydı'
              : 'Anlaşma',
        ownerId: doc.ownerId.toString(),
        owner: !owner
          ? null
          : doc.ownerType === 'transaction'
            ? `İşlem no ${(owner as Transaction).recordNo}`
            : agreementLabel(owner as Agreement),
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        uploadedBy: actor(doc.uploadedBy),
        uploadedAt: time(doc.uploadedAt),
        deletedBy: actor(doc.deletedBy),
        deletedAt: time(doc.deletedAt),
        deleteReason: doc.deleteReason,
        note: missing ? 'Dosya depoda bulunamadı; pakete eklenemedi.' : null,
      };
    });

  const historyRows = buildHistoryRows(source, {
    actor,
    partyName,
    categoryName: (id) => categories.get(key(id))?.name ?? null,
    projectName,
    agreementName,
  });

  const projectRows = source.projects.map((project) => ({
    id: project._id.toString(),
    status: recordStatus(project),
    name: project.name,
    description: project.description,
    address: project.address,
    startDate: project.startDate,
    workState: PROJECT_STATUS[project.status],
    completedAt: project.completedAt,
    ...meta(project),
  }));
  const partyRows = source.parties.map((party) => ({
    id: party._id.toString(),
    status: recordStatus(party),
    name: party.name,
    kind: PARTY_KIND[party.kind],
    tags: party.tags.map((tag) => PARTY_TAG[tag]).join(', '),
    phone: party.phone,
    email: party.email,
    address: party.address,
    note: party.note,
    isActive: YES_NO(party.isActive),
    ...meta(party),
  }));
  const categoryRows = source.categories.map((category) => ({
    id: category._id.toString(),
    status: recordStatus(category),
    name: category.name,
    isActive: YES_NO(category.isActive),
    ...meta(category),
  }));

  const agreementColumns = (kind: Agreement['kind']): Column[] => [
    ID,
    STATUS,
    column('label', 'Ad', 'text', 24),
    column('direction', 'Yön', 'text', 22),
    column('scope', 'Kapsam'),
    column('projectId', 'Şantiye kimliği', 'text', 26),
    column('project', 'Şantiye', 'text', 20),
    column('partyId', 'Kişi/firma kimliği', 'text', 26),
    column('party', 'Kişi/firma', 'text', 20),
    column('description', 'Açıklama', 'text', 24),
    column('initialAmount', kind === 'opening' ? 'Devreden kalan' : 'İlk bedel', 'money', 14),
    column('currentAmount', 'Güncel bedel', 'money', 14),
    column('netSettled', 'Ödenen / tahsil edilen', 'money', 20),
    column('remaining', 'Kalan', 'money', 14),
    column('excess', 'Fazla', 'money', 12),
    column('paymentStatus', 'Ödeme durumu', 'text', 16),
    ...(kind === 'agreement'
      ? [
          column('workStatus', 'İş durumu'),
          column('settlementPending', 'Hesap kesinleşmedi', 'text', 18),
          column('agreementDate', 'Anlaşma tarihi', 'date', 13),
        ]
      : [column('trackingStartDate', 'Takip başlangıcı', 'date', 14)]),
    column('dueDate', 'Vade', 'date', 12),
    column('documentCount', 'Belge sayısı', 'integer', 12),
    ...META_COLUMNS,
  ];

  const deletedCount = (docs: { deletedAt: Date | null }[]) =>
    docs.filter((doc) => doc.deletedAt).length;
  const openings = source.agreements.filter((agreement) => agreement.kind === 'opening');
  const plain = source.agreements.filter((agreement) => agreement.kind === 'agreement');
  const refunds = source.transactions.filter((transaction) => transaction.refundOf);

  const tables: TableFile[] = [
    {
      file: 'hareketler.csv',
      description:
        'Gelir, gider ve iade hareketleri; her hareket bir satır. "Kişi/firma kimliği" Kişiler ve firmalar, "Kategori kimliği" Kategoriler tablosundaki "Kimlik" sütununa bağlanır. İade satırında "Kaynak işlem kimliği" geri çevrilen hareketi gösterir.',
      deletedCount: deletedCount(source.transactions),
      section: table(
        'Hareketler',
        [
          ID,
          column('recordNo', 'İşlem no', 'integer', 10),
          STATUS,
          column('kind', 'Tür', 'text', 16),
          column('date', 'Tarih', 'date', 12),
          column('amount', 'Tutar', 'money', 14),
          column('partyId', 'Kişi/firma kimliği', 'text', 26),
          column('party', 'Kişi/firma', 'text', 20),
          column('categoryId', 'Kategori kimliği', 'text', 26),
          column('category', 'Kategori'),
          column('description', 'Açıklama', 'text', 24),
          column('scope', 'Kapsam', 'text', 24),
          column('allocationCount', 'Pay sayısı', 'integer', 10),
          column('linked', 'Anlaşmaya bağlı', 'text', 14),
          column('sourceId', 'Kaynak işlem kimliği', 'text', 26),
          column('sourceNo', 'Kaynak işlem no', 'integer', 14),
          column('excessAmount', 'Onaylı fazla', 'money', 14),
          column('excessReason', 'Fazla gerekçesi', 'text', 20),
          column('documentCount', 'Belge sayısı', 'integer', 12),
          ...META_COLUMNS,
        ],
        transactionRows,
      ),
    },
    {
      file: 'paylar.csv',
      description:
        'Her hareketin kapsam ve anlaşma payları; bir hareketin paylarının toplamı hareket tutarına eşittir. "İşlem kimliği" Hareketler, "Şantiye kimliği" Şantiyeler, "Anlaşma kimliği" Anlaşmalar veya Başlangıç kayıtları tablosuna bağlanır.',
      deletedCount: null,
      section: table(
        'Paylar',
        [
          column('id', 'Kimlik', 'text', 26),
          column('transactionId', 'İşlem kimliği', 'text', 26),
          column('recordNo', 'İşlem no', 'integer', 10),
          column('transactionStatus', 'İşlem durumu', 'text', 24),
          column('kind', 'İşlem türü', 'text', 16),
          column('date', 'Tarih', 'date', 12),
          column('scope', 'Kapsam', 'text', 14),
          column('projectId', 'Şantiye kimliği', 'text', 26),
          column('project', 'Şantiye', 'text', 20),
          column('agreementId', 'Anlaşma kimliği', 'text', 26),
          column('agreement', 'Anlaşma / başlangıç kaydı', 'text', 24),
          column('amount', 'Pay tutarı', 'money', 14),
          column('refundedAmount', 'İade edilen', 'money', 14),
        ],
        allocationRows,
      ),
    },
    {
      file: 'iadeler.csv',
      description:
        'İade hareketlerinin hangi kaynak paydan ne kadar geri çevirdiği; her kaynak pay bir satır. "İade işlem kimliği" ve "Kaynak işlem kimliği" Hareketler, "Kaynak pay kimliği" Paylar tablosuna bağlanır.',
      deletedCount: deletedCount(refunds),
      section: table(
        'İadeler',
        [
          column('refundId', 'İade işlem kimliği', 'text', 26),
          column('refundNo', 'İade işlem no', 'integer', 12),
          STATUS,
          column('kind', 'Tür', 'text', 16),
          column('date', 'İade tarihi', 'date', 12),
          column('sourceId', 'Kaynak işlem kimliği', 'text', 26),
          column('sourceNo', 'Kaynak işlem no', 'integer', 14),
          column('sourceAllocationId', 'Kaynak pay kimliği', 'text', 26),
          column('sourceScope', 'Kaynak pay kapsamı', 'text', 22),
          column('amount', 'Tutar', 'money', 14),
        ],
        refundRows,
      ),
    },
    {
      file: 'anlasmalar.csv',
      description:
        'Ödenecek ve tahsil edilecek anlaşmalar. Anlaşma gelir veya gider değildir; ödeme ve tahsilatlar Paylar tablosunda "Anlaşma kimliği" ile bağlanır. Kalan, fazla ve ödeme durumu çıkış anındaki değerlerdir.',
      deletedCount: deletedCount(plain),
      section: table('Anlaşmalar', agreementColumns('agreement'), agreementRows('agreement')),
    },
    {
      file: 'baslangic-kayitlari.csv',
      description:
        'Takip başlangıcında devreden borç ve alacaklar; Anlaşmalar tablosuyla aynı bağlantılar. Başlangıç kaydı gelir veya gider değildir.',
      deletedCount: deletedCount(openings),
      section: table('Başlangıç kayıtları', agreementColumns('opening'), agreementRows('opening')),
    },
    {
      file: 'santiyeler.csv',
      description: 'Şantiyeler (tamamlanan ve arşivlenenler dahil).',
      deletedCount: deletedCount(source.projects),
      section: table(
        'Şantiyeler',
        [
          ID,
          STATUS,
          column('name', 'Ad', 'text', 22),
          column('description', 'Açıklama', 'text', 24),
          column('address', 'Adres', 'text', 24),
          column('startDate', 'Başlangıç tarihi', 'date', 14),
          column('workState', 'Şantiye durumu', 'text', 14),
          column('completedAt', 'Tamamlanma tarihi', 'date', 16),
          ...META_COLUMNS,
        ],
        projectRows,
      ),
    },
    {
      file: 'kisiler.csv',
      description: 'Kişiler ve firmalar (pasifler dahil).',
      deletedCount: deletedCount(source.parties),
      section: table(
        'Kişiler ve firmalar',
        [
          ID,
          STATUS,
          column('name', 'Ad', 'text', 22),
          column('kind', 'Tür', 'text', 8),
          column('tags', 'Etiketler', 'text', 20),
          column('phone', 'Telefon'),
          column('email', 'E-posta', 'text', 22),
          column('address', 'Adres', 'text', 24),
          column('note', 'Not', 'text', 24),
          column('isActive', 'Aktif', 'text', 8),
          ...META_COLUMNS,
        ],
        partyRows,
      ),
    },
    {
      file: 'kategoriler.csv',
      description: 'Gider kategorileri (pasifler dahil).',
      deletedCount: deletedCount(source.categories),
      section: table(
        'Kategoriler',
        [
          ID,
          STATUS,
          column('name', 'Ad', 'text', 22),
          column('isActive', 'Aktif', 'text', 8),
        ].concat(META_COLUMNS),
        categoryRows,
      ),
    },
    {
      file: 'belgeler.csv',
      description:
        'Belge–dosya eşleme tablosu: "Paketteki dosya" zip içindeki orijinal dosyanın yoludur. "Bağlı kayıt kimliği" Hareketler, Anlaşmalar veya Başlangıç kayıtları tablosundaki "Kimlik" sütununa bağlanır.',
      deletedCount: deletedCount(
        source.documents.filter((doc) => doc.status === 'uploaded' && doc.storageKey),
      ),
      section: table(
        'Belgeler',
        [
          ID,
          STATUS,
          column('path', 'Paketteki dosya', 'text', 50),
          column('ownerType', 'Bağlı kayıt türü', 'text', 16),
          column('ownerId', 'Bağlı kayıt kimliği', 'text', 26),
          column('owner', 'Bağlı kayıt', 'text', 22),
          column('fileName', 'Dosya adı', 'text', 28),
          column('mimeType', 'Dosya türü', 'text', 16),
          column('sizeBytes', 'Boyut (bayt)', 'integer', 14),
          column('uploadedBy', 'Yükleyen', 'text', 18),
          column('uploadedAt', 'Yüklenme', 'text', 18),
          column('deletedBy', 'Silen', 'text', 18),
          column('deletedAt', 'Silinme', 'text', 18),
          column('deleteReason', 'Silme gerekçesi', 'text', 24),
          column('note', 'Not', 'text', 30),
        ],
        documentRows,
      ),
    },
    {
      file: 'degisiklik-gecmisi.csv',
      description:
        'Bütün kayıtların ve belgelerin geçmişi: oluşturma, düzenleme, durum değişikliği, silme ve geri yükleme; belge ekleme dahil. Kim, ne zaman, gerekçe. "Kayıt kimliği" ilgili tablodaki "Kimlik" sütununa bağlanır; değişen her alan ayrı satırdır.',
      deletedCount: null,
      section: table(
        'Değişiklik geçmişi',
        [
          column('recordType', 'Kayıt türü', 'text', 16),
          column('recordId', 'Kayıt kimliği', 'text', 26),
          column('record', 'Kayıt', 'text', 22),
          column('at', 'Zaman', 'text', 18),
          column('by', 'Yapan', 'text', 18),
          column('action', 'İşlem', 'text', 20),
          column('field', 'Alan', 'text', 16),
          column('old', 'Eski değer', 'text', 24),
          column('new', 'Yeni değer', 'text', 24),
          column('reason', 'Gerekçe', 'text', 28),
        ],
        historyRows,
      ),
    },
  ];

  // Toplamlar Hareketler tablosunun silinmemiş satırlarından; borç/alacak silinmemiş anlaşmalardan.
  const activeTransactions = source.transactions.filter((transaction) => !transaction.deletedAt);
  const totals = cashTotalsOfRows(
    activeTransactions.map((transaction) => ({
      kind: transaction.kind,
      amount: transaction.amount,
    })),
  );
  const activeAgreements = source.agreements.filter((agreement) => !agreement.deletedAt);
  const obligations = summarizeObligations(activeAgreements, source.today);
  const trackingStart =
    activeAgreements
      .filter((agreement) => agreement.kind === 'opening' && agreement.trackingStartDate)
      .map((agreement) => agreement.trackingStartDate!)
      .sort()[0] ?? null;

  const relations = table(
    'Tablolar ve ilişkiler',
    [
      column('table', 'Tablo', 'text', 22),
      column('file', 'CSV dosyası', 'text', 26),
      column('count', 'Kayıt sayısı', 'integer', 12),
      column('deleted', 'Silinmiş (geri alınabilir)', 'integer', 14),
      column('description', 'İçerik ve ilişkiler', 'text', 90),
    ],
    tables.map((entry) => ({
      table: entry.section.title,
      file: `csv/${entry.file}`,
      count: entry.section.rows.length,
      deleted: entry.deletedCount,
      description: entry.description,
    })),
  );

  const summary: ReportDocument = {
    title: 'Tüm firma verisi',
    subject: null,
    fileBase: `tum-firma-verisi-${slug(source.companyName) || 'firma'}-${todayInIstanbul(new Date(source.generatedAt))}`,
    meta: [
      { label: 'Firma', value: source.companyName },
      { label: 'Üretim tarihi/saati', value: displayDateTime(source.generatedAt) },
      {
        label: 'Veri anı',
        value:
          'Bütün tablolar aynı anda alınmış tek tutarlı okumadan üretildi; toplamlar aynı satırlardan hesaplandı.',
      },
      {
        label: 'Kapsam',
        value:
          'Bütün şantiyeler ve firma geneli kayıtlar; silinmiş ama geri alınabilir kayıtlar dahil.',
      },
      {
        label: 'Durum etiketleri',
        value: `"${ACTIVE_STATUS_LABEL}": etkin kayıt. "${DELETED_STATUS_LABEL}": silinmiş ama geri yüklenebilir kayıt; toplamlara katılmaz.`,
      },
      {
        label: 'Biçim',
        value:
          "Excel'de tutarlar TL sayı hücresi, tarihler tarih hücresi. CSV dosyaları UTF-8, ';' ayraçlı; tutar binlik ayraçsız ondalık virgüllü (12500,50), tarih GG.AA.YYYY.",
      },
      {
        label: 'Belgeler',
        value:
          'Orijinal dosyalar "belgeler" klasöründe; hangi dosyanın hangi kayda ait olduğu Belgeler tablosundadır.',
      },
      {
        label: 'Takip başlangıcı',
        value: trackingStart ? displayDate(trackingStart) : NO_OPENING_TEXT,
      },
    ],
    warning: trackingStart ? TRACKING_START_WARNING : null,
    sections: [
      cashSummary('Gerçekleşen hareketler (Hareketler tablosunun silinmemiş satırları)', totals),
      ...obligationSections(obligations.payable, obligations.receivable, obligations.openings),
      relations,
    ],
  };

  return {
    fileBase: summary.fileBase,
    generatedAt: source.generatedAt,
    summary,
    tables,
    documents: packaged,
  };
}

// ── Değişiklik geçmişi ───────────────────────────────────────────────────────

interface Lookups {
  actor(id: Types.ObjectId | null | undefined): string | null;
  partyName(id: Types.ObjectId | null): string | null;
  categoryName(id: Types.ObjectId | null): string | null;
  projectName(id: Types.ObjectId | null): string | null;
  agreementName(id: Types.ObjectId | null): string | null;
}

const MONEY_FIELDS = new Set(['amount', 'initialAmount', 'currentAmount']);

const isObjectId = (value: unknown): value is Types.ObjectId =>
  typeof value === 'object' &&
  value !== null &&
  (value as { _bsontype?: string })._bsontype === 'ObjectId';

function historyValue(field: string, value: unknown, lookups: Lookups): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (isObjectId(value)) {
    const name =
      field === 'partyId'
        ? lookups.partyName(value)
        : field === 'categoryId'
          ? lookups.categoryName(value)
          : field === 'projectId'
            ? lookups.projectName(value)
            : null;
    return name ? `${name} (${value.toString()})` : value.toString();
  }
  if (typeof value === 'number' && MONEY_FIELDS.has(field)) return formatTl(value);
  if (typeof value === 'boolean') return YES_NO(value);
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function buildHistoryRows(source: FullExportSource, lookups: Lookups) {
  interface Owner {
    type: string;
    id: Types.ObjectId;
    label: string;
    history: HistoryEntry[];
  }
  const owners: Owner[] = [
    ...source.projects.map((p) => ({
      type: 'Şantiye',
      id: p._id,
      label: p.name,
      history: p.history,
    })),
    ...source.parties.map((p) => ({
      type: 'Kişi/firma',
      id: p._id,
      label: p.name,
      history: p.history,
    })),
    ...source.categories.map((c) => ({
      type: 'Kategori',
      id: c._id,
      label: c.name,
      history: c.history,
    })),
    ...source.transactions.map((t) => ({
      type: 'Hareket',
      id: t._id,
      label: `İşlem no ${t.recordNo}`,
      history: t.history,
    })),
    ...source.agreements.map((a) => ({
      type: a.kind === 'opening' ? 'Başlangıç kaydı' : 'Anlaşma',
      id: a._id,
      label: agreementLabel(a),
      history: a.history,
    })),
    ...source.documents.map((d) => ({
      type: 'Belge',
      id: d._id,
      label: `${d.fileName} (${DOCUMENT_STATUS[d.status]})`,
      history: d.history,
    })),
  ];

  const rows: (Record<string, CellValue> & { sortAt: number })[] = [];
  const push = (owner: Omit<Owner, 'history'> | null, entry: HistoryEntry) => {
    const base = {
      recordType: owner?.type ?? 'Firma',
      recordId: owner?.id.toString() ?? null,
      record: owner?.label ?? source.companyName,
      at: displayDateTime(entry.at.toISOString()),
      by: lookups.actor(entry.by),
      action: HISTORY_ACTION_LABEL[entry.action] ?? entry.action,
      reason: entry.reason,
      sortAt: entry.at.getTime(),
    };
    if (entry.changes.length === 0) {
      rows.push({ ...base, field: null, old: null, new: null });
      return;
    }
    for (const change of entry.changes) {
      rows.push({
        ...base,
        field: FIELD_LABEL[change.field] ?? change.field,
        old: historyValue(change.field, change.old, lookups),
        new: historyValue(change.field, change.new, lookups),
      });
    }
  };
  for (const entry of source.companyHistory) push(null, entry);
  for (const owner of owners) for (const entry of owner.history) push(owner, entry);
  rows.sort((a, b) => a.sortAt - b.sortAt);
  return rows.map(({ sortAt: _sortAt, ...row }) => row);
}

// ── Dosyalar ─────────────────────────────────────────────────────────────────

/** Paketteki tablo dosyaları: tek Excel (Özet + her tablo bir sayfa) ve her tablo için CSV. */
export async function renderFullExportFiles(
  content: FullExportContent,
): Promise<{ path: string; body: Buffer }[]> {
  const workbook = await renderXlsx(
    {
      ...content.summary,
      sections: [...content.summary.sections, ...content.tables.map((entry) => entry.section)],
    },
    new Date(content.generatedAt),
  );
  return [
    { path: 'veri.xlsx', body: workbook },
    { path: 'csv/ozet.csv', body: renderCsv(content.summary) },
    ...content.tables.map((entry) => ({
      path: `csv/${entry.file}`,
      body: renderCsvTable(entry.section),
    })),
  ];
}
