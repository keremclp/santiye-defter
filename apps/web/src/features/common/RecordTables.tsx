import {
  daysBetween,
  overdueDaysOf,
  todayInIstanbul,
  type DirectionSummary,
} from '@santiye/shared';
import { ArrowDownLeft, ArrowUpRight, Clock, History, Split, TriangleAlert } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import type { Agreement, Transaction } from '../../api/types';
import { Amount, Badge, KindIcon } from '../../components/ui/Amount';
import { Icon } from '../../components/ui/Icon';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { usePhone } from '../../hooks/useMediaQuery';
import { formatDate, formatMoney, formatMoneyWhole } from '../../lib/format';
import {
  DIRECTION_LABEL,
  DUE_STATE_LABEL,
  KIND_LABEL,
  paymentStatusLabel,
  WORK_STATUS_LABEL,
} from '../../lib/labels';

/** Şantiye adı(ları) veya "Firma geneli". */
export function ScopeText({ transaction }: { transaction: Transaction }) {
  const names = [
    ...new Set(
      transaction.allocations.map((a) =>
        a.scope === 'company' ? 'Firma geneli' : (a.project?.name ?? 'Şantiye'),
      ),
    ),
  ];
  return <>{names.join(', ')}</>;
}

function agreementNames(transaction: Transaction): string {
  const names = transaction.allocations
    .map((a) => a.agreement?.name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)].join(', ');
}

/** Paylaştırma notunda kuruş yalnız gerekiyorsa yazılır: "₺25.000 + ₺15.000". */
const shareText = (kurus: number) =>
  kurus % 100 === 0 ? formatMoneyWhole(kurus) : formatMoney(kurus);

function SplitNote({ transaction }: { transaction: Transaction }) {
  if (!transaction.isSplit) return null;
  return (
    <span className="split-note">
      <Icon icon={Split} />
      Paylaştırıldı: {transaction.allocations.map((a) => shareText(a.amount)).join(' + ')}
    </span>
  );
}

const titleOf = (t: Transaction) => t.description || (t.party?.name ?? 'Açıklamasız kayıt');

/** "#18 · 13 Eki 2026 · Ödeme iadesi" — tür yazısı her zaman görünür (şartname 4.1). */
function metaOf(t: Transaction) {
  return (
    <>
      <span className="record-no">#{t.recordNo}</span> · {formatDate(t.date)} · {KIND_LABEL[t.kind]}
    </>
  );
}

function ScopedShare({ transaction, show }: { transaction: Transaction; show: boolean }) {
  if (!show || transaction.scopedAmount === undefined) return null;
  if (transaction.scopedAmount === transaction.amount) return null;
  return (
    <span className="meta block">Bu kapsama düşen: {formatMoney(transaction.scopedAmount)}</span>
  );
}

/** Hareketin liste satırı (özet paneli, detay blokları, arama). */
export function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  return (
    <ListRow
      to={`/uygulama/islemler/${t.id}`}
      icon={<KindIcon kind={t.kind} />}
      title={titleOf(t)}
      titleExtra={t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
      meta={
        <>
          <ScopeText transaction={t} />
          {t.party && t.description ? ` · ${t.party.name}` : ''} · {formatDate(t.date)}
        </>
      }
      side={
        <>
          <Amount value={t.amount} kind={t.kind} />
          {t.kind === 'expense_refund' || t.kind === 'income_refund' ? (
            <Badge>{KIND_LABEL[t.kind]}</Badge>
          ) : null}
        </>
      }
    />
  );
}

/**
 * İşlem listesi (şartname 7.4, 11): masaüstünde tablo — İşlem, Kişi, Şantiye, Anlaşma, Kategori,
 * Tutar; 760 px altında her satır kart. `compact` dar panellerde liste satırları gösterir.
 */
