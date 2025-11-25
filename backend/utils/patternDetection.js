/**
 * Pattern Detection System for Bingo Game
 * Handles all pattern checking logic for winning conditions
 */

/**
 * Convert cartela data to a 5x5 grid format for pattern checking
 * @param {Object} cartela - Cartela with card_id and numbers in BINGO format
 * @returns {Array} 5x5 grid with null for FREE space
 */
function convertCartelaToGrid(cartela) {
  if (!cartela || !cartela.numbers) {
    throw new Error('Invalid cartela: missing numbers property');
  }

  const grid = [];
  const columns = ['B', 'I', 'N', 'G', 'O'];

  for (let row = 0; row < 5; row++) {
    grid[row] = [];
    for (let col = 0; col < 5; col++) {
      const column = columns[col];
      const columnData = cartela.numbers[column];

      if (!Array.isArray(columnData) || columnData.length !== 5) {
        throw new Error(`Invalid column ${column}: must be array of 5 numbers`);
      }

      const number = columnData[row];
      
      if (typeof number !== 'number' || isNaN(number)) {
        throw new Error(`Invalid number in ${column}[${row}]: ${number}`);
      }

      // Center square (N column, middle row) is FREE space
      grid[row][col] = (col === 2 && row === 2) ? null : number;
    }
  }

  return grid;
}

/**
 * Check if a number is called
 * @param {number|null} number - Number to check (null = FREE space)
 * @param {Array} calledNumbers - Array of called numbers
 * @returns {boolean} True if number is called or is FREE space
 */
function isNumberCalled(number, calledNumbers) {
  if (number === null) return true; // FREE space always counts
  return calledNumbers.includes(number);
}

/**
 * Check if a specific pattern is completed
 * @param {Array} grid - 5x5 grid
 * @param {Array} calledNumbers - Called numbers
 * @param {Array} positions - Array of [row, col] positions
 * @returns {boolean} True if all positions are called
 */
function checkPattern(grid, calledNumbers, positions) {
  for (const [row, col] of positions) {
    if (!isNumberCalled(grid[row][col], calledNumbers)) {
      return false;
    }
  }
  return true;
}

/**
 * Define all possible line patterns
 * Four Corners counts as 1 line
 * @returns {Array} Array of line pattern objects
 */
function getAllLinePatterns() {
  return [
    // Horizontal lines (5 rows)
    { name: "Top Row", positions: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { name: "Second Row", positions: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
    { name: "Third Row", positions: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: "Fourth Row", positions: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: "Bottom Row", positions: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] },

    // Vertical lines (5 columns)
    { name: "B Column", positions: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
    { name: "I Column", positions: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] },
    { name: "N Column", positions: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] },
    { name: "G Column", positions: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]] },
    { name: "O Column", positions: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },

    // Diagonal lines (2 diagonals)
    { name: "Main Diagonal", positions: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] },
    { name: "Anti Diagonal", positions: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]] },

    // Four Corners (counts as 1 line)
    { name: "Four Corners", positions: [[0, 0], [0, 4], [4, 0], [4, 4]] }
  ];
}

/**
 * Count how many lines are completed on the cartela
 * @param {Array} grid - 5x5 grid
 * @param {Array} calledNumbers - Called numbers
 * @returns {Object} Object with count and list of completed lines
 */
function countCompletedLines(grid, calledNumbers) {
  const linePatterns = getAllLinePatterns();
  const completedLines = [];

  for (const line of linePatterns) {
    if (checkPattern(grid, calledNumbers, line.positions)) {
      completedLines.push(line.name);
    }
  }

  return {
    count: completedLines.length,
    lines: completedLines
  };
}

/**
 * Check for Full House pattern (all 25 squares)
 * @param {Array} grid - 5x5 grid
 * @param {Array} calledNumbers - Called numbers
 * @returns {boolean} True if all numbers are called
 */
function checkFullHouse(grid, calledNumbers) {
  const fullHousePositions = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      fullHousePositions.push([row, col]);
    }
  }
  return checkPattern(grid, calledNumbers, fullHousePositions);
}

/**
 * Main function to check winning patterns
 * @param {Array} calledNumbers - Array of called numbers
 * @param {Object} cartela - Cartela object with card_id and numbers
 * @param {Array} selectedPatterns - Array of pattern names to check (e.g., ["One Line", "Two Lines"])
 * @returns {Array} Array of winning pattern names
 */
