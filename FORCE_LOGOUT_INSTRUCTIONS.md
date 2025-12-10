# Force Logout and Clear Cache

To see the updated user types, you MUST:

1. **Open Browser Console** (Press F12)
2. **Run this command in console:**
   ```javascript
   localStorage.clear(); location.reload();
   ```
3. **Log in again** with your user credentials

## What You Should See:

### For pretest@bingo.com (Prepaid):
- Sidebar: "Balance: 1000.00 Birr"
- Dashboard: "Balance: 1,000 Birr"
- Console: "Sidebar - User Type: prepaid Role: user Balance: 1000"

### For yabtest@gmail.com (Postpaid):
- Sidebar: "Credit: 0.00 Birr (Unlimited)"
- Dashboard: "Credit Used: 0 Birr (Unlimited)"
- Console: "Sidebar - User Type: postpaid Role: user Balance: 0"

### For admin@amour-bingo.com (Admin):
- Sidebar: No balance shown (just username)
- Dashboard: No balance shown
- Console: "Sidebar - User Type: prepaid Role: admin Balance: 0"

## If Still Not Working:

Check the browser console for the log messages. If you see:
- "User Type: undefined" → The backend is not returning userType
- "User Type: prepaid" for Yabtest → The database wasn't updated properly

Run this to verify database:
```bash
cd backend
node scripts/check-user-types.js
```
