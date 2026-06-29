import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL || "";
const corsOrigins = [
  ...new Set(
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      ...(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      process.env.CORS_ORIGIN || ""
    ].filter(Boolean)
  )
];

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

const REVIEW_PROMPT = `You are a senior QA analyst.

Review the uploaded UI screenshot(s) and generate a deep, practical test suite.

Requirements:
- Inspect every visible section, field, label, control, upload area, button, icon action, helper text, placeholder, and error state.
- Treat multiple screenshots as one end-to-end flow when they belong together.
- Generate a deep suite rather than a shallow list.
- Do not stop at 11 or any other arbitrary count.
- For complex UI, produce 30 to 60 test cases.
- For each required field, include happy path, invalid/missing input, and boundary/edge coverage.
- For each dropdown, test default value, option coverage, keyboard behavior, and persistence.
- For each upload area, test supported files, rejected files, multiple files, replacement/removal, cancel, and size limits if visible or implied.
- For each modal, test open, close, backdrop/escape behavior, reset, and unsaved changes.
- Include cross-field validation such as address/state/ZIP consistency, optional vs required behavior, and submit button enablement.
- Include accessibility, keyboard navigation, focus order, labels/placeholders, responsive layout, and error-state checks.
- Avoid generic duplicates. Every case must probe a different field, rule, interaction, or workflow.

Return JSON only in this exact shape:
{
  "suite_name": "Short suite name",
  "suite_summary": "One sentence summary",
  "field_inventory": [
    {
      "label": "Exact visible label",
      "section": "Section name",
      "field_type": "text | dropdown | textarea | file-upload | button | numeric | date | checkbox | radio",
      "required": true,
      "notes": "Optional short note"
    }
  ],
  "test_cases": [
    {
      "id": "TC-001",
      "title": "Short title",
      "module": "UI | Navigation | Validation | Accessibility | Data | Security | Performance | Workflow",
      "priority": "High | Medium | Low",
      "severity": "High | Medium | Low",
      "sources": ["Screenshot 1", "Screenshot 2"],
      "field_refs": ["Visible field label 1", "Visible field label 2"],
      "scenario_type": "happy path | validation | boundary | negative | accessibility | upload | workflow | security | responsive | data integrity",
      "preconditions": "One sentence",
      "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
      "expected_result": "One sentence",
      "automation_candidate": "Yes | No"
    }
  ]
}`;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function isCorsOriginAllowed(origin) {
  return Boolean(origin && (corsOrigins.includes("*") || corsOrigins.includes(origin)));
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!isCorsOriginAllowed(origin)) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function sendConfig(res) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(
    `window.__TESTCRAFT_CONFIG__ = ${JSON.stringify({
      apiBaseUrl: publicApiBaseUrl
    })};`
  );
}

function parseDataUrl(dataUrl) {
  return /^data:(.+?);base64,(.+)$/i.test(dataUrl || "");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function analyzeWithOpenAI(files) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You produce strictly valid JSON and never wrap it in markdown."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: REVIEW_PROMPT
            },
            ...files.flatMap((file, index) => [
              {
                type: "text",
                text: `Screenshot ${index + 1}: ${file.filename}`
              },
              {
                type: "image_url",
                image_url: {
                  url: file.imageDataUrl
                }
              }
            ])
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.test_cases)) {
    throw new Error("OpenAI response did not include test_cases.");
  }

  return parsed;
}

async function handleAnalyze(req, res) {
  try {
    if (!openaiApiKey) {
      return sendJson(res, 503, {
        error: "OPENAI_API_KEY is required to generate test cases with the prompt-only flow."
      });
    }

    const payload = await readBody(req);
    const rawFiles = Array.isArray(payload.files) ? payload.files : [];
    const files = rawFiles
      .map((file, index) => ({
        filename: typeof file?.filename === "string" && file.filename.trim()
          ? file.filename
          : `screenshot-${index + 1}.png`,
        imageDataUrl: typeof file?.imageDataUrl === "string" ? file.imageDataUrl : ""
      }))
      .filter((file) => file.imageDataUrl && parseDataUrl(file.imageDataUrl));

    if (!files.length) {
      return sendJson(res, 400, { error: "At least one screenshot is required." });
    }

    const result = await analyzeWithOpenAI(files);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}

function handleHealth(req, res) {
  return sendJson(res, 200, {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

async function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, "Forbidden");
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(ext) || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch {
    sendText(res, 404, "Not found");
  }
}

export const server = http.createServer((req, res) => {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    if (isCorsOriginAllowed(req.headers.origin)) {
      res.writeHead(204, {
        "Cache-Control": "no-store"
      });
      return void res.end();
    }

    return void sendText(res, 403, "Forbidden");
  }

  if (req.method === "GET" && req.url === "/config.js") {
    return void sendConfig(res);
  }

  if (req.method === "GET" && req.url === "/health") {
    return void handleHealth(req, res);
  }

  if (req.method === "POST" && req.url === "/api/analyze") {
    return void handleAnalyze(req, res);
  }

  if (req.method === "GET") {
    return void serveStatic(req, res);
  }

  sendText(res, 405, "Method not allowed");
});

if (process.env.NO_LISTEN !== "true") {
  server.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`TestCraft AI running on http://${host}:${port}`);
    console.log(`Using model ${openaiModel}.`);
  });
}
