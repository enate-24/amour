# Admin Login Debug Guide

## Current Status
✅ Backend is working correctly
✅ Admin user exists in database
✅ Login API endpoint is functional

## Admin Credentials
- **Email**: `admin@amour-bingo.com`
- **Username**: `admin`
- **Password**: `demo123`

## Test Results
Both email and username login work correctly when tested directly against the API.

## Possible Issues

### 1. Frontend Environment Configuration
The frontend is configured to use the production backend:
```
VITE_API_URL=https://amour-bingo-backend.onrender.com/api
```

### 2. Browser Console Errors
Check the browser console for:
- Network errors (CORS, 401, 500, etc.)
- JavaScript errors
- Failed fetch requests

### 3. Token Storage Issues
The app stores the auth token in localStorage as `auth_token`. Check if:
- Token is being stored correctly
- Token format is valid (JWT with 3 parts)
- Token is being sent in subsequent requests

### 4. Redirect Issues
After successful login, the app should redirect based on user role:
- Admin users → `/backoffice/dashboard`
- Regular users → `/game`

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to login
4. Look for any error messages

### Step 2: Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to login
4. Check the `/api/auth/login` request:
   - Status code (should be 200)
   - Response body (should contain user and token)
   - Request payload (should contain email/username and password)

### Step 3: Check localStorage
1. Open browser DevTools (F12)
2. Go to Application tab → Local Storage
3. After login attempt, check if `auth_token` exists
4. Verify the token format (should be `xxx.yyy.zzz`)

### Step 4: Test with Different Browsers
Try logging in with:
- Chrome/Edge (Chromium)
- Firefox
- Safari (if on Mac)

### Step 5: Clear Browser Cache
1. Clear all browser cache and cookies
2. Close and reopen the browser
3. Try logging in again

## Common Issues and Solutions

### Issue: "Invalid login credentials"
**Solution**: Make sure you're using the correct credentials:
- Email: `admin@amour-bingo.com` OR Username: `admin`
- Password: `demo123`

### Issue: Network error or timeout
**Solution**: 
- Check if the backend server is running
- Verify the API URL in `.env` file
- Check internet connection

### Issue: Login succeeds but doesn't redirect
**Solution**:
- Check browser console for JavaScript errors
- Verify the user role is set correctly
- Check if the App.tsx routing logic is working

### Issue: CORS error
**Solution**:
- Backend should have CORS enabled for the frontend URL
- Check backend CORS configuration
- Verify the FRONTEND_URL in backend/.env

## Scripts Available

### Reset Admin Password
```bash
node backend/scripts/reset-admin-password.js
```

### Test Admin Login (API)
```bash
node backend/scripts/test-admin-login.js
```

### Create Admin User
```bash
node backend/scripts/create-admin.js
```

## Next Steps

If login still doesn't work after checking all the above:

1. **Check the exact error message** in the browser console
2. **Capture the network request/response** for the login API call
3. **Verify the frontend code** in `src/components/AuthPage.tsx` and `src/hooks/useAuth.ts`
4. **Check if there are any middleware** blocking the request
5. **Verify the JWT_SECRET** matches between frontend and backend

## Contact Information

If you need further assistance, provide:
- Browser console error messages
- Network tab screenshots
- Steps to reproduce the issue
- Browser and OS information
