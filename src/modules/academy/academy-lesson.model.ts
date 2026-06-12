import { Model, Schema, Types, model, models } from 'mongoose';

import type { AcademyLessonDocument } from './academy.types';

const textSectionSchema = new Schema(
  {
    heading: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const arrowSchema = new Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    color: { type: String, trim: true },
  },
  { _id: false },
);

const conceptMoveSchema = new Schema(
  {
    san: { type: String, trim: true },
    uci: { type: String, trim: true },
    fenAfter: { type: String, trim: true },
    comment: { type: String, trim: true },
    highlightSquares: { type: [String], default: [] },
    arrows: { type: [arrowSchema], default: [] },
  },
  { _id: false },
);

const conceptVariationSchema = new Schema(
  {
    name: { type: String, trim: true },
    moves: { type: [String], required: true, default: [] },
    explanation: { type: String, trim: true },
  },
  { _id: false },
);

const conceptPositionSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    fen: { type: String, required: true, trim: true },
    orientation: {
      type: String,
      enum: ['white', 'black'],
      required: true,
    },
    initialPly: { type: Number },
    moves: { type: [conceptMoveSchema], default: [] },
    variations: { type: [conceptVariationSchema], default: [] },
  },
  { _id: false },
);

const studyShelfItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['video', 'book', 'article', 'course', 'chapter'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    url: { type: String, trim: true },
    description: { type: String, trim: true },
    provider: { type: String, trim: true },
    order: { type: Number },
  },
  { _id: false },
);

const gmMomentSchema = new Schema(
  {
    moveNumber: { type: Number },
    ply: { type: Number },
    fen: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
    candidateMoves: { type: [String], default: [] },
    bestMove: { type: String, trim: true },
  },
  { _id: false },
);

const gmModelGameSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    white: { type: String, required: true, trim: true },
    black: { type: String, required: true, trim: true },
    event: { type: String, trim: true },
    year: { type: Number },
    result: { type: String, trim: true },
    pgn: { type: String, trim: true },
    startFen: { type: String, trim: true },
    criticalFen: { type: String, trim: true },
    criticalMoveNumber: { type: Number },
    orientation: {
      type: String,
      enum: ['white', 'black'],
    },
    explanation: { type: String, trim: true },
    moments: { type: [gmMomentSchema], default: [] },
  },
  { _id: false },
);

const generatedFiltersSchema = new Schema(
  {
    themes: { type: [String], default: [] },
    minRating: { type: Number },
    maxRating: { type: Number },
    count: { type: Number },
  },
  { _id: false },
);

const customPuzzleSchema = new Schema(
  {
    title: { type: String, trim: true },
    fen: { type: String, required: true, trim: true },
    moves: { type: [String], required: true, default: [] },
    themes: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
    },
    explanation: { type: String, trim: true },
  },
  { _id: false },
);

const targetedPracticeSchema = new Schema(
  {
    description: { type: String, trim: true },
    puzzleRefs: { type: [{ type: Types.ObjectId, ref: 'Puzzle' }], default: [] },
    generatedFilters: { type: generatedFiltersSchema },
    customPuzzles: { type: [customPuzzleSchema], default: [] },
  },
  { _id: false },
);

const coreIdeaSchema = new Schema(
  {
    title: { type: String, trim: true },
    summary: { type: String, required: true, trim: true },
    sections: { type: [textSectionSchema], default: [] },
  },
  { _id: false },
);

const academyLessonSchema = new Schema<AcademyLessonDocument>(
  {
    pathId: { type: Types.ObjectId, ref: 'AcademyPath', required: true, index: true },
    moduleId: { type: Types.ObjectId, ref: 'AcademyModule', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    lessonType: {
      type: String,
      enum: ['concept', 'model_game', 'practice', 'mixed'],
      required: true,
    },
    estimatedMinutes: { type: Number },
    tags: { type: [String], default: [], index: true },
    keyConcepts: { type: [String], default: [], index: true },
    coreIdea: { type: coreIdeaSchema, required: true },
    conceptPosition: { type: conceptPositionSchema },
    studyShelf: { type: [studyShelfItemSchema], default: [] },
    gmModelGame: { type: gmModelGameSchema },
    targetedPractice: { type: targetedPracticeSchema },
  },
  { timestamps: true },
);

academyLessonSchema.index({ moduleId: 1, order: 1 });
academyLessonSchema.index({ moduleId: 1, slug: 1 }, { unique: true });

export const AcademyLesson: Model<AcademyLessonDocument> =
  models.AcademyLesson ?? model<AcademyLessonDocument>('AcademyLesson', academyLessonSchema);
