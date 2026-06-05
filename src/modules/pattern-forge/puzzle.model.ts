import { Model, Schema, model, models } from 'mongoose';

import type { PuzzleDocument } from './pattern-forge.types';

const puzzleSchema = new Schema<PuzzleDocument>(
  {
    externalId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['LICHESS'],
      required: true,
      default: 'LICHESS',
      index: true,
    },
    fen: { type: String, required: true, trim: true },
    initialMove: { type: String, required: true, trim: true },
    playableFen: { type: String, required: true, trim: true },
    solutionMoves: { type: [String], required: true, default: [] },
    fullMoveSequence: { type: [String], required: true, default: [] },
    rating: { type: Number, required: true, index: true },
    ratingDeviation: { type: Number, required: true },
    popularity: { type: Number, required: true, index: true },
    nbPlays: { type: Number, required: true },
    themes: { type: [String], default: [], index: true },
    openingTags: { type: [String], default: [] },
    gameUrl: { type: String, required: true, trim: true },
    normalizedDifficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

puzzleSchema.index({ themes: 1 });
puzzleSchema.index({ source: 1 });

export const Puzzle: Model<PuzzleDocument> = models.Puzzle ?? model<PuzzleDocument>('Puzzle', puzzleSchema);
