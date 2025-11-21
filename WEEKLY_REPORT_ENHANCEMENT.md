# Weekly Report Enhancement - Implementation Summary

## Overview
Enhanced the backoffice weekly report page to show comprehensive user statistics with two reporting periods:
1. **Weekly Report** - Monday to Sunday of the current week
2. **15-Day Report** - Last 15 days from today

## Features Implemented

### 1. Period Selection
- **Weekly Report**: Automatically calculates Monday-Sunday range for the current week
- **15-Day Report**: Shows data from the last 15 days
- Toggle buttons to switch between periods
- Date range displayed in the header

### 2. Enhanced Statistics

#### Summary Cards (5 cards):
1. **Total Users** - All users with active count
2. **Total Games** - Number of games played in the period
3. **Total Bet** - Sum of all bets placed
4. **Player Wins** - Total winnings paid out
5. **House Profit** - Net profit (Total Bet - Player Wins)

#### User Table Columns:
- **#** - Row number
- **Username** - User display name with avatar
- **Email** - User email address
- **Shop Name** - Shop/location name (if applicable)
- **Games** - Number of games played
- **Cartelas** - Number of cartelas used
- **Total Bet** - Sum of all bets
- **Player Win** - Total winnings
- **House Profit** - Net profit per user

### 3. Data Features
- **Sorting**: Users sorted by total bet (highest first)
- **Color Coding**: 
  - Active values in bright colors
  - Zero values in muted gray
  - Negative house profit in red
- **Totals Row**: Footer showing sum of all columns
- **Privacy Toggle**: Show/hide monetary amounts
- **Export**: Download report as CSV file

## Backend Changes

### File: `backend/routes/admin.js`

#### New Helper Function
```javascript
const getMondayOfWeek = (date) => {
  // Calculates Monday of the current week
  // Handles Sunday correctly (treats as end of week)
}
```

#### Enhanced Endpoint
- **Endpoint**: `GET /api/admin/weekly-report`
- **Query Parameters**: 
  - `period` - 'week' (default) or '15days'

#### Response Structure
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "shopname": "string | null",
      "periodTotalBet": 0,
      "periodPlayerWin": 0,
      "periodHouseProfit": 0,
      "periodGamesPlayed": 0,
      "periodCartelasPlayed": 0
    }
  ],
  "summary": {
    "totalUsers": 0,
    "activeUsersPeriod": 0,
    "totalBetPeriod": 0,
    "totalPlayerWinPeriod": 0,
    "totalHouseProfitPeriod": 0,
    "totalGamesPeriod": 0,
    "period": "week",
    "startDate": "2025-01-13",
    "endDate": "2025-01-19",
    "reportGeneratedAt": "2025-01-21T10:30:00.000Z"
  }
}
```

#### SQL Query Improvements
- Uses PostgreSQL date functions for accurate date ranges
- Joins users, cartelas, and games tables
- Filters only finished games
- Calculates house profit as (bet - player win)
- Groups by user and aggregates statistics
- Excludes admin users from reports

## Frontend Changes

### File: `src/components/WeeklyReport.tsx`

#### New State Variables
```typescript
const [period, setPeriod] = useState<'week' | '15days'>('week');
```

#### New UI Components

1. **Period Selector**
   - Two-button toggle (Weekly / 15 Days)
   - Active state styling
   - Icons for visual clarity

2. **Enhanced Summary Cards**
   - 5 cards instead of 4
   - Added "Total Games" card
   - Responsive grid layout
   - Color-coded metrics

3. **Improved Table**
   - Row numbers for easy reference
   - Cartelas played column
   - Color-coded values (active/inactive)
   - Totals footer row
   - Hover effects
   - Empty state with icon

4. **Export Functionality**
   - Generates CSV file
   - Includes all user data
   - Filename includes period and date range
   - Downloads automatically

#### Helper Functions

```typescript
const formatDate = (dateString: string) => {
  // Formats date as "Jan 13, 2025"
}

