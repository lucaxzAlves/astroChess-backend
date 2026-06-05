import { Chess } from 'chess.js';

import { parsePgnGame } from '../../chess/pgn.parser';
import type { GameMetadata, PlayerColor } from '../../chess/chess.types';
import { AppError } from '../../utils/AppError';
import * as openingExplorerRepository from './opening-explorer.repository';
import type {
  CachedOpeningNode,
  OpeningColorStats,
  OpeningExplorerCacheRecord,
  OpeningExplorerCacheStats,
  OpeningExplorerGameRecord,
  OpeningExplorerInsight,
  OpeningExplorerSummary,
  OpeningMoveSummary,
  OpeningNamedStat,
  OpeningNode,
  OpeningOutcome,
  OpeningSummaryItem,
  PersistedOpeningNode,
  PersistedOpeningTree,
} from './opening-explorer.types';

const DEFAULT_ROOT_FEN = new Chess().fen();
const MIN_GAMES_FOR_OPENING_SCORE = 3;

type ResolvedOpeningExplorerCache = Omit<OpeningExplorerCacheRecord, 'root'> & {
  root: CachedOpeningNode;
};

const isRecordStringKeyMap = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isPersistedOpeningTree = (value: unknown): value is PersistedOpeningTree => {
  if (!isRecordStringKeyMap(value)) {
    return false;
  }

  return value.version === 1 && typeof value.rootId === 'string' && isRecordStringKeyMap(value.nodes);
};

const serializeTree = (root: CachedOpeningNode): PersistedOpeningTree => {
  const nodes: Record<string, PersistedOpeningNode> = {};
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop() as CachedOpeningNode;

    nodes[node.id] = {
      id: node.id,
      move: node.move,
      fen: node.fen,
      depth: node.depth,
      games: node.games,
      wins: node.wins,
      draws: node.draws,
      losses: node.losses,
      whiteGames: node.whiteGames,
      blackGames: node.blackGames,
      whiteStats: node.whiteStats,
      blackStats: node.blackStats,
      childIds: node.children.map((child) => child.id),
    };

    for (const child of node.children) {
      stack.push(child);
    }
  }

  return {
    version: 1,
    rootId: root.id,
    nodes,
  };
};

