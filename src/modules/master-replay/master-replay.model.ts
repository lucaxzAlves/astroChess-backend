import { Model, Schema, Types, model, models } from 'mongoose';

import type { MasterReplayGameDocument } from './master-replay.types';

const arrowSchema = new Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    color: { type: String, trim: true },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    prompt: { type: String, required: true, trim: true },
    candidateMoves: { type: [String], default: [] },
    correctMove: { type: String, trim: true },
    explanation: { type: String, trim: true },
    hints: { type: [String], default: [] },
  },
  { _id: false },
);

const annotatedMoveSchema = new Schema(
  {
    ply: { type: Number, required: true },
    moveNumber: { type: Number, required: true },
    color: { type: String, enum: ['white', 'black'], required: true },
    san: { type: String, required: true, trim: true },
    uci: { type: String, trim: true },
    fenBefore: { type: String, trim: true },
    fenAfter: { type: String, trim: true },
    comment: { type: String, trim: true },
    shortComment: { type: String, trim: true },
    annotationType: {
      type: String,
      enum: [
        'idea',
        'critical',
        'mistake',
        'brilliant',
        'turning_point',
        'quiet_move',
        'defensive_resource',
        'model_move',
      ],
    },
    arrows: { type: [arrowSchema], default: [] },
    highlightSquares: { type: [String], default: [] },
    evalBefore: { type: Number },
    evalAfter: { type: Number },
    isGuessMove: { type: Boolean, default: false },
    question: { type: questionSchema },
  },
  { _id: false },
);

const keyMomentSchema = new Schema(
  {
    id: { type: String, trim: true },
    ply: { type: Number, required: true },
    moveNumber: { type: Number, required: true },
    color: { type: String, enum: ['white', 'black'], required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'opening_idea',
        'critical_position',
        'turning_point',
        'combination',
        'defensive_resource',
        'conversion',
        'endgame_technique',
      ],
      required: true,
    },
    fen: { type: String, trim: true },
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
    lesson: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const masterReplayGameSchema = new Schema<MasterReplayGameDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    category: {
      type: String,
      enum: ['attack', 'defense', 'calculation', 'positional', 'endgame', 'opening', 'tactics', 'strategy'],
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'master'],
      required: true,
      index: true,
    },
    tags: { type: [String], default: [], index: true },
    players: {
      white: { type: String, required: true, trim: true, index: true },
      black: { type: String, required: true, trim: true, index: true },
    },
    gameInfo: {
      event: { type: String, trim: true },
      site: { type: String, trim: true },
      date: { type: String, trim: true },
      round: { type: String, trim: true },
      result: { type: String, trim: true },
      eco: { type: String, trim: true },
      opening: { type: String, trim: true },
      year: { type: Number },
    },
    pgn: { type: String, required: true, trim: true },
    initialFen: { type: String, trim: true },
    orientation: { type: String, enum: ['white', 'black'], default: 'white' },
    moveCount: { type: Number },
    replayMode: {
      sideToGuess: { type: String, enum: ['white', 'black', 'both'], default: 'both' },
      showEngineEval: { type: Boolean, default: false },
      showHints: { type: Boolean, default: true },
      allowRetry: { type: Boolean, default: true },
    },
    annotatedMoves: { type: [annotatedMoveSchema], default: [] },
    keyMoments: { type: [keyMomentSchema], default: [] },
    studySummary: {
      coreLesson: { type: String, trim: true },
      whatToLearn: { type: [String], default: [] },
      typicalMistakes: { type: [String], default: [] },
      modelIdeas: { type: [String], default: [] },
    },
    order: { type: Number, default: 0, index: true },
    createdBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

masterReplayGameSchema.index({ slug: 1 }, { unique: true });
masterReplayGameSchema.index({ status: 1 });
masterReplayGameSchema.index({ category: 1 });
masterReplayGameSchema.index({ difficulty: 1 });
masterReplayGameSchema.index({ tags: 1 });
masterReplayGameSchema.index({ 'players.white': 1 });
masterReplayGameSchema.index({ 'players.black': 1 });
masterReplayGameSchema.index({ order: 1 });
masterReplayGameSchema.index({ 'annotatedMoves.ply': 1 });
masterReplayGameSchema.index({ 'keyMoments.ply': 1 });

export const MasterReplayGame: Model<MasterReplayGameDocument> =
  models.MasterReplayGame ??
  model<MasterReplayGameDocument>('MasterReplayGame', masterReplayGameSchema);

