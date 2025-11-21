# User Settings System

## Overview
The system now saves user game settings (pattern, bet amount, house cut %) in the database. Settings persist until the user changes them.

## Features

### Available Patterns
1. **One Line** - A single completed line
2. **Two Lines** - Any two completed lines
3. **Three Lines** - Any three completed lines (NEW!)
4. **Full House** - All numbers marked

### Settings Stored
- **Selected Pattern**: The winning pattern for the game
- **Bet Amount**: Default bet money per cartela
- **House Cut Percentage**: Percentage taken by the house (0-100%)

## API Endpoints

### Get All Settings
```
GET /api/settings
Authorization: Bearer <token>

Response:
{
  "selectedPattern": "Two Lines",
  "betAmount": 10.0,
  "houseCutPercentage": 10.0,
  "availablePatterns": ["One Line", "Two Lines", "Three Lines", "Full House"]
}
```

### Get Pattern Setting Only
```
GET /api/settings/pattern
Authorization: Bearer <token>

Response:
{
  "selectedPattern": "Two Lines",
  "availablePatterns": ["One Line", "Two Lines", "Three Lines", "Full House"]
}
```

### Save Pattern Setting
```
POST /api/settings/pattern
Authorization: Bearer <token>
Content-Type: application/json

{
  "selectedPattern": "Three Lines"
}

Response:
{
  "success": true,
  "message": "Pattern setting saved successfully",
  "selectedPattern": "Three Lines"
}
```

### Save All Settings
```
POST /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "selectedPattern": "Three Lines",
  "betAmount": 20.0,
  "houseCutPercentage": 15.0
}

Response:
{
  "success": true,
  "message": "Settings saved successfully",
  "settings": {
    "selectedPattern": "Three Lines",
    "betAmount": 20.0,
    "houseCutPercentage": 15.0
  }
}
```

## Database Schema

### user_settings Table
```sql
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  selected_pattern VARCHAR(50) DEFAULT 'Two Lines',
  bet_amount DECIMAL(10,2) DEFAULT 10.0,
  house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## Usage

### Frontend Integration
The frontend should:
1. Load settings on page load using `GET /api/settings`
2. Save settings when user changes them using `POST /api/settings`
3. Use the saved settings as defaults for new games

### Default Behavior
- If a user has no settings, defaults are automatically created:
  - Pattern: "Two Lines"
  - Bet Amount: 10.0
  - House Cut: 10.0%

## Migration
Run the migration to create the table and populate defaults:
```bash
node backend/migrations/add-user-settings-table.js
```
