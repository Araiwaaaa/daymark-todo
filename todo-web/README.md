# Daymark Todo

A small username/password todo app built with Express and SQLite.

## Demo database notice

This project uses SQLite for demonstration purposes. A local SQLite file is a convenient way to try the app, but it is not a suitable persistent database for a production Vercel deployment: serverless instances have temporary, isolated filesystems. Data in the Vercel demo deployment may disappear or differ between instances.

For production, replace SQLite with a hosted database such as Supabase or PostgreSQL, and configure the database connection through environment variables.

## Run locally

```sh
npm install
npm start
```

Open http://localhost:3000. The local database is stored at `~/.todo-web/todo.sqlite` by default. Set `TODO_DB_PATH` to choose another location.

## Deploy a demo to Vercel

The Vercel project is connected to this GitHub repository with `todo-web` set as its Root Directory. Pushes to `main` trigger production deployments. For another Vercel project, set its Root Directory to `todo-web` as well. The API adapter uses `/tmp/todo.sqlite` on Vercel; this is temporary demo storage, not durable storage.

Before deploying, set `SESSION_SECRET` in the Vercel project's Environment Variables for every environment you use. Generate a unique value locally with `openssl rand -hex 32`; enter it directly in Vercel and do not commit it. The application refuses to start in production without this value.

The GitHub integration deploys pushes to `main`. Configure `SESSION_SECRET` in Vercel before production deployment.

## Tests

```sh
npm test
```