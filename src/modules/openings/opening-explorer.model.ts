import { Model, Schema, Types, model, models } from 'mongoose';

import type { OpeningExplorerCacheDocument } from './opening-explorer.types';

const openingExplorerCacheSchema = new Schema<OpeningExplorerCacheDocument>(
  {
    playerId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    root: {
      type: Schema.Types.Mixed,
      required: true,
    },
    stats: {
      type: Schema.Types.Mixed,
      required: true,
    },
    dirty: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  },
);

openingExplorerCacheSchema.index({ playerId: 1 }, { unique: true });
openingExplorerCacheSchema.index({ dirty: 1 });
openingExplorerCacheSchema.index({ updatedAt: -1 });

export const OpeningExplorerCache: Model<OpeningExplorerCacheDocument> =
  models.OpeningExplorerCache ??
  model<OpeningExplorerCacheDocument>('OpeningExplorerCache', openingExplorerCacheSchema, 'openingExplorer');
