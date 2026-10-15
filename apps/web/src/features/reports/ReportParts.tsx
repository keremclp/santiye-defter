// Rapor ekranlarının ortak parçaları (şartname 7.10, 9.1, 4.4). Tutarlar ve toplamlar API'deki rapor
// verisinden gelir; ekranda yeniden hesaplanmaz. Dosyalar aynı veriden yazılır.

import {
  NO_OPENING_TEXT,
  OBLIGATIONS_LABEL,
  TRACKING_START_WARNING,
  type CashTotals,
  type DirectionSummary,
} from '@santiye/shared';
import { ArrowDownLeft, ArrowUpRight, Calendar, Info, Scale } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import type { ReportAgreementRow, ReportHeader, ReportTransactionRow } from '../../api/types';
import { Amount, Badge, KindIcon } from '../../components/ui/Amount';
import { Metric } from '../../components/ui/Card';
import { Segment } from '../../components/ui/Chips';
import { DateInput, Field } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { usePhone } from '../../hooks/useMediaQuery';
import { formatDate, formatDateTime, formatMoney, formatSigned } from '../../lib/format';
import { DIRECTION_LABEL, DUE_STATE_LABEL, KIND_LABEL } from '../../lib/labels';
import { BalanceFlags, DirectionIcon } from '../common/RecordTables';
import type { RangeFilters, TotalLine } from './report-params';

// ── Tarih aralığı ────────────────────────────────────────────────────────────

export function RangeFilter({
  filters,
  onChange,
}: {
  filters: RangeFilters;
  onChange: (patch: Partial<RangeFilters>) => void;
}) {
  return (
    <>
      <Segment
        label="İşlem tarihi"
        options={[
          { value: 'buay', label: 'Bu ay' },
          { value: 'buyil', label: 'Bu yıl' },
          { value: 'tumu', label: 'Tümü' },
          { value: 'aralik', label: <Icon icon={Calendar} />, ariaLabel: 'Tarih aralığı' },
        ]}
        value={filters.donem}
        onChange={(donem) => onChange({ donem })}
      />
      {filters.donem === 'aralik' ? (
        <div className="panel-toolbar__range">
          <Field label="Başlangıç">
            {(props) => (
              <DateInput
                {...props}
                value={filters.baslangic}
                onChange={(event) => onChange({ baslangic: event.target.value })}
              />
            )}
          </Field>
          <Field label="Bitiş">
            {(props) => (
              <DateInput
                {...props}
                value={filters.bitis}
                onChange={(event) => onChange({ bitis: event.target.value })}
              />
            )}
          </Field>
        </div>
      ) : null}
    </>
  );
}

// ── Başlık bilgileri ─────────────────────────────────────────────────────────

function rangeText(header: ReportHeader, dated: boolean) {
  if (!dated) return 'Tarih filtresi yok (güncel açık tutarlar)';
  if (!header.dateFrom && !header.dateTo) return 'Tüm tarihler';
  return `${header.dateFrom ? formatDate(header.dateFrom) : 'İlk kayıt'} – ${
    header.dateTo ? formatDate(header.dateTo) : 'Son kayıt'
  }`;
}

/**
 * Raporun başlık bilgileri (dosyadakiyle aynı): firma, kapsam, işlem tarihi aralığı, üretim zamanı,
 * güncel kalanın hesaplandığı zaman ve takip başlangıcı; başlangıç kaydı varsa uyarı.
 */
export function ReportMeta({ header, dated = true }: { header: ReportHeader; dated?: boolean }) {
  return (
    <div className="report-meta">
      <dl className="definition-list report-meta__list">
        <dt>Firma</dt>
        <dd>{header.companyName}</dd>
        <dt>Kapsam</dt>
        <dd>{header.scope}</dd>
        <dt>İşlem tarihi aralığı</dt>
        <dd>{rangeText(header, dated)}</dd>
        {header.filters.length > 0 ? (
          <>
            <dt>Filtreler</dt>
            <dd>{header.filters.join(' · ')}</dd>
          </>
        ) : null}
        <dt>Üretim tarihi/saati</dt>
        <dd>{formatDateTime(header.generatedAt)}</dd>
        <dt>Güncel kalan — hesaplandığı</dt>
        <dd>{formatDateTime(header.balancesAt)}</dd>
        <dt>Takip başlangıcı</dt>
        <dd>{header.trackingStart ? formatDate(header.trackingStart) : NO_OPENING_TEXT}</dd>
      </dl>
      {header.trackingStart ? (
        <p className="alert alert--info report-meta__warning" role="note">
          <Icon icon={Info} />
          {TRACKING_START_WARNING}
        </p>
      ) : null}
    </div>
  );
}

