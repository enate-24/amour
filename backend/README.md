# Bingo Game Backend API

A comprehensive backend system for the Bingo game application with authentication, role-based access control, and complete game management.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Complete CRUD operations for users with different roles
- **Game Management**: Create, start, manage, and finish bingo games
- **Cartela System**: Create and manage bingo cards with number generation
- **PDF Upload**: Upload cartelas from PDF files with automatic number extraction
- **Cartela Copying**: Copy cartelas between users (single and bulk operations)
- **Admin Panel**: Comprehensive admin tools and logging
- **Security**: Rate limiting, input validation, and secure password hashing

## Tech Stack

- **Node.js** with Express.js
- **JWT** for authentication
- **bcryptjs** for password hashing
- **express-validator** for input validation
- **In-memory storage** (easily replaceable with database)

## Installation

1. Clone the repository
2. Navigate to the backend folder:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create environment file:
   ```bash
   cp .env.example .env
   ```

5. Update the `.env` file with your configuration

6. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/balance` - Update user balance
- `GET /api/users/:id/stats` - Get user statistics

### Games
- `POST /api/games` - Create new game (Admin)
- `GET /api/games/active` - Get active game
- `GET /api/games` - Get all games
- `GET /api/games/:id` - Get game by ID
- `PUT /api/games/:id/start` - Start game (Admin)
- `PUT /api/games/:id/call-number` - Call number (Admin)
- `PUT /api/games/:id/finish` - Finish game (Admin)
- `PUT /api/games/:id/cancel` - Cancel game (Admin)
- `GET /api/games/stats/overview` - Get game statistics (Admin)

### Cartelas
- `POST /api/cartelas` - Create new cartela
- `POST /api/cartelas/upload-pdf` - Upload cartela from PDF file
- `POST /api/cartelas/:id/copy` - Copy cartela to another user (Admin)
- `POST /api/cartelas/:id/bulk-copy` - Copy cartela to multiple users (Admin)
- `GET /api/cartelas/my-cartelas` - Get user's cartelas
- `GET /api/cartelas/:id` - Get cartela by ID
- `PUT /api/cartelas/:id` - Update cartela (Admin)
- `DELETE /api/cartelas/:id` - Delete cartela
- `GET /api/cartelas` - Get all cartelas (Admin)
- `POST /api/cartelas/generate` - Generate random cartela
- `POST /api/cartelas/:id/check-win` - Check winning status

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/logs` - Get admin logs
- `GET /api/admin/health` - Get system health
- `GET /api/admin/activities` - Get recent activities
- `GET /api/admin/export/:type` - Export data

## User Roles

- **user**: Regular players who can create cartelas and play games
- **moderator**: Can manage games and users (future feature)
- **admin**: Full access to all features and admin panel

## Default Accounts

- **Demo**: demo@bingo.com / demo123

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
- Role-based access control
- Admin action logging
- CORS protection
- Helmet security headers

## Data Models

### User
```javascript
{
  id: UUID,
  username: String,
  email: String,
  password: String (hashed),
  role: 'user' | 'admin' | 'moderator',
  balance: Number,
  totalGamesPlayed: Number,
  totalWinnings: Number,
  isActive: Boolean,
  createdAt: ISO Date,
  updatedAt: ISO Date
}
```

### Game
```javascript
{
  id: UUID,
  gameNumber: Number,
  status: 'waiting' | 'started' | 'finished' | 'cancelled',
  betMoney: Number,
  winMoney: Number,
  cartelasSelected: Number,
  calledNumbers: Array<Number>,
  totalNumbers: Number,
  winnerPattern: String,
  houseCutPercentage: Number,
  createdAt: ISO Date,
  updatedAt: ISO Date
}
```

### Cartela
```javascript
{
  id: UUID,
  cardId: String,
  userId: UUID,
  gameId: UUID,
  numbers: {
    B: Array<Number>,
    I: Array<Number>,
    N: Array<Number>,
    G: Array<Number>,
    O: Array<Number>
  },
  isWinner: Boolean,
  winningPattern: String,
  createdAt: ISO Date
}

// Extended Cartela with new features
{
  id: UUID,
  cardId: String,
  userId: UUID,
  gameId: UUID,
  numbers: {
    B: Array<Number>,
    I: Array<Number>,
    N: Array<Number>,
    G: Array<Number>,
    O: Array<Number>
  },
  isWinner: Boolean,
  winningPattern: String,
  source: 'manual' | 'pdf' | 'copy' | 'bulk-copy' | 'generated',
  copiedFrom: UUID (optional),
  originalCardId: String (optional),
  originalFileName: String (optional),
  createdAt: ISO Date
}
```

## Development

The backend uses in-memory storage for simplicity. In production, replace the data store with a proper database like PostgreSQL or MongoDB.

### Adding Database

1. Install database driver (e.g., `pg` for PostgreSQL)
2. Replace `backend/data/store.js` with database models
3. Update routes to use database queries instead of array operations
4. Add database connection configuration

### Testing

```bash
npm test
```

## Deployment

1. Set `NODE_ENV=production` in environment
2. Configure production database
3. Set secure JWT secret
4. Configure CORS for production frontend URL
5. Use process manager like PM2

## API Documentation

The API follows RESTful conventions with JSON responses. All endpoints require proper authentication headers except for registration and login.

### Authentication Header
```
Authorization: Bearer <jwt_token>
```

### Error Responses
```javascript
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

### Success Responses
```javascript
{
  "message": "Success message",
  "data": { ... },
  "pagination": { ... } // For paginated endpoints
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License
