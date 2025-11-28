# Bingo Game Application

A full-stack bingo game application with real-time gameplay, user authentication, and admin dashboard.

## Features

- 🎮 Real-time bingo gameplay with auto-call functionality
- 🔐 JWT-based authentication with role-based access control
- 👥 User and admin dashboards
- 🎯 Advanced pattern detection (One Line, Two Lines, Full House)
- 🔊 Sound effects for number calls and winners
- 📊 Game analytics
- 🎴 Dynamic cartela (bingo card) management

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Lucide React for icons

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- Rate limiting and security middleware

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bingo
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

4. Set up environment variables:

Create `.env` in the root directory:
```env
VITE_API_URL=/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

Create `backend/.env`:
```env
PORT=3003
DB_USER=postgres
DB_HOST=localhost
DB_NAME=bingo_db
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

5. Initialize the database:
```bash
cd backend
node -e "require('./db').createTables()"
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

2. Start the frontend (in a new terminal):
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Project Structure

```
bingo/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Libraries and utilities
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── backend/               # Backend source code
│   ├── data/              # Database operations
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── scripts/           # Utility scripts
│   └── utils/             # Backend utilities
└── public/                # Static assets

```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout user

### Games
- `POST /api/games` - Create new game
- `GET /api/games/active` - Get active game
- `PUT /api/games/:id/start` - Start game
- `PUT /api/games/:id/call-number` - Call next number
- `PUT /api/games/:id/finish` - Finish game

### Cartelas
- `GET /api/cartelas/all-cartelas` - Get all cartelas
- `GET /api/cartelas/:id` - Get cartela by ID
- `POST /api/cartelas` - Create new cartela

## Development

### Running Tests
```bash
cd backend
npm test
```

### Code Style
The project uses ESLint for code quality. Run linting with:
```bash
npm run lint
```

## License

MIT

## Contributors

Bingo Team 
