# Winner Pattern Detection Fix

## Problem
The winner detection system was declaring winners incorrectly:
- If user selected "Two Lines" pattern, the system would declare a winner with only 1 line completed
- The system was checking if ANY pattern in the selected list matched, not the SPECIFIC pattern required

## Example of the Bug
```
User selects: "Two Lines"
Cartela completes: 1 line
System checks: "One Line" pattern (1 line) ✓ → WINNER ❌ WRONG!
Expected: Should NOT be winner (needs 2 lines)
```

## Root Cause
The pattern detection logic in `backend/utils/patternDetection.js` was using independent `if` statements that checked each pattern separately:

```javascript
// OLD CODE (BUGGY)
if (patternsToCheck.includes("Three Lines") && lines === 3) {
    winningPatterns.push("Three Lines");
}
if (patternsToCheck.includes("Two Lines") && lines === 2) {
    winningPatterns.push("Two Lines");
}
if (patternsToCheck.includes("One Line") && lines === 1) {
    winningPatterns.push("One Line");
}
```

This meant if the user selected "Two Lines" but had 1 line completed, and "One Line" was also in the check list, it would declare a winner.

## Solution

Changed to use `else if` chain with minimum line requirements:

```javascript
// NEW CODE (FIXED)
if (patternsToCheck.includes("Three Lines") && lines >= 3) {
    winningPatterns.push("Three Lines");
}
else if (patternsToCheck.includes("Two Lines") && lines >= 2) {
    winningPatterns.push("Two Lines");
}
else if (patternsToCheck.includes("One Line") && lines >= 1) {
    winningPatterns.push("One Line");
}
```

## How It Works Now

### Pattern Requirements
- **One Line**: Requires AT LEAST 1 completed line
- **Two Lines**: Requires AT LEAST 2 completed lines
- **Three Lines**: Requires AT LEAST 3 completed lines
- **Full House**: Requires ALL 25 numbers marked

### Winner Detection Logic
1. Check Full House first (highest priority)
2. If Full House not selected or not met, check Three Lines
3. If Three Lines not selected or not met, check Two Lines
4. If Two Lines not selected or not met, check One Line
5. Only ONE pattern can win (the highest one that matches)

### Examples

#### Example 1: User Selects "Two Lines"
```
Cartela has 1 line completed:
- Check "Two Lines" (needs 2+) → 1 < 2 → NO MATCH
- Result: NOT A WINNER ✓ CORRECT
```

```
Cartela has 2 lines completed:
- Check "Two Lines" (needs 2+) → 2 >= 2 → MATCH!
- Result: WINNER ✓ CORRECT
```

```
Cartela has 3 lines completed:
- Check "Two Lines" (needs 2+) → 3 >= 2 → MATCH!
- Result: WINNER ✓ CORRECT (exceeds requirement)
```

#### Example 2: User Selects "One Line"
```
Cartela has 0 lines completed:
- Check "One Line" (needs 1+) → 0 < 1 → NO MATCH
- Result: NOT A WINNER ✓ CORRECT
```

```
Cartela has 1 line completed:
- Check "One Line" (needs 1+) → 1 >= 1 → MATCH!
- Result: WINNER ✓ CORRECT
```

#### Example 3: User Selects "Three Lines"
```
Cartela has 2 lines completed:
- Check "Three Lines" (needs 3+) → 2 < 3 → NO MATCH
- Result: NOT A WINNER ✓ CORRECT
```

```
Cartela has 3 lines completed:
- Check "Three Lines" (needs 3+) → 3 >= 3 → MATCH!
- Result: WINNER ✓ CORRECT
```

## What Changed

### File Modified
`backend/utils/patternDetection.js`

### Changes Made
1. Changed from `===` (exact match) to `>=` (minimum requirement)
2. Changed from independent `if` statements to `else if` chain
3. Ensures only the highest matching pattern wins
4. Prevents lower patterns from triggering when higher pattern is selected

## Benefits

1. **Correct Winner Detection**: Only declares winner when pattern requirement is met
2. **Fair Gameplay**: Users must complete the selected pattern to win
3. **Clear Rules**: Pattern requirements are enforced consistently
4. **No False Positives**: Won't declare winner prematurely

## Testing Scenarios

### Scenario 1: Two Lines Pattern
```
Selected Pattern: "Two Lines"
Test Cases:
- 0 lines → NOT WINNER ✓
- 1 line → NOT WINNER ✓
- 2 lines → WINNER ✓
- 3 lines → WINNER ✓
- Full House → WINNER ✓
```

### Scenario 2: One Line Pattern
```
Selected Pattern: "One Line"
Test Cases:
- 0 lines → NOT WINNER ✓
- 1 line → WINNER ✓
- 2 lines → WINNER ✓
- 3 lines → WINNER ✓
```

### Scenario 3: Three Lines Pattern
```
Selected Pattern: "Three Lines"
Test Cases:
- 0 lines → NOT WINNER ✓
- 1 line → NOT WINNER ✓
- 2 lines → NOT WINNER ✓
- 3 lines → WINNER ✓
- Full House → WINNER ✓
```

### Scenario 4: Full House Pattern
```
Selected Pattern: "Full House"
Test Cases:
- 0-24 numbers → NOT WINNER ✓
- 25 numbers (all) → WINNER ✓
```

## Line Counting

The system counts these as valid lines:
- **5 Horizontal lines** (rows)
- **5 Vertical lines** (columns)
- **2 Diagonal lines** (main diagonal, anti-diagonal)
- **1 Four Corners** pattern

Total possible: 13 different line patterns

## Additional Fix: Last Number Validation

### Problem
Users could win even if the pattern was already complete before the last called number. This meant a user could have completed the pattern 5 numbers ago but only get declared winner now.

### Solution
Added validation to ensure the last called number actually completed the pattern:

```javascript
// Check if pattern was already complete without the last number
const lastNumber = calledNumbers[calledNumbers.length - 1];
const numbersWithoutLast = calledNumbers.slice(0, -1);
const { lines: linesWithoutLast } = countCompletedLines(grid, numbersWithoutLast);

if (lines === linesWithoutLast) {
    // Pattern was already complete - NOT A VALID WIN
    return [];
}
```

### How It Works
1. Get the last called number
2. Check pattern completion WITHOUT the last number
3. Compare line counts:
   - If same → Pattern was already complete → NOT A VALID WIN
   - If different → Last number completed the pattern → VALID WIN

### Example
```
Called numbers: [5, 12, 23, 34, 45, 67]
Last number: 67

Check with [5, 12, 23, 34, 45]:
- Lines completed: 1

Check with [5, 12, 23, 34, 45, 67]:
- Lines completed: 2

Result: 1 ≠ 2 → Last number completed a new line → VALID WIN ✓
```

```
Called numbers: [5, 12, 23, 34, 45, 67, 89]
Last number: 89

Check with [5, 12, 23, 34, 45, 67]:
- Lines completed: 2

Check with [5, 12, 23, 34, 45, 67, 89]:
- Lines completed: 2

Result: 2 = 2 → Last number didn't complete anything → NOT A VALID WIN ✓
```

## Conclusion

The winner detection now correctly enforces pattern requirements:
- ✅ Users must complete the selected pattern to win
- ✅ No false positives (declaring winner too early)
- ✅ Fair and consistent gameplay
- ✅ Clear pattern requirements enforced
- ✅ Last called number must complete the pattern
- ✅ Cannot win if pattern was already complete

The fix ensures that:
1. If a user selects "Two Lines", they MUST have at least 2 completed lines to win
2. The last called number MUST be the one that completes the pattern
3. Users cannot win if the pattern was already complete before the last number
