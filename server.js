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

const REVIEW_PROMPT = `You are a senior QA analyst and test automation engineer.

Review the uploaded UI screenshot(s) and generate:
1. A deep, practical manual test suite.
2. AI-predicted UI selectors for likely automation targets.
3. A starter Playwright script that uses robust selectors and readable test structure.

Important rules:
- Inspect every visible section, field, label, control, upload area, button, icon action, helper text, placeholder, and error state.
- Treat multiple screenshots as one end-to-end flow when they belong together.
- Generate a deep suite rather than a shallow list.
- Do not stop at 11 or any other arbitrary count.
- Generate as many test cases as the screenshots justify, with no fixed minimum or maximum count.
- For each required field, include happy path, invalid/missing input, and boundary/edge coverage.
- For each dropdown, test default value, option coverage, keyboard behavior, and persistence.
- For each upload area, test supported files, rejected files, multiple files, replacement/removal, cancel, and size limits if visible or implied.
- For each modal, test open, close, backdrop/escape behavior, reset, and unsaved changes.
- Include cross-field validation such as address/state/ZIP consistency, optional vs required behavior, and submit button enablement.
- Include accessibility, keyboard navigation, focus order, labels/placeholders, responsive layout, and error-state checks.
- Prefer selectors in this order when inferring automation targets:
  1. getByRole
  2. getByLabel
  3. getByPlaceholder
  4. getByText
  5. locator('[data-testid="..."]')
  6. CSS selectors only as the last fallback
- Mark uncertain selectors clearly with TODO comments in the script.
- Keep the Playwright code clean, readable, and production-style.
- Avoid fragile selectors such as nth-child chains.
- If the screenshot does not expose enough information for a selector, infer the most likely one from visible text, labels, placeholders, headings, common frontend conventions, and data-testid naming patterns.

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
  ],
  "screenshot_analysis": {
    "screenName": "Short screen name",
    "visibleElements": [
      {
        "elementName": "Email input",
        "elementType": "input",
        "visibleText": "Email",
        "likelySelector": "page.getByLabel('Email')",
        "fallbackSelectors": [
          "page.getByPlaceholder('Enter email')",
          "page.locator('[data-testid=\"email-input\"]')",
          "page.locator('input[type=\"email\"]')"
        ],
        "confidence": "high",
        "reason": "Label text is visible and can be used by Playwright getByLabel"
      }
    ]
  },
  "playwrightScript": "Short starter Playwright script in the selected language.",
  "predictedSelectors": [
    {
      "elementName": "Login button",
      "elementType": "button",
      "visibleText": "Login",
      "likelySelector": "page.getByRole('button', { name: 'Login' })",
      "fallbackSelectors": [
        "page.getByText('Login')",
        "page.locator('[data-testid=\"login-button\"]')"
      ],
      "confidence": "high",
      "reason": "Visible button text can be used with getByRole"
    }
  ],
  "warnings": [
    "Selectors are AI-predicted from screenshots and may need manual adjustment after running against real DOM."
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
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function normalizeString(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function normalizeConfidence(value) {
  const normalized = normalizeString(value, "medium").toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizeSelectorList(value) {
  return normalizeStringArray(value);
}

function safeParseJsonObject(content) {
  const raw = normalizeString(content);
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("OpenAI returned invalid JSON.");
  }
}

function normalizeVisibleElement(element = {}, index = 0) {
  const elementName =
    normalizeString(element.elementName) ||
    normalizeString(element.element_name) ||
    normalizeString(element.label) ||
    normalizeString(element.text) ||
    normalizeString(element.visibleText) ||
    normalizeString(element.visible_text) ||
    `Element ${index + 1}`;

  const visibleText =
    normalizeString(element.visibleText) ||
    normalizeString(element.visible_text) ||
    normalizeString(element.label) ||
    normalizeString(element.text) ||
    "";

  const elementType =
    normalizeString(element.elementType) ||
    normalizeString(element.element_type) ||
    normalizeString(element.type, "unknown");

  return {
    elementName,
    elementType,
    visibleText,
    likelySelector:
      normalizeString(element.likelySelector) ||
      normalizeString(element.likely_selector) ||
      "",
    fallbackSelectors: normalizeSelectorList(element.fallbackSelectors || element.fallback_selectors),
    confidence: normalizeConfidence(element.confidence),
    reason:
      normalizeString(element.reason) ||
      normalizeString(element.selectorReason) ||
      normalizeString(element.selector_reason) ||
      "Selector inferred from screenshot context."
  };
}

function normalizeScreenshotAnalysis(value = {}) {
  const visibleElements = Array.isArray(value.visibleElements)
    ? value.visibleElements
    : Array.isArray(value.visible_elements)
      ? value.visible_elements
      : [];

  return {
    screenName:
      normalizeString(value.screenName) ||
      normalizeString(value.screen_name) ||
      "Screenshot analysis",
    visibleElements: visibleElements.map((element, index) => normalizeVisibleElement(element, index)),
    warnings: normalizeStringArray(value.warnings)
  };
}

function normalizeTestCaseRequest(testCase = {}, index = 0) {
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps.map((step) => normalizeString(step)).filter(Boolean)
    : normalizeString(testCase.steps)
        .split(/\r?\n+/)
        .map((step) => step.trim())
        .filter(Boolean);

  return {
    id: normalizeString(testCase.id, `TC-${String(index + 1).padStart(3, "0")}`),
    title: normalizeString(testCase.title),
    module: normalizeString(testCase.module, "Workflow"),
    priority: normalizeString(testCase.priority, "Medium"),
    severity: normalizeString(testCase.severity, "Medium"),
    sources: normalizeStringArray(testCase.sources),
    field_refs: normalizeStringArray(testCase.field_refs),
    scenario_type: normalizeString(testCase.scenario_type),
    preconditions: normalizeString(testCase.preconditions),
    steps,
    expected_result: normalizeString(testCase.expected_result || testCase.expectedResult),
    automation_candidate: normalizeString(testCase.automation_candidate, "No")
  };
}

function normalizePlaywrightRequest(payload = {}) {
  const testCases = Array.isArray(payload.testCases)
    ? payload.testCases
    : Array.isArray(payload.test_cases)
      ? payload.test_cases
      : [];

  const screenshotAnalysis = normalizeScreenshotAnalysis(
    payload.screenshotAnalysis || payload.screenshot_analysis || {}
  );

  const language = normalizeString(payload.language, "typescript").toLowerCase() === "javascript"
    ? "javascript"
    : "typescript";

  return {
    testCases: testCases.map((testCase, index) => normalizeTestCaseRequest(testCase, index)),
    screenshotAnalysis,
    language,
    baseUrl: normalizeString(payload.baseUrl || payload.base_url),
    testFileName: normalizeString(payload.testFileName || payload.test_file_name)
  };
}

function escapeSingleQuotedString(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replace(/\r?\n+/g, " ")
    .trim();
}

function toPlaywrightLiteral(value) {
  return `'${escapeSingleQuotedString(value)}'`;
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function inferKeywordAction(step) {
  const text = normalizeString(step).toLowerCase();
  if (!text) {
    return "unknown";
  }

  if (/navigate|go to|open|visit|load/.test(text)) {
    return "navigate";
  }

  if (/click|press|tap|submit|sign in|log in|login|continue|save|search|send|next|select/.test(text)) {
    return "click";
  }

  if (/enter|fill|type|input|set|provide|add/.test(text)) {
    return "fill";
  }

  if (/choose|pick|select/.test(text)) {
    return "select";
  }

  if (/verify|expect|should see|see|shows|display|appear|redirect|land/.test(text)) {
    return "assert";
  }

  return "unknown";
}

function elementCandidatesForAction(elements, action) {
  return elements.filter((element) => {
    const type = normalizeString(element.elementType).toLowerCase();
    if (action === "fill") {
      return /(input|textarea|field|search)/.test(type);
    }
    if (action === "click") {
      return /(button|link|tab|menu|item|card|checkbox|radio|switch)/.test(type);
    }
    if (action === "select") {
      return /(dropdown|select|combobox|radio|checkbox)/.test(type);
    }
    if (action === "assert") {
      return true;
    }
    return false;
  });
}

function scoreElementForStep(element, step, action) {
  const haystack = [
    element.elementName,
    element.elementType,
    element.visibleText,
    element.likelySelector,
    ...(Array.isArray(element.fallbackSelectors) ? element.fallbackSelectors : [])
  ]
    .join(" ")
    .toLowerCase();
  const stepText = normalizeString(step).toLowerCase();
  let score = 0;

  for (const token of stepText.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token.length < 3) {
      continue;
    }
    if (haystack.includes(token)) {
      score += 2;
    }
  }

  if (action === "fill" && /(input|textarea|field)/.test(normalizeString(element.elementType).toLowerCase())) {
    score += 4;
  }
  if (action === "click" && /(button|link|tab|menu|item)/.test(normalizeString(element.elementType).toLowerCase())) {
    score += 4;
  }
  if (action === "select" && /(dropdown|select|combobox|radio|checkbox)/.test(normalizeString(element.elementType).toLowerCase())) {
    score += 4;
  }

  if (stepText.includes(normalizeString(element.visibleText).toLowerCase()) && element.visibleText) {
    score += 3;
  }
  if (stepText.includes(normalizeString(element.elementName).toLowerCase()) && element.elementName) {
    score += 2;
  }

  return score;
}

function buildSelectorForElement(element) {
  const type = normalizeString(element.elementType).toLowerCase();
  const text = normalizeString(element.visibleText || element.elementName);
  const fallbackText = text || normalizeString(element.elementName);

  if (normalizeString(element.likelySelector)) {
    return normalizeString(element.likelySelector);
  }

  if (/(button|submit|link|menu|tab)/.test(type) && fallbackText) {
    return `page.getByRole('button', { name: ${toPlaywrightLiteral(fallbackText)} })`;
  }

  if (/(input|textarea|field|search)/.test(type) && fallbackText) {
    return `page.getByLabel(${toPlaywrightLiteral(fallbackText)})`;
  }

  if (/(dropdown|select|combobox)/.test(type) && fallbackText) {
    return `page.getByLabel(${toPlaywrightLiteral(fallbackText)})`;
  }

  if (/(placeholder)/.test(type) && fallbackText) {
    return `page.getByPlaceholder(${toPlaywrightLiteral(fallbackText)})`;
  }

  if (fallbackText) {
    return `page.getByText(${toPlaywrightLiteral(fallbackText)})`;
  }

  const testId = normalizeString(element.testId || element.test_id);
  if (testId) {
    return `page.locator('[data-testid="${escapeSingleQuotedString(testId)}"]')`;
  }

  if (/(input|textarea)/.test(type)) {
    return "page.locator('input')";
  }

  return "page.locator('body')";
}

function buildFallbackSelectors(element) {
  const selectors = [
    normalizeString(element.likelySelector),
    ...(Array.isArray(element.fallbackSelectors) ? element.fallbackSelectors : [])
  ].filter(Boolean);

  if (!selectors.length) {
    const text = normalizeString(element.visibleText || element.elementName);
    const type = normalizeString(element.elementType).toLowerCase();
    if (/(button|link)/.test(type) && text) {
      selectors.push(`page.getByText(${toPlaywrightLiteral(text)})`);
    }
    if (/(input|textarea|field)/.test(type) && text) {
      selectors.push(`page.getByLabel(${toPlaywrightLiteral(text)})`);
    }
    if (text) {
      selectors.push(`page.getByText(${toPlaywrightLiteral(text)})`);
    }
    if (/(input|textarea)/.test(type)) {
      selectors.push("page.locator('input')");
    }
  }

  return dedupeByKey(selectors, (selector) => selector);
}

function buildSelectorConfidenceEntry(element, selector, confidence, reason) {
  return {
    element: normalizeString(element.elementName || element.visibleText || "UI element"),
    selector,
    confidence,
    reason
  };
}

function buildExpectSnippet(step, preferredText) {
  const stepText = normalizeString(step);
  const targetText = normalizeString(preferredText);
  if (/redirect|land|dashboard|success|home|profile|settings/i.test(stepText)) {
    return `await expect(page.getByText(${toPlaywrightLiteral(targetText || stepText)})).toBeVisible();`;
  }

  if (/visible|see|display|appear|shown/i.test(stepText)) {
    return `await expect(page.getByText(${toPlaywrightLiteral(targetText || stepText)})).toBeVisible();`;
  }

  return `await expect(page).toBeTruthy();`;
}

function inferAssertionText(value) {
  const text = normalizeString(value);
  if (!text) {
    return "Dashboard";
  }

  const quotedMatch = /["'“”](.+?)["'“”]/.exec(text);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const keywordMap = [
    ["dashboard", "Dashboard"],
    ["home", "Home"],
    ["profile", "Profile"],
    ["settings", "Settings"],
    ["success", "Success"],
    ["error", "Error"],
    ["saved", "Saved"],
    ["submitted", "Submitted"],
    ["logout", "Logout"]
  ];

  for (const [keyword, label] of keywordMap) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(text)) {
      return label;
    }
  }

  return text;
}

function buildStepSnippet(step, visibleElements, state) {
  const action = inferKeywordAction(step);
  const candidates = elementCandidatesForAction(visibleElements, action);
  const ranked = candidates
    .map((element) => ({ element, score: scoreElementForStep(element, step, action) }))
    .sort((left, right) => right.score - left.score);
  const chosen = ranked[0]?.element || visibleElements[0] || null;

  if (action === "navigate") {
    const comment = `// TODO: Confirm the route for "${normalizeString(step)}" against the real app.`;
    return {
      code: `${comment}`,
      selector: null,
      warning: true
    };
  }

  if (action === "fill" && chosen) {
    const selector = buildSelectorForElement(chosen);
    const confidence = normalizeConfidence(chosen.confidence);
    const value = /password/i.test(normalizeString(step)) ? "Password@123" : "test@example.com";
    const todo = confidence !== "high" ? "// TODO: AI-predicted selector. Verify against actual DOM.\n    " : "";
    return {
      code: `${todo}await ${selector}.fill(${toPlaywrightLiteral(value)});`,
      selector,
      warning: confidence !== "high",
      element: chosen,
      confidence
    };
  }

  if (action === "click" && chosen) {
    const selector = buildSelectorForElement(chosen);
    const confidence = normalizeConfidence(chosen.confidence);
    const todo = confidence !== "high" ? "// TODO: AI-predicted selector. Verify against actual DOM.\n    " : "";
    return {
      code: `${todo}await ${selector}.click();`,
      selector,
      warning: confidence !== "high",
      element: chosen,
      confidence
    };
  }

  if (action === "select" && chosen) {
    const selector = buildSelectorForElement(chosen);
    const confidence = normalizeConfidence(chosen.confidence);
    const todo = confidence !== "high" ? "// TODO: AI-predicted selector. Verify against actual DOM.\n    " : "";
    return {
      code: `${todo}await ${selector}.selectOption(${toPlaywrightLiteral("Option 1")});`,
      selector,
      warning: confidence !== "high",
      element: chosen,
      confidence
    };
  }

  if (action === "assert") {
    const textMatch = /dashboard|success|home|profile|settings|error|message|toast/i.exec(normalizeString(step));
    const selectorText = textMatch ? textMatch[0] : normalizeString(step);
    return {
      code: buildExpectSnippet(step, selectorText),
      selector: `page.getByText(${toPlaywrightLiteral(selectorText)})`,
      warning: false,
      element: null,
      confidence: "medium"
    };
  }

  if (chosen) {
    const selector = buildSelectorForElement(chosen);
    const confidence = normalizeConfidence(chosen.confidence);
    const todo = confidence !== "high" ? "// TODO: AI-predicted selector. Verify against actual DOM.\n    " : "";
    return {
      code: `${todo}await ${selector}.click();`,
      selector,
      warning: confidence !== "high",
      element: chosen,
      confidence
    };
  }

  return {
    code: `// TODO: Could not confidently automate: ${normalizeString(step)}\n    await page.waitForTimeout(0);`,
    selector: null,
    warning: true
  };
}

