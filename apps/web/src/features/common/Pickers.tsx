import { useQueryClient } from '@tanstack/react-query';
import { Building2, UserPlus, UserRound } from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';
import { apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, usePartySuggest } from '../../api/queries';
import { newIdempotencyKey } from '../../api/submission';
import type { Party } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/Chips';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { projectById, useProjectOptions } from './project-options';

export interface PartyRef {
  id: string;
  name: string;
}

/**
 * Kişi/firma seçimi: yazınca öner, listeden seç, yoksa aynı akışta yalnız adla hızlı ekle.
 * Açık formdaki tutar, tarih ve kapsam kaybolmaz (şartname 7.3, 7.4). Pasif kişiler önerilmez.
 */
export function PartyPicker({
  label = 'Kişi/firma',
  value,
  onChange,
  required,
  error,
  locked,
  lockedReason,
  hint,
}: {
  label?: string;
  value: PartyRef | null;
  onChange: (party: PartyRef | null) => void;
  required?: boolean;
  error?: string | undefined;
  locked?: boolean;
  lockedReason?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<string | null>(null);
  const deferred = useDeferredValue(query.trim());
  const suggest = usePartySuggest(deferred, open && !value);
  const queryClient = useQueryClient();
  const listId = useId();

  if (value) {
    return (
      <Field label={label} required={required} error={error} hint={locked ? lockedReason : hint}>
        {(props) => (
          <div className="row">
            <TextInput {...props} value={value.name} readOnly />
            {locked ? null : (
              <Button variant="ghost" size="small" onClick={() => onChange(null)}>
                Değiştir
              </Button>
            )}
            {similar ? <span className="meta">{similar}</span> : null}
          </div>
        )}
      </Field>
    );
  }

  const items = suggest.data ?? [];
  const exact = items.some(
    (item) => item.name.toLocaleLowerCase('tr-TR') === deferred.toLocaleLowerCase('tr-TR'),
  );

  async function quickAdd() {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await apiPost<Party>(
        '/parties',
        { name },
        { idempotencyKey: newIdempotencyKey() },
      );
      void invalidateRecords(queryClient);
      setSimilar(
        created.warnings?.length
          ? `${created.warnings[0]!.message} (${created.warnings[0]!.related.map((r) => r.name).join(', ')})`
          : null,
      );
      onChange({ id: created.id, name: created.name });
      setQuery('');
      setOpen(false);
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Field label={label} required={required} error={error ?? addError ?? undefined} hint={hint}>
      {(props) => (
        <div className="stack stack--sm">
          <TextInput
            {...props}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Ad veya telefon yazın"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
          {open && (items.length > 0 || suggest.isFetching || query.trim()) ? (
            <ul
              id={listId}
              className="dropdown dropdown--inline"
              role="listbox"
              aria-label="Öneriler"
            >
              {items.map((item) => (
                <li key={item.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="dropdown__item"
                    onClick={() => {
                      onChange({ id: item.id, name: item.name });
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <Icon icon={item.kind === 'company' ? Building2 : UserRound} />
                    {item.name}
                  </button>
                </li>
              ))}
              {suggest.isFetching && items.length === 0 ? (
                <li className="dropdown__note">Aranıyor…</li>
              ) : null}
              {query.trim() && !exact ? (
                <li>
                  <button
                    type="button"
                    className="dropdown__item"
                    disabled={adding}
                    aria-busy={adding || undefined}
                    onClick={() => void quickAdd()}
                  >
                    <Icon icon={UserPlus} />
                    {adding ? 'Ekleniyor…' : `“${query.trim()}” adıyla yeni kişi/firma ekle`}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}

export interface ScopeValue {
  scope: 'project' | 'company';
  projectId: string;
}

/**
 * Şantiye veya firma geneli (şartname 7.4): açık "Firma geneli" seçeneği; bağlamdan hazır gelir ve
 * görünür kalır. `activeOnly` yeni anlaşmada yalnız aktif şantiyeleri gösterir.
 */
export function ScopePicker({
  value,
  onChange,
  error,
  locked,
  lockedReason,
  activeOnly = false,
  label = 'Şantiye veya firma geneli',
}: {
  value: ScopeValue;
  onChange: (value: ScopeValue) => void;
  error?: string | undefined;
  locked?: boolean;
  lockedReason?: string;
  activeOnly?: boolean;
  label?: string;
}) {
  const projects = useProjectOptions();
  const items = projects.data?.items ?? [];
  const active = items.filter((project) => project.status === 'active');
  const closed = items.filter((project) => project.status !== 'active');
  const selected = projectById(items, value.projectId);

  if (locked) {
    return (
      <Field label={label} required hint={lockedReason}>
        {(props) => (
          <TextInput
            {...props}
            readOnly
            value={
              value.scope === 'company'
                ? 'Firma geneli'
                : (selected?.name ?? (projects.isPending ? 'Yükleniyor…' : 'Şantiye'))
            }
          />
        )}
      </Field>
    );
  }

  return (
    <div className="stack stack--sm">
      <span className="field__label">
        {label}
        <span className="field__required" aria-hidden="true">
          *
        </span>
      </span>
      <ChipGroup
        label={label}
        options={[
          { value: 'project', label: 'Şantiye' },
          { value: 'company', label: 'Firma geneli' },
        ]}
        value={value.scope}
        onChange={(scope) =>
          onChange({ scope, projectId: scope === 'company' ? '' : value.projectId })
        }
      />
      {value.scope === 'project' ? (
        <Field label="Şantiye" required error={error}>
          {(props) => (
            <SelectInput
              {...props}
              value={value.projectId}
              onChange={(event) => onChange({ scope: 'project', projectId: event.target.value })}
            >
              <option value="">
                {projects.isPending ? 'Şantiyeler yükleniyor…' : 'Şantiye seçin'}
              </option>
              {active.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              {!activeOnly && closed.length > 0 ? (
                <optgroup label="Tamamlanan / arşivlenen">
                  {closed.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({PROJECT_STATUS_LABEL[project.status]})
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </SelectInput>
          )}
        </Field>
      ) : (
        <p className="meta">Kayıt bir şantiyeye değil, firma geneline yazılır.</p>
      )}
      {projects.error ? <p className="field__error">Şantiyeler yüklenemedi.</p> : null}
    </div>
  );
}