export function TransactionTable({
  items,
  showScopedAmount = false,
  compact = false,
}: {
  items: Transaction[];
  /** Şantiye filtresinde bu kapsama düşen pay ayrıca gösterilir. */
  showScopedAmount?: boolean;
  /** Dar panellerde (özet, detay blokları) her genişlikte liste satırları. */
  compact?: boolean;
}) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (t: Transaction) => `/uygulama/islemler/${t.id}`;

  if (compact) {
    return (
      <ListRows>
        {items.map((t) => (
          <TransactionRow key={t.id} transaction={t} />
        ))}
      </ListRows>
    );
  }

  if (phone) {
    return (
      <ul className="card-list">
        {items.map((t) => (
          <li key={t.id}>
            <Link className="card-list__item" to={href(t)}>
              <span className="list-row__main">
                <span className="list-row__title">
                  <span className="list-row__title-text">{titleOf(t)}</span>
                  {t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
                </span>
                <span className="list-row__meta block">{metaOf(t)}</span>
                <SplitNote transaction={t} />
              </span>
              <span className="list-row__side">
                <Amount value={t.amount} kind={t.kind} />
                <ScopedShare transaction={t} show={showScopedAmount} />
              </span>
              <span className="card-list__extra">
                <ScopeText transaction={t} />
                {t.party ? ` · ${t.party.name}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">İşlem</th>
            <th scope="col">Kişi</th>
            <th scope="col">Şantiye</th>
            <th scope="col">Anlaşma</th>
            <th scope="col">Kategori</th>
            <th scope="col" className="num">
              Tutar
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} onClick={() => void navigate(href(t))}>
              <td>
                <div className="type-cell">
                  <KindIcon kind={t.kind} size="md" />
                  <div>
                    <span className="list-row__title">
                      <Link className="cell-link" to={href(t)}>
                        {titleOf(t)}
                      </Link>
                      {t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
                    </span>
                    <span className="cell-sub">{metaOf(t)}</span>
                    <SplitNote transaction={t} />
                  </div>
                </div>
              </td>
              <td>{t.party?.name ?? <span className="muted">Muhatapsız</span>}</td>
              <td>
                <ScopeText transaction={t} />
              </td>
              <td>{agreementNames(t) || <span className="muted">Bağlı değil</span>}</td>
              <td className="muted">
                {t.category?.name ?? (t.kind === 'income' ? '—' : 'Kategorisiz')}
              </td>
              <td className="num">
                <Amount value={t.amount} kind={t.kind} />
                <ScopedShare transaction={t} show={showScopedAmount} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Gecikmiş: kırmızı rozet + uyarı ikonu + "N gün gecikti"; yaklaşan: warn + saat + "N gün kaldı". */
export function DueBadge({ agreement }: { agreement: Agreement }) {
  if (!agreement.dueState) return null;
  if (agreement.dueState === 'overdue') {
    // Detay cevabında gün sayısı yok; aynı ortak fonksiyonla hesaplanır.
    const days =
      agreement.overdueDays ??
      (agreement.dueDate ? overdueDaysOf(agreement.dueDate, todayInIstanbul()) : 0);
    return (
      <Badge tone="overdue">
        <Icon icon={TriangleAlert} />
        {days ? `${days} gün gecikti` : 'Gecikmiş'}
      </Badge>
    );
  }
  if (agreement.dueState === 'upcoming' && agreement.dueDate) {
    const left = daysBetween(todayInIstanbul(), agreement.dueDate);
    return (
      <Badge tone="warn">
        <Icon icon={Clock} />
        {left === 0 ? 'Bugün' : `${left} gün kaldı`}
      </Badge>
    );
  }
  return <Badge>{DUE_STATE_LABEL[agreement.dueState]}</Badge>;
}

/**
 * Bakiye kutusunun alt satırı: gecikmiş tutar kırmızı rozet + uyarı ikonu, fazla ödeme/tahsilat
 * kırmızı rozet (şartname 4.4). İkisi de yoksa "Gecikmiş yok".
 */
export function BalanceFlags({
  summary,
  payable,
}: {
  summary: Pick<DirectionSummary, 'overdue' | 'excess'>;
  payable: boolean;
}) {
  if (summary.overdue <= 0 && summary.excess <= 0) return <>Gecikmiş yok</>;
  return (
    <>
      {summary.overdue > 0 ? (
        <Badge tone="overdue">
          <Icon icon={TriangleAlert} />
          Gecikmiş {formatMoney(summary.overdue)}
        </Badge>
      ) : null}
      {summary.excess > 0 ? (
        <Badge tone="danger">
          {payable ? 'Fazla ödeme' : 'Fazla tahsilat'} {formatMoney(summary.excess)}
        </Badge>
      ) : null}
    </>
  );
}

/** Anlaşmanın durum rozetleri (detay sayfası): yön, iş, ödeme ve vade; anlam yazıyla da verilir. */
export function AgreementStatusBadges({ agreement }: { agreement: Agreement }) {
  return (
    <span className="status-row">
      {agreement.kind === 'opening' ? <Badge>Başlangıç</Badge> : null}
      <Badge tone={agreement.direction === 'payable' ? 'expense' : 'income'}>
        {DIRECTION_LABEL[agreement.direction]}
      </Badge>
      {agreement.settlementPending ? (
        <Badge tone="danger">İptal — hesap kesinleşmedi</Badge>
      ) : agreement.workStatus ? (
        <Badge tone={agreement.workStatus === 'cancelled' ? 'danger' : 'neutral'}>
          {WORK_STATUS_LABEL[agreement.workStatus]}
        </Badge>
      ) : null}
      <Badge tone={agreement.paymentStatus === 'overpaid' ? 'danger' : 'neutral'}>
        {paymentStatusLabel(agreement.paymentStatus, agreement.direction)}
      </Badge>
      <DueBadge agreement={agreement} />
    </span>
  );
}

/** Yön ikon kutusu: tahsil edilecek yeşil, ödenecek kırmızı; başlangıç kaydı geçmiş ikonu. */
export function DirectionIcon({
  agreement,
  opening,
  size = 'lg',
}: {
  agreement: Pick<Agreement, 'direction'>;
  opening?: boolean;
  size?: 'lg' | 'md';
}) {
  const receivable = agreement.direction === 'receivable';
  const glyph = opening ? History : receivable ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`icon-box icon-box--${size} icon-box--${receivable ? 'income' : 'expense'}`}>
      <Icon icon={glyph} />
    </span>
  );
}

const scopeOf = (a: Agreement) => (a.scope === 'company' ? 'Firma geneli' : a.project?.name);
const remainingLabel = (a: Agreement) =>
  a.direction === 'receivable' ? 'Kalan alacak' : 'Kalan borç';

/** "Tahsil edilecek · Devam ediyor · Kısmi tahsil edildi" — yön ve durum yazıyla. */
function statusText(a: Agreement) {
  return [
    DIRECTION_LABEL[a.direction],
    a.settlementPending ? null : a.workStatus ? WORK_STATUS_LABEL[a.workStatus] : null,
    paymentStatusLabel(a.paymentStatus, a.direction),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Yalnız istisnai durumlar rozetle: başlangıç, iptal, fazla ve vade. */
function AgreementFlags({ agreement: a, due = true }: { agreement: Agreement; due?: boolean }) {
  return (
    <>
      {a.kind === 'opening' ? <Badge>Başlangıç</Badge> : null}
      {a.settlementPending ? (
        <Badge tone="danger">İptal — hesap kesinleşmedi</Badge>
      ) : a.workStatus === 'cancelled' ? (
        <Badge tone="danger">İptal</Badge>
      ) : null}
      {due ? <DueBadge agreement={a} /> : null}
    </>
  );
}

function Excess({ agreement: a }: { agreement: Agreement }) {
  if (a.excess <= 0) return null;
  return (
    <Badge tone="danger">
      {a.direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat'} {formatMoney(a.excess)}
    </Badge>
  );
}

/** Anlaşmanın liste satırı (panellerde): kalan bakiye `ink`, yön ikon kutusu ve yazıyla. */
export function AgreementRow({ agreement: a }: { agreement: Agreement }) {
  return (
    <ListRow
      to={`/uygulama/anlasmalar/${a.id}`}
      icon={<DirectionIcon agreement={a} opening={a.kind === 'opening'} />}
      title={a.label}
      titleExtra={<AgreementFlags agreement={a} due={false} />}
      meta={`${a.party?.name ?? ''} · ${scopeOf(a) ?? ''}${a.dueDate ? ` · Vade ${formatDate(a.dueDate)}` : ''}`}
      side={
        <>
          <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
          {a.dueState === 'overdue' || a.dueState === 'upcoming' ? (
            <DueBadge agreement={a} />
          ) : (
            <span className="list-row__note">{remainingLabel(a)}</span>
          )}
          <Excess agreement={a} />
        </>
      }
    />
  );
}

/**
 * Anlaşma ve başlangıç kayıtları listesi (şartname 7.6): masaüstünde tablo, telefonda panel içinde
 * kart satırları; `compact` dar panellerde liste satırları. Kalan borç/alacak bakiyedir, `ink`
 * renginde (şartname 4.1); yön ikon kutusu ve yazıyla anlaşılır.
 */
export function AgreementTable({
  items,
  compact = false,
}: {
  items: Agreement[];
  compact?: boolean;
}) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (a: Agreement) => `/uygulama/anlasmalar/${a.id}`;

  if (compact) {
    return (
      <ListRows>
        {items.map((a) => (
          <AgreementRow key={a.id} agreement={a} />
        ))}
      </ListRows>
    );
  }

  if (phone) {
    return (
      <ul className="card-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="card-list__item" to={href(a)}>
              <span className="list-row__main">
                <span className="list-row__title">
                  <span className="list-row__title-text">{a.label}</span>
                </span>
                <span className="list-row__meta block">{statusText(a)}</span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
                <span className="list-row__note">{remainingLabel(a)}</span>
              </span>
              <span className="card-list__extra">
                {a.party?.name} · {scopeOf(a)}
                {a.dueDate ? ` · Vade ${formatDate(a.dueDate)}` : ''}
              </span>
              {a.kind === 'opening' ||
              a.settlementPending ||
              a.workStatus === 'cancelled' ||
              a.excess > 0 ||
              a.dueState === 'overdue' ||
              a.dueState === 'upcoming' ? (
                <span className="card-list__extra status-row">
                  <AgreementFlags agreement={a} />
                  <Excess agreement={a} />
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Anlaşma</th>
            <th scope="col">Kişi</th>
            <th scope="col">Şantiye</th>
            <th scope="col">Vade</th>
            <th scope="col" className="num">
              Bedel
            </th>
            <th scope="col" className="num">
              Ödenen / tahsil edilen
            </th>
            <th scope="col" className="num">
              Kalan
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} onClick={() => void navigate(href(a))}>
              <td>
                <div className="type-cell">
                  <DirectionIcon agreement={a} opening={a.kind === 'opening'} size="md" />
                  <div>
                    <span className="list-row__title">
                      <Link className="cell-link" to={href(a)}>
                        {a.label}
                      </Link>
                      <AgreementFlags agreement={a} due={false} />
                    </span>
                    <span className="cell-sub">{statusText(a)}</span>
                  </div>
                </div>
              </td>
              <td>{a.party?.name}</td>
              <td>{scopeOf(a)}</td>
              <td>
                <span className="nowrap">{a.dueDate ? formatDate(a.dueDate) : '—'}</span>
                {a.dueState === 'overdue' || a.dueState === 'upcoming' ? (
                  <span className="block">
                    <DueBadge agreement={a} />
                  </span>
                ) : null}
              </td>
              <td className="num">{formatMoney(a.currentAmount)}</td>
              <td className="num">{formatMoney(a.netSettled)}</td>
              <td className="num">
                <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
                {a.excess > 0 ? (
                  <span className="cell-sub text-danger">
                    {a.direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat'}{' '}
                    {formatMoney(a.excess)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
