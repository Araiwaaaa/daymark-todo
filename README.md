# Daymark

A private to-do list with individual accounts and SQLite-backed storage.

## Run locally

Requires Node.js 20 or newer. Install dependencies with `npm install`, copy `.env.example` to `.env`, set a unique `SESSION_SECRET`, then run `npm start`. Open [http://localhost:3000](http://localhost:3000). The app creates its database under `data/` on first run. For local development with automatic restarts, run `npm run dev`.

## Tests

Run `npm test`. The tests use temporary SQLite databases and cover registration validation, successful and failed login, authenticated task creation/completion/deletion, and cross-account isolation.

## Security notes

Passwords are hashed with bcrypt. Session records and application data are stored in SQLite, and the session cookie is HTTP-only and same-site. Set a long random `SESSION_SECRET` and serve behind HTTPS in production; production mode enables secure cookies. Usernames are case-insensitive and limited to letters, numbers, and underscores.