import { useNavigate, Link } from 'react-router';
import type { Agreement, Transaction } from '../../api/types';
import { Amount, Badge, KindBadge } from '../../components/ui/Amount';
import { usePhone } from '../../hooks/useMediaQuery';
import { formatDate, formatMoney } from '../../lib/format';
import {
  DIRECTION_LABEL,
  DUE_STATE_LABEL,
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

/**
 * İşlem listesi: masaüstünde tablo, 760 px altında kart (şartname 7.4, 11). Paylaştırılmış harekette
 * "Paylaştırıldı" rozeti; tür yazıyla da gösterilir.
 */
export function TransactionTable({
  items,
  showScopedAmount = false,
  compact = false,
}: {
  items: Transaction[];
  /** Şantiye filtresinde bu kapsama düşen pay ayrıca gösterilir. */
  showScopedAmount?: boolean;
  /** Dar kartlarda (özet, detay blokları) her genişlikte kart listesi. */
  compact?: boolean;
}) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (t: Transaction) => `/uygulama/islemler/${t.id}`;

  if (phone || compact) {
    return (
      <ul className="item-list">
        {items.map((t) => (
          <li key={t.id}>
            <Link className="item-card" to={href(t)}>
              <div className="item-card__main">
                <span className="item-card__title">
                  {t.description || (t.party?.name ?? 'Açıklamasız kayıt')}
                </span>
                <span className="meta">
                  #{t.recordNo} · {formatDate(t.date)} · <ScopeText transaction={t} />
                </span>
                {t.party && t.description ? <span className="meta">{t.party.name}</span> : null}
                <span className="row">
                  <KindBadge kind={t.kind} />
                  {t.isSplit ? <Badge tone="cyan">Paylaştırıldı</Badge> : null}
                  {t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
                </span>
              </div>
              <div className="item-card__side">
                <Amount value={t.amount} kind={t.kind} />
                {showScopedAmount && t.scopedAmount !== undefined && t.scopedAmount !== t.amount ? (
                  <span className="meta">Bu kapsama düşen: {formatMoney(t.scopedAmount)}</span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">No</th>
          <th scope="col">Tarih</th>
          <th scope="col">Tür</th>
          <th scope="col">Açıklama</th>
          <th scope="col">Şantiye</th>
          <th scope="col">Kişi</th>
          <th scope="col">Anlaşma</th>
          <th scope="col" className="num">
            Tutar
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} onClick={() => void navigate(href(t))}>
            <td>
              <Link to={href(t)}>#{t.recordNo}</Link>
            </td>
            <td className="nowrap">{formatDate(t.date)}</td>
            <td>
              <span className="row">
                <KindBadge kind={t.kind} />
                {t.isSplit ? <Badge tone="cyan">Paylaştırıldı</Badge> : null}
                {t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
              </span>
            </td>
            <td>{t.description || <span className="muted">—</span>}</td>
            <td>
              <ScopeText transaction={t} />
            </td>
            <td>{t.party?.name ?? <span className="muted">—</span>}</td>
            <td>{agreementNames(t) || <span className="muted">Anlaşmaya bağlı değil</span>}</td>
            <td className="num">
              <Amount value={t.amount} kind={t.kind} />
              {showScopedAmount && t.scopedAmount !== undefined && t.scopedAmount !== t.amount ? (
                <span className="meta block">Bu kapsama düşen: {formatMoney(t.scopedAmount)}</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DueBadge({ agreement }: { agreement: Agreement }) {
  if (!agreement.dueState) return null;
  if (agreement.dueState === 'overdue') {
    return (
      <Badge tone="overdue">
        Gecikmiş{agreement.overdueDays ? ` · ${agreement.overdueDays} gün` : ''}
      </Badge>
    );
  }
  if (agreement.dueState === 'upcoming') return <Badge tone="upcoming">Yaklaşan</Badge>;
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
  );
}
