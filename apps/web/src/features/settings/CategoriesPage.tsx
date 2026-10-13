import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiPatch, apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useCategories } from '../../api/queries';
import { newIdempotencyKey } from '../../api/submission';
import type { Category } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Pencil, Plus, Tag, Tags } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { QueryView } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { toast } from '../../stores/ui';

function CategoryRow({ category, canWrite }: { category: Category; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/categories/${category.id}`, {
        ...body,
        expectedUpdatedAt: category.updatedAt,
      });
      await invalidateRecords(queryClient);
      setEditing(false);
      toast(message);
    } catch (caught) {
      setError(errorMessage(caught));
      await invalidateRecords(queryClient);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      {editing ? (
        <form
          className="toolbar panel-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void patch({ name: name.trim() }, 'Kategori yeniden adlandırıldı.');
          }}
        >
          <Field label="Kategori adı" required error={error ?? undefined}>
            {(props) => (
              <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Button type="submit" size="small" loading={busy} disabled={!name.trim()}>
            Kaydet
          </Button>
          <Button variant="ghost" size="small" onClick={() => setEditing(false)}>
            Vazgeç
          </Button>
        </form>
      ) : (
        <div className="list-row list-row--static">
          <span className="icon-box icon-box--lg icon-box--neutral">
            <Icon icon={Tag} />
          </span>
          <span className="list-row__main">
            <span className="list-row__title">
              <span className="list-row__title-text">{category.name}</span>
              {!category.isActive ? <Badge>Pasif</Badge> : null}
            </span>
            {error ? <span className="field__error block">{error}</span> : null}
          </span>
          {canWrite ? (
            <span className="row row--nowrap">
              <Button
                variant="ghost"
                size="small"
                aria-label={`Yeniden adlandır: ${category.name}`}
                onClick={() => setEditing(true)}
              >
                <Icon icon={Pencil} />
                <span className="hide-mobile">Yeniden adlandır</span>
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() =>
                  void patch(
                    { isActive: !category.isActive },
                    category.isActive ? 'Kategori pasifleştirildi.' : 'Kategori aktifleştirildi.',
                  )
                }
              >
                {category.isActive ? 'Pasifleştir' : 'Aktifleştir'}
              </Button>
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

/**
 * Gider kategorileri (şartname 7.11): ekle, yeniden adlandır, pasifleştir. Kullanılmış kategori
 * silinmez, pasifleşir; pasif kategori yeni kayıtta seçilemez. Ad, Türkçe harf farkı gözetmeden tektir.
 */
export function CategoriesPage() {
  usePageMeta('Kategoriler');
  const queryClient = useQueryClient();
  const { canWrite, reason } = useWriteAccess();
  const categories = useCategories(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) {
      setError('Kategori adını girin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost('/categories', { name: name.trim() }, { idempotencyKey: newIdempotencyKey() });
      await invalidateRecords(queryClient);
      setName('');
      toast('Kategori eklendi.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Gider kategorileri"
        subtitle="Gider kayıtlarında seçilen kategoriler"
        back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }}
      />
      <div className="form-columns form-columns--side-first">
        <Panel title="Yeni kategori" icon={Plus}>
          {canWrite ? (
            <form
              className="toolbar panel__body"
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <Field label="Kategori adı" error={error ?? undefined}>
                {(props) => (
                  <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} />
                )}
              </Field>
              <Button type="submit" loading={busy}>
                <Icon icon={Plus} />
                Ekle
              </Button>
            </form>
          ) : (
            <p className="panel__note">{reason}</p>
          )}
          <ul className="panel__list">
            <li>Seçilmeyen giderler “Kategorisiz” görünür.</li>
            <li>Kullanılmış kategori silinmez, pasifleşir.</li>
            <li>Pasif kategori yeni kayıtta seçilemez; eski kayıtlarda görünmeye devam eder.</li>
          </ul>
        </Panel>
        <Panel
          title={`Kategoriler${categories.data ? ` (${categories.data.length})` : ''}`}
          icon={Tags}
        >
          <QueryView query={categories}>
            {(items) =>
              items.length === 0 ? (
                <p className="list-empty">Henüz kategori yok.</p>
              ) : (
                <ul className="list-rows">
                  {items.map((category) => (
                    <CategoryRow key={category.id} category={category} canWrite={canWrite} />
                  ))}
                </ul>
              )
            }
          </QueryView>
        </Panel>
      </div>
    </main>
  );
}
