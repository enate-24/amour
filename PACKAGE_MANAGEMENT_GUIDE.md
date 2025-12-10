# Package Management Guide

## Overview
The Package Management page allows admin users to manage prepaid user balances. Admins can add or deduct balance from prepaid users' accounts.

## Features

### 1. User Selection
- **Search**: Search users by username or email
- **Filter**: Only shows prepaid users (postpaid users are excluded)
- **User Info Display**: Shows username, email, current balance, and active status
- **Refresh**: Reload the user list with the refresh button

### 2. Balance Operations

#### Add Balance
- Increases the user's balance
- Use case: User purchases a package/top-up
- Example: User pays 500 Birr → Admin adds 500 Birr to their balance

#### Deduct Balance
- Decreases the user's balance
- Use case: Corrections, refunds, or adjustments
- Example: User requests refund → Admin deducts amount from balance
- **Validation**: Cannot make balance negative

### 3. Real-time Preview
- Shows current balance
- Shows operation amount
- Shows calculated new balance
- Updates before confirmation

## How to Use

### Adding Balance to a User

1. **Navigate**: Go to Backoffice → Package Management
2. **Search**: Find the user using the search box
3. **Select**: Click on the user card
4. **Choose Operation**: Click "Add Balance" button (green)
5. **Enter Amount**: Type the amount to add (e.g., 500)
6. **Preview**: Check the preview showing new balance
7. **Confirm**: Click "Add [amount] Birr" button
8. **Success**: Green message appears confirming the update

### Deducting Balance from a User

1. **Navigate**: Go to Backoffice → Package Management
2. **Search**: Find the user using the search box
3. **Select**: Click on the user card
4. **Choose Operation**: Click "Deduct Balance" button (red)
5. **Enter Amount**: Type the amount to deduct (e.g., 100)
6. **Preview**: Check the preview showing new balance
7. **Confirm**: Click "Deduct [amount] Birr" button
8. **Success**: Green message appears confirming the update

## User Interface

### Left Panel: User Selection
```
┌─────────────────────────────────┐
│ Select User            [Refresh]│
│                                 │
│ [Search box]                    │
│                                 │
│ ┌─────────────────────────────┐│
│ │ Username                    ││
│ │ email@example.com           ││
│ │                   1,500 Birr││
│ │                      [Active]││
│ └─────────────────────────────┘│
│                                 │
│ [More users...]                 │
└─────────────────────────────────┘
```

### Right Panel: Balance Update
```
┌─────────────────────────────────┐
│ Update Balance                  │
│                                 │
│ Selected User                   │
│ Username                        │
│ email@example.com               │
│ Current Balance: 1,500 Birr     │
│                                 │
│ Operation                       │
│ [Add Balance] [Deduct Balance]  │
│                                 │
│ Amount (Birr)                   │
│ [500]                           │
│                                 │
│ Preview                         │
│ Current Balance:    1,500 Birr  │
│ Add:                 +500 Birr  │
│ New Balance:        2,000 Birr  │
│                                 │
│ [Add 500.00 Birr]               │
└─────────────────────────────────┘
```

## API Endpoints

### Get Users
```
GET /api/admin/users
Authorization: Bearer <token>

Response:
{
  "users": [
    {
      "id": "uuid",
      "username": "user1",
      "email": "user@example.com",
      "userType": "prepaid",
      "balance": 1500,
      "isActive": true
    }
  ]
}
```

### Update Balance
```
PUT /api/admin/users/:userId/balance
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "balance": 2000
}

Response:
{
  "message": "Balance updated successfully",
  "user": { ... },
  "oldBalance": 1500,
  "newBalance": 2000
}
```

## Validation Rules

1. **User Type**: Only prepaid users can have balance updated
2. **Amount**: Must be a positive number
3. **Negative Balance**: Cannot make balance negative for prepaid users
4. **Admin Only**: Only admin users can access this feature
5. **Authentication**: Requires valid auth token

## Error Handling

### Common Errors

**"Balance cannot be negative for prepaid users"**
- Cause: Trying to deduct more than current balance
- Solution: Reduce the deduction amount

**"Balance can only be updated for prepaid users"**
- Cause: Selected user is postpaid
- Solution: Postpaid users don't need balance management (unlimited credit)

**"User not found"**
- Cause: User was deleted or doesn't exist
- Solution: Refresh the user list

**"Failed to update balance"**
- Cause: Server error or network issue
- Solution: Check connection and try again

## Admin Logging

All balance updates are logged in the admin_logs table:

```javascript
{
  action: 'UPDATE_USER_BALANCE',
  targetType: 'USER',
  targetId: 'user-uuid',
  details: {
    oldBalance: 1500,
    newBalance: 2000,
    difference: 500
  },
  adminId: 'admin-uuid',
  ipAddress: '192.168.1.1',
  timestamp: '2025-12-09T10:30:00Z'
}
```

## Use Cases

### 1. User Top-Up
**Scenario**: User pays 1000 Birr for package
- Admin selects user
- Clicks "Add Balance"
- Enters 1000
- Confirms
- User can now play games with new balance

### 2. Refund
**Scenario**: User requests 200 Birr refund
- Admin selects user
- Clicks "Deduct Balance"
- Enters 200
- Confirms
- User balance reduced, refund processed externally

### 3. Correction
**Scenario**: Accidentally added wrong amount
- Admin selects user
- Clicks "Deduct Balance" (if added too much) or "Add Balance" (if added too little)
- Enters correction amount
- Confirms
- Balance corrected

### 4. Promotional Credit
**Scenario**: Give 500 Birr bonus to user
- Admin selects user
- Clicks "Add Balance"
- Enters 500
- Confirms
- User receives promotional credit

## Security Features

1. **Admin Only**: Only users with admin role can access
2. **Authentication**: Requires valid JWT token
3. **Validation**: Server-side validation of all inputs
4. **Audit Trail**: All changes logged with admin ID and timestamp
5. **IP Tracking**: Admin's IP address recorded for each action

## Best Practices

1. **Verify User**: Always double-check you selected the correct user
2. **Check Amount**: Verify the amount before confirming
3. **Use Preview**: Review the preview before submitting
4. **Document Reason**: Keep external records of why balance was changed
5. **Communicate**: Inform users when their balance is updated

## Troubleshooting

### User List Not Loading
- Check internet connection
- Verify admin authentication
- Refresh the page
- Check browser console for errors

### Balance Update Fails
- Verify amount is valid (positive number)
- Check user is prepaid type
- Ensure balance won't go negative
- Try refreshing and selecting user again

### Changes Not Reflecting
- Wait a few seconds for update
- Click refresh button
- User may need to log out and back in to see updated balance

## Mobile Responsiveness

The Package Management page is fully responsive:
- **Desktop**: Two-column layout (user list | update panel)
- **Tablet**: Two-column layout with adjusted spacing
- **Mobile**: Stacked layout, scrollable user list

## Future Enhancements

Potential improvements:
- Bulk balance updates
- Transaction history per user
- Export balance change reports
- Scheduled balance updates
- Balance update templates
- SMS/Email notifications to users