function checkWinningPatterns(calledNumbers, cartela, selectedPatterns) {
  try {
    console.log('🔍 === PATTERN CHECK START ===');
    console.log(`   Cartela ID: ${cartela.card_id}`);
    console.log(`   Called numbers: ${calledNumbers.length} numbers`);
    console.log(`   Patterns to check: ${JSON.stringify(selectedPatterns)}`);

    // Convert cartela to grid
    const grid = convertCartelaToGrid(cartela);

    // Count completed lines
    const { count: lineCount, lines: completedLines } = countCompletedLines(grid, calledNumbers);
    console.log(`   Completed lines: ${lineCount}`);
    console.log(`   Lines: ${completedLines.join(', ')}`);

    // Display grid state
    console.log('   Grid state:');
    for (let row = 0; row < 5; row++) {
      let rowStr = '   ';
      for (let col = 0; col < 5; col++) {
        const num = grid[row][col];
        const called = isNumberCalled(num, calledNumbers);
        const display = num === null ? 'FR' : String(num).padStart(2, '0');
        rowStr += called ? `[✓${display}] ` : `[ ${display}] `;
      }
      console.log(rowStr);
    }

    const winningPatterns = [];

    // Ensure selectedPatterns is an array
    if (!selectedPatterns || !Array.isArray(selectedPatterns)) {
      selectedPatterns = getWinningPatterns().map(p => p.name);
    }

    // Check each selected pattern
    for (const patternName of selectedPatterns) {
      console.log(`   Checking pattern: "${patternName}"`);

      switch (patternName) {
        case "Full House":
          if (checkFullHouse(grid, calledNumbers)) {
            console.log(`   ✅ FULL HOUSE WIN!`);
            winningPatterns.push("Full House");
          } else {
            console.log(`   ❌ Full House not complete`);
          }
          break;

        case "Three Lines":
          if (lineCount >= 3) {
            console.log(`   ✅ THREE LINES WIN! (${lineCount} lines)`);
            winningPatterns.push("Three Lines");
          } else {
            console.log(`   ❌ Three Lines not complete (need >= 3, have ${lineCount})`);
          }
          break;

        case "Two Lines":
          if (lineCount >= 2) {
            console.log(`   ✅ TWO LINES WIN! (${lineCount} lines)`);
            winningPatterns.push("Two Lines");
          } else {
            console.log(`   ❌ Two Lines not complete (need >= 2, have ${lineCount})`);
          }
          break;

        case "One Line":
          if (lineCount >= 1) {
            console.log(`   ✅ ONE LINE WIN! (${lineCount} lines)`);
            winningPatterns.push("One Line");
          } else {
            console.log(`   ❌ One Line not complete (need >= 1, have ${lineCount})`);
          }
          break;

        default:
          console.log(`   ⚠️ Unknown pattern: "${patternName}"`);
      }
    }

    console.log(`🔍 === PATTERN CHECK END ===`);
    console.log(`   Result: ${winningPatterns.length > 0 ? winningPatterns.join(', ') : 'NO WIN'}`);

    return winningPatterns;
  } catch (error) {
    console.error('❌ Error in checkWinningPatterns:', error);
    return [];
  }
}

/**
 * Get all available winning patterns with descriptions
 * @returns {Array} Array of pattern objects
 */
function getWinningPatterns() {
  return [
    {
      name: "One Line",
      description: "Complete any single line (horizontal, vertical, diagonal, or four corners)"
    },
    {
      name: "Two Lines",
      description: "Complete any two lines"
    },
    {
      name: "Three Lines",
      description: "Complete any three lines"
    },
    {
      name: "Full House",
      description: "Complete all 25 numbers on the card"
    }
  ];
}

/**
 * Get pattern description by name
 * @param {string} patternName - Name of the pattern
 * @returns {string} Description of the pattern
 */
function getPatternDescription(patternName) {
  const patterns = getWinningPatterns();
  const pattern = patterns.find(p => p.name === patternName);
  return pattern ? pattern.description : 'Unknown pattern';
}

/**
 * Validate cartela structure
 * @param {Object} cartela - Cartela to validate
 * @returns {boolean} True if valid
 */
function validateCartela(cartela) {
  try {
    if (!cartela || typeof cartela !== 'object') {
      console.error('❌ Cartela is not an object');
      return false;
    }

    if (!cartela.card_id || typeof cartela.card_id !== 'string') {
      console.error('❌ Missing or invalid card_id');
      return false;
    }

    if (!cartela.numbers || typeof cartela.numbers !== 'object') {
      console.error('❌ Missing or invalid numbers object');
      return false;
    }

    const columns = ['B', 'I', 'N', 'G', 'O'];
    for (const col of columns) {
      if (!Array.isArray(cartela.numbers[col])) {
        console.error(`❌ Column ${col} is not an array`);
        return false;
      }

      if (cartela.numbers[col].length !== 5) {
        console.error(`❌ Column ${col} has ${cartela.numbers[col].length} elements, expected 5`);
        return false;
      }

      for (let i = 0; i < 5; i++) {
        const num = cartela.numbers[col][i];
        if (typeof num !== 'number' || isNaN(num) || num < 0 || num > 75) {
          console.error(`❌ Invalid number in ${col}[${i}]: ${num}`);
          return false;
        }
      }
    }

    console.log('✅ Cartela validation passed');
    return true;
  } catch (error) {
    console.error('❌ Validation error:', error);
    return false;
  }
}

// Export all functions
module.exports = {
  convertCartelaToGrid,
  isNumberCalled,
  checkPattern,
  getAllLinePatterns,
  countCompletedLines,
  checkFullHouse,
  checkWinningPatterns,
  getWinningPatterns,
  getPatternDescription,
  validateCartela
};
