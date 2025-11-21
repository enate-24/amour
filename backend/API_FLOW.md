# Bingo Backend API Documentation

## Overview
This document provides a comprehensive overview of the Bingo backend API architecture, endpoints, and data flow.

## Architecture

### Server Configuration (`server.js`)
- **Framework**: Express.js
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan
- **Body Parsing**: JSON (10MB limit), URL-encoded
- **Port**: 3001 (configurable via PORT environment variable)

### Security Features
- Helmet for security headers
- CORS configured for frontend URL
- Rate limiting (100 requests per 15 minutes per IP)
- JWT authentication middleware
- Password hashing with bcryptjs

## API Routes Structure

### 1. Authentication Routes (`/api/auth`)

#### Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string (min 3 chars)",
  "email": "valid email",
  "password": "string (min 6 chars)"
}
```

**Flow**:
1. Input validation using express-validator
2. Check for existing users (email/username)
3. Hash password with bcrypt (salt rounds: 10)
4. Create user with UUID, default role 'user'
5. Generate JWT token
6. Return user data (without password) + token

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "valid email",
  "password": "string"
}
```

**Flow**:
1. Validate email format
2. Find user by email
3. Check if user is active
4. Verify password with bcrypt.compare()
5. Generate JWT token
6. Log admin login if user role is 'admin'
7. Return user data + token

#### Profile Management
```http
GET /api/auth/profile (authenticated)
PUT /api/auth/profile (authenticated)
PUT /api/auth/change-password (authenticated)
POST /api/auth/logout (authenticated)
POST /api/auth/verify-token (authenticated)
```

### 2. Games Routes (`/api/games`)

#### Game Lifecycle
1. **Creation** (Admin only)
   ```http
   POST /api/games
   Authorization: Bearer <admin-token>

   {
     "gameNumber": "integer",
     "betMoney": "float",
     "winnerPattern": "string",
     "houseCutPercentage": "float (optional, default 25%)"
   }
   ```

2. **Starting** (Admin only)
   ```http
   PUT /api/games/:id/start
   Authorization: Bearer <admin-token>
   ```

3. **Number Calling** (Admin only)
   ```http
   PUT /api/games/:id/call-number
   Authorization: Bearer <admin-token>

   {
     "number": "integer (1-75)"
   }
   ```

4. **Finishing** (Admin only)
   ```http
   PUT /api/games/:id/finish
   Authorization: Bearer <admin-token>

   {
     "winMoney": "float",
     "winnerCartelaIds": "array of UUIDs"
   }
   ```

#### Game States
- `waiting`: Game created but not started
- `started`: Game in progress, numbers being called
- `finished`: Game completed with winners declared
- `cancelled`: Game cancelled before completion

### 3. Cartelas Routes (`/api/cartelas`)

#### Cartela Management
```http
# Create new cartela (public)
POST /api/cartelas

{
  "cardId": "string",
  "numbers": {
    "B": [1,2,3,4,5],
    "I": [16,17,18,19,20],
    "N": [31,32,0,34,35],
    "G": [46,47,48,49,50],
    "O": [61,62,63,64,65]
  },
  "gameId": "UUID (optional)",
  "userId": "UUID (optional)"
}

# Get all cartelas (public)
GET /api/cartelas

# Get available cartelas (public)
GET /api/cartelas/available

# Generate from existing (public)
POST /api/cartelas/generate-from-existing

{
  "sourceCardIds": ["card1", "card2"],
  "cardIdPrefix": "string (optional)",
  "userId": "UUID (optional)"
}
```

#### Admin Cartela Operations
```http
# Bulk copy to users (admin only)
POST /api/cartelas/:id/bulk-copy
Authorization: Bearer <admin-token>

{
  "targetUserIds": ["UUID1", "UUID2"],
  "gameId": "UUID (optional)",
  "cardIdPrefix": "string (optional)"
}

# Assign existing cartelas (admin only)
POST /api/cartelas/assign-existing
Authorization: Bearer <admin-token>

{
  "targetUserId": "UUID",
  "sourceCartelaIds": ["UUID1", "UUID2"],
  "gameId": "UUID (optional)"
}

# Add cartelas by range (admin only)
POST /api/cartelas/add-by-range
Authorization: Bearer <admin-token>

{
  "targetUserId": "UUID",
  "cardIdPrefix": "string",
  "startRange": "integer",
  "endRange": "integer",
  "gameId": "UUID (optional)",
  "numbersTemplate": "object (optional)"
}
```

### 4. Users Routes (`/api/users`)

#### User Management (Admin only)
```http
# Get all users
GET /api/users?role=admin&status=active&page=1&limit=20
Authorization: Bearer <admin-token>

# Get user by ID
GET /api/users/:id
Authorization: Bearer <admin-token>

# Create user
POST /api/users
Authorization: Bearer <admin-token>

{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "user|admin|moderator",
  "balance": "float (optional)"
}

# Update user
PUT /api/users/:id
Authorization: Bearer <admin-token>

{
  "username": "string (optional)",
  "email": "string (optional)",
  "role": "string (optional)",
  "balance": "float (optional)",
  "isActive": "boolean (optional)"
}

# Update user balance
PUT /api/users/:id/balance
Authorization: Bearer <admin-token>

{
  "amount": "float",
  "operation": "add|subtract|set"
}

# Update user status
PATCH /api/users/:id/status
Authorization: Bearer <admin-token>

{
  "is_active": "boolean"
}

# Get user statistics
GET /api/users/:id/stats
Authorization: Bearer <admin-token>
```

