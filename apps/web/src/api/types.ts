// API cevap biçimleri (apps/api/src/services/*presenters.ts ile aynı). Tutarlar kuruş tamsayı,
// iş tarihleri YYYY-MM-DD, sistem zamanları ISO UTC.

import type {
  AgreementKind,
  CashTotals,
  Direction,
  DirectionSummary,
  DocumentOwnerType,
  DocumentStatus,
  PaymentStatus,
  ReportExportType,
  Scope,
  TransactionKind,
  WorkStatus,
} from '@santiye/shared';

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ActorRef {
  id: string;
  name: string;
}

export interface NameRef {
  id: string;
  name: string;
  deleted: boolean;
}

export interface HistoryChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface HistoryEntry {
  at: string;
  by: ActorRef | null;
  action: string;
  changes: HistoryChange[];
  reason: string | null;
}

export interface RecordMeta {
  createdBy: ActorRef | null;
  createdAt: string;
  updatedBy: ActorRef | null;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: ActorRef | null;
  deleteReason: string | null;
}

export interface Warning {
  code: string;
  message: string;
  related: { id: string; name?: string; recordNo?: number }[];
}

// ── Kimlik ve firma ───────────────────────────────────────────────────────────

export type ServiceState =
  'active' | 'view_only' | 'suspended' | 'archived' | 'deletion_pending' | 'deleting';

export interface ServiceSummary {
  state: ServiceState;
  serviceEndedAt: string | null;
  viewUntil: string | null;
  retainUntil: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  companyId: string;
  mustChangePassword: boolean;
}

export interface Profile extends AuthUser {
  phone: string;
  email: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: AuthUser;
  mustChangePassword: boolean;
  company: { displayName: string };
  service: ServiceSummary;
}

export interface MeResult {
  user: Profile;
  company: { displayName: string };
  service: ServiceSummary;
}

export interface PasswordChangeResult extends Partial<TokenPair> {
  user: AuthUser;
}

export interface Contact {
  person: string;
  phone: string;
  email: string;
}

/** Kullanım dökümü; toplamı `usedBytes` ile aynıdır (şartname 7.11, 9.6). */
export interface StorageBreakdown {
  originalBytes: number;
  previewBytes: number;
  deletedBytes: number;
  pendingBytes: number;
  exportBytes: number;
  documentCount: number;
  deletedDocumentCount: number;
}

export interface CompanyInfo {
  displayName: string;
  contact: Contact;
  storage: { usedBytes: number; quotaBytes: number; breakdown?: StorageBreakdown };
  service: ServiceSummary;
  updatedAt: string;
}