const hydrateTree = (tree: PersistedOpeningTree): CachedOpeningNode => {
  const hydrateNode = (nodeId: string): CachedOpeningNode => {
    const persistedNode = tree.nodes[nodeId];

    if (!persistedNode) {
      throw new AppError('Opening explorer cache is corrupted.', 500, {
        nodeId,
      });
    }

    return {
      id: persistedNode.id,
      move: persistedNode.move,
      fen: persistedNode.fen,
      depth: persistedNode.depth,
      games: persistedNode.games,
      wins: persistedNode.wins,
      draws: persistedNode.draws,
      losses: persistedNode.losses,
      whiteGames: persistedNode.whiteGames,
      blackGames: persistedNode.blackGames,
      whiteStats: persistedNode.whiteStats,
      blackStats: persistedNode.blackStats,
      children: persistedNode.childIds.map((childId) => hydrateNode(childId)),
    };
  };

  return hydrateNode(tree.rootId);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeString = (value: string): string => {
  return value.trim().toLowerCase();
};

const roundScore = (value: number): number => {
  return Number(value.toFixed(1));
};

const createColorStats = (): OpeningColorStats => ({
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
});

const createNode = (move: string | null, fen: string, depth: number): CachedOpeningNode => ({
  id: depth === 0 ? 'root' : `${depth}:${move ?? 'root'}:${fen}`,
  move,
  fen,
  depth,
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  whiteGames: 0,
  blackGames: 0,
  whiteStats: createColorStats(),
  blackStats: createColorStats(),
  children: [],
});

const clonePublicNode = (node: CachedOpeningNode, maxChildDepth = 1): OpeningNode => ({
  id: node.id,
  move: node.move,
  fen: node.fen,
  depth: node.depth,
  games: node.games,
  wins: node.wins,
  draws: node.draws,
  losses: node.losses,
  whiteGames: node.whiteGames,
  blackGames: node.blackGames,
  children:
    maxChildDepth <= 0
      ? []
      : node.children.map((child) => clonePublicNode(child, maxChildDepth - 1)),
});

const scoreFromStats = (wins: number, draws: number, games: number): number => {
  if (games <= 0) {
    return 0;
  }

  return roundScore(((wins + draws * 0.5) / games) * 100);
};

const incrementOutcomeStats = (stats: OpeningColorStats, outcome: OpeningOutcome): void => {
  stats.games += 1;

  if (outcome === 'win') {
    stats.wins += 1;
    return;
  }

  if (outcome === 'draw') {
    stats.draws += 1;
    return;
  }

  stats.losses += 1;
};

const incrementNodeStats = (
  node: CachedOpeningNode,
  color: PlayerColor,
  outcome: OpeningOutcome,
): void => {
  node.games += 1;

  if (outcome === 'win') {
    node.wins += 1;
  } else if (outcome === 'draw') {
    node.draws += 1;
  } else {
    node.losses += 1;
  }

  if (color === 'white') {
    node.whiteGames += 1;
    incrementOutcomeStats(node.whiteStats, outcome);
    return;
  }

  node.blackGames += 1;
  incrementOutcomeStats(node.blackStats, outcome);
};

const getOrCreateChildNode = (
  parent: CachedOpeningNode,
  move: string,
  fen: string,
): CachedOpeningNode => {
  const existingChild = parent.children.find((child) => child.move === move);

  if (existingChild) {
    return existingChild;
  }

  const child = createNode(move, fen, parent.depth + 1);
  parent.children.push(child);
  return child;
};

const sortTree = (node: CachedOpeningNode): void => {
  node.children.sort((left, right) => {
    if (right.games !== left.games) {
      return right.games - left.games;
    }

    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }

    return (left.move ?? '').localeCompare(right.move ?? '');
  });

  for (const child of node.children) {
    sortTree(child);
  }
};

const resolvePlayerOutcome = (
  result: string | undefined,
  color: PlayerColor,
): OpeningOutcome | null => {
  const normalizedResult = result?.trim();

  if (!normalizedResult || normalizedResult === '*') {
    return null;
  }

  if (normalizedResult === '1/2-1/2') {
    return 'draw';
  }

  if (normalizedResult === '1-0') {
    return color === 'white' ? 'win' : 'loss';
  }

  if (normalizedResult === '0-1') {
    return color === 'black' ? 'win' : 'loss';
  }

  return null;
};

const buildKnownUsernames = async (userId: string): Promise<Set<string>> => {
  const profile = await openingExplorerRepository.findPlayerProfileIdentitiesByUser(userId);
  const usernames = new Set<string>();

  const candidates = [
    profile?.identities?.chessCom?.username,
    profile?.identities?.lichess?.username,
    profile?.identities?.fide?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      usernames.add(normalizeString(candidate));
    }
  }

  return usernames;
};

const resolvePlayerColor = (
  analysis: OpeningExplorerGameRecord,
  usernames: Set<string>,
  headers: Record<string, string>,
): PlayerColor | null => {
  if (analysis.targetPlayer?.color === 'white' || analysis.targetPlayer?.color === 'black') {
    return analysis.targetPlayer.color;
  }

  const metadataWhite = analysis.metadata?.white ?? headers.White;
  const metadataBlack = analysis.metadata?.black ?? headers.Black;
  const targetUsername = analysis.targetPlayer?.username;

  if (typeof targetUsername === 'string' && targetUsername.trim()) {
    const normalizedTargetUsername = normalizeString(targetUsername);

    if (metadataWhite && normalizeString(metadataWhite) === normalizedTargetUsername) {
      return 'white';
    }

    if (metadataBlack && normalizeString(metadataBlack) === normalizedTargetUsername) {
      return 'black';
    }
  }

  if (metadataWhite && usernames.has(normalizeString(metadataWhite))) {
    return 'white';
  }

  if (metadataBlack && usernames.has(normalizeString(metadataBlack))) {
    return 'black';
  }

  return null;
};