// ── Özet kutuları ────────────────────────────────────────────────────────────

/** Gerçekleşen hareketler: net tahsilat, net ödeme, fark; iadeler alt satırda. */
export function CashMetrics({ totals, note }: { totals: CashTotals; note: string }) {
  return (
    <section className="metrics metrics--report" aria-label="Gerçekleşen hareketler">
      <Metric
        label="Tahsilat (net)"
        icon={ArrowDownLeft}
        tone="income"
        value={formatMoney(totals.netIncome)}
        valueClassName="amount--income"
        sub={
          totals.incomeRefund > 0
            ? `Tahsilat iadesi düşüldü: ${formatMoney(totals.incomeRefund)}`
            : 'Tahsilat iadesi yok'
        }
        info="Tahsilatlar − tahsilat iadeleri."
      />
      <Metric
        label="Ödeme (net)"
        icon={ArrowUpRight}
        tone="expense"
        value={formatMoney(totals.netExpense)}
        valueClassName="amount--expense"
        sub={
          totals.expenseRefund > 0
            ? `Ödeme iadesi düşüldü: ${formatMoney(totals.expenseRefund)}`
            : 'Ödeme iadesi yok'
        }
        info="Ödemeler − ödeme iadeleri."
      />
      <Metric
        label="Gelir − gider farkı"
        icon={Scale}
        tone="neutral"
        className="metric--wide"
        value={formatSigned(totals.difference)}
        sub={note}
      />
    </section>
  );
}

/**
 * Borç ve alacak ayrı satırlarda; birbirinden düşülmez. "Anlaşmalar ve başlangıç kayıtları"
 * etiketli, başlangıç alt toplamı ayrıca (şartname 9.1).
 */
