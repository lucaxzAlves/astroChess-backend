import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyMove, cpToExpectedPointsForColor } from './move-classifier';
import type { NormalizedEvaluation, PlayerColor } from './chess.types';

const cp = (evaluation: number): NormalizedEvaluation => ({
  evaluation,
  evaluationType: 'cp',
});

const mate = (evaluation: number): NormalizedEvaluation => ({
  evaluation,
  evaluationType: 'mate',
});

const expected = (evaluation: number, color: PlayerColor): number =>
  Number(cpToExpectedPointsForColor(evaluation, color).toFixed(4));

const baseInput = {
  moveNumber: 20,
  color: 'white' as const,
  playedMoveUci: 'e2e4',
  bestMoveUci: 'e2e4',
  bestMoveSan: 'e4',
  ignoreErrorsBeforeMove: 7,
  phase: 'middlegame' as const,
};

const sacrificeSignal = (overrides: Partial<{ offeredSacrifice: boolean; acceptedSacrifice: boolean; offeredPieceValue: number; gainedPieceValue: number; netOfferValue: number; }> = {}) => ({
  offeredPieceValue: 3,
  gainedPieceValue: 1,
  netOfferValue: 2,
  captureAvailable: false,
  captureMove: null,
  captureEval: null,
  currentEval: 0,
  acceptedSacrifice: false,
  offeredSacrifice: true,
  ...overrides,
});