const resolveOpeningMetadata = (
  metadata: OpeningExplorerGameRecord['metadata'],
  headers: Record<string, string>,
): { name: string | null; eco: string | null } => {
  const openingName = metadata?.opening?.trim() || headers.Opening?.trim() || null;
  const eco = metadata?.eco?.trim() || headers.ECO?.trim() || null;

  return {
    name: openingName,
    eco,
  };
};

const buildOpeningKey = (name: string, eco: string | null): string => {
  return `${normalizeString(name)}::${normalizeString(eco ?? '')}`;
};

const findNodesByFen = (
  node: CachedOpeningNode,
  fen: string,
  matches: CachedOpeningNode[] = [],
): CachedOpeningNode[] => {
  if (node.fen === fen) {
    matches.push(node);
  }

  for (const child of node.children) {
    findNodesByFen(child, fen, matches);
  }

  return matches;
};

const aggregateNodes = (nodes: CachedOpeningNode[], fen: string): CachedOpeningNode => {
  const aggregate = createNode(nodes[0]?.move ?? null, fen, nodes[0]?.depth ?? 0);
  aggregate.id = `aggregate:${fen}`;

  const childMap = new Map<string, OpeningMoveSummary>();

  for (const node of nodes) {
    aggregate.games += node.games;
    aggregate.wins += node.wins;
    aggregate.draws += node.draws;
    aggregate.losses += node.losses;
    aggregate.whiteGames += node.whiteGames;
    aggregate.blackGames += node.blackGames;
    aggregate.whiteStats.games += node.whiteStats.games;
    aggregate.whiteStats.wins += node.whiteStats.wins;
    aggregate.whiteStats.draws += node.whiteStats.draws;
    aggregate.whiteStats.losses += node.whiteStats.losses;
    aggregate.blackStats.games += node.blackStats.games;
    aggregate.blackStats.wins += node.blackStats.wins;
    aggregate.blackStats.draws += node.blackStats.draws;
    aggregate.blackStats.losses += node.blackStats.losses;

    for (const child of node.children) {
      const key = `${child.move ?? ''}::${child.fen}`;
      const existingChild = childMap.get(key);

      if (existingChild) {
        existingChild.games += child.games;
        existingChild.wins += child.wins;
        existingChild.draws += child.draws;
        existingChild.losses += child.losses;
        existingChild.whiteGames += child.whiteGames;
        existingChild.blackGames += child.blackGames;
        continue;
      }

      childMap.set(key, {
        move: child.move ?? '',
        fen: child.fen,
        games: child.games,
        wins: child.wins,
        draws: child.draws,
        losses: child.losses,
        score: 0,
        whiteGames: child.whiteGames,
        blackGames: child.blackGames,
      });
    }
  }

  aggregate.children = [...childMap.values()]
    .map((childSummary) => {
      const childNode = createNode(childSummary.move, childSummary.fen, aggregate.depth + 1);
      childNode.games = childSummary.games;
      childNode.wins = childSummary.wins;
      childNode.draws = childSummary.draws;
      childNode.losses = childSummary.losses;
      childNode.whiteGames = childSummary.whiteGames;
      childNode.blackGames = childSummary.blackGames;
      return childNode;
    })
    .sort((left, right) => {
      if (right.games !== left.games) {
        return right.games - left.games;
      }

      return (left.move ?? '').localeCompare(right.move ?? '');
    });

  return aggregate;
};

const toMoveSummary = (node: CachedOpeningNode): OpeningMoveSummary => ({
  move: node.move ?? '',
  fen: node.fen,
  games: node.games,
  wins: node.wins,
  draws: node.draws,
  losses: node.losses,
  score: scoreFromStats(node.wins, node.draws, node.games),
  whiteGames: node.whiteGames,
  blackGames: node.blackGames,
});