export interface CompanyUser {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Şantiye ve kişi ───────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project extends RecordMeta {
  id: string;
  name: string;
  description: string;
  address: string;
  startDate: string | null;
  status: ProjectStatus;
  completedAt: string | null;
  pinned: boolean;
  lastUsedAt: string | null;
  history?: HistoryEntry[];
  summary?: ProjectCardSummary;
  warnings?: Warning[];
}

/** Liste ve pano kartı için şantiye bazında net tutarlar ve kalanlar. */
export interface ProjectCardSummary {
  netIncome: number;
  netExpense: number;
  difference: number;
  remainingPayable: number;
  remainingReceivable: number;
  overdueReceivable: number;
}

export interface ObligationSummary {
  payable: DirectionSummary;
  receivable: DirectionSummary;
  openings: { payable: DirectionSummary; receivable: DirectionSummary };
}

export interface ProjectSummary extends ObligationSummary {
  projectId: string;
  cash: CashTotals;
  generatedAt: string;
}

export type PartyKind = 'person' | 'company';
export type PartyTag = 'supplier' | 'subcontractor' | 'customer';

export interface Party extends RecordMeta {
  id: string;
  name: string;
  kind: PartyKind;
  tags: PartyTag[];
  phone: string;
  email: string;
  address: string;
  note: string;
  isActive: boolean;
  pinned: boolean;
  lastUsedAt: string | null;
  history?: HistoryEntry[];
  warnings?: Warning[];
}

export interface PartySuggestion {
  id: string;
  name: string;
  kind: PartyKind;
  tags: PartyTag[];
}

export interface PartyFinance extends ObligationSummary {
  overpaid: number;
  overcollected: number;
  byScope: {
    scope: Scope;
    project: (NameRef & { status: ProjectStatus }) | null;
    payable: DirectionSummary;
    receivable: DirectionSummary;
  }[];
  directTransactions: CashTotals;
  agreements: Agreement[];
}

export interface PartyDetail extends Party {
  finance: PartyFinance;
}

export interface PartyStatement extends PartyFinance {
  party: Party;
  transactions: (Transaction & { notLinkedToAgreement: boolean })[];
  generatedAt: string;
}

// ── İşlem ─────────────────────────────────────────────────────────────────────

export interface Allocation {
  id: string;
  scope: Scope;
  projectId: string | null;
  project: (NameRef & { status: ProjectStatus }) | null;
  agreementId: string | null;
  agreement: (NameRef & { kind: AgreementKind }) | null;
  amount: number;
  refundedAmount: number;
}

export interface Transaction extends RecordMeta {
  id: string;
  recordNo: number;
  kind: TransactionKind;
  amount: number;
  date: string;
  partyId: string | null;
  party: NameRef | null;
  categoryId: string | null;
  category: NameRef | null;
  description: string;
  isSplit: boolean;
  linkedToAgreement: boolean;
  allocations: Allocation[];
  refundOf: {
    transactionId: string;
    parts: { allocationId: string; amount: number }[];
  } | null;
  excess: { amount: number; reason: string } | null;
  documentCount: number;
  scopedAmount?: number;
  history?: HistoryEntry[];
  warnings?: Warning[];
}

export interface TransactionDetail extends Transaction {
  history: HistoryEntry[];
  refunds: Transaction[];
  refundable: number | null;
  documents: DocumentInfo[];
}

export interface TransactionList extends Paged<Transaction> {
  totals: CashTotals;
}

export interface DuplicateDraft {
  sourceTransactionId: string;
  kind: 'income' | 'expense';
  amount: number;
  date: string;
  partyId: string | null;
  categoryId: string | null;
  description: string;
  allocations: {
    scope: Scope;
    projectId: string | null;
    agreementId: string | null;
    amount: number;
  }[];
  agreementConfirmationRequired: boolean;
}

// ── Anlaşma ───────────────────────────────────────────────────────────────────

export type DueState = 'overdue' | 'upcoming' | 'later' | 'none';

export interface ValueChange<T> {
  at: string;
  by: ActorRef | null;
  old: T;
  new: T;
  reason: string;
}

export interface Agreement extends RecordMeta {
  id: string;
  kind: AgreementKind;
  direction: Direction;
  label: string;
  title: string;
  description: string;
  scope: Scope;
  projectId: string | null;
  project: (NameRef & { status: ProjectStatus }) | null;
  partyId: string;
  party: NameRef | null;
  initialAmount: number;
  currentAmount: number;
  netSettled: number;
  remaining: number;
  excess: number;
  paymentStatus: PaymentStatus;
  workStatus: WorkStatus | null;
  settlementPending: boolean;
  agreementDate: string | null;
  trackingStartDate: string | null;
  dueDate: string | null;
  dueState?: DueState | null;
  overdueDays?: number;
}

export interface AgreementDetail extends Agreement {
  history: HistoryEntry[];
  amountHistory: ValueChange<number>[];
  dueDateHistory: ValueChange<string | null>[];
  transactions: (Transaction & { agreementShare: number })[];
  documents: DocumentInfo[];
}

export interface AgreementList extends Paged<Agreement> {
  totals: ObligationSummary;
}

export interface AmountPreview {
  preview: true;
  before: {
    currentAmount: number;
    netSettled: number;
    remaining: number;
    excess: number;
    paymentStatus: PaymentStatus;
  };
  after: {
    currentAmount: number;
    netSettled: number;
    remaining: number;
    excess: number;
    paymentStatus: PaymentStatus;
  };
  updatedAt: string;
}

// ── Belge ─────────────────────────────────────────────────────────────────────

/** Kayıt detayındaki belge; silinmiş ama geri alınabilir belgede `deletedAt` doludur. */
export interface DocumentInfo {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  status: DocumentStatus;
  hasPreview: boolean;
  uploadedBy: ActorRef | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: ActorRef | null;
  deleteReason: string | null;
}

export interface UploadIntent {
  document: DocumentInfo;
  /** Belge artık beklemiyorsa (yüklendi, süresi doldu) adres verilmez. */
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  } | null;
}