describe('move classification by expected points loss', () => {
  it('classifies an equal position becoming lost as a blunder', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'a2a3',
      before: cp(0),
      after: cp(-900),
    });

    assert.equal(result.classification, 'blunder');
    assert.ok(result.expectedPointsLoss > 0.2);
  });

  it('does not over-punish a won position that remains clearly better', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'a2a3',
      before: cp(900),
      after: cp(500),
    });

    assert.notEqual(result.classification, 'blunder');
    assert.ok(['good', 'inaccuracy', 'mistake'].includes(result.classification));
  });

  it('gives book priority for early theoretical moves', () => {
    const result = classifyMove({
      ...baseInput,
      moveNumber: 2,
      before: cp(20),
      after: cp(18),
      isBookMove: true,
      bookMovesUsedBySide: 0,
      maxBookMovesPerSide: 3,
    });

    assert.equal(result.classification, 'book');
    assert.equal(result.isBook, true);
  });

  it('marks a difficult engine-best move as excellent', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'e2e4',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(0),
      after: cp(20),
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(20, 'white') },
        { moveUci: 'g2g3', expectedPoints: expected(-350, 'white') },
        { moveUci: 'a2a3', expectedPoints: expected(-500, 'white') },
      ],
    });

    assert.equal(result.classification, 'excellent');
  });

  it('keeps a normal engine-best move as best', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'e2e4',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(40),
      after: cp(40),
    });

    assert.equal(result.classification, 'best');
  });

  it('classifies an unpunished opponent error as a missed chance', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'a2a3',
      bestMoveUci: 'e2e4',
      before: cp(350),
      after: cp(0),
      previousMoveWasProblematic: true,
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(350, 'white') },
        { moveUci: 'a2a3', expectedPoints: expected(0, 'white') },
      ],
    });

    assert.equal(result.classification, 'miss');
    assert.ok(result.missLoss >= 0.1);
    assert.ok(result.reasonTags.includes('missed_strong_continuation'));
  });

  it('classifies losing a forced mate as a blunder', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'a2a3',
      bestMoveUci: 'h5e8',
      bestMoveSan: 'Qe8#',
      before: mate(1),
      after: cp(0),
    });

    assert.equal(result.classification, 'blunder');
    assert.ok(result.reasonTags.includes('lost_forced_mate'));
  });

  it('classifies failing to use a still-winning mate sequence as a miss', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'a2a3',
      bestMoveUci: 'h5e8',
      bestMoveSan: 'Qe8#',
      before: mate(1),
      after: mate(3),
    });

    assert.equal(result.classification, 'miss');
    assert.ok(result.reasonTags.includes('missed_forced_mate'));
  });

  it('marks a near-best but difficult move as great', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'g2g3',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(0),
      after: cp(320),
      previousMoveWasProblematic: true,
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(350, 'white') },
        { moveUci: 'g2g3', expectedPoints: expected(320, 'white') },
        { moveUci: 'a2a3', expectedPoints: expected(0, 'white') },
      ],
    });

    assert.equal(result.classification, 'great');
    assert.equal(result.isOnlyMove, false);
  });

  it('marks a strong near-best sacrifice resource as brilliant', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'b5f7',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(30),
      after: cp(10),
      materialDelta: -2,
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(30, 'white') },
        { moveUci: 'b5f7', expectedPoints: expected(10, 'white') },
        { moveUci: 'a2a3', expectedPoints: expected(-260, 'white') },
      ],
    });

    assert.equal(result.classification, 'brilliant');
  });

  it('marks an excellent sacrifice as brilliant', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'b5f7',
      bestMoveUci: 'b5f7',
      bestMoveSan: 'Bxf7+',
      before: cp(0),
      after: cp(250),
      materialDelta: -3,
      candidateEvaluations: [
        { moveUci: 'b5f7', expectedPoints: expected(250, 'white') },
        { moveUci: 'b5e2', expectedPoints: expected(0, 'white') },
      ],
      sacrificeSignal: sacrificeSignal({ acceptedSacrifice: true, offeredSacrifice: false, netOfferValue: 3 }),
    });

    assert.equal(result.classification, 'brilliant');
    assert.equal(result.isSacrifice, true);
  });

  it('detects a direct piece offer as brilliant even without immediate material loss', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'd3h7',
      bestMoveUci: 'd3h7',
      bestMoveSan: 'Bxh7+',
      before: cp(20),
      after: cp(180),
      fenBefore: '6k1/7p/8/8/8/3B4/8/4K3 w - - 0 1',
      fenAfter: '6k1/7B/8/8/8/8/8/4K3 b - - 0 1',
      materialDelta: 1,
      candidateEvaluations: [
        { moveUci: 'd3h7', expectedPoints: expected(180, 'white') },
        { moveUci: 'd3e2', expectedPoints: expected(20, 'white') },
      ],
      sacrificeSignal: sacrificeSignal(),
    });

    assert.equal(result.classification, 'brilliant');
    assert.equal(result.isSacrifice, true);
  });

  it('marks a near-best sacrifice that still works as brilliant', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'b5f7',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(40),
      after: cp(170),
      materialDelta: -3,
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(200, 'white') },
        { moveUci: 'b5f7', expectedPoints: expected(170, 'white') },
        { moveUci: 'a2a3', expectedPoints: expected(-40, 'white') },
      ],
      sacrificeSignal: sacrificeSignal(),
    });

    assert.equal(result.classification, 'brilliant');
    assert.equal(result.isSacrifice, true);
  });

  it('detects a queen offer with direct recapture as a sacrifice', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'd1d7',
      bestMoveUci: 'd1d7',
      bestMoveSan: 'Qxd7+',
      before: cp(60),
      after: cp(220),
      fenBefore: '8/3rk2p/8/8/8/8/8/3Q2K1 w - - 0 1',
      fenAfter: '8/3Qk2p/8/8/8/8/8/6K1 b - - 0 1',
      materialDelta: 0,
      candidateEvaluations: [
        { moveUci: 'd1d7', expectedPoints: expected(220, 'white') },
        { moveUci: 'd1e2', expectedPoints: expected(60, 'white') },
      ],
      sacrificeSignal: sacrificeSignal({ offeredPieceValue: 9, gainedPieceValue: 5, netOfferValue: 4 }),
    });

    assert.equal(result.isSacrifice, true);
    assert.equal(result.classification, 'brilliant');
  });

  it('does not mark a sacrifice that fails as brilliant', () => {
    const result = classifyMove({
      ...baseInput,
      playedMoveUci: 'b5f7',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      before: cp(220),
      after: cp(40),
      materialDelta: -3,
      candidateEvaluations: [
        { moveUci: 'e2e4', expectedPoints: expected(220, 'white') },
        { moveUci: 'b5f7', expectedPoints: expected(40, 'white') },
        { moveUci: 'b5e2', expectedPoints: expected(180, 'white') },
      ],
      sacrificeSignal: sacrificeSignal(),
    });

    assert.notEqual(result.classification, 'brilliant');
    assert.ok(['good', 'inaccuracy', 'mistake', 'miss'].includes(result.classification));
  });
});
