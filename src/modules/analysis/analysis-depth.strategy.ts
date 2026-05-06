export const getAnalysisDepth = (totalGames: number): number => {
  if (totalGames === 1) {
    return 16;
  }

  if (totalGames <= 5) {
    return 14;
  }

  if (totalGames <= 15) {
    return 12;
  }

  return 10;
};
