"use strict";

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
            name: "Three Lines",
            positions: [], // This will be dynamically determined
            description: "Any three completed lines (various combinations)"
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
        
        // Get line completion info with current called numbers
        const { lines, completedLines } = countCompletedLines(grid, calledNumbers);
        
        // Debug logging for troubleshooting
        console.log('🔍 Grid:', grid);
        console.log('🔍 Lines completed:', lines, 'which are:', completedLines);
        console.log('🔍 FREE space (center):', grid[2][2]);
        // Check each selected pattern
        for (const patternName of patternsToCheck) {
            if (patternName === "Full House") {
                const fullHousePattern = patterns.find(p => p.name === "Full House");
                if (fullHousePattern && checkPattern(grid, calledNumbers, fullHousePattern.positions)) {
                    console.log('🏆 FULL HOUSE DETECTED!');
                    winningPatterns.push("Full House");
                }
                else {
                    console.log('❌ Full House not completed');
                }
            }
            else if (patternName === "Three Lines") {
                // Three Lines requires EXACTLY 3 or more lines
                if (lines >= 3) {
                    console.log(`🏆 THREE LINES DETECTED! (${lines} lines completed)`);
                    winningPatterns.push("Three Lines");
                }
                else {
                    console.log(`❌ Three Lines not completed (only ${lines} lines)`);
                }
            }
            else if (patternName === "Two Lines") {
                // Two Lines requires EXACTLY 2 or more lines
                if (lines >= 2) {
                    console.log(`🏆 TWO LINES DETECTED! (${lines} lines completed)`);
                    winningPatterns.push("Two Lines");
                }
                else {
                    console.log(`❌ Two Lines not completed (only ${lines} lines)`);
                }
            }
            else if (patternName === "One Line") {
                // One Line requires EXACTLY 1 or more lines
                if (lines >= 1) {
                    console.log(`🏆 ONE LINE DETECTED! (${lines} lines completed)`);
                    winningPatterns.push("One Line");
                }
                else {
                    console.log(`❌ One Line not completed (only ${lines} lines)`);
                }
            }
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
        if (!cartela || typeof cartela !== 'object') {
            console.error('❌ Validation failed: cartela is not an object');
            return false;
        }
        if (!cartela.card_id || typeof cartela.card_id !== 'string') {
            console.error('❌ Validation failed: card_id is missing or not a string', cartela.card_id);
            return false;
        }
        if (!cartela.numbers || typeof cartela.numbers !== 'object') {
            console.error('❌ Validation failed: numbers is missing or not an object');
            return false;
        }
        const columns = ['B', 'I', 'N', 'G', 'O'];
        for (const col of columns) {
            if (!Array.isArray(cartela.numbers[col])) {
                console.error(`❌ Validation failed: column ${col} is not an array`);
                return false;
            }
            if (cartela.numbers[col].length !== 5) {
                console.error(`❌ Validation failed: column ${col} length is ${cartela.numbers[col].length}, expected 5`);
                return false;
            }
            for (let i = 0; i < cartela.numbers[col].length; i++) {
                const num = cartela.numbers[col][i];
                // Allow 0 for FREE space in N column
                if (typeof num !== 'number') {
                    console.error(`❌ Validation failed: column ${col}[${i}] is not a number, got ${typeof num}: ${num}`);
                    return false;
                }
                if (isNaN(num)) {
                    console.error(`❌ Validation failed: column ${col}[${i}] is NaN`);
                    return false;
                }
                if (num < 0 || num > 75) {
                    console.error(`❌ Validation failed: column ${col}[${i}] is out of range (${num}), expected 0-75`);
                    return false;
                }
            }
        }
        console.log('✅ Cartela validation passed');
        return true;
    }
    catch (error) {
        console.error('Error validating cartela:', error);
        return false;
    }
}

// Export functions
module.exports = {
    convertCartelaToGrid,
    getWinningPatterns,
    checkWinningPatterns,
    getPatternDescription,
    validateCartela,
    isNumberCalled,
    checkPattern,
    countCompletedLines
};
