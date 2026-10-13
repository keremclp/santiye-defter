import type { HistoryEntry } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import { FIELD_LABEL, HISTORY_ACTION_LABEL } from '../../lib/labels';

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Değişiklik geçmişi: eski → yeni, kim, ne zaman, gerekçe (şartname 7.4). Panel içinde ince
 * çizgiyle ayrılmış satırlar; kart içinde kart yok.
 */
export function HistoryList({
  history,
  formatValue,
}: {
  history: HistoryEntry[];
  /** Alanına göre değeri okunur biçime çevirir (ör. kuruş → TL). */
  formatValue?: (field: string, value: unknown) => string | null;
}) {
  if (history.length === 0) return <p className="muted">Geçmiş yok.</p>;
  const entries = [...history].reverse();
  return (
    <ol className="history-list">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="history-list__item">
          <div className="history-list__head">
            <span>{HISTORY_ACTION_LABEL[entry.action] ?? entry.action}</span>
            <span className="meta">
              {formatDateTime(entry.at)} · {entry.by?.name ?? 'Bilinmeyen kullanıcı'}
            </span>
          </div>
          {entry.changes.length > 0 ? (
            <ul className="history-list__changes">
              {entry.changes.map((change) => (
                <li key={change.field}>
                  {FIELD_LABEL[change.field] ?? change.field}:{' '}
                  {formatValue?.(change.field, change.old) ?? show(change.old)} →{' '}
                  {formatValue?.(change.field, change.new) ?? show(change.new)}
                </li>
              ))}
            </ul>
          ) : null}
          {entry.reason ? <p className="meta">Gerekçe: {entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
