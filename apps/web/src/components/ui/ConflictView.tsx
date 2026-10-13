import { GitCompareArrows } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ConflictField {
  key: string;
  label: string;
  /** Güncel kayıttaki değer ve kullanıcının girdiği değer, okunur biçimde. */
  current: ReactNode;
  mine: ReactNode;
  differs: boolean;
}

/**
 * 409 CONFLICT (şartname 3, 11): kayıt başka yerde değişti. Güncel kayıt ile kullanıcının değişikliği
 * yan yana gösterilir; sessizce üzerine yazılmaz, kullanıcı yeniden değerlendirir.
 */
export function ConflictView({
  fields,
  onUseCurrent,
  onKeepMine,
}: {
  fields: ConflictField[];
  /** Formu güncel kayıtla doldurur. */
  onUseCurrent: () => void;
  /** Kendi değerlerini koruyup güncel sürüm üzerinden yeniden kaydetmeyi seçer. */
  onKeepMine: () => void;
}) {
  return (
    <section className="alert alert--danger" aria-labelledby="conflict-title">
      <p id="conflict-title" className="alert__title alert__title--icon">
        <Icon icon={GitCompareArrows} />
        Kayıt başka bir yerde güncellendi
      </p>
      <p>
        Siz düzenlerken bu kayıt değişti. Değişiklikleri karşılaştırın; kaydetmeden önce yeniden
        değerlendirin.
      </p>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Alan</th>
              <th scope="col">Güncel kayıt</th>
              <th scope="col">Sizin değişikliğiniz</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className={field.differs ? 'compare-table__diff' : undefined}>
                <th scope="row">
                  {field.label}
                  {field.differs ? <span className="badge badge--danger">Farklı</span> : null}
                </th>
                <td>{field.current}</td>
                <td>{field.mine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onUseCurrent}>
          Güncel kaydı forma yükle
        </Button>
        <Button variant="ghost" onClick={onKeepMine}>
          Benim değişikliklerimle devam et
        </Button>
      </div>
    </section>
  );
}