const exportReport = () => {
  // Generates and downloads CSV file
}
```

## Date Range Logic

### Weekly Report (Monday-Sunday)
```javascript
// Get Monday of current week
const monday = getMondayOfWeek(new Date());
monday.setHours(0, 0, 0, 0);

// Get Sunday (6 days after Monday)
const sunday = new Date(monday);
sunday.setDate(sunday.getDate() + 6);
sunday.setHours(23, 59, 59, 999);
```

### 15-Day Report
```javascript
// Start: 15 days ago
const startDate = new Date();
startDate.setDate(startDate.getDate() - 15);
startDate.setHours(0, 0, 0, 0);

// End: Today
const endDate = new Date();
endDate.setHours(23, 59, 59, 999);
```

## Usage

### Viewing Reports

1. **Navigate to Weekly Report**
   - Go to Backoffice Dashboard
   - Click "Weekly Report" in the sidebar

2. **Switch Between Periods**
   - Click "Weekly" button for Monday-Sunday report
   - Click "15 Days" button for 15-day report
   - Data refreshes automatically

3. **View/Hide Amounts**
   - Click "Show Amounts" to reveal monetary values
   - Click "Hide Amounts" to mask values with ***

4. **Export Report**
   - Click "Export CSV" button
   - File downloads automatically
   - Filename: `week-report-2025-01-13-to-2025-01-19.csv`

### Understanding the Data

#### Active Users
Users who played at least one game during the period

#### House Profit Calculation
```
House Profit = Total Bet - Player Win
```

- **Positive**: House made profit
- **Negative**: House paid out more than received (rare)
- **Zero**: No activity or break-even

#### Color Coding
- **Blue**: Games played
- **Cyan**: Cartelas used
- **Green**: Total bets (revenue)
- **Yellow**: Player winnings (payout)
- **Purple**: House profit (net)
- **Red**: Negative house profit (loss)
- **Gray**: No activity (zero values)

## API Examples

### Get Weekly Report
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3003/api/admin/weekly-report?period=week
```

### Get 15-Day Report
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3003/api/admin/weekly-report?period=15days
```

## Database Query Performance

The query is optimized with:
- Proper JOIN conditions
- WHERE clause filtering
- GROUP BY aggregation
- Indexes on:
  - `users.role`
  - `games.status`
  - `games.created_at`
  - `cartelas.user_id`
  - `cartelas.game_id`

Expected query time: < 100ms for 1000 users

## Testing Recommendations

1. **Test with no data**
   - Verify empty state displays correctly
   - Check that totals show zero

2. **Test with sample data**
   - Create test games in different date ranges
   - Verify weekly report shows only Monday-Sunday
   - Verify 15-day report shows last 15 days

3. **Test period switching**
   - Switch between weekly and 15-day
   - Verify data updates correctly
   - Check date ranges in header

4. **Test export**
   - Export with data
   - Verify CSV format
   - Check filename includes dates

5. **Test privacy toggle**
   - Hide amounts
   - Show amounts
   - Verify all monetary values toggle

## Notes

- All monetary values are in BIRR currency
- Reports exclude admin users
- Only finished games are included in statistics
- Date ranges are inclusive (start and end dates included)
- Weekly report always starts on Monday
- 15-day report is rolling (always last 15 days)

## Future Enhancements

Potential improvements:
1. Custom date range picker
2. Monthly/yearly reports
3. User comparison charts
4. Profit trend graphs
5. PDF export with charts
6. Email report scheduling
7. Filter by shop name
8. Search users in table
9. Sort by any column
10. Pagination for large datasets

## Troubleshooting

### "No users found"
- Check if users exist in database
- Verify users have played games
- Check date range is correct

### "Failed to fetch weekly report"
- Verify backend server is running
- Check authentication token is valid
- Restart backend server if routes not loaded

### Wrong date range
- Verify server timezone matches expected timezone
- Check getMondayOfWeek function logic
- Ensure database timestamps are correct

### Export not working
- Check browser allows downloads
- Verify data exists before export
- Check console for JavaScript errors

---

**The weekly report now provides comprehensive insights into user activity with flexible time periods! 📊**
