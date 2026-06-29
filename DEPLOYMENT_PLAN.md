# Deployment Readiness Report

## Project Classification

- **App type:** Full-stack app
- **Frontend:** Static HTML/CSS/vanilla JavaScript served by the Node server
- **Backend:** Custom Node.js HTTP server
- **Monorepo:** No
- **Database:** No database usage found
- **AI API:** OpenAI Chat Completions API used from the backend

## Evidence Summary

- `server.js` creates an HTTP server, serves static files from `public/`, and exposes `POST /api/analyze`.
- `public/index.html`, `public/styles.css`, and `public/app.js` form the frontend.
- `package.json` defines `node server.js` as the runtime entry point.
- `server.js` calls `https://api.openai.com/v1/chat/completions` and expects `OPENAI_API_KEY`.

## Current Project Structure

```text
TestCraft AI/
  package.json
  server.js
  public/
    index.html
    styles.css
    app.js
  README.md
  CONTEXT.md
```

## Frontend Deployment Requirements

- The frontend is not a standalone SPA build artifact; it is static content served by the Node server.
- The browser app uses a relative API call to `/api/analyze`, so it must be deployed on the same origin as the backend or behind a proxy that preserves that route.
- The frontend needs no framework-specific build step because it is plain HTML/CSS/JavaScript.
- The frontend expects image uploads and uses browser APIs such as `FileReader`, `fetch`, and `navigator.clipboard`.

## Backend Deployment Requirements

- Deploy `server.js` as a Node process.
- Use a Node runtime that supports ES modules and global `fetch`.
- Set the process host to a public bind address in production. The current default host is `127.0.0.1`, which is fine locally but is a deployment blocker on hosted platforms unless overridden with `HOST=0.0.0.0` or platform-specific equivalent.
- The server must be able to make outbound HTTPS requests to OpenAI.
- The server must receive an OpenAI API key at runtime.

## Package Manager

- **Package manager:** npm
- Evidence: `package.json` exists and defines `start` and `dev` scripts.
- No lockfile was found in the repository snapshot.

## Environment Variables Needed

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PORT`
- `HOST`
- `NO_LISTEN`
- `DEMO_MODE` is documented in `README.md`, but the current `server.js` flow does not use it for request handling.

## Database Requirements

- None found.
- There are no database clients, ORM configs, schema files, migrations, or persistence code in the repository snapshot.

## AI Usage

- The backend sends uploaded screenshots to OpenAI using the Chat Completions API.
- The request body includes a prompt and one or more image URLs encoded as data URLs.
- The backend expects the response to be JSON and returns the parsed result to the frontend.

## Localhost URLs And Hardcoded Paths

### Localhost URLs found

- `http://localhost:3000` in `README.md`
- `127.0.0.1` default host in `server.js`
- `http://${host}:${port}` is logged by `server.js` at startup

### Hardcoded file paths found

- No absolute hardcoded filesystem paths were found in the application source.
- `server.js` uses `path.join(__dirname, "public")`, which is relative to the app root and appropriate for deployment.

### Hardcoded API keys found

- No hardcoded API keys were found.
- The application expects `OPENAI_API_KEY` from the environment.

## Deployment Blockers

1. **`HOST` defaults to `127.0.0.1`**
   - This will prevent remote access on many platforms unless the host is overridden.
2. **`OPENAI_API_KEY` is required for the main workflow**
   - `POST /api/analyze` returns `503` when the key is missing.
3. **No build or install metadata beyond `npm start`**
   - This is deployable, but the platform must support plain Node startup without a separate build step.
4. **No lockfile present**
   - Reproducibility is lower than it could be, though the repo currently has no external npm dependencies.
5. **Frontend depends on the backend being same-origin**
   - Static hosting alone will not work unless the API is separately hosted and the frontend is adjusted.

## Recommended Deployment Platform

- **Recommended:** Render, Fly.io, or Railway
- **Why:** This app is a small Node server that serves its own static frontend and calls OpenAI from the backend. A single web service is the cleanest fit.

## Exact Files That Need Changes

- `server.js`
  - Change the default host binding for production deployment if the platform does not provide `HOST`.
  - Add any production-specific guardrails if desired, such as stronger startup validation for missing env vars.
- `package.json`
  - Optional, if you want to add deployment-friendly scripts or a start command for a specific platform.
- `README.md`
  - Optional, to document production deployment steps and environment variables more explicitly.
- `CONTEXT.md`
  - Optional, to preserve deployment preferences and rollout assumptions for later work.

## Step-by-Step Deployment Plan

1. Choose a single Node hosting target such as Render, Fly.io, or Railway.
2. Configure the service to run `npm start`.
3. Set `OPENAI_API_KEY` in the hosting platform’s secret/environment settings.
4. Set `OPENAI_MODEL` if you want anything other than the default `gpt-4.1-mini`.
5. Set `HOST=0.0.0.0` unless the platform injects an equivalent bind address automatically.
6. Set `PORT` only if the platform requires an explicit port override.
7. Deploy the service and verify that the root URL loads `public/index.html`.
8. Upload screenshots in the browser and confirm `POST /api/analyze` returns generated test cases.
9. Verify CSV export, DOCX export, row copy, and full-table copy in the live environment.
10. If you want a public static frontend plus separate backend later, plan a second pass to split API and UI origins.

## Notes For Later Changes

- The codebase already supports a good single-service deployment pattern.
- The main production risk is the loopback host default, not the app architecture.
- If you later want to split frontend and backend hosting, the browser code will need an API base URL strategy instead of same-origin `/api/analyze`.
