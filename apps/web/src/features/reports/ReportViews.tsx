// Dört standart raporun gövdeleri (şartname 7.10). Ekran ve indirilen dosya aynı parametrelerle aynı
// API verisinden üretilir.

import { OBLIGATIONS_LABEL } from '@santiye/shared';
import { CalendarClock, FileText, Handshake, Layers, ListOrdered, Tags } from 'lucide-react';
import {
  useOpenBalancesReport,
  usePartyReport,
  usePeriodReport,
  useProjectReport,
} from '../../api/queries';
import type { ReportHeader } from '../../api/types';
import { Panel } from '../../components/ui/Card';
import { QueryView, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { formatMoney } from '../../lib/format';
import { DUE_STATE_LABEL } from '../../lib/labels';
import { ReportDownload } from './ReportDownload';
import { cashLines } from './report-params';
import {
  CashMetrics,
  ObligationTable,
  ReportAgreementTable,
  ReportMeta,
  ReportTransactionTable,
} from './ReportParts';

type Params = Record<string, unknown>;

/** Rapor başlığı paneli: başlık, indirme ve başlık bilgileri. */
function ReportHead({
  header,
  params,
  refreshing,
  dated = true,
}: {
  header: ReportHeader;
  params: Params;
  refreshing: boolean;
  dated?: boolean;
}) {
  return (
    <Panel
      title={header.subject ? `${header.title} — ${header.subject}` : header.title}
      icon={FileText}
      actions={
        <div className="row">
          <Refreshing active={refreshing} />
          <ReportDownload type={header.type} params={params} />
        </div>
      }
    >
      <div className="panel__body">
        <ReportMeta header={header} dated={dated} />
      </div>
    </Panel>
  );
}

/** Dönem gelir/gider hareket dökümü: kategori özeti ve güncel kalanlar ayrı. */
export function PeriodReportView({ params }: { params: Params }) {
  const query = usePeriodReport(params);
  return (
    <QueryView query={query} loadingLabel="Rapor hazırlanıyor…">
      {(report) => (
        <>
          <ReportHead
            header={report.header}
            params={params}
            refreshing={query.isFetching && !query.isPending}
          />
          <CashMetrics
            totals={report.totals}
            note={`${report.rows.length} hareket${report.header.scoped ? ' · seçili kapsamın payları' : ''}`}
          />
          <Panel title="Kategori özeti (giderler)" icon={Tags}>
            {report.categories.length === 0 ? (
              <p className="list-empty">Bu dönemde gider yok.</p>
            ) : (
              <CategoryTable categories={report.categories} />
            )}
          </Panel>
          <Panel title="Hareketler (tarihe göre artan)" icon={ListOrdered}>
            <ReportTransactionTable
              rows={report.rows}
              share={report.header.scoped}
              totals={cashLines(report.totals, 'both')}
              empty="Bu dönemde ve kapsamda hareket yok."
            />
          </Panel>
          <Panel title={`Güncel kalan borç/alacak — ${OBLIGATIONS_LABEL}`} icon={Handshake}>
            <ObligationTable {...report.obligations} />
          </Panel>
        </>
      )}
    </QueryView>
  );
}

function CategoryTable({
  categories,
}: {
  categories: { category: string; expense: number; expenseRefund: number; netExpense: number }[];
}) {
  const phone = usePhone();
  if (phone) {
    return (
      <ul className="card-list">
        {categories.map((row) => (
          <li key={row.category}>
            <div className="card-list__item">
              <span className="list-row__main">
                <span className="list-row__title">{row.category}</span>
                <span className="list-row__meta block">
                  Ödeme {formatMoney(row.expense)} · İade {formatMoney(row.expenseRefund)}
                </span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--expense">{formatMoney(row.netExpense)}</span>
                <span className="list-row__note">Net ödeme</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table data-table--static">
        <thead>
          <tr>
            <th scope="col">Kategori</th>
            <th scope="col" className="num">
              Ödeme
            </th>
            <th scope="col" className="num">
              Ödeme iadesi
            </th>
            <th scope="col" className="num">
              Net ödeme
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td className="num">{formatMoney(row.expense)}</td>
              <td className="num">{formatMoney(row.expenseRefund)}</td>
              <td className="num">
                <span className="amount amount--expense">{formatMoney(row.netExpense)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Şantiye özeti ve hareket dökümü: tutarlar yalnız bu şantiyenin paylarından. */
export function ProjectReportView({ projectId, params }: { projectId: string; params: Params }) {
  const query = useProjectReport(projectId, params);
  const downloadParams = { ...params, id: projectId };
  return (
    <QueryView query={query} loadingLabel="Rapor hazırlanıyor…">
      {(report) => (
        <>
          <ReportHead
            header={report.header}
            params={downloadParams}
            refreshing={query.isFetching && !query.isPending}
          />
          <CashMetrics totals={report.cash} note="Yalnız bu şantiyeye düşen paylar" />
          <Panel title={OBLIGATIONS_LABEL} icon={Handshake}>
            <ObligationTable
              payable={report.payable}
              receivable={report.receivable}
              openings={report.openings}
            />
          </Panel>
          <Panel title="Gelirler (tarihe göre artan)" icon={Layers}>
            <ReportTransactionTable
              rows={report.incomeRows}
              share
              totals={cashLines(report.cash, 'income')}
              empty="Bu şantiyede gelir yok."
            />
          </Panel>
          <Panel title="Giderler (tarihe göre artan)" icon={Layers}>
            <ReportTransactionTable
              rows={report.expenseRows}
              share
              totals={cashLines(report.cash, 'expense')}
              empty="Bu şantiyede gider yok."
            />
          </Panel>
        </>
      )}
    </QueryView>
  );
}

/** Kişi/firma hesap dökümü: borç, alacak, fazla ve doğrudan hareketler ayrı; mahsup yok. */
export function PartyReportView({ partyId, params }: { partyId: string; params: Params }) {
  const query = usePartyReport(partyId, params);
  const downloadParams = { ...params, id: partyId };
  return (
    <QueryView query={query} loadingLabel="Rapor hazırlanıyor…">
      {(report) => (
        <>
          <ReportHead
            header={report.header}
            params={downloadParams}
            refreshing={query.isFetching && !query.isPending}
          />
          <Panel title={`Borç ve alacak — ${OBLIGATIONS_LABEL}`} icon={Handshake}>
            <ObligationTable
              payable={report.payable}
              receivable={report.receivable}
              openings={report.openings}
            />
            <div className="panel__section">
              <ReportAgreementTable
                rows={report.agreements}
                empty="Bu kişiyle anlaşma veya başlangıç kaydı yok."
              />
            </div>
          </Panel>
          <Panel title="Anlaşmaya bağlı hareketler" icon={Layers}>
            <ReportTransactionTable
              rows={report.linkedRows}
              share={false}
              totals={cashLines(report.linkedTotals, 'both')}
            />
          </Panel>
          <Panel title="Doğrudan hareketler (anlaşmaya bağlanmamış)" icon={Layers}>
            <p className="panel__note">Bu hareketler anlaşma borcunu veya alacağını azaltmaz.</p>
            <ReportTransactionTable
              rows={report.directRows}
              share={false}
              totals={cashLines(report.directTotals, 'both')}
            />
          </Panel>
        </>
      )}
    </QueryView>
  );
}

const GROUP_TITLE = { ...DUE_STATE_LABEL, upcoming: 'Yaklaşan (30 gün)' };

/** Açık borç/alacak ve vade listesi: başlangıç kayıtları dahil ve etiketli. */
export function OpenBalancesView({ params }: { params: Params }) {
  const query = useOpenBalancesReport(params);
  return (
    <QueryView query={query} loadingLabel="Rapor hazırlanıyor…">
      {(report) => (
        <>
          <ReportHead
            header={report.header}
            params={params}
            refreshing={query.isFetching && !query.isPending}
            dated={false}
          />
          <Panel title={`Açık tutarlar — ${OBLIGATIONS_LABEL}`} icon={Handshake}>
            <ObligationTable {...report.summary} />
          </Panel>
          <Panel title="Vade grupları" icon={CalendarClock}>
            {report.groups.map((group) => {
              const total = (direction: 'payable' | 'receivable') =>
                group.rows
                  .filter((row) => row.direction === direction)
                  .reduce((sum, row) => sum + row.remaining, 0);
              return (
                <section
                  key={group.state}
                  className="panel__section"
                  aria-label={GROUP_TITLE[group.state]}
                >
                  <div className="subhead">
                    <span>
                      {GROUP_TITLE[group.state]} ({group.rows.length})
                    </span>
                    {group.rows.length > 0 ? (
                      <span>
                        Borç {formatMoney(total('payable'))} · Alacak{' '}
                        {formatMoney(total('receivable'))}
                      </span>
                    ) : null}
                  </div>
                  <ReportAgreementTable rows={group.rows} empty="Bu grupta açık tutar yok." />
                </section>
              );
            })}
          </Panel>
        </>
      )}
    </QueryView>
  );
}
