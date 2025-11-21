# Authentication & Role-Based Redirect Implementation

## Overview
This document describes the authentication flow, role-based redirection, and token cleanup mechanisms implemented in the Bingo application.

## Features Implemented

### 1. Role-Based Dashboard Redirection After Login
The application automatically redirects users to the appropriate dashboard based on their role:

- **Admin** → Backoffice Dashboard (BackofficeLayout)
- **Cashier** → Game Page (GamePage with limited access)
- **User** → Main Dashboard (Dashboard with full navigation)

### 2. Comprehensive Token Cleanup on Signout
When a user signs out, the system performs complete cleanup:

- Removes `auth_token` from localStorage
- Clears all sessionStorage data
- Removes all auth-related, user-related, and game-related keys from localStorage
- Resets user state to null
- Ensures the system is ready for the next login

### 3. State Reset on User Change
The application resets navigation state when users change (login/logout/role change):

- Resets to dashboard/home page
- Closes any open sidebars
- Clears previous user's navigation state

## Implementation Details

### Modified Files

#### 1. `src/hooks/useAuth.ts`
**Enhanced `signOut` function:**
```typescript
const signOut = async () => {
  try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Comprehensive cleanup for next login
    localStorage.removeItem('auth_token');
    sessionStorage.clear();
    setUser(null);
    
    // Clear any cached data
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('auth_') || key.startsWith('user_') || key.startsWith('game_')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  return { error: null };
};
```

#### 2. `src/App.tsx`
**Added state reset on user change:**
```typescript
// Reset page state when user changes (login/logout/role change)
useEffect(() => {
  setCurrentPage('dashboard');
  setIsSidebarOpen(false);
}, [user?.id, user?.role]);
```

**Role-based routing:**
```typescript
// Admin can only access backoffice
if (userRole === 'admin') {
  return <BackofficeLayout />;
}

// Cashier can only access game page
if (userRole === 'cashier') {
  return (
    // GamePage with sign out button
  );
}

// Regular user gets full dashboard
return (
  // Main app with sidebar navigation
);
```

#### 3. `src/components/BackofficeLayout.tsx`
**Added state reset on user change:**
```typescript
// Reset page state when user changes (login/logout/role change)
useEffect(() => {
  setCurrentPage('dashboard');
  setIsSidebarOpen(false);
}, [user?.id]);
```

**Fixed role access:**
- Changed from `user.user_metadata?.role` to `user.role`
- Changed from `user.user_metadata?.username` to `user.username`
- These changes align with the User type definition in `src/types/auth.ts`

## User Flow

### Login Flow
1. User enters credentials on AuthPage
2. `signIn` function authenticates and receives token + user data
3. Token stored in localStorage
4. User state updated in useAuth hook
5. App.tsx detects user state change
6. User redirected to appropriate dashboard based on role:
   - Admin → BackofficeLayout
   - Cashier → GamePage
   - User → Dashboard

### Logout Flow
1. User clicks "Sign Out" button
2. `signOut` function called
3. Logout API request sent (with token)
4. Comprehensive cleanup performed:
   - auth_token removed
   - sessionStorage cleared
   - All auth/user/game keys removed from localStorage
5. User state set to null
6. App.tsx detects null user state
7. User redirected to AuthPage (login screen)
8. System is clean and ready for next login

### Role Switching
1. If a different user logs in with a different role
2. useEffect in App.tsx and BackofficeLayout detects user.id or user.role change
3. Navigation state resets to default (dashboard)
4. Sidebar closes automatically
5. User sees fresh interface for their role

## Security Considerations

1. **Token Validation**: Tokens are validated on initial load and removed if invalid
2. **Role-Based Access Control**: Each role has specific access restrictions
3. **Comprehensive Cleanup**: All user data is cleared on logout to prevent data leakage
4. **State Reset**: Navigation state is reset when users change to prevent confusion

## Testing Scenarios

### Test 1: Admin Login
1. Login with admin credentials
2. Should redirect to Backoffice Dashboard
3. Verify backoffice features are accessible

### Test 2: Cashier Login
1. Login with cashier credentials
2. Should see Game Page only
3. Verify limited access (no full navigation)

### Test 3: User Login
1. Login with user credentials
2. Should see main Dashboard with sidebar
3. Verify full navigation is available

### Test 4: Logout and Re-login
1. Login as any user
2. Click "Sign Out"
3. Verify redirect to login page
4. Check localStorage is clean (no auth_token)
5. Login as different user
6. Verify new user's data is loaded
7. Verify previous user's state is not present

### Test 5: Role Switching
1. Login as user
2. Navigate to a specific page
3. Logout
4. Login as admin
5. Verify redirect to Backoffice Dashboard (not the page user was on)

## Demo Accounts

The following demo accounts are available:
- **Demo**: demo@bingo.com / demo123

## Benefits

1. **Clean User Experience**: Each role gets a tailored interface
2. **Security**: Proper token cleanup prevents unauthorized access
3. **State Management**: Automatic state reset prevents confusion when switching users
4. **Ready for Production**: Comprehensive cleanup ensures system is always in a clean state
5. **Maintainable**: Clear separation of concerns and documented flow
