# Design Document

## Overview

This design addresses the bet amount storage issue where the system currently stores total bet instead of bet amount per cartela. The fix involves adding a new database field, updating the API to handle both values, and ensuring the frontend correctly displays and calculates bet amounts.

## Architecture

The solution follows a three-tier architecture:

1. **Database Layer**: Add `bet_amount_per_cartela` field to the `games` table
2. **API Layer**: Update game creation and retrieval endpoints to handle both bet amounts
3. **Frontend Layer**: Update components to use the correct bet amount field

### Data Flow

```
Frontend (NewGame) → API (/games/session) → Database (games table)
                     ↓
              Store both:
              - bet_amount_per_cartela (new)
              - bet_money (total bet)
                     ↓
Frontend (GamePage) ← API (/games/active) ← Database
                     ↓
              Display bet_amount_per_cartela
```

## Components and Interfaces

### Database Schema Changes

Add new column to `games` table:
- `bet_amount_per_cartela` (DECIMAL): The bet amount per individual cartela

The existing `bet_money` field will continue to store the total bet amount.

### API Endpoints

#### POST /games/session
**Request Body:**
```typescript
{
  selectedCartelas: string[],
  betAmount: number,           // Per cartela
  housePercentage: number,
  totalBet: number,            // Calculated: betAmount * selectedCartelas.length
  houseCut: number,
  playerWin: number
}
```

**Changes:**
- Store `betAmount` in `bet_amount_per_cartela` field
- Store `totalBet` in `bet_money` field (existing behavior)

#### GET /games/active
**Response:**
```typescript
{
  game: {
    id: string,
    betMoney: number,                    // Total bet
    betAmountPerCartela: number,         // NEW: Per cartela amount
    cartelasSelected: number,
    // ... other fields
  }
}
```

**Changes:**
- Return `bet_amount_per_cartela` as `betAmountPerCartela`
- Maintain backward compatibility with `betMoney` (total bet)

### Frontend Components

#### NewGame.tsx
**Changes:**
- Continue sending `betAmount` (per cartela) in the request
- No changes needed to component logic

#### GamePageOptimized.tsx
**Changes:**
- Use `betAmountPerCartela` from API response instead of calculating from `betMoney`
- Display per-cartela amount in UI

## Data Models

### Game Model (Database)

```typescript
interface Game {
  id: string;
  game_number: number;
  status: string;
  bet_money: number;                    // Total bet
  bet_amount_per_cartela: number;       // NEW: Per cartela bet
  win_money: number;
  cartelas_selected: number;
  selected_cartelas: string;            // JSON array
  called_numbers: string;               // JSON array
  number_sequence: string;              // JSON array
  total_numbers: number;
  winner_pattern: string;
  house_cut_percentage: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}
```

### Game Model (API Response)

```typescript
interface GameResponse {
  id: string;
  gameNumber: number;
  status: string;
  betMoney: number;                     // Total bet
  betAmountPerCartela: number;          // NEW: Per cartela bet
  winMoney: number;
  cartelasSelected: number;
  selectedCartelas: string[];
  calledNumbers: number[];
  totalNumbers: number;
  winnerPattern: string;
  houseCutPercentage: number;
  createdAt: string;
  updatedAt: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bet amount storage correctness
*For any* game session created with a bet amount per cartela B and N selected cartelas (where N ≥ 3), the database should store bet_amount_per_cartela = B and bet_money = B × N
**Validates: Requirements 1.1, 1.2**

### Property 2: API response completeness
*For any* active game retrieved from the database, the API response should contain both betAmountPerCartela and betMoney fields, and betAmountPerCartela × cartelasSelected should equal betMoney
**Validates: Requirements 1.3, 2.3**

### Property 3: Migration calculation accuracy
*For any* existing game with bet_money M and cartelas_selected N (where N > 0), after migration the bet_amount_per_cartela should equal M / N
**Validates: Requirements 2.4**

### Property 4: Total bet calculation invariant
*For any* bet amount per cartela B and number of selected cartelas N, the calculated total bet should always equal B × N
**Validates: Requirements 3.1**

### Property 5: House cut calculation correctness
*For any* total bet T and house percentage H (where 0 ≤ H ≤ 50), the house cut should equal (T × H) / 100
**Validates: Requirements 3.2**

### Property 6: Winnings calculation correctness
*For any* total bet T and house cut C, the potential winnings should equal T - C
**Validates: Requirements 3.3**

### Property 7: Frontend display consistency
*For any* game displayed in the frontend, the displayed bet amount should match the betAmountPerCartela value from the API, not a calculated value from betMoney / cartelasSelected
**Validates: Requirements 1.4, 3.4**

## Error Handling

### Migration Errors
- If existing games have `bet_money` but no `bet_amount_per_cartela`, calculate it as `bet_money / cartelas_selected`
- Handle division by zero: if `cartelas_selected` is 0, set `bet_amount_per_cartela` to 0 or a default value

### API Errors
- Validate that `betAmount` is positive before storing
- Validate that `totalBet` equals `betAmount * selectedCartelas.length`
- Return 400 Bad Request if validation fails

### Frontend Errors
- If `betAmountPerCartela` is missing from API response, fall back to calculating from `betMoney / cartelasSelected`
- Display error message if bet amount cannot be determined

## Testing Strategy

### Unit Tests
- Test database migration script with various game states
- Test API endpoint validation for bet amounts
- Test frontend calculation of total bet from per-cartela amount

### Property-Based Tests
We will use **fast-check** (JavaScript/TypeScript property-based testing library) for property-based testing. Each property-based test should run a minimum of 100 iterations.

Property-based tests will be tagged with comments in this format:
`// Feature: bet-amount-fix, Property {number}: {property_text}`

Each correctness property will be implemented as a single property-based test.

### Integration Tests
- Test complete flow: create game → retrieve game → verify bet amounts
- Test with various numbers of cartelas (3, 10, 100, 1200)
- Test with various bet amounts (5, 10, 50, 100)

### Manual Testing
- Create a game with 5 cartelas at 10 Birr each
- Verify database shows bet_amount_per_cartela = 10 and bet_money = 50
- Verify frontend displays "Bet: 10 Birr per cartela"
- Verify total bet calculation shows 50 Birr
