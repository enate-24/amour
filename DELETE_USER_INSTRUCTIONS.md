# Delete User alemu.gonde Instructions

## Step 1: Get Admin Token
1. Open your bingo application in a web browser
2. Log in as an admin user
3. Open browser developer tools (F12)
4. Go to Application/Storage tab → Local Storage
5. Find the 'auth_token' value and copy it

## Step 2: Set Environment Variable and Run Script
Open command prompt in the project directory and run:

```cmd
set ADMIN_TOKEN=your_jwt_token_here
node delete_user.cjs
```

Replace `your_jwt_token_here` with the actual token from step 1.

## Alternative: Direct Database Method
If the API method doesn't work, you can also delete the user directly from the database:

1. Connect to your PostgreSQL database
2. Run this SQL command:
```sql
DELETE FROM users WHERE username = 'alemu.gonde' OR email = 'alemu.gonde';
```

## What the script does:
- Searches for user with username or email 'alemu.gonde'
- Shows user details if found
- Performs a hard delete (removes user and all associated data)
- Shows confirmation of deletion

## Files created:
- `delete_user.cjs` - The deletion script
- `DELETE_USER_INSTRUCTIONS.md` - These instructions

You can delete these files after use.