# TestCraft AI

Upload one or more screenshots of a target system and generate a test suite in tabular form.

## What it does

- Accepts one or more screenshot uploads from the browser.
- Sends the screenshot batch to OpenAI when `OPENAI_API_KEY` is configured.
- Requires `OPENAI_API_KEY` for test-case generation.
- Renders the output as a QA-friendly table and lets you export CSV or DOCX.
- Lets you copy the full table or copy a single row from the action column.
- Lets you edit generated test cases directly in the table.
- Lets you add and delete test cases before export.

## Run it

```bash
npm start
```

Open `http://localhost:3000`.

## Deployment setup

Set these environment variables before starting the server:

```bash
export HOST="0.0.0.0"
export PORT="3000"
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-4.1-mini"
```

Optional:

```bash
export PUBLIC_API_BASE_URL=""
export CORS_ORIGINS="https://your-frontend.example.com"
```

Use `PUBLIC_API_BASE_URL` if the browser frontend is hosted on a different origin than the backend API. Leave it empty for same-origin deployment.
Use `CORS_ORIGINS` to allow a local frontend port or a production frontend URL to call the API.
`OPENAI_API_KEY` is required for generation requests.

## Notes

- The app expects UI screenshots, preferably PNG, JPG, or WebP.
- The generated table is designed for QA review and can be exported to CSV or DOCX.
- Export and copy actions always reflect the current edited table state.
- Exported filenames are based on the suite name and trimmed to stay readable.
- Run `npm run check` before deployment to verify the source files parse cleanly.