/** 5 dakika geçerli indirme/önizleme adresi. */
export interface DocumentLink {
  url: string;
  expiresAt: string;
  isPreview: boolean;
  fileName: string;
  mimeType: string;
}

// ── Pano, vade, arama, silinenler ─────────────────────────────────────────────

export interface Dashboard {
  scope: string;
  totals: {
    netIncome: number;
    netExpense: number;
    expenseRefund: number;
    difference: number;
    remainingPayable: number;
    remainingReceivable: number;
    overduePayable: number;
    overdueReceivable: number;
    excessPayable: number;
    excessReceivable: number;
  };
  activeProjectCount: number;
  monthly: {
    month: string;
    netIncome: number;
    netExpense: number;
    expenseRefund: number;
    difference: number;
  };
  recentTransactions: Transaction[];
  dueSoon: Agreement[];
  openAgreements: Agreement[];
  recentProjects: Project[];
  generatedAt: string;
}

export interface DuesList extends Paged<Agreement> {
  range: { from: string; to: string } | null;
}

export interface SearchResult {
  query: string;
  projects: { id: string; name: string; status: ProjectStatus }[];
  parties: { id: string; name: string; kind: PartyKind; phone: string; isActive: boolean }[];
  agreements: {
    id: string;
    label: string;
    kind: AgreementKind;
    direction: Direction;
    party: NameRef | null;
    project: NameRef | null;
    currentAmount: number;
    remaining: number;
  }[];
  transactions: Transaction[];
  totals?: { projects: number; parties: number; agreements: number; transactions: number };
  history?: SearchHistoryItem[];
}

export interface SearchHistoryItem {
  query: string;
  createdAt: string;
}

export type DeletedType = 'transaction' | 'agreement' | 'project' | 'party';

export interface DeletedItem {
  type: DeletedType;
  id: string;
  label: string;
  amount: number | null;
  deletedAt: string | null;
  deletedBy: ActorRef | null;
  deleteReason: string | null;
  updatedAt: string;
}

export interface IdempotencyStatus {
  status: 'done' | 'not_found';
  resultRef?: { type: string; id: string };
}

// ── Raporlar (şartname 7.10, 10.9; apps/api/src/services/reports.ts ile aynı) ──

export interface ReportHeader {
  type: ReportExportType;
  title: string;
  subject: string | null;
  companyName: string;
  scope: string;
  /** Kapsam seçildi: tutarlar seçili kapsama düşen paylardan */
  scoped: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  balancesAt: string;
  trackingStart: string | null;
  filters: string[];
}

export interface ReportTransactionRow {
  id: string;
  recordNo: number;
  date: string;
  kind: TransactionKind;
  party: string | null;
  category: string | null;
  scope: string;
  agreement: string | null;
  description: string;
  isSplit: boolean;
  allocations: string;
  amount: number;
  share: number;
  sourceRecordNo: number | null;
  linkedToAgreement: boolean;
  deleted: boolean;
  createdAt: string;
}

export interface ReportAgreementRow {
  id: string;
  kind: AgreementKind;
  label: string;
  direction: Direction;
  party: string | null;
  scope: string;
  currentAmount: number;
  netSettled: number;
  remaining: number;
  excess: number;
  agreementDate: string | null;
  trackingStartDate: string | null;
  dueDate: string | null;
  dueState: DueState | null;
  overdueDays: number;
  workStatus: WorkStatus | null;
  settlementPending: boolean;
}

export interface PeriodReport {
  header: ReportHeader;
  totals: CashTotals;
  categories: { category: string; expense: number; expenseRefund: number; netExpense: number }[];
  rows: ReportTransactionRow[];
  obligations: ObligationSummary;
}

export interface ProjectReport extends ObligationSummary {
  header: ReportHeader;
  project: { id: string; name: string; status: ProjectStatus };
  cash: CashTotals;
  incomeRows: ReportTransactionRow[];
  expenseRows: ReportTransactionRow[];
}

export interface PartyReport extends ObligationSummary {
  header: ReportHeader;
  party: { id: string; name: string };
  agreements: ReportAgreementRow[];
  linkedRows: ReportTransactionRow[];
  linkedTotals: CashTotals;
  directRows: ReportTransactionRow[];
  directTotals: CashTotals;
}

export interface OpenBalancesReport {
  header: ReportHeader;
  summary: ObligationSummary;
  groups: { state: DueState; rows: ReportAgreementRow[] }[];
}
