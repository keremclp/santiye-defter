import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { PROJECT_STATUSES } from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

export interface Project extends CompanyScopedFields {
  _id: Types.ObjectId;
  name: string;
  nameFolded: string;
  description: string;
  address: string;
  /** YYYY-MM-DD veya null */
  startDate: string | null;
  status: (typeof PROJECT_STATUSES)[number];
  /** Tamamlanma tarihi (YYYY-MM-DD); yeniden aktifleştirmede temizlenir */
  completedAt: string | null;
  pinned: boolean;
  lastUsedAt: Date | null;
}

const projectSchema = new Schema<Project>({
  name: { type: String, required: true, trim: true },
  nameFolded: { type: String, required: true },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  startDate: { type: String, default: null },
  status: { type: String, enum: PROJECT_STATUSES, default: 'active' },
  completedAt: { type: String, default: null },
  pinned: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: null },
});
projectSchema.plugin(companyScopedPlugin);

projectSchema.index({ companyId: 1, status: 1, deletedAt: 1 });
projectSchema.index({ companyId: 1, pinned: -1, lastUsedAt: -1 });
projectSchema.index({ companyId: 1, nameFolded: 1 });

export const ProjectModel = model<Project>('Project', projectSchema);
export type ProjectDocument = HydratedDocument<Project>;