function buildPlaywrightScriptFromRequest(payload = {}) {
  const { testCases, screenshotAnalysis, language, baseUrl, testFileName } = normalizePlaywrightRequest(payload);

  if (!testCases.length) {
    throw new Error("Please generate test cases first.");
  }

  const visibleElements = screenshotAnalysis.visibleElements;
  const selectorConfidence = [];
  const usedSelectors = new Set();
  const warnings = [
    ...(screenshotAnalysis.warnings.length
      ? screenshotAnalysis.warnings
      : []),
    "Selectors are AI-predicted from screenshots and may need verification against the actual DOM."
  ];

  const baseUrlExpression = baseUrl
    ? `process.env.BASE_URL || ${toPlaywrightLiteral(baseUrl)}`
    : `process.env.BASE_URL || 'https://your-app-url.com'`;
  const state = { baseUrlExpression };

  const header = [
    "import { test, expect } from '@playwright/test';",
    "",
    "test.describe('AI Generated Tests', () => {"
  ];

  for (const testCase of testCases) {
    const title = normalizeString(testCase.title, "Generated test case");
    const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
    const body = [];
    body.push(`  test(${toPlaywrightLiteral(title)}, async ({ page }) => {`);
    body.push(`    await page.goto(${baseUrlExpression});`);

    for (const step of steps) {
      const snippet = buildStepSnippet(step, visibleElements, state);
      if (snippet.selector && snippet.element) {
        const confidence = normalizeConfidence(snippet.confidence || snippet.element.confidence);
        const reason = normalizeString(snippet.element.reason, "Selector inferred from screenshot context.");
        const selectorRecord = buildSelectorConfidenceEntry(
          snippet.element,
          snippet.selector,
          confidence,
          reason
        );
        const selectorKey = `${selectorRecord.element}::${selectorRecord.selector}`;
        if (!usedSelectors.has(selectorKey)) {
          usedSelectors.add(selectorKey);
          selectorConfidence.push(selectorRecord);
        }
      }

      body.push(`    ${snippet.code}`);
    }

    const expected = normalizeString(testCase.expected_result || testCase.expectedResult);
    if (expected) {
      body.push(`    await expect(page.getByText(${toPlaywrightLiteral(inferAssertionText(expected))})).toBeVisible();`);
    }

    body.push("  });");
    header.push(body.join("\n"));
    header.push("");
  }

  header.push("});");

  return {
    script: header.join("\n").trim() + "\n",
    fileName: buildPlaywrightFileName(testFileName, language),
    selectorConfidence,
    warnings: dedupeByKey(warnings.map((warning) => ({ warning })), (item) => item.warning).map((item) => item.warning),
    language
  };
}