const selectOpeningStat = (
  openingStats: OpeningNamedStat[],
  direction: 'best' | 'weakest',
): OpeningSummaryItem | null => {
  if (openingStats.length === 0) {
    return null;
  }

  const preferredPool = openingStats.filter((item) => item.games >= MIN_GAMES_FOR_OPENING_SCORE);
  const pool = preferredPool.length > 0 ? preferredPool : openingStats;
  const sorted = [...pool].sort((left, right) => {
    if (left.score !== right.score) {
      return direction === 'best' ? right.score - left.score : left.score - right.score;
    }

    if (right.games !== left.games) {
      return right.games - left.games;
    }

    return left.name.localeCompare(right.name);
  });
  const selected = sorted[0];

  return selected
    ? {
        name: selected.name,
        score: selected.score,
      }
    : null;
};

const buildEmptyCache = (): Pick<OpeningExplorerCacheRecord, 'root' | 'stats'> => {
  const root = createNode(null, DEFAULT_ROOT_FEN, 0);
  const stats: OpeningExplorerCacheStats = {
    rootFen: DEFAULT_ROOT_FEN,
    totalGames: 0,
    whiteRepertoireSize: 0,
    blackRepertoireSize: 0,
    mostPlayedOpening: null,
    bestOpening: null,
    weakestOpening: null,
    skippedGames: 0,
    namedOpeningStats: [],
  };

  return {
    root: serializeTree(root),
    stats,
  };
};

const dedupeGameAnalyses = (analyses: OpeningExplorerGameRecord[]): OpeningExplorerGameRecord[] => {
  const uniqueAnalyses: OpeningExplorerGameRecord[] = [];
  const seenKeys = new Set<string>();

  for (const analysis of analyses) {
    const key =
      typeof analysis.gameId === 'string' && analysis.gameId.trim()
        ? `${analysis.source ?? 'unknown'}::${analysis.gameId.trim()}`
        : analysis._id.toString();

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueAnalyses.push(analysis);
  }

  return uniqueAnalyses;
};

const buildCachePayload = async (userId: string): Promise<Pick<OpeningExplorerCacheRecord, 'root' | 'stats'>> => {
  const analyses = dedupeGameAnalyses(
    await openingExplorerRepository.findOpeningExplorerGamesByUser(userId),
  );

  if (analyses.length === 0) {
    return buildEmptyCache();
  }

  const usernames = await buildKnownUsernames(userId);
  const root = createNode(null, DEFAULT_ROOT_FEN, 0);
  const openingStatsMap = new Map<string, Omit<OpeningNamedStat, 'score'>>();
  const whiteNamedOpenings = new Set<string>();
  const blackNamedOpenings = new Set<string>();
  const whiteFallbackMoves = new Set<string>();
  const blackFallbackReplies = new Set<string>();
  let totalGames = 0;
  let skippedGames = 0;

  for (const [index, analysis] of analyses.entries()) {
    try {
      const parsedGame = parsePgnGame(
        {
          id: analysis.gameId,
          pgn: analysis.originalPgn,
          metadata: analysis.metadata as GameMetadata | undefined,
        },
        index,
      );

      if (parsedGame.moves[0]?.fenBefore !== DEFAULT_ROOT_FEN) {
        skippedGames += 1;
        continue;
      }

      const playerColor = resolvePlayerColor(analysis, usernames, parsedGame.headers);

      if (!playerColor) {
        skippedGames += 1;
        continue;
      }

      const result = analysis.metadata?.result ?? parsedGame.headers.Result;
      const outcome = resolvePlayerOutcome(result, playerColor);

      if (!outcome) {
        skippedGames += 1;
        continue;
      }

      totalGames += 1;
      incrementNodeStats(root, playerColor, outcome);

      const openingMeta = resolveOpeningMetadata(analysis.metadata, parsedGame.headers);

      if (openingMeta.name) {
        const key = buildOpeningKey(openingMeta.name, openingMeta.eco);
        const existing = openingStatsMap.get(key) ?? {
          name: openingMeta.name,
          eco: openingMeta.eco,
          games: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          whiteGames: 0,
          blackGames: 0,
        };

        existing.games += 1;

        if (outcome === 'win') {
          existing.wins += 1;
        } else if (outcome === 'draw') {
          existing.draws += 1;
        } else {
          existing.losses += 1;
        }

        if (playerColor === 'white') {
          existing.whiteGames += 1;
          whiteNamedOpenings.add(key);
        } else {
          existing.blackGames += 1;
          blackNamedOpenings.add(key);
        }

        openingStatsMap.set(key, existing);
      }

      let currentNode = root;
      let ownMoveCount = 0;

      for (const move of parsedGame.moves) {
        const childNode = getOrCreateChildNode(currentNode, move.san, move.fenAfter);
        incrementNodeStats(childNode, playerColor, outcome);
        currentNode = childNode;

        if (move.color === playerColor) {
          ownMoveCount += 1;

          if (playerColor === 'white' && ownMoveCount === 1) {
            whiteFallbackMoves.add(move.san);
          }

          if (playerColor === 'black' && ownMoveCount === 1) {
            blackFallbackReplies.add(move.san);
          }
        }
      }
    } catch {
      skippedGames += 1;
    }
  }

  sortTree(root);

  const openingStats = [...openingStatsMap.values()]
    .map<OpeningNamedStat>((item) => ({
      ...item,
      score: scoreFromStats(item.wins, item.draws, item.games),
    }))
    .sort((left, right) => {
      if (right.games !== left.games) {
        return right.games - left.games;
      }

      return left.name.localeCompare(right.name);
    });

  const mostPlayedOpening = openingStats[0]
    ? {
        name: openingStats[0].name,
        games: openingStats[0].games,
      }
    : null;

  const summary: OpeningExplorerSummary = {
    totalGames,
    whiteRepertoireSize: whiteNamedOpenings.size > 0 ? whiteNamedOpenings.size : whiteFallbackMoves.size,
    blackRepertoireSize: blackNamedOpenings.size > 0 ? blackNamedOpenings.size : blackFallbackReplies.size,
    mostPlayedOpening,
    bestOpening: selectOpeningStat(openingStats, 'best'),
    weakestOpening: selectOpeningStat(openingStats, 'weakest'),
  };

  return {
    root: serializeTree(root),
    stats: {
      rootFen: DEFAULT_ROOT_FEN,
      skippedGames,
      namedOpeningStats: openingStats,
      ...summary,
    },
  };
};

