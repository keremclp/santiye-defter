import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiPatch, apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useCategories } from '../../api/queries';
import { newIdempotencyKey } from '../../api/submission';
import type { Category } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Field, TextInput } from '../../components/ui/Field';
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
    <li className="card stack stack--sm">
      {editing ? (
        <form
          className="toolbar"
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
        <div className="row row--between">
          <span className="row">
            <strong>{category.name}</strong>
            {!category.isActive ? <Badge>Pasif</Badge> : null}
          </span>
          {canWrite ? (
            <span className="row">
              <Button variant="ghost" size="small" onClick={() => setEditing(true)}>
                Yeniden adlandır
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
      {error && !editing ? <p className="field__error">{error}</p> : null}
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
    <main className="page page--narrow">
      <PageHeader title="Gider kategorileri" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      {canWrite ? (
        <Card>
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <Field label="Yeni kategori" error={error ?? undefined}>
              {(props) => (
                <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} />
              )}
            </Field>
            <Button type="submit" loading={busy}>
              Ekle
            </Button>
          </form>
        </Card>
      ) : (
        <p className="meta">{reason}</p>
      )}
      <QueryView query={categories}>
        {(items) => (
          <ul className="item-list">
            {items.map((category) => (
              <CategoryRow key={category.id} category={category} canWrite={canWrite} />
            ))}
          </ul>
        )}
      </QueryView>
      <p className="meta">Seçilmeyen giderler “Kategorisiz” görünür.</p>
    </main>
  );
}