function buildPlaywrightFileName(requestedName, language) {
  const extension = language === "javascript" ? "js" : "ts";
  const defaultName = `generated-test.spec.${extension}`;
  const requested = normalizeString(requestedName);
  if (!requested) {
    return defaultName;
  }

  if (/\.spec\.(ts|js)$/i.test(requested)) {
    return requested.replace(/\.(ts|js)$/i, `.${extension}`);
  }

  const stripped = requested.replace(/\.(ts|js)$/i, "");
  if (/\.spec$/i.test(stripped)) {
    return `${stripped}.${extension}`;
  }

  return `${stripped || "generated-test"}.spec.${extension}`;
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

  const parsed = safeParseJsonObject(content);

  const normalized = {
    ...parsed,
    suite_name: normalizeString(parsed.suite_name || parsed.suiteName, "Test suite"),
    suite_summary: normalizeString(parsed.suite_summary || parsed.suiteSummary || parsed.summary),
    field_inventory: Array.isArray(parsed.field_inventory) ? parsed.field_inventory : Array.isArray(parsed.fieldInventory) ? parsed.fieldInventory : [],
    test_cases: Array.isArray(parsed.test_cases) ? parsed.test_cases : Array.isArray(parsed.testCases) ? parsed.testCases : [],
    screenshot_analysis: normalizeScreenshotAnalysis(parsed.screenshot_analysis || parsed.screenshotAnalysis || {}),
    playwright_script: normalizeString(parsed.playwright_script || parsed.playwrightScript),
    predicted_selectors: Array.isArray(parsed.predicted_selectors)
      ? parsed.predicted_selectors
      : Array.isArray(parsed.predictedSelectors)
        ? parsed.predictedSelectors
        : [],
    warnings: normalizeStringArray(parsed.warnings)
  };

  if (!Array.isArray(normalized.test_cases)) {
    throw new Error("OpenAI response did not include test_cases.");
  }

  return normalized;
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

async function handleGeneratePlaywrightScript(req, res) {
  try {
    const payload = await readBody(req);
    const result = buildPlaywrightScriptFromRequest(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Unable to generate Playwright script."
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

  if (req.method === "POST" && req.url === "/api/generate-playwright-script") {
    return void handleGeneratePlaywrightScript(req, res);
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
