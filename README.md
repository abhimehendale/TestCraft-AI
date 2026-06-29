# TestCraft AI

Upload one or more screenshots of a target system and generate a test suite in tabular form.

## What it does

- Accepts one or more screenshot uploads from the browser.
- Sends the screenshot batch to OpenAI when `OPENAI_API_KEY` is configured.
- Falls back to a demo response when no key is present, so the app still runs.
- Renders the output as a QA-friendly table and lets you export CSV or DOCX.
- Lets you copy the full table or copy a single row from the action column.
- Lets you edit generated test cases directly in the table.
- Lets you add and delete test cases before export.

## Run it

```bash
npm start
```

Open `http://localhost:3000`.

## OpenAI setup

Set these environment variables before starting the server:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-4.1-mini"
```

Optional:

- `DEMO_MODE=true` forces demo output.
- `PORT=3000` changes the local port.

## Notes

- The app expects UI screenshots, preferably PNG, JPG, or WebP.
- The generated table is designed for QA review and can be exported to CSV or DOCX.
- Export and copy actions always reflect the current edited table state.
- Exported filenames are based on the suite name and trimmed to stay readable.
