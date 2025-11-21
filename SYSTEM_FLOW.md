# System Flow Documentation

This document outlines the system flow of the application, covering the frontend, backend, and the interactions between them.

## 1. Frontend

The frontend is a single-page application (SPA) built with **React** and **Vite**. It uses **React Router** for navigation and **Tailwind CSS** for styling.

### 1.1. Project Structure

The main source code is located in the `src` directory, with the following key subdirectories:

-   `components`: Contains all the React components, which are the building blocks of the UI.
-   `hooks`: Contains custom React hooks, such as `useAuth` for managing authentication.
-   `lib`: Likely contains utility functions or libraries.
-   `types`: Contains TypeScript type definitions.

### 1.2. Key Components

-   **`App.tsx`**: The root component that handles routing and renders all other components.
-   **`AuthPage.tsx`**: The login and registration page.
-   **`Dashboard.tsx`**: The main dashboard for regular users.
-   **`BackofficeLayout.tsx` and `BackofficeDashboard.tsx`**: The layout and dashboard for admin users.
-   **`Sidebar.tsx`**: The navigation sidebar.

### 1.3. Routing

The application uses `react-router-dom` to manage client-side routing. The routes are defined in `App.tsx` and are protected based on the user's authentication status and role.

-   **Public Routes**: `/` (login page)
-   **User Routes**: `/dashboard`, `/game`, `/settings`, etc.
-   **Admin Routes**: `/backoffice/dashboard`, `/backoffice/user-management`, etc.

## 2. Backend

The backend is a **Node.js** application using the **Express.js** framework. It provides a RESTful API for the frontend.

### 2.1. Project Structure

The backend code is in the `backend` directory:

-   `routes`: Contains the API route definitions.
-   `middleware`: Contains Express middleware.
-   `data`: Contains the database abstraction layer.
-   `server.js`: The main entry point of the server.

### 2.2. API Endpoints

The API routes are organized by functionality:

-   `/api/auth`: Authentication (login, register, profile).
-   `/api/users`: User management.
-   `/api/games`: Game logic.
-   `/api/cartelas`: "Cartela" (card) management.
-   `/api/admin`: Admin-specific functionalities.

### 2.3. Database

The backend uses a **PostgreSQL** database. The `db.js` file handles the database connection, and the `data/database.js` file provides an abstraction layer for database queries.

## 3. Authentication Flow

Authentication is handled using **JSON Web Tokens (JWT)**.

1.  **Login/Registration**: The user enters their credentials on the `AuthPage.tsx` component.
2.  **API Request**: The frontend sends a POST request to `/api/auth/login` or `/api/auth/register`.
3.  **Backend Verification**: The backend validates the credentials, and on success, generates a JWT.
4.  **Token Response**: The JWT is sent back to the frontend.
5.  **Token Storage**: The `useAuth` hook stores the JWT in the client's browser (e.g., `localStorage`).
6.  **Authenticated Requests**: For subsequent requests, the JWT is included in the `Authorization` header.
7.  **Backend Authorization**: The backend uses middleware to verify the JWT on protected routes.

## 4. System Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Enters credentials and clicks login
    Frontend->>Backend: POST /api/auth/login with credentials
    Backend->>Database: Find user by email
    Database-->>Backend: User data (with hashed password)
    Backend->>Backend: Compare hashed password
    alt Credentials valid
        Backend->>Backend: Generate JWT
        Backend-->>Frontend: JWT and user data
        Frontend->>Frontend: Store JWT and user data
        Frontend->>User: Redirect to dashboard
    else Credentials invalid
        Backend-->>Frontend: 401 Unauthorized error
        Frontend->>User: Show error message
    end

    User->>Frontend: Navigates to a protected page
    Frontend->>Backend: GET /api/some-protected-route (with JWT in header)
    Backend->>Backend: Verify JWT
    alt JWT valid
        Backend->>Database: Fetch data for the route
        Database-->>Backend: Data
        Backend-->>Frontend: Data
        Frontend->>User: Render the page with data
    else JWT invalid
        Backend-->>Frontend: 401 Unauthorized error
        Frontend->>User: Redirect to login page
    end
