import { addDays, DEFAULT_UPCOMING_DAYS, todayInIstanbul } from '@santiye/shared';
import { Link } from 'react-router';
import { useDues } from '../../api/queries';
import type { Agreement } from '../../api/types';
import { Amount, Badge } from '../../components/ui/Amount';
import { Card, PageHeader, Pagination } from '../../components/ui/Card';
import { DateInput, Field } from '../../components/ui/Field';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney } from '../../lib/format';

type Group = 'overdue' | 'upcoming' | 'later' | 'none';

const GROUP_TITLE: Record<Group, string> = {
  overdue: 'Gecikmiş',
  upcoming: 'Yaklaşan',
  later: 'Daha sonra',
  none: 'Vadesi belirlenmemiş açık tutarlar',
};

function DueRows({ items, group }: { items: Agreement[]; group: Group }) {
  const phone = usePhone();
  const scope = (a: Agreement) => (a.scope === 'company' ? 'Firma geneli' : a.project?.name);
  const tone = (a: Agreement) => (a.direction === 'payable' ? 'expense' : 'income');
  const overdueBadge = (a: Agreement) =>
    group === 'overdue' ? <Badge tone="overdue">Gecikmiş · {a.overdueDays ?? 0} gün</Badge> : null;

  if (phone) {
    return (
      <ul className="item-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="item-card" to={`/uygulama/anlasmalar/${a.id}`}>
              <div className="item-card__main">
                <span className="item-card__title">{a.party?.name}</span>
                <span className="meta">
                  {a.label} · {scope(a)}
                </span>
                <span className="meta">Vade: {formatDate(a.dueDate)}</span>
                {overdueBadge(a)}
                {a.kind === 'opening' ? <Badge tone="cyan">Başlangıç</Badge> : null}
              </div>
              <Amount value={a.remaining} tone={tone(a)} label="Kalan" />
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
          <tr key={a.id}>
            <td>{a.party?.name}</td>
            <td>
              <Link to={`/uygulama/anlasmalar/${a.id}`}>{a.label}</Link>{' '}
              {a.kind === 'opening' ? <Badge tone="cyan">Başlangıç</Badge> : null}
            </td>
            <td>{scope(a)}</td>
            <td className="nowrap">{formatDate(a.dueDate)}</td>
            <td>{overdueBadge(a) ?? <span className="muted">—</span>}</td>
            <td className="num">
              <Amount value={a.remaining} tone={tone(a)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
  const total = query.data?.items.reduce((sum, a) => sum + a.remaining, 0);
  return (
    <Card
      title={
        <>
          {GROUP_TITLE[group]}
          {query.data ? ` (${query.data.total})` : ''}
        </>
      }
      actions={
        group === 'upcoming' || group === 'later' ? (
          <span className="meta">
            {group === 'upcoming'
              ? `${formatDate(from)} – ${formatDate(to)}`
              : `${formatDate(to)} sonrası`}
          </span>
        ) : null
      }
    >
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="muted">Bu grupta açık tutar yok.</p>
      ) : (
        <>
          <DueRows items={query.data.items} group={group} />
          {query.data.total <= query.data.limit && total !== undefined ? (
            <p className="meta">Grup toplamı: {formatMoney(total)}</p>
          ) : null}
          <Pagination
            page={query.data.page}
            limit={query.data.limit}
            total={query.data.total}
            onPage={onPage}
          />
        </>
      )}
    </Card>
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
        subtitle="Anlaşmalar ve başlangıç kayıtlarının açık tutarları. Bildirim gönderilmez; yalnız uygulama içi liste."
      />
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
      <section className="card form-grid" aria-label="Yaklaşan vade aralığı">
        <Field label="Yaklaşan: başlangıç">
          {(props) => (
            <DateInput
              {...props}
              value={f.baslangic}
              onChange={(e) => update({ baslangic: e.target.value })}
            />
          )}
        </Field>
        <Field label="Yaklaşan: bitiş" hint="Varsayılan 30 gün">
          {(props) => (
            <DateInput
              {...props}
              value={f.bitis}
              onChange={(e) => update({ bitis: e.target.value })}
            />
          )}
        </Field>
      </section>
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
    </main>
  );
}
