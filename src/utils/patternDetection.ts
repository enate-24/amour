export interface CartelaData {
  card_id: string;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
}

export interface WinningPattern {
  name: string;
  positions: number[][];
  description: string;
}

/**
 * Convert cartela data to a 5x5 grid format for pattern checking
 */
export function convertCartelaToGrid(cartela: CartelaData): (number | null)[][] {
  // Validate cartela structure
  if (!cartela || !cartela.numbers) {
    throw new Error('Invalid cartela data: missing numbers property');
  }

  const grid: (number | null)[][] = [];
  const columns: (keyof CartelaData['numbers'])[] = ['B', 'I', 'N', 'G', 'O'];

  for (let row = 0; row < 5; row++) {
    grid[row] = [];
    for (let col = 0; col < 5; col++) {
      const column = columns[col];
      const columnData = cartela.numbers[column];

      // Validate column exists and is an array
      if (!Array.isArray(columnData)) {
        throw new Error(`Invalid cartela data: column ${column} is not an array`);
      }

      // Validate column has enough elements
      if (columnData.length < 5) {
        throw new Error(`Invalid cartela data: column ${column} has insufficient data (${columnData.length} elements)`);
      }

      const number = columnData[row];

      // Validate number is a valid number
      if (typeof number !== 'number' || isNaN(number)) {
        throw new Error(`Invalid cartela data: invalid number in column ${column}, row ${row}: ${number}`);
      }

      // Center square (N column, middle row) is always FREE
      grid[row][col] = (col === 2 && row === 2) ? null : number;
    }
  }

  return grid;
}

/**
 * Check if a number is called (exists in the called numbers array)
 */
function isNumberCalled(number: number | null, calledNumbers: number[]): boolean {
  if (number === null) return true; // FREE space is always considered called
  return calledNumbers.includes(number);
}

/**
 * Check for a specific winning pattern on the cartela
 */
function checkPattern(
  grid: (number | null)[][],
  calledNumbers: number[],
  pattern: number[][]
): boolean {
  for (const [row, col] of pattern) {
    if (!isNumberCalled(grid[row][col], calledNumbers)) {
      return false;
    }
  }
  return true;
}

/**
 * Get all available winning patterns
 */
export function getWinningPatterns(): WinningPattern[] {
  return [
    {
      name: "One Line",
      positions: [], // This will be dynamically determined
      description: "A single horizontal, vertical, or diagonal line OR Four Corners pattern"
    },
    {
      name: "Two Lines",
      positions: [], // This will be dynamically determined
      description: "Any two completed lines (various combinations)"
    },
    {
      name: "Full House",
      positions: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], // Top row
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], // Second row
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], // Third row
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], // Fourth row
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]  // Bottom row
      ],
      description: "Every single number on the ticket is marked - The classic BINGO! win"
    }
  ];
}

/**
 * Check if a specific line pattern is completed
 */
function isLineCompleted(grid: (number | null)[][], calledNumbers: number[], positions: number[][]): boolean {
  return checkPattern(grid, calledNumbers, positions);
}

/**
 * Count completed lines on the cartela
 */
function countCompletedLines(grid: (number | null)[][], calledNumbers: number[]): {
  lines: number;
  completedLines: string[];
} {
  const linePatterns = [
    // Horizontal lines
    { name: "Top Row", positions: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { name: "Second Row", positions: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
    { name: "Third Row", positions: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: "Fourth Row", positions: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: "Bottom Row", positions: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] },

    // Vertical lines
    { name: "Left Column", positions: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
    { name: "Second Column", positions: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] },
    { name: "Middle Column", positions: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] },
    { name: "Fourth Column", positions: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]] },
    { name: "Right Column", positions: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },

    // Diagonal lines
    { name: "Main Diagonal", positions: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] },
    { name: "Anti Diagonal", positions: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]] },

    // Four Corners
    { name: "Four Corners", positions: [[0, 0], [0, 4], [4, 0], [4, 4]] }
  ];

  const completedLines: string[] = [];

  for (const line of linePatterns) {
    if (isLineCompleted(grid, calledNumbers, line.positions)) {
      completedLines.push(line.name);
    }
  }

  return {
    lines: completedLines.length,
    completedLines
  };
}

/**
 * Check for winning patterns on a cartela
 */
