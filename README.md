# TestCraft AI

TestCraft AI is an AI-powered screenshot-to-test-case generator. You upload one or more UI screenshots, the app analyzes the visible interface, and it produces a structured QA test suite in a clean table that you can review, edit, copy, and export.

It also generates a starter Playwright script from the same screenshot-driven analysis, with predicted selectors, confidence notes, and downloadable `.spec.ts` or `.spec.js` output.

## Portfolio Summary

This project was built to demonstrate an end-to-end product workflow for QA and test automation teams:

- Screenshot ingestion from the browser
- AI-based UI understanding and test-case generation
- Editable tabular review workflow
- CSV and DOCX export
- Playwright script generation with selector confidence tracking
- Copy actions for individual rows and the full table
- Single-service deployment with Node.js

It is a good portfolio project because it combines product thinking, frontend UX, backend API design, AI integration, export workflows, and deployment readiness.

## What It Does

- Accepts one or more screenshot uploads.
- Sends the screenshots to OpenAI for analysis.
- Generates a QA-oriented test suite from the visible UI.
- Renders test cases in a readable table.
- Lets you edit rows directly in the table.
- Lets you add new test cases manually.
- Lets you copy a single row or the full table.
- Exports the final table to CSV or DOCX.
- Generates a downloadable Playwright test file from the current test cases.
- Supports a health check endpoint for deployment monitoring.

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js using the built-in `http` module
- **AI integration:** OpenAI Chat Completions API
- **File export:** Client-side CSV export and generated DOCX export
- **Deployment style:** Single Node web service
- **Language mode:** ECMAScript modules (`"type": "module"`)

## Architecture

The app is intentionally simple and deployable as one service:

- `public/index.html` renders the UI shell
- `public/styles.css` handles the entire visual design
- `public/app.js` handles uploads, table rendering, editing, copy actions, and export actions
- `server.js` serves the frontend, exposes the analysis API, and proxies requests to OpenAI
- `server.js` also exposes `POST /api/generate-playwright-script` for script generation

The frontend and backend are served from the same Node process, which makes deployment straightforward.

## Key Features

- Upload one or many screenshots
- AI-generated test-case suites
- Editable table view
- Add row / delete row / edit row actions
- Copy row action with toast notification
- Copy full table action
- CSV export
- DOCX export
- Playwright code viewer, copy action, and download action
- Health check endpoint at `/health`
- Production-friendly environment-based configuration

## Screenshots and Test-Case Workflow

The app is designed to help QA teams and product teams turn screenshots into structured testing work:

1. Upload a screenshot or a batch of screenshots.
2. The backend sends them to OpenAI with a detailed QA prompt.
3. The model returns a structured response containing suite metadata and test cases.
4. The frontend normalizes and displays the results in a table.
5. You can edit the table before exporting or copying.

## Local Development

### Prerequisites

- Node.js 18 or later
- An OpenAI API key

### Install

```bash
npm install
```

### Run locally

```bash
npm start
```

Open:

```bash
http://localhost:3000
```

### Verify source files

```bash
npm run check
```

## Environment Variables

Set these before starting the server:

```bash
export HOST="0.0.0.0"
export PORT="3000"
export OPENAI_API_KEY="your_openai_key"
export OPENAI_MODEL="gpt-4.1-mini"
```

Optional:

```bash
export PUBLIC_API_BASE_URL=""
export CORS_ORIGINS="https://your-frontend.example.com,http://localhost:5173"
export CORS_ORIGIN="https://your-frontend.example.com"
export NO_LISTEN="true"
```

### What each variable does

- `OPENAI_API_KEY` powers the AI analysis request from the backend.
- `OPENAI_MODEL` selects the OpenAI model used for generation.
- `PORT` controls the listening port.
- `HOST` controls the bind address.
- `PUBLIC_API_BASE_URL` lets the browser talk to a separate API origin if needed.
- `CORS_ORIGINS` allows approved browser origins to call the backend.
- `CORS_ORIGIN` is a shortcut for one allowed origin.
- `NO_LISTEN` is useful for test or validation workflows.

## How To Work On This Project

If you want to modify or extend the project, the main entry points are:

- `server.js` for API behavior, environment config, health checks, and OpenAI integration
- `public/app.js` for table rendering, upload flow, row editing, copy actions, and exports
- `public/styles.css` for all visual and responsive UI changes
- `public/index.html` for page structure and browser tab branding

Suggested working pattern:

1. Make your code change.
2. Run `npm run check`.
3. Open the app locally and test the upload and table workflows.
4. Confirm export, copy, and edit behavior still works.
5. If deploying, verify `/health` and the main page in the production environment.

## Deployment Notes

This app is meant to be deployed as a single Node web service.

- Render Web Service is the simplest first deployment target.
- The app does not need a separate frontend hosting service for the first deployment.
- The backend serves the frontend and the API together.

## Project Structure

```text
TestCraft AI/
  public/
    index.html
    styles.css
    app.js
  server.js
  package.json
  README.md
  CONTEXT.md
  DEPLOYMENT_PLAN.md
  DEPLOYMENT_REVIEW.md
```

## Notes

- The app expects screenshot uploads in PNG, JPG, JPEG, or WebP format.
- The AI prompt is optimized for deeper QA coverage rather than shallow generic test lists.
- Exported filenames are shortened so they stay readable.
- The browser tab uses a small brand icon for identity and polish.

## License

No license has been declared yet.
