import { model, Schema, type Types } from 'mongoose';

/** Kullanıcıya özel son aramalar (şartname 8.9). */
export interface SearchHistory {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  query: string;
  createdAt: Date;
}

const searchHistorySchema = new Schema<SearchHistory>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

searchHistorySchema.index({ userId: 1, createdAt: -1 });

export const SearchHistoryModel = model<SearchHistory>('SearchHistory', searchHistorySchema);
