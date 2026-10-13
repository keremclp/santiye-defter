import { useProjects } from '../../api/queries';
import type { Project } from '../../api/types';

/** Seçim için şantiye listesi; tamamlanan ve arşivlenenler dahil. */
export function useProjectOptions() {
  return useProjects({ status: 'all', sort: 'last_used', limit: 100 });
}

export function projectById(projects: Project[] | undefined, id: string): Project | undefined {
  return projects?.find((project) => project.id === id);
}