export function checkWinningPatterns(
  calledNumbers: number[],
  cartela: CartelaData,
  selectedPatterns?: string[]
): string[] {
  try {
    console.log('🔍 CHECKING PATTERNS for cartela:', cartela.card_id);
    console.log('🔍 Called numbers count:', calledNumbers.length, 'numbers:', calledNumbers);
    console.log('🔍 Selected patterns to check:', selectedPatterns);

    const grid = convertCartelaToGrid(cartela);
    const patterns = getWinningPatterns();
    const patternsToCheck = selectedPatterns || patterns.map(p => p.name);
    const winningPatterns: string[] = [];

    // Get line completion info
    const { lines, completedLines } = countCompletedLines(grid, calledNumbers);

    console.log('🔍 COMPLETED LINES INFO:');
    console.log('  - Total completed lines:', lines);
    console.log('  - Individual completed lines:', completedLines);
    console.log('🔍 Patterns user wants to check for:', patternsToCheck);

    // Show visual representation of grid
    console.log('🔍 CARTELA GRID STATE:');
    for (let row = 0; row < 5; row++) {
      let rowStr = '';
      for (let col = 0; col < 5; col++) {
        const num = grid[row][col];
        const isCalled = isNumberCalled(num, calledNumbers);
        const displayNum = num === null ? 'FR' : num;
        rowStr += isCalled ? `[✓${displayNum}]` : `[✗${displayNum}]`;
      }
      console.log('  ' + rowStr);
    }

    // Check Full House first (highest priority)
    if (patternsToCheck.includes("Full House")) {
      console.log('🔄 Checking Full House...');
      const fullHousePattern = patterns.find(p => p.name === "Full House");
      if (fullHousePattern) {
        const fullHouseCompleted = checkPattern(grid, calledNumbers, fullHousePattern.positions);
        console.log('  - Full House completed?', fullHouseCompleted ? 'YES!' : 'No');
        if (fullHouseCompleted) {
          console.log('🏆 FULL HOUSE WIN DETECTED!');
          winningPatterns.push("Full House");
          return winningPatterns; // Full House wins immediately
        }
      }
    } else {
      console.log('⏭️  Full House not in patterns to check - skipping');
    }

    // Check Two Lines
    if (patternsToCheck.includes("Two Lines")) {
      console.log('🔄 Checking Two Lines...', lines >= 2 ? 'YES!' : 'No (need >=2 lines)');
      if (lines >= 2) {
        console.log('🏆 TWO LINES WIN DETECTED! (completed lines:', lines, ')');
        winningPatterns.push("Two Lines");
        // Keep checking for Full House if it wasn't checked yet
      }
    } else {
      console.log('⏭️  Two Lines not in patterns to check - skipping');
    }

    // Check One Line (only if Two Lines not already won)
    if (patternsToCheck.includes("One Line") && !winningPatterns.includes("Two Lines")) {
      console.log('🔄 Checking One Line...', lines >= 1 ? 'YES!' : 'No (need >=1 line)');
      if (lines >= 1) {
        console.log('🏆 ONE LINE WIN DETECTED! (completed lines:', lines, ')');
        winningPatterns.push("One Line");
      }
    } else if (!patternsToCheck.includes("One Line")) {
      console.log('⏭️  One Line not in patterns to check - skipping');
    }

    console.log('🔍 FINAL RESULT: Winning patterns detected:', winningPatterns.length > 0 ? winningPatterns : 'NONE');

    return winningPatterns;
  } catch (error) {
    console.error('Error checking winning patterns:', error);
    return [];
  }
}

/**
 * Get pattern description by name
 */
export function getPatternDescription(patternName: string): string {
  const patterns = getWinningPatterns();
  const pattern = patterns.find(p => p.name === patternName);
  return pattern ? pattern.description : 'Unknown pattern';
}

/**
 * Validate if a cartela has valid structure
 */
export function validateCartela(cartela: any): boolean {
  try {
    if (!cartela || typeof cartela !== 'object') return false;
    if (!cartela.card_id || typeof cartela.card_id !== 'string') return false;
    if (!cartela.numbers || typeof cartela.numbers !== 'object') return false;

    const columns = ['B', 'I', 'N', 'G', 'O'];
    for (const col of columns) {
      if (!Array.isArray(cartela.numbers[col]) || cartela.numbers[col].length !== 5) {
        return false;
      }
      for (const num of cartela.numbers[col]) {
        // Allow 0 for FREE space in N column
        if (typeof num !== 'number' || isNaN(num) || (num < 0 || num > 75)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating cartela:', error);
    return false;
  }
}
