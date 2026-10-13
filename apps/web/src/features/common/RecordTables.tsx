import { daysBetween, todayInIstanbul } from '@santiye/shared';
import { Clock, Split, TriangleAlert } from 'lucide-react';
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
    return (
      <Badge tone="overdue">
        <Icon icon={TriangleAlert} />
        {agreement.overdueDays ? `${agreement.overdueDays} gün gecikti` : 'Gecikmiş'}
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

export function AgreementStatusBadges({ agreement }: { agreement: Agreement }) {
  return (
    <span className="row">
      {agreement.kind === 'opening' ? <Badge tone="cyan">Başlangıç</Badge> : null}
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

const tone = (agreement: Agreement) => (agreement.direction === 'payable' ? 'expense' : 'income');

/** Anlaşma ve başlangıç kayıtları listesi; başlangıç kayıtları "Başlangıç" rozetiyle (şartname 7.6). */
export function AgreementTable({ items }: { items: Agreement[] }) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (a: Agreement) => `/uygulama/anlasmalar/${a.id}`;
  const scope = (a: Agreement) => (a.scope === 'company' ? 'Firma geneli' : a.project?.name);

  if (phone) {
    return (
      <ul className="item-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="item-card" to={href(a)}>
              <div className="item-card__main">
                <span className="item-card__title">{a.label}</span>
                <span className="meta">
                  {a.party?.name} · {scope(a)}
                </span>
                {a.dueDate ? <span className="meta">Vade: {formatDate(a.dueDate)}</span> : null}
                <AgreementStatusBadges agreement={a} />
              </div>
              <div className="item-card__side">
                <Amount value={a.remaining} tone={tone(a)} label="Kalan" />
                {a.excess > 0 ? (
                  <span className="meta">
                    {a.direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat'}:{' '}
                    {formatMoney(a.excess)}
                  </span>
                ) : null}
              </div>
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
                <Link to={href(a)}>{a.label}</Link>
                <div>
                  <AgreementStatusBadges agreement={a} />
                </div>
              </td>
              <td>{a.party?.name}</td>
              <td>{scope(a)}</td>
              <td className="nowrap">{formatDate(a.dueDate)}</td>
              <td className="num">{formatMoney(a.currentAmount)}</td>
              <td className="num">{formatMoney(a.netSettled)}</td>
              <td className="num">
                <Amount value={a.remaining} tone={tone(a)} />
                {a.excess > 0 ? (
                  <span className="meta block">Fazla: {formatMoney(a.excess)}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