### 5. Admin Routes (`/api/admin`)

#### Dashboard & Analytics
```http
# Get dashboard statistics
GET /api/admin/dashboard
Authorization: Bearer <admin-token>

# Get admin logs
GET /api/admin/logs?action=CREATE_USER&page=1&limit=50
Authorization: Bearer <admin-token>

# Get system health
GET /api/admin/health
Authorization: Bearer <admin-token>

# Get recent activities
GET /api/admin/activities?limit=20
Authorization: Bearer <admin-token>
```

#### File Management
```http
# Upload PDF
POST /api/admin/upload-pdf
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

# Get PDF files
GET /api/admin/pdf-files
Authorization: Bearer <admin-token>

# Delete PDF file
DELETE /api/admin/pdf-files/:filename
Authorization: Bearer <admin-token>
```

#### Data Export
```http
# Export data
GET /api/admin/export/:type (users|games|cartelas|logs)
Authorization: Bearer <admin-token>
```

## Data Flow Architecture

### Authentication Flow
1. **Client Request** → Express middleware validation
2. **Database Query** → User lookup/verification
3. **Password Verification** → bcrypt.compare()
4. **JWT Generation** → jsonwebtoken.sign()
5. **Response** → User data + token

### Game Flow
1. **Admin Creates Game** → Database storage
2. **Players Join** → Cartela assignment
3. **Admin Starts Game** → Status update
4. **Number Calling** → Real-time updates
5. **Winner Detection** → Pattern matching
6. **Game Completion** → Payout calculation

### Cartela Flow
1. **Creation/Generation** → Database storage
2. **Assignment** → User linkage
3. **Game Association** → Game participation
4. **Winner Marking** → Pattern completion

## Database Schema

### Users Table
```javascript
{
  id: "UUID",
  username: "string",
  email: "string",
  password: "hashed string",
  role: "user|admin|moderator",
  balance: "float",
  totalGamesPlayed: "integer",
  totalWinnings: "float",
  is_active: "boolean",
  createdAt: "ISO string",
  updatedAt: "ISO string"
}
```

### Games Table
```javascript
{
  id: "UUID",
  gameNumber: "integer",
  status: "waiting|started|finished|cancelled",
  betMoney: "float",
  winMoney: "float",
  cartelasSelected: "integer",
  calledNumbers: "array",
  totalNumbers: "integer (75)",
  winnerPattern: "string",
  houseCutPercentage: "float",
  createdAt: "ISO string",
  updatedAt: "ISO string"
}
```

### Cartelas Table
```javascript
{
  id: "UUID",
  card_id: "string",
  user_id: "UUID (nullable)",
  game_id: "UUID (nullable)",
  numbers: "object (BINGO grid)",
  pattern: "string (nullable)",
  is_active: "boolean",
  purchased_at: "ISO string"
}
```

## Middleware Architecture

### Authentication Middleware (`middleware/auth.js`)
- `authenticateToken`: Verifies JWT tokens
- `requireAdmin`: Ensures admin role access
- Token validation and user context injection

### Security Features
- Rate limiting per IP address
- CORS configuration
- Helmet security headers
- Input validation and sanitization
- SQL injection prevention through parameterized queries

## Error Handling

### Centralized Error Handling
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
```

### 404 Handler
```javascript
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

## Environment Configuration

### Required Environment Variables
- `JWT_SECRET`: Secret key for JWT token generation
- `JWT_EXPIRES_IN`: Token expiration time (default: 7d)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `NODE_ENV`: Environment mode (development/production)

## API Response Standards

### Success Response
```javascript
{
  "message": "Operation successful",
  "data": { ... },
  "pagination": { ... } // if applicable
}
```

### Error Response
```javascript
{
  "error": "Error description",
  "errors": [ // validation errors
    {
      "field": "fieldName",
      "message": "Error message"
    }
  ]
}
```

## Logging System

### Admin Action Logging
- All admin actions are logged with:
  - Admin ID and details
  - Action type
  - Target type and ID
  - IP address
  - Timestamp

### System Logging
- Morgan for HTTP request logging
- Console logging for errors and important events
- Admin activity tracking

## Performance Considerations

### Optimization Features
- Database connection pooling (if using SQL database)
- Pagination for large datasets
- Rate limiting to prevent abuse
- Input validation to prevent malformed requests
- Error handling to prevent crashes

### Scalability Features
- Stateless JWT authentication
- Modular route structure
- Middleware-based architecture
- Database abstraction layer

## Security Best Practices

1. **Password Security**: bcrypt hashing with salt rounds
2. **JWT Security**: Configurable expiration, secure secrets
3. **Rate Limiting**: Prevents brute force attacks
4. **Input Validation**: express-validator for all inputs
5. **CORS Configuration**: Restricted to specific origins
6. **Helmet Integration**: Security headers
7. **Error Information**: Limited error details in production

## Testing Strategy

### API Testing Endpoints
- Health check: `GET /api/health`
- Token verification: `POST /api/auth/verify-token`
- Dashboard stats: `GET /api/admin/dashboard` (admin only)

### Manual Testing Flow
1. Register new user
2. Login to get token
3. Create/access cartelas
4. Admin creates game
5. Players join game
6. Game execution and completion

This documentation provides a complete overview of the Bingo backend API architecture, data flow, and implementation details.
