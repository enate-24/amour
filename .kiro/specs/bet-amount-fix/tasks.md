# Implementation Plan

- [x] 1. Add database field for bet amount per cartela


  - Create migration script to add `bet_amount_per_cartela` column to games table
  - Set column type to DECIMAL with appropriate precision
  - Add migration to calculate bet_amount_per_cartela for existing games (bet_money / cartelas_selected)
  - Handle edge case where cartelas_selected is 0
  - _Requirements: 2.1, 2.4_


- [x] 1.1 Write property test for migration calculation

  - **Property 3: Migration calculation accuracy**
  - **Validates: Requirements 2.4**

- [x] 2. Update backend API to store bet amount per cartela


  - Modify POST /games/session endpoint to accept and store betAmount in bet_amount_per_cartela field
  - Continue storing totalBet in bet_money field for backward compatibility
  - Add validation to ensure betAmount * selectedCartelas.length equals totalBet
  - _Requirements: 1.1, 1.2_

- [x] 2.1 Write property test for bet amount storage


  - **Property 1: Bet amount storage correctness**
  - **Validates: Requirements 1.1, 1.2**

- [x] 3. Update backend API to return bet amount per cartela


  - Modify GET /games/active endpoint to return bet_amount_per_cartela as betAmountPerCartela
  - Ensure both betAmountPerCartela and betMoney are included in response
  - Add fallback calculation if bet_amount_per_cartela is null (for old games)
  - _Requirements: 1.3, 2.3_

- [x] 3.1 Write property test for API response completeness


  - **Property 2: API response completeness**
  - **Validates: Requirements 1.3, 2.3**

- [x] 4. Update frontend to use bet amount per cartela


  - Modify GamePageOptimized.tsx to use betAmountPerCartela from API response
  - Update state management to store betAmountPerCartela separately from total bet
  - Ensure UI displays per-cartela amount consistently
  - _Requirements: 1.4_

- [x] 4.1 Write property test for frontend display consistency


  - **Property 7: Frontend display consistency**
  - **Validates: Requirements 1.4, 3.4**

- [x] 5. Update frontend financial calculations


  - Verify total bet calculation uses betAmountPerCartela * cartelasSelected
  - Verify house cut calculation uses total bet amount
  - Verify winnings calculation uses total bet - house cut
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5.1 Write property test for total bet calculation


  - **Property 4: Total bet calculation invariant**
  - **Validates: Requirements 3.1**

- [x] 5.2 Write property test for house cut calculation

  - **Property 5: House cut calculation correctness**
  - **Validates: Requirements 3.2**

- [x] 5.3 Write property test for winnings calculation

  - **Property 6: Winnings calculation correctness**
  - **Validates: Requirements 3.3**

- [x] 6. Run database migration


  - Execute migration script on development database
  - Verify all existing games have bet_amount_per_cartela populated
  - Check for any games with invalid data (cartelas_selected = 0)
  - _Requirements: 2.4_

- [x] 7. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Manual testing and verification


  - Create a new game with 5 cartelas at 10 Birr each
  - Verify database shows bet_amount_per_cartela = 10 and bet_money = 50
  - Verify frontend displays correct per-cartela amount
  - Verify total bet, house cut, and winnings calculations are correct
  - Test with various cartela counts (3, 10, 100, 1200)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_
