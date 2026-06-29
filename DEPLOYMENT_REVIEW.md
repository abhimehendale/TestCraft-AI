# Deployment Review

## Final App Type

- **Type:** Full-stack Node app
- **Why:** `server.js` serves the static frontend from `public/` and also exposes the backend API route `POST /api/analyze`.
- **Not frontend-only:** the browser UI depends on the backend for test-case generation.
- **Not backend-only:** the app ships a browser UI in `public/index.html`, `public/app.js`, and `public/styles.css`.
- **Not a monorepo:** there is a single Node service and no separate app packages.

## Recommended Platform

- **Recommended first deployment:** **Render Web Service**
- **Why this is the simplest fit:**
  - One Node process serves both frontend and backend.
  - The app listens on `PORT` and `HOST`, which maps cleanly to Render.
  - Render supports a simple health check path, which this app now exposes at `/health`.
  - No separate static hosting or frontend/backend split is required.

## Can It Be Deployed As One App?

- **Yes.**
- The code is already structured for a single Node deployment.
- The frontend requests `/api/analyze` from the same origin by default.
- `public/index.html` loads `/config.js`, which is served by the same backend.
- You do **not** need Vercel frontend plus a separate backend for the first deployment.

## Exact Commands

- **Install/dependency step:** `npm install`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Verification command:** `npm run check`

## Required Environment Variables

- `OPENAI_API_KEY`
  - Required for test-case generation
  - Used only in `server.js`
- `OPENAI_MODEL`
  - Optional
  - Defaults to `gpt-4.1-mini`
- `PORT`
  - Optional
  - Defaults to `3000`
- `HOST`
  - Optional
  - Defaults to `0.0.0.0`
- `PUBLIC_API_BASE_URL`
  - Optional
  - Used by the browser if the API is hosted on a different origin
- `CORS_ORIGINS`
  - Optional
  - Comma-separated allowlist for frontend origins
- `CORS_ORIGIN`
  - Optional
  - Single-origin shortcut for CORS allowlisting
- `NO_LISTEN`
  - Optional
  - Test-only control to suppress server listening
- **Node version**
  - Use Node 18+ so global `fetch` is available without extra polyfills.

## Check Results

### 1. Frontend-only, backend-only, or full-stack?

- **Result:** Full-stack Node app.

### 2. One app on Render/Railway, or Vercel frontend + separate backend?

- **Result:** One app is enough.
- **Best fit:** Render Web Service.
- **Reason:** the Node server already serves the frontend and backend together.

### 3. Does `npm start` use `HOST` and `PORT` correctly?

- **Result:** Yes.
- `package.json` runs `node server.js`.
- `server.js` reads `PORT` and `HOST` from the environment.
- `server.listen(port, host, ...)` uses them directly.

### 4. Is `OPENAI_API_KEY` only used server-side?

- **Result:** Yes.
- `OPENAI_API_KEY` is read in `server.js` only.
- The browser does not receive this value.
- `config.js` exposes only `apiBaseUrl`, not secrets.

### 5. Is `PUBLIC_API_BASE_URL` used correctly in frontend requests?

- **Result:** Yes.
- `server.js` serves `/config.js` with `window.__TESTCRAFT_CONFIG__`.
- `public/app.js` reads that config and builds the API URL with `buildApiUrl("/api/analyze")`.
- If `PUBLIC_API_BASE_URL` is empty, the browser uses same-origin requests.

### 6. Is `CORS_ORIGINS` implemented correctly?

- **Result:** Mostly yes for the intended use case.
- It supports:
  - localhost defaults for local development
  - comma-separated allowlist via `CORS_ORIGINS`
  - one-off value via `CORS_ORIGIN`
- It applies CORS headers only for allowed origins.
- It returns `403` on `OPTIONS` preflight from disallowed origins.

## Exact Files Reviewed

- [package.json](/Users/abhishekmehendale/Documents/TestCraft%20AI/package.json)
- [server.js](/Users/abhishekmehendale/Documents/TestCraft%20AI/server.js)
- [public/index.html](/Users/abhishekmehendale/Documents/TestCraft%20AI/public/index.html)
- [public/app.js](/Users/abhishekmehendale/Documents/TestCraft%20AI/public/app.js)
- [public/styles.css](/Users/abhishekmehendale/Documents/TestCraft%20AI/public/styles.css)

## Blockers

- **OpenAI key required:** the app cannot generate test cases without `OPENAI_API_KEY`.
- **Outbound network required:** the deployed service must be allowed to call `https://api.openai.com`.
- **Cross-origin deployment needs configuration:** if frontend and backend are split later, `PUBLIC_API_BASE_URL` and `CORS_ORIGINS` must be set correctly.
- **No lockfile present:** deployment is still straightforward, but dependency reproducibility is weaker than it could be.

## Next Deployment Steps

1. Create a Render Web Service for the repository.
2. Set the start command to `npm start`.
3. Set `OPENAI_API_KEY`.
4. Set `OPENAI_MODEL` if you want a model other than the default.
5. Keep `HOST=0.0.0.0` and `PORT` provided by the platform.
6. Set a health check path to `/health`.
7. Deploy and confirm the homepage loads.
8. Upload a screenshot and verify `POST /api/analyze` returns a test suite.
9. If you later split frontend and backend, add a production frontend URL to `CORS_ORIGINS` and set `PUBLIC_API_BASE_URL`.

## Bottom Line

- **Best deployment target for this exact app:** **Render Web Service**
- **Simplest first deployment:** single Node service, no frontend/backend split
