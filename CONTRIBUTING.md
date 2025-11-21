# Contributing to Bingo Game

Thank you for your interest in contributing to the Bingo Game project!

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies (see README.md)
4. Create a new branch for your feature
5. Make your changes
6. Test your changes
7. Submit a pull request

## Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for new frontend code
- Follow ESLint rules
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

### File Organization
- Components go in `src/components/`
- Hooks go in `src/hooks/`
- Utilities go in `src/utils/`
- Backend routes go in `backend/routes/`
- Database operations go in `backend/data/`

### Naming Conventions
- Components: PascalCase (e.g., `GamePage.tsx`)
- Hooks: camelCase with 'use' prefix (e.g., `useAuth.ts`)
- Utilities: camelCase (e.g., `patternDetection.ts`)
- Constants: UPPER_SNAKE_CASE

## Testing

Before submitting a PR:
1. Run `npm run lint` to check code style
2. Test your changes manually
3. Ensure no console errors
4. Check that existing features still work

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add new pattern detection`
- `fix: resolve authentication bug`
- `docs: update README`
- `refactor: improve code organization`
- `test: add unit tests for game logic`

## Pull Request Process

1. Update documentation if needed
2. Add a clear description of changes
3. Reference any related issues
4. Wait for code review
5. Address review feedback

## Questions?

Open an issue for questions or discussions.