const ensureExplorerCache = async (userId: string): Promise<ResolvedOpeningExplorerCache> => {
  const cache = await openingExplorerRepository.findOpeningExplorerCacheByUser(userId);

  if (cache && cache.dirty !== true && isPersistedOpeningTree(cache.root)) {
    return {
      ...cache,
      root: hydrateTree(cache.root),
    };
  }

  const payload = await buildCachePayload(userId);
  const rebuiltCache = await openingExplorerRepository.upsertOpeningExplorerCache(userId, payload);

  return {
    ...rebuiltCache,
    root: hydrateTree(rebuiltCache.root),
  };
};

const aggregateNodeByFen = async (userId: string, fen?: string): Promise<CachedOpeningNode> => {
  const cache = await ensureExplorerCache(userId);
  const targetFen = typeof fen === 'string' && fen.trim() ? fen.trim() : cache.stats.rootFen;

  if (targetFen === cache.root.fen) {
    return cache.root;
  }

  const matches = findNodesByFen(cache.root, targetFen);

  if (matches.length === 0) {
    throw new AppError('Opening position not found for this player.', 404, {
      fen: targetFen,
    });
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return aggregateNodes(matches, targetFen);
};

const ensureMovesInput = (body: unknown): string[] => {
  if (!isRecord(body) || !Array.isArray(body.moves)) {
    throw new AppError('moves must be an array of SAN moves.', 400);
  }

  const moves = body.moves.map((move) => {
    if (typeof move !== 'string' || !move.trim()) {
      throw new AppError('Each move must be a non-empty string.', 400);
    }

    return move.trim();
  });

  return moves;
};

const buildChildrenResponse = (node: CachedOpeningNode): OpeningMoveSummary[] => {
  return node.children.map(toMoveSummary);
};

const buildInsights = (node: CachedOpeningNode, moves: OpeningMoveSummary[]): OpeningExplorerInsight[] => {
  const insights: OpeningExplorerInsight[] = [];
  const totalGames = node.games;
  const positionScore = scoreFromStats(node.wins, node.draws, node.games);
  const topMove = moves[0];

  if (topMove && totalGames > 0) {
    const topMoveShare = roundScore((topMove.games / totalGames) * 100);

    if (topMoveShare >= 60) {
      insights.push({
        type: 'common_choice',
        title: 'Most Common Choice',
        description: `You play ${topMove.move} in ${topMoveShare}% of games from this position.`,
      });
    }

    if (topMove.score >= 65 && topMove.games >= 3) {
      insights.push({
        type: 'strong_choice',
        title: 'Strong Personal Score',
        description: `Your best-performing practical choice here is ${topMove.move}, scoring ${topMove.score}%.`,
      });
    }
  }

  if (positionScore <= 45 && totalGames >= 5) {
    insights.push({
      type: 'performance_warning',
      title: 'Performance Warning',
      description: `You score only ${positionScore}% from this structure across ${totalGames} games.`,
    });
  }

  if (topMove && totalGames >= 8 && roundScore((topMove.games / totalGames) * 100) >= 80) {
    insights.push({
      type: 'repertoire_pattern',
      title: 'Narrow Repertoire Signal',
      description: `You rely heavily on ${topMove.move} here, which may make your repertoire easier to predict.`,
    });
  }

  if (moves.length === 0 && totalGames > 0) {
    insights.push({
      type: 'leaf_position',
      title: 'Leaf Position',
      description: 'This is currently a terminal position in your personal opening tree.',
    });
  }

  return insights.slice(0, 3);
};

export const getOpeningExplorerRoot = async (userId: string) => {
  const cache = await ensureExplorerCache(userId);

  return {
    root: clonePublicNode(cache.root, 1),
    updatedAt: cache.updatedAt ?? null,
  };
};

export const getOpeningExplorerNode = async (userId: string, fen?: string) => {
  const node = await aggregateNodeByFen(userId, fen);

  return {
    fen: node.fen,
    moves: buildChildrenResponse(node),
  };
};

export const getOpeningExplorerPath = async (userId: string, body: unknown) => {
  const moves = ensureMovesInput(body);
  const cache = await ensureExplorerCache(userId);
  let currentNode = cache.root;

  for (const move of moves) {
    const nextNode = currentNode.children.find((child) => child.move === move);

    if (!nextNode) {
      throw new AppError('Opening path not found for this player.', 404, {
        move,
      });
    }

    currentNode = nextNode;
  }

  return {
    moves,
    currentNode: clonePublicNode(currentNode, 0),
    children: buildChildrenResponse(currentNode),
    statistics: {
      games: currentNode.games,
      wins: currentNode.wins,
      draws: currentNode.draws,
      losses: currentNode.losses,
      score: scoreFromStats(currentNode.wins, currentNode.draws, currentNode.games),
      whiteGames: currentNode.whiteGames,
      blackGames: currentNode.blackGames,
    },
  };
};

export const getOpeningExplorerSummary = async (userId: string): Promise<OpeningExplorerSummary> => {
  const cache = await ensureExplorerCache(userId);

  return {
    totalGames: cache.stats.totalGames,
    whiteRepertoireSize: cache.stats.whiteRepertoireSize,
    blackRepertoireSize: cache.stats.blackRepertoireSize,
    mostPlayedOpening: cache.stats.mostPlayedOpening,
    bestOpening: cache.stats.bestOpening,
    weakestOpening: cache.stats.weakestOpening,
  };
};

export const getOpeningExplorerInsights = async (userId: string, fen?: string) => {
  const node = await aggregateNodeByFen(userId, fen);
  const moves = buildChildrenResponse(node);

  return {
    fen: node.fen,
    insights: buildInsights(node, moves),
  };
};

export const markOpeningExplorerDirty = async (userId: string): Promise<void> => {
  await openingExplorerRepository.markOpeningExplorerDirtyByUser(userId);
};
