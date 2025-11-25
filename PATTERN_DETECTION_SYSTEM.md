# Pattern Detection System - Clean Implementation

## Overview
The pattern detection system has been completely rebuilt to be clean, reliable, and properly respect user-selected patterns.

## Key Features

### ✅ Clean Architecture
- Single responsibility functions
- Clear separation of concerns
- Comprehensive error handling
- Detailed logging for debugging

### ✅ Pattern Types Supported
1. **One Line** - Any single completed line (horizontal, vertical, diagonal, or four corners)
2. **Two Lines** - Any two completed lines
3. **Three Lines** - Any three completed lines
4. **Full House** - All 25 numbers on the card

### ✅ Line Types Detected (13 total)
- 5 Horizontal rows
- 5 Vertical columns (B, I, N, G, O)
- 2 Diagonal lines (main and anti-diagonal)
- 1 Four Corners pattern (counts as 1 line)

## How It Works

### 1. Grid Conversion
Converts BINGO format `{B: [], I: [], N: [], G: [], O: []}` to a 5x5 grid:
- Center square (N column, row 2) is always FREE (null)
- All other squares contain their number values

### 2. Line Counting
Counts all completed lines on the cartela:
- Checks all 13 possible line patterns (5 rows + 5 columns + 2 diagonals + 1 four corners)
- Four Corners pattern counts as 1 line
- Returns count and list of completed lines

### 3. Pattern Matching
Checks if the cartela wins based on user-selected pattern:
- **One Line**: Needs ≥ 1 completed line
- **Two Lines**: Needs ≥ 2 completed lines
- **Three Lines**: Needs ≥ 3 completed lines
- **Full House**: All 25 squares must be called

## Important Behavior

### Progressive Wins
If a cartela has 3 completed lines and you check for:
- "One Line" → ✅ WINS
- "Two Lines" → ✅ WINS
- "Three Lines" → ✅ WINS

This is correct! A cartela with 3 lines satisfies all three patterns.

### Pattern Selection Matters
The system ONLY checks the patterns you specify:
- If user selects "Three Lines", it ONLY checks for 3+ lines
- If user selects "One Line", it ONLY checks for 1+ line
- The game respects the user's choice

## Files

### Backend (JavaScript)
- `backend/utils/patternDetection.js` - Main pattern detection logic
- `backend/test-pattern-bug.js` - Bug reproduction test
- `backend/test-all-patterns.js` - Comprehensive test suite

### Frontend (TypeScript)
- `src/utils/patternDetection.ts` - TypeScript version with type safety

## Testing

Run the comprehensive test suite:
```bash
node backend/test-all-patterns.js
```

Run the bug reproduction test:
```bash
node backend/test-pattern-bug.js
```

## API Usage

### Backend (Node.js)
```javascript
const { checkWinningPatterns, validateCartela } = require('./utils/patternDetection');

const cartela = {
  card_id: "123",
  numbers: {
    B: [1, 2, 3, 4, 5],
    I: [16, 17, 18, 19, 20],
    N: [31, 32, 0, 34, 35],
    G: [46, 47, 48, 49, 50],
    O: [61, 62, 63, 64, 65]
  }
};

const calledNumbers = [1, 2, 3, 4, 5]; // Top row complete
const selectedPatterns = ["One Line"]; // User wants One Line

// Validate first
if (validateCartela(cartela)) {
  // Check for wins
  const wins = checkWinningPatterns(calledNumbers, cartela, selectedPatterns);
  console.log('Winning patterns:', wins); // ["One Line"]
}
```

### Frontend (TypeScript)
```typescript
import { checkWinningPatterns, validateCartela, CartelaData } from './utils/patternDetection';

const cartela: CartelaData = {
  card_id: "123",
  numbers: {
    B: [1, 2, 3, 4, 5],
    I: [16, 17, 18, 19, 20],
    N: [31, 32, 0, 34, 35],
    G: [46, 47, 48, 49, 50],
    O: [61, 62, 63, 64, 65]
  }
};

const calledNumbers = [1, 2, 3, 4, 5];
const selectedPatterns = ["One Line"];

if (validateCartela(cartela)) {
  const wins = checkWinningPatterns(calledNumbers, cartela, selectedPatterns);
  console.log('Winning patterns:', wins);
}
```

## Debugging

The system includes comprehensive logging:
- Grid state visualization
- Line completion status
- Pattern check results
- Win/loss reasons

All logs are prefixed with emojis for easy scanning:
- 🔍 Pattern check info
- ✅ Success/validation
- ❌ Failure/error
- 🏆 Win detected
- 📊 Statistics

## Migration Notes

### What Changed
1. **Cleaner code structure** - Removed redundant logic
2. **Better naming** - `count` instead of `lines` for line count
3. **Consistent behavior** - Always respects selected patterns
4. **Better logging** - More detailed debug information
5. **Type safety** - Full TypeScript support

### Breaking Changes
None! The API remains the same:
- `checkWinningPatterns(calledNumbers, cartela, selectedPatterns)`
- `validateCartela(cartela)`
- `convertCartelaToGrid(cartela)`

## Common Issues

### Issue: "System always checks Two Lines"
**Solution**: Make sure you're passing the correct `selectedPatterns` array to `checkWinningPatterns()`. The third parameter is required!

### Issue: "Cartela validation fails"
**Solution**: Ensure cartela has correct structure:
- `card_id` must be a string
- `numbers` must have B, I, N, G, O arrays
- Each array must have exactly 5 numbers
- All numbers must be 0-75

### Issue: "FREE space not working"
**Solution**: The center square (N column, position 2) should be 0 in the data. The system automatically converts it to null (FREE space).

## Performance

- Grid conversion: O(25) - constant time
- Line counting: O(13 × 5) = O(65) - constant time
- Pattern checking: O(patterns × 25) - linear in pattern count
- Overall: Very fast, suitable for real-time checking

## Future Enhancements

Possible additions:
- Custom pattern shapes (X, T, L, etc.)
- Pattern difficulty scoring
- Win probability calculation
- Pattern visualization