export function ObligationTable({
  payable,
  receivable,
  openings,
  title = OBLIGATIONS_LABEL,
}: {
  payable: DirectionSummary;
  receivable: DirectionSummary;
  openings: { payable: DirectionSummary; receivable: DirectionSummary };
  title?: string;
}) {
  const phone = usePhone();
  const rows = [
    { key: 'payable' as const, data: payable, opening: openings.payable },
    { key: 'receivable' as const, data: receivable, opening: openings.receivable },
  ];
  const settled = (key: 'payable' | 'receivable') =>
    key === 'payable' ? 'Ödenen' : 'Tahsil edilen';
  const remaining = (key: 'payable' | 'receivable') =>
    key === 'payable' ? 'Kalan borç' : 'Kalan alacak';

  if (phone) {
    return (
      <ul className="card-list" aria-label={title}>
        {rows.map((row) => (
          <li key={row.key}>
            <div className="card-list__item">
              <span className="list-row__main">
                <span className="list-row__title">{DIRECTION_LABEL[row.key]}</span>
                <span className="list-row__meta block">
                  Toplam {formatMoney(row.data.totalAmount)} · {settled(row.key)}{' '}
                  {formatMoney(row.data.netSettled)}
                </span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--neutral">{formatMoney(row.data.remaining)}</span>
                <span className="list-row__note">{remaining(row.key)}</span>
              </span>
              <span className="card-list__extra status-row">
                <BalanceFlags summary={row.data} payable={row.key === 'payable'} />
                {row.opening.totalAmount > 0
                  ? ` Başlangıç kayıtlarından kalan ${formatMoney(row.opening.remaining)}`
                  : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table data-table--static" aria-label={title}>
        <thead>
          <tr>
            <th scope="col">Yön</th>
            <th scope="col" className="num">
              Toplam
            </th>
            <th scope="col" className="num">
              Ödenen / tahsil edilen
            </th>
            <th scope="col" className="num">
              Kalan
            </th>
            <th scope="col" className="num">
              Gecikmiş
            </th>
            <th scope="col" className="num">
              Fazla
            </th>
            <th scope="col" className="num">
              Başlangıç kayıtlarından kalan
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <div className="type-cell">
                  <DirectionIcon agreement={{ direction: row.key }} size="md" />
                  <span className="list-row__title">{DIRECTION_LABEL[row.key]}</span>
                </div>
              </td>
              <td className="num">{formatMoney(row.data.totalAmount)}</td>
              <td className="num">{formatMoney(row.data.netSettled)}</td>
              <td className="num">
                <span className="amount amount--neutral">{formatMoney(row.data.remaining)}</span>
              </td>
              <td className={row.data.overdue > 0 ? 'num text-danger' : 'num'}>
                {formatMoney(row.data.overdue)}
              </td>
              <td className={row.data.excess > 0 ? 'num text-danger' : 'num'}>
                {formatMoney(row.data.excess)}
              </td>
              <td className="num">{formatMoney(row.opening.remaining)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Hareket tablosu ──────────────────────────────────────────────────────────

const titleOf = (row: ReportTransactionRow) =>
  row.description || (row.party ?? 'Açıklamasız kayıt');

function kindText(row: ReportTransactionRow) {
  return row.isSplit ? `${KIND_LABEL[row.kind]} · paylaştırıldı` : KIND_LABEL[row.kind];
}

/**
 * Rapor hareket tablosu: masaüstünde tablo, telefonda kart listesi. Paylaştırılmış kayıtta toplam
 * tutar ve seçili kapsama düşen pay ayrı; toplam satırları paydan (dosyadakiyle aynı).
 */
export function ReportTransactionTable({
  rows,
  share,
  totals,
  empty = 'Bu kapsamda hareket yok.',
}: {
  rows: ReportTransactionRow[];
  share: boolean;
  totals: TotalLine[];
  empty?: string;
}) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (row: ReportTransactionRow) => `/uygulama/islemler/${row.id}`;

  const totalsBlock = (
    <dl className="report-totals">
      {totals.map((line) => (
        <div key={line.label} className="report-totals__line">
          <dt>{line.label}</dt>
          <dd>{formatSigned(line.value)}</dd>
        </div>
      ))}
    </dl>
  );

  if (rows.length === 0) {
    return (
      <>
        <p className="list-empty">{empty}</p>
        {totalsBlock}
      </>
    );
  }

  if (phone) {
    return (
      <>
        <ul className="card-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link className="card-list__item" to={href(row)}>
                <span className="list-row__main">
                  <span className="list-row__title">
                    <span className="list-row__title-text">{titleOf(row)}</span>
                    {row.deleted ? <Badge tone="danger">Silindi</Badge> : null}
                  </span>
                  <span className="list-row__meta block">
                    <span className="record-no">#{row.recordNo}</span> · {formatDate(row.date)} ·{' '}
                    {kindText(row)}
                  </span>
                </span>
                <span className="list-row__side">
                  <Amount value={share ? row.share : row.amount} kind={row.kind} />
                  {share && row.share !== row.amount ? (
                    <span className="list-row__note">Toplam {formatMoney(row.amount)}</span>
                  ) : null}
                </span>
                <span className="card-list__extra">
                  {row.scope}
                  {row.party ? ` · ${row.party}` : ''}
                  {row.agreement ? ` · ${row.agreement}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {totalsBlock}
      </>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">İşlem</th>
              <th scope="col">Kişi</th>
              <th scope="col">Kapsam</th>
              <th scope="col">Anlaşma</th>
              <th scope="col">Kategori</th>
              <th scope="col" className="num">
                Toplam tutar
              </th>
              {share ? (
                <th scope="col" className="num">
                  Kapsama düşen pay
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => void navigate(href(row))}>
                <td>
                  <div className="type-cell">
                    <KindIcon kind={row.kind} size="md" />
                    <div>
                      <span className="list-row__title">
                        <Link className="cell-link" to={href(row)}>
                          {titleOf(row)}
                        </Link>
                        {row.deleted ? <Badge tone="danger">Silindi</Badge> : null}
                      </span>
                      <span className="cell-sub">
                        <span className="record-no">#{row.recordNo}</span> · {formatDate(row.date)}{' '}
                        · {kindText(row)}
                        {row.sourceRecordNo ? ` · Kaynak #${row.sourceRecordNo}` : ''}
                      </span>
                      {row.isSplit ? <span className="cell-sub">{row.allocations}</span> : null}
                    </div>
                  </div>
                </td>
                <td>{row.party ?? <span className="muted">Muhatapsız</span>}</td>
                <td>{row.scope}</td>
                <td>{row.agreement ?? <span className="muted">Bağlı değil</span>}</td>
                <td className="muted">{row.category ?? '—'}</td>
                <td className="num">
                  <Amount value={row.amount} kind={row.kind} />
                </td>
                {share ? (
                  <td className="num">
                    <Amount value={row.share} kind={row.kind} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalsBlock}
    </>
  );
}

// ── Anlaşma ve başlangıç kaydı tablosu ───────────────────────────────────────

function dueText(row: ReportAgreementRow) {
  if (row.dueState === 'overdue') return `${row.overdueDays} gün gecikti`;
  if (row.dueState === null) return row.remaining > 0 ? '' : 'Kapandı';
  return DUE_STATE_LABEL[row.dueState];
}

/** Kalan borç/alacak bakiyedir, `ink` renginde; başlangıç kayıtları etiketli (şartname 4.1, 9.1). */
export function ReportAgreementTable({
  rows,
  empty,
}: {
  rows: ReportAgreementRow[];
  empty: string;
}) {
  const phone = usePhone();
  const navigate = useNavigate();
  const href = (row: ReportAgreementRow) => `/uygulama/anlasmalar/${row.id}`;
  if (rows.length === 0) return <p className="list-empty">{empty}</p>;

  if (phone) {
    return (
      <ul className="card-list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card-list__item" to={href(row)}>
              <span className="list-row__main">
                <span className="list-row__title">
                  <span className="list-row__title-text">{row.label}</span>
                  {row.kind === 'opening' ? <Badge>Başlangıç kaydı</Badge> : null}
                </span>
                <span className="list-row__meta block">
                  {DIRECTION_LABEL[row.direction]} · {row.party} · {row.scope}
                </span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--neutral">{formatMoney(row.remaining)}</span>
                <span className="list-row__note">
                  {row.direction === 'payable' ? 'Kalan borç' : 'Kalan alacak'}
                </span>
              </span>
              <span className="card-list__extra status-row">
                {row.dueDate ? `Vade ${formatDate(row.dueDate)}` : 'Vadesi belirlenmemiş'}
                {row.dueState === 'overdue' ? <Badge tone="overdue">{dueText(row)}</Badge> : null}
                {row.excess > 0 ? (
                  <Badge tone="danger">
                    {row.direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat'}{' '}
                    {formatMoney(row.excess)}
                  </Badge>
                ) : null}
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
            <th scope="col">Anlaşma</th>
            <th scope="col">Kişi</th>
            <th scope="col">Kapsam</th>
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
          {rows.map((row) => (
            <tr key={row.id} onClick={() => void navigate(href(row))}>
              <td>
                <div className="type-cell">
                  <DirectionIcon agreement={row} opening={row.kind === 'opening'} size="md" />
                  <div>
                    <span className="list-row__title">
                      <Link className="cell-link" to={href(row)}>
                        {row.label}
                      </Link>
                      {row.kind === 'opening' ? <Badge>Başlangıç kaydı</Badge> : null}
                    </span>
                    <span className="cell-sub">
                      {DIRECTION_LABEL[row.direction]}
                      {row.trackingStartDate
                        ? ` · Takip başlangıcı ${formatDate(row.trackingStartDate)}`
                        : ''}
                    </span>
                  </div>
                </div>
              </td>
              <td>{row.party}</td>
              <td>{row.scope}</td>
              <td>
                <span className="nowrap">{row.dueDate ? formatDate(row.dueDate) : '—'}</span>
                {row.dueState === 'overdue' ? (
                  <span className="block">
                    <Badge tone="overdue">{dueText(row)}</Badge>
                  </span>
                ) : null}
              </td>
              <td className="num">{formatMoney(row.currentAmount)}</td>
              <td className="num">{formatMoney(row.netSettled)}</td>
              <td className="num">
                <span className="amount amount--neutral">{formatMoney(row.remaining)}</span>
                {row.excess > 0 ? (
                  <span className="cell-sub text-danger">
                    {row.direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat'}{' '}
                    {formatMoney(row.excess)}
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
