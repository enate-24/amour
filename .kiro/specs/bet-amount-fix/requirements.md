# Requirements Document

## Introduction

This document specifies the requirements for fixing the bet amount storage issue in the bingo game system. Currently, the system is storing the total bet amount (number of cartelas × bet per cartela) instead of the individual bet amount per cartela, causing confusion when the bet amount appears to change automatically as cartelas are selected.

## Glossary

- **Bet Amount**: The amount of money wagered per cartela (individual card)
- **Total Bet**: The total amount wagered for all selected cartelas (bet amount × number of cartelas)
- **Cartela**: A bingo card used in the game
- **Game Session**: A single instance of a bingo game with selected cartelas and bet configuration
- **Backend**: The server-side API that handles game data storage and retrieval
- **Frontend**: The client-side application that displays game information to users

## Requirements

### Requirement 1

**User Story:** As a player, I want the system to correctly store and display my bet amount per cartela, so that I can see consistent betting information throughout the game.

#### Acceptance Criteria

1. WHEN a user creates a game session with a bet amount per cartela, THEN the Backend SHALL store the bet amount per cartela in the database
2. WHEN a user creates a game session with selected cartelas, THEN the Backend SHALL store the total bet amount separately from the bet amount per cartela
3. WHEN a user retrieves an active game, THEN the Backend SHALL return both the bet amount per cartela and the total bet amount
4. WHEN the Frontend displays game information, THEN the Frontend SHALL show the bet amount per cartela consistently
5. WHEN a user selects or deselects cartelas, THEN the Frontend SHALL recalculate the total bet without modifying the stored bet amount per cartela

### Requirement 2

**User Story:** As a developer, I want the database schema to clearly separate bet amount per cartela from total bet, so that the data model accurately represents the game's financial structure.

#### Acceptance Criteria

1. WHEN the database stores game data, THEN the database SHALL have a field for bet amount per cartela
2. WHEN the database stores game data, THEN the database SHALL have a field for total bet amount
3. WHEN game data is retrieved from the database, THEN both bet amount per cartela and total bet SHALL be available
4. WHEN existing games are migrated, THEN the system SHALL calculate bet amount per cartela from existing total bet and cartela count

### Requirement 3

**User Story:** As a player, I want to see accurate financial calculations in my game, so that I understand how much I'm betting and potentially winning.

#### Acceptance Criteria

1. WHEN the Frontend calculates total bet, THEN the calculation SHALL be bet amount per cartela multiplied by number of selected cartelas
2. WHEN the Frontend calculates house cut, THEN the calculation SHALL be based on the total bet amount
3. WHEN the Frontend calculates potential winnings, THEN the calculation SHALL be total bet minus house cut
4. WHEN game financial data is displayed, THEN all amounts SHALL be consistent with the stored bet amount per cartela
