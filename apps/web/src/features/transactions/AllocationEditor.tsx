import type { CashKind } from '@santiye/shared';
import { Button } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/Chips';
import { Field, SelectInput } from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatMoney, formatTl } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { useProjectOptions } from '../common/project-options';
import { agreementOptionLabel, agreementsForScope, usePartyAgreements } from './agreement-options';
import { emptyRow, unallocatedAmount, type AllocationRowValues } from './transaction-form';

/**
 * Paylaştırma satırları (şartname 7.4): kapsam, varsa anlaşma veya başlangıç kaydı ve pay tutarı;
 * her satırda hedefin kalanı ve dağıtılmamış tutar görünür.
 */
export function AllocationEditor({
  kind,
  amount,
  rows,
  onChange,
  partyId,
  errors,
  sumError,
  lockedRowIds = new Set(),
}: {
  kind: CashKind;
  amount: string;
  rows: AllocationRowValues[];
  onChange: (rows: AllocationRowValues[]) => void;
  partyId: string | undefined;
  errors: Record<number, { projectId?: string; amount?: string }>;
  sumError?: string | undefined;
  /** Bağlı iadesi olan paylar (düzeltmede): kaldırılamaz, hedefi değiştirilemez. */
  lockedRowIds?: Set<string>;
}) {
  const projects = useProjectOptions();
  const agreements = usePartyAgreements(partyId, kind);
  const items = projects.data?.items ?? [];
  const unallocated = unallocatedAmount(amount, rows);

  const update = (index: number, patch: Partial<AllocationRowValues>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="stack" aria-describedby="allocation-summary">
      <legend className="field__label">Paylar</legend>
      {rows.map((row, index) => {
        const locked = Boolean(row.id && lockedRowIds.has(row.id));
        const options = agreementsForScope(
          agreements.data?.items ?? [],
          row.scope,
          row.projectId,
          row.agreementId,
        );
        const target = options.find((agreement) => agreement.id === row.agreementId);
        return (
          <div key={row.key} className="allocation-row">
            <div className="stack stack--sm">
              <span className="field__label">Kapsam</span>
              <ChipGroup
                label={`${index + 1}. pay kapsamı`}
                options={[
                  { value: 'project', label: 'Şantiye', disabled: locked },
                  { value: 'company', label: 'Firma geneli', disabled: locked },
                ]}
                value={row.scope}
                onChange={(scope) => update(index, { scope, projectId: '', agreementId: '' })}
              />
              {row.scope === 'project' ? (
                <Field label="Şantiye" required error={errors[index]?.projectId}>
                  {(props) => (
                    <SelectInput
                      {...props}
                      disabled={locked}
                      value={row.projectId}
                      onChange={(event) =>
                        update(index, { projectId: event.target.value, agreementId: '' })
                      }
                    >
                      <option value="">Şantiye seçin</option>
                      {items.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                          {project.status !== 'active'
                            ? ` (${PROJECT_STATUS_LABEL[project.status]})`
                            : ''}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              ) : null}
            </div>
            <Field
              label="Anlaşma / başlangıç kaydı"
              hint={
                target
                  ? `Hedefin kalanı: ${formatMoney(target.remaining)}`
                  : partyId
                    ? 'Seçilmezse bu pay anlaşmaya bağlanmaz.'
                    : 'Anlaşma seçmek için önce kişi/firma seçin.'
              }
            >
              {(props) => (
                <SelectInput
                  {...props}
                  disabled={!partyId || locked}
                  value={row.agreementId}
                  onChange={(event) => update(index, { agreementId: event.target.value })}
                >
                  <option value="">Anlaşmaya bağlı değil</option>
                  {options.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreementOptionLabel(agreement)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="Pay tutarı" required error={errors[index]?.amount}>
              {(props) => (
                <MoneyInput
                  {...props}
                  value={row.amount}
                  onChange={(value) => update(index, { amount: value })}
                />
              )}
            </Field>
            <div>
              <Button
                variant="ghost"
                size="small"
                disabled={rows.length <= 1 || locked}
                aria-label={`${index + 1}. payı kaldır`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                Kaldır
              </Button>
            </div>
            {locked ? (
              <p className="meta" style={{ gridColumn: '1 / -1' }}>
                Bu payın bağlı iadesi var; kaldırılamaz, şantiyesi veya anlaşması değiştirilemez.
                Hedef değişecekse önce iadeyi silin.
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="row row--between">
        <Button variant="secondary" size="small" onClick={() => onChange([...rows, emptyRow()])}>
          + Satır ekle
        </Button>
        <span id="allocation-summary" className={unallocated ? 'field__error' : 'meta'}>
          {unallocated === null
            ? 'Önce toplam tutarı girin.'
            : unallocated === 0
              ? 'Tutarın tamamı dağıtıldı.'
              : unallocated > 0
                ? `Dağıtılmamış tutar: ${formatTl(unallocated)}`
                : `Fazla dağıtılan: ${formatTl(-unallocated)}`}
        </span>
      </div>
      {sumError ? (
        <p className="field__error" role="alert">
          {sumError}
        </p>
      ) : null}
    </fieldset>
  );
}
