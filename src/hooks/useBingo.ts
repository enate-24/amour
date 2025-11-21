import { useState, useCallback } from 'react';

type BingoNumber = number | 'FREE';
type PatternName = 'singleLine' | 'twoLines' | 'threeLines' | 'fourLines' | 'fullHouse' | 'fourCorners' | 'xPattern' | 'blackout' | 'tPattern' | 'plusSign' | 'smallDiamond' | 'letterH' | 'letterU' | 'pyramid' | 'cross';

const useBingo = (cardSize = 5) => {
  const [calledNumbers, setCalledNumbers] = useState<Set<number>>(new Set());
  const [patterns] = useState<Record<PatternName, string | number[][]>>({
    singleLine: 'any_row_or_column',
    twoLines: 'two_rows_or_columns',
    threeLines: 'three_rows_or_columns',
    fourLines: 'four_rows_or_columns',
    fullHouse: 'all_cells',
    fourCorners: [[0,0], [0,4], [4,0], [4,4]],
    xPattern: 'both_diagonals',
    blackout: 'all_cells',
    tPattern: 'top_row_and_middle_column',
    plusSign: 'middle_row_and_middle_column',
    smallDiamond: [[0,2], [1,1], [1,3], [2,0], [2,4], [3,1], [3,3], [4,2]],
    letterH: [[0,0], [0,4], [1,0], [1,4], [2,0], [2,1], [2,2], [2,3], [2,4], [3,0], [3,4], [4,0], [4,4]],
    letterU: [[0,0], [0,4], [1,0], [1,4], [2,0], [2,4], [3,0], [3,4], [4,0], [4,1], [4,2], [4,3], [4,4]],
    pyramid: [[0,2], [1,1], [1,2], [1,3], [2,0], [2,1], [2,2], [2,3], [2,4], [3,1], [3,2], [3,3], [4,2]],
    cross: [[0,0], [0,4], [1,1], [1,3], [2,2], [3,1], [3,3], [4,0], [4,4]]
  });

  const checkPattern = useCallback((marked: boolean[][], pattern: string | number[][]): boolean => {
    const size = marked.length;

    // Helper function to check if four corners are marked
    const hasFourCorners = () => {
      return marked[0][0] && marked[0][size-1] && marked[size-1][0] && marked[size-1][size-1];
    };

    switch (pattern) {
      case 'any_row_or_column':
        // Check rows
        for (let row of marked) {
          if (row.every(cell => cell)) return true;
        }
        // Check columns
        for (let col = 0; col < size; col++) {
          if (marked.every(row => row[col])) return true;
        }
        // Check four corners as one line
        return hasFourCorners();

      case 'two_rows_or_columns':
        let lineCount = 0;

        // Check rows
        for (let row of marked) {
          if (row.every(cell => cell)) lineCount++;
        }
        // Check columns
        for (let col = 0; col < size; col++) {
          if (marked.every(row => row[col])) lineCount++;
        }
        // Check four corners as one line
        if (hasFourCorners()) lineCount++;

        return lineCount >= 2;

      case 'three_rows_or_columns':
        let threeLineCount = 0;

        // Check rows
        for (let row of marked) {
          if (row.every(cell => cell)) threeLineCount++;
        }
        // Check columns
        for (let col = 0; col < size; col++) {
          if (marked.every(row => row[col])) threeLineCount++;
        }
        // Check four corners as one line
        if (hasFourCorners()) threeLineCount++;

        return threeLineCount >= 3;

      case 'four_rows_or_columns':
        let fourLineCount = 0;

        // Check rows
        for (let row of marked) {
          if (row.every(cell => cell)) fourLineCount++;
        }
        // Check columns
        for (let col = 0; col < size; col++) {
          if (marked.every(row => row[col])) fourLineCount++;
        }
        // Check four corners as one line
        if (hasFourCorners()) fourLineCount++;

        return fourLineCount >= 4;

      case 'all_cells':
        return marked.every(row => row.every(cell => cell));

      case 'both_diagonals':
        const diag1 = marked.every((row, i) => row[i]);
        const diag2 = marked.every((row, i) => row[size - 1 - i]);
        return diag1 && diag2;

      case 'top_row_and_middle_column':
        const topRow = marked[0].every(cell => cell);
        const middleCol = marked.every(row => row[Math.floor(size/2)]);
        return topRow && middleCol;

      case 'middle_row_and_middle_column':
        const middleRow = marked[Math.floor(size/2)].every(cell => cell);
        const middleColumn = marked.every(row => row[Math.floor(size/2)]);
        return middleRow && middleColumn;

      default:
        // Custom pattern array
        if (Array.isArray(pattern)) {
          return pattern.every(([row, col]) => marked[row]?.[col]);
        }
        return false;
    }
  }, []);

  const checkWinner = useCallback((card: BingoNumber[][], patternType: PatternName): boolean => {
    const pattern = patterns[patternType];
    if (!pattern) return false;

    const marked = card.map((row: BingoNumber[]) =>
      row.map((cell: BingoNumber) => cell === 'FREE' || calledNumbers.has(cell as number))
    );

    return checkPattern(marked, pattern);
  }, [calledNumbers, patterns, checkPattern]);

  const callNumber = useCallback((number: number) => {
    setCalledNumbers(prev => new Set([...prev, number]));
  }, []);

  const resetGame = useCallback(() => {
    setCalledNumbers(new Set());
  }, []);

  const getPatternDescription = (patternKey: PatternName): string => {
    const descriptions = {
      singleLine: "Any complete row, column, or four corners",
      twoLines: "Any two complete rows, columns, or four corners",
      threeLines: "Any three complete rows, columns, or four corners",
      fourLines: "Any four complete rows, columns, or four corners",
      fullHouse: "All cells marked (including FREE space)",
      fourCorners: "All four corner cells",
      xPattern: "Both diagonals forming an X",
      blackout: "All cells marked (including FREE space)",
      tPattern: "Top row and middle column forming a T",
      plusSign: "Middle row and middle column forming a +",
      smallDiamond: "Diamond shape pattern",
      letterH: "Letter H pattern",
      letterU: "Letter U pattern",
      pyramid: "Pyramid shape pattern",
      cross: "Cross pattern (X with corners)"
    };
    return descriptions[patternKey] || patternKey;
  };

  return {
    calledNumbers,
    callNumber,
    resetGame,
    checkWinner,
    patterns: Object.keys(patterns),
    getPatternDescription
  };
};

export type { PatternName };
export default useBingo;
