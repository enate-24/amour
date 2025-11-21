"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCartelaToGrid = convertCartelaToGrid;
exports.getWinningPatterns = getWinningPatterns;
exports.checkWinningPatterns = checkWinningPatterns;
exports.getPatternDescription = getPatternDescription;
exports.validateCartela = validateCartela;
/**
 * Convert cartela data to a 5x5 grid format for pattern checking
 */
function convertCartelaToGrid(cartela) {
    // Validate cartela structure
    if (!cartela || !cartela.numbers) {
        throw new Error('Invalid cartela data: missing numbers property');
    }
    const grid = [];
    const columns = ['B', 'I', 'N', 'G', 'O'];
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
function isNumberCalled(number, calledNumbers) {
    if (number === null)
        return true; // FREE space is always considered called
    return calledNumbers.includes(number);
}
/**
 * Check for a specific winning pattern on the cartela
 */
function checkPattern(grid, calledNumbers, pattern) {
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
function getWinningPatterns() {
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
                [4, 0], [4, 1], [4, 2], [4, 3], [4, 4] // Bottom row
            ],
            description: "Every single number on the ticket is marked - The classic BINGO! win"
        }
    ];
}
/**
 * Check if a specific line pattern is completed
 */
function isLineCompleted(grid, calledNumbers, positions) {
    return checkPattern(grid, calledNumbers, positions);
}
/**
 * Count completed lines on the cartela
 */
function countCompletedLines(grid, calledNumbers) {
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
    const completedLines = [];
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
function checkWinningPatterns(calledNumbers, cartela, selectedPatterns) {
    try {
        console.log('🔍 CHECKING PATTERNS for cartela:', cartela.card_id);
        console.log('🔍 Called numbers:', calledNumbers);
        console.log('🔍 Selected patterns:', selectedPatterns);
        const grid = convertCartelaToGrid(cartela);
        const patterns = getWinningPatterns();
        const patternsToCheck = selectedPatterns || patterns.map(p => p.name);
        const winningPatterns = [];
        // Get line completion info
        const { lines, completedLines } = countCompletedLines(grid, calledNumbers);
        // Debug logging for troubleshooting
        console.log('🔍 Grid:', grid);
        console.log('🔍 Lines completed:', lines, 'which are:', completedLines);
        console.log('🔍 FREE space (center):', grid[2][2]);
        // Show visual representation of grid
        console.log('🔍 Visual grid:');
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
            const fullHousePattern = patterns.find(p => p.name === "Full House");
            if (fullHousePattern && checkPattern(grid, calledNumbers, fullHousePattern.positions)) {
                console.log('🏆 FULL HOUSE DETECTED!');
                winningPatterns.push("Full House");
                return winningPatterns; // Full House wins immediately
            }
            else {
                console.log('❌ Full House not completed');
            }
        }
        // Check Two Lines
        if (patternsToCheck.includes("Two Lines") && lines >= 2) {
            console.log('🏆 TWO LINES DETECTED! (lines >= 2):', lines);
            winningPatterns.push("Two Lines");
        }
        // Check One Line (only if Two Lines not already won)
        if (patternsToCheck.includes("One Line") && lines >= 1 && !winningPatterns.includes("Two Lines")) {
            console.log('🏆 ONE LINE DETECTED! (lines >= 1):', lines);
            winningPatterns.push("One Line");
        }
        if (winningPatterns.length === 0) {
            console.log('❌ No winning patterns detected');
        }
        return winningPatterns;
    }
    catch (error) {
        console.error('Error checking winning patterns:', error);
        return [];
    }
}
/**
 * Get pattern description by name
 */
function getPatternDescription(patternName) {
    const patterns = getWinningPatterns();
    const pattern = patterns.find(p => p.name === patternName);
    return pattern ? pattern.description : 'Unknown pattern';
}
/**
 * Validate if a cartela has valid structure
 */
function validateCartela(cartela) {
    try {
        if (!cartela || typeof cartela !== 'object')
            return false;
        if (!cartela.card_id || typeof cartela.card_id !== 'string')
            return false;
        if (!cartela.numbers || typeof cartela.numbers !== 'object')
            return false;
        const columns = ['B', 'I', 'N', 'G', 'O'];
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const col = columns[colIndex];
      if (!Array.isArray(cartela.numbers[col]) || cartela.numbers[col].length !== 5) {
        return false;
      }
      for (let row = 0; row < cartela.numbers[col].length; row++) {
        const num = cartela.numbers[col][row];
        // Allow 0 only for center square (N column index 2, middle row index 2)
        const allowZero = colIndex === 2 && row === 2;
        if (typeof num !== 'number' || (!allowZero && (num < 1 || num > 75)) || (allowZero && (num < 0 || num > 75))) {
          return false;
        }
      }
    }
        return true;
    }
    catch (error) {
        console.error('Error validating cartela:', error);
        return false;
    }
}
