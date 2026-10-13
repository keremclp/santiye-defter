import { addDays, DEFAULT_UPCOMING_DAYS, todayInIstanbul } from '@santiye/shared';
import { CalendarRange } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useDues } from '../../api/queries';
import type { Agreement } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { DateInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney } from '../../lib/format';
import { DirectionIcon, DueBadge } from '../common/RecordTables';

type Group = 'overdue' | 'upcoming' | 'later' | 'none';

const GROUP_TITLE: Record<Group, string> = {
  overdue: 'Gecikmiş',
  upcoming: 'Yaklaşan',
  later: 'Daha sonra',
  none: 'Vadesi belirlenmemiş açık tutarlar',
};

const scopeOf = (a: Agreement) => (a.scope === 'company' ? 'Firma geneli' : a.project?.name);
const href = (a: Agreement) => `/uygulama/anlasmalar/${a.id}`;

/** Gecikme ve yaklaşan vade rozeti; durum satırın grubundan gelir. Vadesiz satırda "Vade yok". */
function DueCell({ agreement: a, group }: { agreement: Agreement; group: Group }) {
  if (group === 'overdue' || group === 'upcoming') {
    return <DueBadge agreement={{ ...a, dueState: group }} />;
  }
  return <span className="muted">{a.dueDate ? '—' : 'Vade yok'}</span>;
}

function DueRows({ items, group }: { items: Agreement[]; group: Group }) {
  const phone = usePhone();
  const navigate = useNavigate();

  if (phone) {
    return (
      <ul className="card-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="card-list__item" to={href(a)}>
              <span className="list-row__main">
                <span className="list-row__title">
                  <span className="list-row__title-text">{a.party?.name}</span>
                  {a.kind === 'opening' ? <Badge>Başlangıç</Badge> : null}
                </span>
                <span className="list-row__meta block">
                  {a.label} · {scopeOf(a)}
                </span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
                <span className="list-row__note">
                  {a.direction === 'payable' ? 'Kalan borç' : 'Kalan alacak'}
                </span>
              </span>
              <span className="card-list__extra status-row">
                {a.dueDate ? `Vade ${formatDate(a.dueDate)}` : 'Vadesi belirlenmemiş'}
                <DueCell agreement={a} group={group} />
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
            <th scope="col">Kişi</th>
            <th scope="col">Anlaşma</th>
            <th scope="col">Kapsam</th>
            <th scope="col">Vade</th>
            <th scope="col">Gecikme</th>
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
                  <Link className="cell-link" to={href(a)}>
                    {a.party?.name}
                  </Link>
                </div>
              </td>
              <td>
                <span className="list-row__title">
                  {a.label}
                  {a.kind === 'opening' ? <Badge>Başlangıç</Badge> : null}
                </span>
              </td>
              <td>{scopeOf(a)}</td>
              <td className="nowrap">{a.dueDate ? formatDate(a.dueDate) : '—'}</td>
              <td>
                <DueCell agreement={a} group={group} />
              </td>
              <td className="num">
                <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bir vade grubu: başlık satırı (sayı ve toplam); boş grup tam kart değil, tek satırdır. */
function DueGroup({
  group,
  direction,
  from,
  to,
  page,
  onPage,
}: {
  group: Group;
  direction: string;
  from: string;
  to: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const query = useDues({ direction, group, from, to, page, limit: 50 });
  const data = query.data;
  const total = data?.items.reduce((sum, a) => sum + a.remaining, 0);
  const range =
    group === 'upcoming'
      ? ` · ${formatDate(from)} – ${formatDate(to)}`
      : group === 'later'
        ? ` · ${formatDate(to)} sonrası`
        : '';

  return (
    <section className="panel__section" aria-label={GROUP_TITLE[group]}>
      <div className="subhead">
        <span>
          {GROUP_TITLE[group]}
          {data ? ` (${data.total})` : ''}
          {range}
        </span>
        {data && data.items.length > 0 && data.total <= data.limit && total !== undefined ? (
          <span>Toplam {formatMoney(total)}</span>
        ) : null}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <div className="panel__body">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : data.items.length === 0 ? (
        <p className="list-empty">Bu grupta açık tutar yok.</p>
      ) : (
        <>
          <DueRows items={data.items} group={group} />
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={onPage} />
        </>
      )}
    </section>
  );
}

/**
 * Vadeler (şartname 7.7): gecikmiş, yaklaşan (varsayılan 30 gün), daha sonra ve vadesiz açık
 * tutarlar; borç ve alacak ayrı sekmeler; tamamlanan ve arşivlenen şantiyeler dahil.
 */
export function DuesPage() {
  usePageMeta('Vadeler');
  const today = todayInIstanbul();
  const defaults = {
    yon: 'payable',
    baslangic: today,
    bitis: addDays(today, DEFAULT_UPCOMING_DAYS),
    sayfa_overdue: '1',
    sayfa_upcoming: '1',
    sayfa_later: '1',
    sayfa_none: '1',
  };
  const { values: f, update } = useUrlFilters(defaults);
  const groups: Group[] = ['overdue', 'upcoming', 'later', 'none'];

  return (
    <main className="page">
      <PageHeader
        title="Vadeler"
        subtitle="Anlaşmalar ve başlangıç kayıtlarının açık tutarları · bildirim gönderilmez"
      />
      <Panel label="Vade listesi">
        <div className="tabs" role="tablist" aria-label="Borç ve alacak">
          {[
            { value: 'payable', label: 'Borç (ödenecek)' },
            { value: 'receivable', label: 'Alacak (tahsil edilecek)' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className="tab"
              aria-selected={f.yon === tab.value}
              onClick={() => update({ yon: tab.value })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="panel-toolbar">
          <div className="date-range" role="group" aria-label="Yaklaşan vade aralığı">
            <span className="date-range__label">
              <Icon icon={CalendarRange} />
              Yaklaşan aralık
            </span>
            <DateInput
              aria-label="Yaklaşan: başlangıç"
              value={f.baslangic}
              onChange={(e) => update({ baslangic: e.target.value })}
            />
            <span aria-hidden="true">–</span>
            <DateInput
              aria-label="Yaklaşan: bitiş"
              value={f.bitis}
              onChange={(e) => update({ bitis: e.target.value })}
            />
            {f.baslangic !== defaults.baslangic || f.bitis !== defaults.bitis ? (
              <button
                type="button"
                className="filter-clear"
                onClick={() => update({ baslangic: defaults.baslangic, bitis: defaults.bitis })}
              >
                30 güne dön
              </button>
            ) : null}
          </div>
        </div>
        {groups.map((group) => (
          <DueGroup
            key={group}
            group={group}
            direction={f.yon}
            from={f.baslangic}
            to={f.bitis}
            page={Number(f[`sayfa_${group}`]) || 1}
            onPage={(page) =>
              update({ [`sayfa_${group}`]: String(page), page: '' } as Partial<typeof defaults>)
            }
          />
        ))}
      </Panel>
    </main>
  );
}
