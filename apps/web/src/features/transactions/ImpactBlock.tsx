import type { ReactNode } from 'react';
import { ImpactPreview, type ImpactGroup } from '../../components/ui/ImpactPreview';
import { Loading } from '../../components/ui/States';

/** Önizleme yüklenirken veya yüklenemezse tutarlar kesin gibi gösterilmez. */
export function ImpactBlock({
  impact,
  note,
}: {
  impact: { groups: ImpactGroup[]; loading: boolean; error: unknown };
  note?: ReactNode;
}) {
  if (impact.loading) return <Loading label="Etki hesaplanıyor…" />;
  if (impact.error) {
    return (
      <div className="alert alert--danger" role="alert">
        Etki önizlemesi yüklenemedi. Güncel bakiyeler görülmeden onay vermeyin; bağlantıyı kontrol
        edip yeniden açın.
      </div>
    );
  }
  if (impact.groups.length === 0) {
    return <p className="meta">Bu işlem toplamları ve bakiyeleri değiştirmez.</p>;
  }
  return <ImpactPreview groups={impact.groups} note={note} />;
}
