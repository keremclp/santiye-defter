import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

/** Şartname 8.5: yeni firmaya başlangıç gider kategorileri. */
export const DEFAULT_CATEGORY_NAMES = [
  'Malzeme',
  'İşçilik',
  'Taşeron',
  'Nakliye',
  'Kira',
  'Genel giderler',
] as const;

export interface Category extends CompanyScopedFields {
  _id: Types.ObjectId;
  name: string;
  nameFolded: string;
  isActive: boolean;
}

const categorySchema = new Schema<Category>({
  name: { type: String, required: true, trim: true },
  nameFolded: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});
categorySchema.plugin(companyScopedPlugin);

// Firma içinde benzersiz ad (Türkçe katlamalı).
categorySchema.index({ companyId: 1, nameFolded: 1 }, { unique: true });

export const CategoryModel = model<Category>('Category', categorySchema);
export type CategoryDocument = HydratedDocument<Category>;
