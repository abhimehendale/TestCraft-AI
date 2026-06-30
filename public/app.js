const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const previewWrap = document.getElementById("previewWrap");
const previewGrid = document.getElementById("previewGrid");
const fileName = document.getElementById("fileName");
const clearButton = document.getElementById("clearButton");
const analyzeButton = document.getElementById("analyzeButton");
const addButton = document.getElementById("addButton");
const copyTableButton = document.getElementById("copyTableButton");
const docxButton = document.getElementById("docxButton");
const statusText = document.getElementById("statusText");
const resultsBody = document.getElementById("resultsBody");
const sourceNote = document.getElementById("sourceNote");
const generateScriptButton = document.getElementById("generateScriptButton");
const copyScriptButton = document.getElementById("copyScriptButton");
const downloadScriptButton = document.getElementById("downloadScriptButton");
const scriptLanguageSelect = document.getElementById("scriptLanguageSelect");
const baseUrlInput = document.getElementById("baseUrlInput");
const scriptViewer = document.getElementById("scriptViewer");
const scriptFileName = document.getElementById("scriptFileName");
const scriptWarning = document.getElementById("scriptWarning");
const selectorTableBody = document.getElementById("selectorTableBody");
const downloadButton = document.getElementById("downloadButton");
const toast = document.getElementById("toast");
const appConfig = window.__TESTCRAFT_CONFIG__ || {};
const apiBaseUrl = typeof appConfig.apiBaseUrl === "string" ? appConfig.apiBaseUrl.trim() : "";

const TABLE_HEADERS = [
  "ID",
  "Title",
  "Module",
  "Priority",
  "Severity",
  "Preconditions",
  "Steps",
  "Expected Result",
  "Automation Candidate"
];
const ZIP_TEXT_ENCODER = new TextEncoder();

let selectedAssets = [];
let latestResult = null;
let latestScreenshotAnalysis = null;
let currentSuite = {
  suite_name: "",
  suite_summary: "",
  field_inventory: []
};
let currentTestCases = [];
let editingRowIndex = null;
let generatedPlaywrightScript = "";
let generatedPlaywrightFileName = "generated-test.spec.ts";
let generatedSelectorConfidence = [];
let generatedScriptWarnings = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function setStatus(message, kind = "info") {
  statusText.textContent = message;
  statusText.dataset.kind = kind;
}

let toastTimer = null;

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

function stripFileExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function sanitizeFilePart(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return ascii || "test-suite";
}

function formatDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExportBaseName() {
  const suiteCandidate = sanitizeFilePart(currentSuite.suite_name);
  const fileCandidate = sanitizeFilePart(stripFileExtension(selectedAssets[0]?.file?.name || ""));
  const preferredName =
    suiteCandidate && suiteCandidate !== "test-suite"
      ? suiteCandidate
      : fileCandidate || suiteCandidate || "test-suite";
  const shortened = preferredName.slice(0, 38).replace(/-+$/g, "") || "test-suite";
  return `${shortened}-${formatDateStamp()}`;
}

function buildApiUrl(pathname) {
  if (apiBaseUrl) {
    return new URL(pathname, apiBaseUrl).toString();
  }

  return pathname;
}

function syncTableActions() {
  const hasRows = currentTestCases.length > 0;
  downloadButton.disabled = !hasRows;
  copyTableButton.disabled = !hasRows;
  docxButton.disabled = !hasRows;
  if (generateScriptButton) {
    generateScriptButton.disabled = !hasRows;
  }
}

function normalizeTestCase(testCase = {}, index = 0) {
  return {
    id: String(testCase.id || `TC-${String(index + 1).padStart(3, "0")}`),
    title: String(testCase.title || ""),
    module: String(testCase.module || ""),
    priority: String(testCase.priority || "Medium"),
    severity: String(testCase.severity || "Medium"),
    sources: Array.isArray(testCase.sources) ? testCase.sources.map((source) => String(source)) : [],
    field_refs: Array.isArray(testCase.field_refs) ? testCase.field_refs.map((ref) => String(ref)) : [],
    scenario_type: String(testCase.scenario_type || ""),
    preconditions: String(testCase.preconditions || ""),
    steps: Array.isArray(testCase.steps)
      ? testCase.steps.map((step) => String(step))
      : String(testCase.steps || "")
          .split(/\r?\n+/)
          .map((step) => step.trim())
          .filter(Boolean),
    expected_result: String(testCase.expected_result || ""),
    automation_candidate: String(testCase.automation_candidate || "No")
  };
}

function normalizeCases(testCases) {
  return Array.isArray(testCases) ? testCases.map((testCase, index) => normalizeTestCase(testCase, index)) : [];
}

function buildSourcesValue(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return "";
  }

  return sources.join(" | ");
}

function nextCaseId() {
  const ids = currentTestCases
    .map((testCase) => /^TC-(\d+)$/.exec(testCase.id || ""))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const next = (ids.length ? Math.max(...ids) : 0) + 1;
  return `TC-${String(next).padStart(3, "0")}`;
}

function nextIdFromList(cases) {
  const ids = cases
    .map((testCase) => /^TC-(\d+)$/.exec(testCase.id || ""))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const next = (ids.length ? Math.max(...ids) : 0) + 1;
  return `TC-${String(next).padStart(3, "0")}`;
}

function priorityClass(priority) {
  const normalized = String(priority || "").toLowerCase();
  if (normalized.includes("high")) {
    return "priority-high";
  }
  if (normalized.includes("low")) {
    return "priority-low";
  }
  return "priority-medium";
}

function formatDisplayValue(value) {
  return escapeHtml(String(value || "—"));
}

function formatDisplaySources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return "—";
  }

  return escapeHtml(sources.join(" | "));
}

function formatDisplaySteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "—";
  }

  return escapeHtml(steps.join(" · "));
}

function isEditing(index) {
  return editingRowIndex === index;
}

function renderRow(testCase, index) {
  const stepsValue = Array.isArray(testCase.steps) ? testCase.steps.join("\n") : "";
  if (!isEditing(index)) {
    return `
      <tr data-index="${index}">
        <td>${formatDisplayValue(testCase.id)}</td>
        <td>${formatDisplayValue(testCase.title)}</td>
        <td>${formatDisplayValue(testCase.module)}</td>
        <td><span class="${priorityClass(testCase.priority)}">${formatDisplayValue(testCase.priority)}</span></td>
        <td>${formatDisplayValue(testCase.severity)}</td>
        <td>${formatDisplayValue(testCase.preconditions)}</td>
        <td>${formatDisplaySteps(testCase.steps)}</td>
        <td>${formatDisplayValue(testCase.expected_result)}</td>
        <td>${formatDisplayValue(testCase.automation_candidate)}</td>
        <td class="actions-cell">
          <div class="actions-stack">
            <button class="row-action-button" type="button" data-action="edit-row" data-index="${index}" aria-label="Edit test case ${escapeHtml(testCase.id)}">✎</button>
            <button class="row-copy-button" type="button" data-action="copy-row" data-index="${index}" aria-label="Copy test case ${escapeHtml(testCase.id)}">⧉</button>
            <button class="row-delete-button" type="button" data-action="delete-row" data-index="${index}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-index="${index}">
      <td><input class="cell-input" data-field="id" data-index="${index}" value="${escapeHtml(testCase.id)}" /></td>
      <td><input class="cell-input" data-field="title" data-index="${index}" value="${escapeHtml(testCase.title)}" /></td>
      <td><input class="cell-input" data-field="module" data-index="${index}" value="${escapeHtml(testCase.module)}" /></td>
      <td>
        <select class="cell-select" data-field="priority" data-index="${index}">
          ${["High", "Medium", "Low"].map((option) => `<option value="${option}"${option === testCase.priority ? " selected" : ""}>${option}</option>`).join("")}
        </select>
      </td>
      <td>
        <select class="cell-select" data-field="severity" data-index="${index}">
          ${["High", "Medium", "Low"].map((option) => `<option value="${option}"${option === testCase.severity ? " selected" : ""}>${option}</option>`).join("")}
        </select>
      </td>
      <td><input class="cell-input" data-field="preconditions" data-index="${index}" value="${escapeHtml(testCase.preconditions)}" /></td>
      <td><textarea class="cell-textarea" data-field="steps" data-index="${index}">${escapeHtml(stepsValue)}</textarea></td>
      <td><textarea class="cell-textarea" data-field="expected_result" data-index="${index}">${escapeHtml(testCase.expected_result)}</textarea></td>
      <td>
        <select class="cell-select" data-field="automation_candidate" data-index="${index}">
          ${["Yes", "No"].map((option) => `<option value="${option}"${option === testCase.automation_candidate ? " selected" : ""}>${option}</option>`).join("")}
        </select>
      </td>
      <td class="actions-cell">
        <div class="actions-stack">
          <button class="row-save-button" type="button" data-action="save-row" data-index="${index}">Save</button>
          <button class="row-cancel-button" type="button" data-action="cancel-row" data-index="${index}">Cancel</button>
          <button class="row-copy-button" type="button" data-action="copy-row" data-index="${index}" aria-label="Copy test case ${escapeHtml(testCase.id)}">⧉</button>
          <button class="row-delete-button" type="button" data-action="delete-row" data-index="${index}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTable() {
  if (!Array.isArray(currentTestCases) || currentTestCases.length === 0) {
    resultsBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="10">No test cases yet. Upload one or more screenshots, generate a suite, or add a new test case.</td>
      </tr>
    `;
    return;
  }

  resultsBody.innerHTML = currentTestCases.map((testCase, index) => renderRow(testCase, index)).join("");
}

function startEditingRow(index) {
  editingRowIndex = index;
  renderTable();
}

function cancelEditingRow() {
  editingRowIndex = null;
  renderTable();
}

function saveEditingRow(index) {
  updateRow(index, "id", getValueFromCell(index, "id"));
  updateRow(index, "title", getValueFromCell(index, "title"));
  updateRow(index, "module", getValueFromCell(index, "module"));
  updateRow(index, "priority", getValueFromCell(index, "priority"));
  updateRow(index, "severity", getValueFromCell(index, "severity"));
  updateRow(index, "preconditions", getValueFromCell(index, "preconditions"));
  updateRow(index, "steps", getValueFromCell(index, "steps"));
  updateRow(index, "expected_result", getValueFromCell(index, "expected_result"));
  updateRow(index, "automation_candidate", getValueFromCell(index, "automation_candidate"));
  editingRowIndex = null;
  renderTable();
  setStatus("Saved test case changes.", "success");
}

function getValueFromCell(index, field) {
  const selector = `[data-index="${index}"][data-field="${field}"]`;
  const element = resultsBody.querySelector(selector);
  if (!element) {
    return "";
  }

  if (element instanceof HTMLSelectElement || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  return "";
}

function updateRow(index, field, value) {
  const current = currentTestCases[index];
  if (!current) {
    return;
  }

  if (field === "steps") {
    current.steps = String(value)
      .split(/\r?\n+/)
      .map((step) => step.trim())
      .filter(Boolean);
    return;
  }

  current[field] = String(value);
}

function deleteRow(index) {
  if (editingRowIndex === index) {
    editingRowIndex = null;
  } else if (editingRowIndex !== null && index < editingRowIndex) {
    editingRowIndex -= 1;
  }
  currentTestCases.splice(index, 1);
  currentTestCases = normalizeCases(currentTestCases);
  renderTable();
  syncTableActions();
}

function addBlankCase() {
  currentTestCases.push(
    normalizeTestCase(
      {
        id: nextCaseId(),
        title: "New test case",
        module: "Workflow",
        priority: "Medium",
        severity: "Medium",
        sources: [],
        field_refs: [],
        scenario_type: "custom",
        preconditions: "",
        steps: [],
        expected_result: "",
        automation_candidate: "No"
      },
      currentTestCases.length
    )
  );
  editingRowIndex = currentTestCases.length - 1;
  renderTable();
  syncTableActions();
  addButton.disabled = false;
  setStatus("Added a new editable test case row.", "success");
}

function buildClientSupplementalCases(existingCases, fieldInventory, sourceLabels) {
  const inventory = Array.isArray(fieldInventory) && fieldInventory.length ? fieldInventory : [];
  const sources = Array.isArray(sourceLabels) && sourceLabels.length ? sourceLabels : ["Screenshot 1"];
  const firstSource = sources[0];
  const secondSource = sources[1] || firstSource;
  const allSources = sources;
  const seenTitles = new Set(existingCases.map((testCase) => String(testCase.title || "").toLowerCase()));
  const supplemental = [];
  const requiredCount = inventory.filter((field) => field.required).length;
  const targetCount = Math.max(0, inventory.length * 4 + requiredCount * 2 + sources.length * 6);
  let nextId = nextIdFromList(existingCases);
  let nextNumber = Number((/^TC-(\d+)$/.exec(nextId) || [null, "1"])[1]);

  const makeCase = (partial) => {
    if (existingCases.length + supplemental.length >= targetCount) {
      return;
    }

    const key = String(partial.title || "").toLowerCase();
    if (!key || seenTitles.has(key)) {
      return;
    }

    seenTitles.add(key);
    supplemental.push(
      normalizeTestCase(
        {
          id: `TC-${String(nextNumber++).padStart(3, "0")}`,
          priority: "Medium",
          severity: "Medium",
          automation_candidate: "Yes",
          sources: [firstSource],
          field_refs: [],
          scenario_type: "workflow",
          ...partial
        },
        existingCases.length + supplemental.length
      )
    );
  };

  for (const field of inventory) {
    const label = String(field.label || field.section || "Field");
    const section = String(field.section || "General");
    const type = String(field.field_type || "text").toLowerCase();
    const common = {
      field_refs: [label],
      sources: Array.isArray(field.sources) && field.sources.length ? field.sources.map(String) : [firstSource]
    };

    if (type.includes("text")) {
      makeCase({
        ...common,
        title: `Validate ${label} accepts a valid value`,
        module: "Validation",
        scenario_type: "happy path",
        priority: field.required ? "High" : "Medium",
        severity: field.required ? "High" : "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Enter a valid value in ${label}.`,
          "Move to the next field.",
          "Confirm the value is retained."
        ],
        expected_result: `${label} accepts a valid value.`
      });

      makeCase({
        ...common,
        title: `Validate ${label} rejects invalid or missing input`,
        module: "Validation",
        scenario_type: "validation",
        priority: field.required ? "High" : "Medium",
        severity: field.required ? "High" : "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Leave ${label} empty or enter invalid text.`,
          "Attempt to continue.",
          "Verify the validation feedback."
        ],
        expected_result: `${label} shows the correct validation behavior.`
      });
    } else if (type.includes("numeric") || type.includes("date")) {
      makeCase({
        ...common,
        title: `Validate ${label} boundary values`,
        module: "Validation",
        scenario_type: "boundary",
        priority: field.required ? "High" : "Medium",
        severity: field.required ? "High" : "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Enter the minimum supported value for ${label}.`,
          `Enter the maximum supported value for ${label}.`,
          "Verify the field enforces bounds."
        ],
        expected_result: `${label} accepts valid boundary values.`
      });

      makeCase({
        ...common,
        title: `Validate ${label} rejects malformed values`,
        module: "Validation",
        scenario_type: "validation",
        priority: "High",
        severity: "High",
        preconditions: `${section} is visible.`,
        steps: [
          `Enter a malformed value into ${label}.`,
          "Attempt to proceed.",
          "Verify the error state is shown."
        ],
        expected_result: `${label} rejects malformed values.`
      });
    } else if (type.includes("dropdown") || type.includes("radio")) {
      makeCase({
        ...common,
        title: `Validate ${label} option coverage`,
        module: "Navigation",
        scenario_type: "happy path",
        priority: "High",
        severity: "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Open ${label}.`,
          "Review all available options.",
          "Select a non-default option and verify it persists."
        ],
        expected_result: `${label} exposes and retains options correctly.`
      });

      makeCase({
        ...common,
        title: `Validate ${label} keyboard behavior`,
        module: "Accessibility",
        scenario_type: "accessibility",
        priority: "Medium",
        severity: "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Focus ${label} using the keyboard.`,
          "Open it and navigate options.",
          "Confirm keyboard-only use works."
        ],
        expected_result: `${label} works correctly with keyboard input.`
      });
    } else if (type.includes("file-upload") || type.includes("upload")) {
      makeCase({
        ...common,
        title: `Validate ${label} accepts supported files`,
        module: "Data",
        scenario_type: "upload",
        priority: "High",
        severity: "High",
        preconditions: `${section} upload is visible.`,
        steps: [
          `Upload a supported file to ${label}.`,
          "Upload multiple files if allowed.",
          "Confirm the preview or attachment state updates."
        ],
        expected_result: `${label} accepts supported files and shows feedback.`
      });

      makeCase({
        ...common,
        title: `Validate ${label} replacement and removal`,
        module: "Workflow",
        scenario_type: "workflow",
        priority: "Medium",
        severity: "Medium",
        preconditions: `${section} upload is visible.`,
        steps: [
          `Upload a file into ${label}.`,
          "Replace or remove it.",
          "Verify the state updates correctly."
        ],
        expected_result: `${label} supports replace and remove behavior.`
      });
    } else if (type.includes("button") || type.includes("icon button")) {
      makeCase({
        ...common,
        title: `Validate ${label} action state`,
        module: "Workflow",
        scenario_type: "workflow",
        priority: "High",
        severity: "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Inspect when ${label} is enabled.`,
          `Click ${label}.`,
          "Verify the expected action occurs."
        ],
        expected_result: `${label} triggers the expected action.`
      });

      makeCase({
        ...common,
        title: `Validate ${label} with unsaved changes`,
        module: "Workflow",
        scenario_type: "workflow",
        priority: "High",
        severity: "Medium",
        preconditions: `${section} is visible and unsaved changes exist.`,
        steps: [
          "Make changes in the form.",
          `Activate ${label}.`,
          "Confirm the unsaved-state behavior is correct."
        ],
        expected_result: `${label} behaves correctly with pending edits.`
      });
    } else {
      makeCase({
        ...common,
        title: `Validate ${label} behavior`,
        module: "Workflow",
        scenario_type: "workflow",
        priority: "Medium",
        severity: "Medium",
        preconditions: `${section} is visible.`,
        steps: [
          `Interact with ${label}.`,
          "Observe the resulting state.",
          "Confirm the control behaves as expected."
        ],
        expected_result: `${label} behaves consistently.`
      });
    }
  }

  const genericCases = [
    {
      title: "Validate required fields block submission",
      module: "Validation",
      scenario_type: "validation",
      priority: "High",
      severity: "High",
      sources: allSources,
      field_refs: inventory.filter((field) => field.required).map((field) => field.label).slice(0, 5),
      preconditions: "The modal is open with required fields visible.",
      steps: ["Leave one required field blank.", "Attempt to submit.", "Confirm submission is blocked."],
      expected_result: "The form blocks submission until required fields are completed."
    },
    {
      title: "Validate cross-field consistency for related inputs",
      module: "Validation",
      scenario_type: "data integrity",
      priority: "High",
      severity: "High",
      sources: allSources,
      field_refs: inventory.slice(0, 4).map((field) => field.label),
      preconditions: "Related fields are visible.",
      steps: ["Enter conflicting values across related fields.", "Attempt to submit.", "Verify the correct field is flagged."],
      expected_result: "Cross-field validation catches mismatched input."
    },
    {
      title: "Validate keyboard tab order across the modal",
      module: "Accessibility",
      scenario_type: "accessibility",
      priority: "Medium",
      severity: "Medium",
      sources: allSources,
      field_refs: inventory.slice(0, 5).map((field) => field.label),
      preconditions: "The modal is open.",
      steps: ["Use Tab through the controls.", "Confirm the order matches the layout.", "Use Shift+Tab to reverse."],
      expected_result: "Keyboard focus follows a logical order."
    },
    {
      title: "Validate responsive layout on smaller screens",
      module: "UI Quality",
      scenario_type: "responsive",
      priority: "Medium",
      severity: "Medium",
      sources: allSources,
      field_refs: inventory.slice(0, 5).map((field) => field.label),
      preconditions: "The modal is open on desktop and mobile widths.",
      steps: ["Resize to tablet width.", "Resize to mobile width.", "Check for overlap or clipping."],
      expected_result: "The layout remains usable across breakpoints."
    },
    {
      title: "Validate cancel and close behavior with unsaved changes",
      module: "Workflow",
      scenario_type: "workflow",
      priority: "High",
      severity: "High",
      sources: allSources,
      field_refs: ["Cancel", "Close modal"],
      preconditions: "The form contains unsaved changes.",
      steps: ["Make edits.", "Use Cancel or the close icon.", "Reopen the form and inspect the state."],
      expected_result: "Cancel and close behave predictably with unsaved changes."
    },
    {
      title: "Validate optional fields do not block submission",
      module: "Validation",
      scenario_type: "happy path",
      priority: "Medium",
      severity: "Medium",
      sources: allSources,
      field_refs: inventory.filter((field) => !field.required).map((field) => field.label).slice(0, 4),
      preconditions: "Optional fields are visible.",
      steps: ["Leave optional fields blank.", "Complete the required fields.", "Attempt to submit."],
      expected_result: "Optional fields remain optional."
    }
  ];

  for (const testCase of genericCases) {
    if (existingCases.length + supplemental.length >= targetCount) {
      break;
    }

    const titleKey = String(testCase.title || "").toLowerCase();
    if (!seenTitles.has(titleKey)) {
      seenTitles.add(titleKey);
      supplemental.push(
        normalizeTestCase(
          {
            id: `TC-${String(nextNumber++).padStart(3, "0")}`,
            automation_candidate: "Yes",
            ...testCase
          },
          existingCases.length + supplemental.length
        )
      );
    }
  }

  return supplemental;
}

function syncSuiteFromResult(data) {
  currentSuite = {
    suite_name: String(data?.suite_name || "Test suite"),
    suite_summary: String(data?.suite_summary || data?.source || ""),
    field_inventory: Array.isArray(data?.field_inventory) ? data.field_inventory : []
  };
  currentTestCases = normalizeCases(data?.test_cases);
  latestScreenshotAnalysis = data?.screenshot_analysis || data?.screenshotAnalysis || null;
  editingRowIndex = null;
}

function normalizeSelectorConfidenceEntry(entry = {}) {
  return {
    element: String(entry.element || entry.elementName || "UI element"),
    selector: String(entry.selector || entry.likelySelector || ""),
    confidence: String(entry.confidence || "medium").toLowerCase(),
    reason: String(entry.reason || "")
  };
}

function syncScriptResult(data) {
  generatedPlaywrightScript = String(data?.script || data?.playwrightScript || "");
  generatedPlaywrightFileName = String(data?.fileName || data?.file_name || buildScriptFileName(normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript")));
  generatedSelectorConfidence = Array.isArray(data?.selectorConfidence || data?.selector_confidence)
    ? (data.selectorConfidence || data.selector_confidence).map((entry) => normalizeSelectorConfidenceEntry(entry))
    : [];
  generatedScriptWarnings = Array.isArray(data?.warnings) ? data.warnings.map((warning) => String(warning)) : [];
  renderGeneratedScript();
}

function ensureClientDepth() {
  const sourceLabels = selectedAssets.map((asset, index) => `Screenshot ${index + 1}: ${asset.file.name}`);
  const supplemental = buildClientSupplementalCases(currentTestCases, currentSuite.field_inventory, sourceLabels);
  if (supplemental.length > 0) {
    currentTestCases = normalizeCases([...currentTestCases, ...supplemental]);
  }
}

function toTableRows(testCases) {
  return testCases.map((testCase) => [
    testCase.id,
    testCase.title,
    testCase.module,
    testCase.priority,
    testCase.severity,
    testCase.preconditions,
    Array.isArray(testCase.steps) ? testCase.steps.join(" | ") : "",
    testCase.expected_result,
    testCase.automation_candidate
  ]);
}

function getTableMatrix(testCases) {
  return [TABLE_HEADERS, ...toTableRows(testCases)];
}

function serializeDelimited(rows, delimiter) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const stringValue = String(cell ?? "");
          if (delimiter === ",") {
            return `"${stringValue.replaceAll('"', '""')}"`;
          }
          return stringValue.replace(/\r?\n/g, " ");
        })
        .join(delimiter)
    )
    .join("\n");
}

function toCsv(testCases) {
  return serializeDelimited(getTableMatrix(testCases), ",");
}

function toTabbedText(testCases) {
  return serializeDelimited(getTableMatrix(testCases), "\t");
}

function toSingleRowTabbedText(testCase) {
  return serializeDelimited(getTableMatrix([testCase]), "\t");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeScriptLanguage(value) {
  return String(value || "typescript").toLowerCase() === "javascript" ? "javascript" : "typescript";
}

function buildDefaultBaseUrl() {
  return "https://example.com";
}

function buildScriptBaseUrl() {
  const value = String(baseUrlInput?.value || "").trim();
  return value || buildDefaultBaseUrl();
}

function buildScriptFileName(language = "typescript") {
  return language === "javascript" ? "generated-test.spec.js" : "generated-test.spec.ts";
}

function updateScriptFileName() {
  const language = normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript");
  generatedPlaywrightFileName = buildScriptFileName(language);
  if (scriptFileName) {
    scriptFileName.textContent = generatedPlaywrightFileName;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightPlaywrightCode(code) {
  const escaped = escapeHtml(code);
  const commentPattern = /(^|\n)(\s*\/\/.*)/g;
  const stringPattern = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g;
  const keywordPattern = /\b(import|from|test|describe|async|await|const|let|var|if|else|return|new|try|catch|throw|expect|process|env|true|false|null|undefined)\b/g;

  return escaped
    .replace(commentPattern, (_, prefix, comment) => `${prefix}<span class="code-comment">${comment}</span>`)
    .replace(stringPattern, '<span class="code-string">$1</span>')
    .replace(keywordPattern, '<span class="code-keyword">$1</span>');
}

function confidenceClass(confidence) {
  const normalized = String(confidence || "").toLowerCase();
  if (normalized === "high") {
    return "confidence-high";
  }
  if (normalized === "low") {
    return "confidence-low";
  }
  return "confidence-medium";
}

function renderScriptWarnings(warnings = []) {
  if (!scriptWarning) {
    return;
  }

  const list = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  if (!list.length) {
    scriptWarning.classList.add("hidden");
    scriptWarning.textContent = "";
    return;
  }

  scriptWarning.textContent = list.join(" ");
  scriptWarning.classList.remove("hidden");
}

function renderSelectorConfidenceTable(entries = []) {
  if (!selectorTableBody) {
    return;
  }

  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) {
    selectorTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">Generate a Playwright script to see AI-predicted selectors here.</td>
      </tr>
    `;
    return;
  }

  selectorTableBody.innerHTML = rows
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.element || "—")}</td>
          <td><code>${escapeHtml(entry.selector || "—")}</code></td>
          <td><span class="confidence-pill ${confidenceClass(entry.confidence)}">${escapeHtml(entry.confidence || "medium")}</span></td>
          <td>${escapeHtml(entry.reason || "Selector inferred from screenshot context.")}</td>
        </tr>
      `
    )
    .join("");
}

function renderGeneratedScript() {
  if (!scriptViewer) {
    return;
  }

  const code = generatedPlaywrightScript || "Generate test cases first, then click Generate Playwright Script.";
  scriptViewer.innerHTML = highlightPlaywrightCode(code);
  if (copyScriptButton) {
    copyScriptButton.disabled = !generatedPlaywrightScript;
  }
  if (downloadScriptButton) {
    downloadScriptButton.disabled = !generatedPlaywrightScript;
  }
  if (scriptFileName) {
    scriptFileName.textContent = generatedPlaywrightFileName || buildScriptFileName(normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript"));
  }
  renderSelectorConfidenceTable(generatedSelectorConfidence);
  renderScriptWarnings(generatedScriptWarnings);
}

function resetGeneratedScriptState() {
  generatedPlaywrightScript = "";
  generatedSelectorConfidence = [];
  generatedScriptWarnings = [];
  generatedPlaywrightFileName = buildScriptFileName(normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript"));
  renderGeneratedScript();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Clipboard copy failed.");
    }
  } finally {
    document.body.removeChild(textArea);
  }
}

function getSnapshotForRow(index) {
  const current = currentTestCases[index];
  if (!current) {
    return null;
  }

  if (!isEditing(index)) {
    return normalizeTestCase(current, index);
  }

  return normalizeTestCase(
    {
      ...current,
      sources: getValueFromCell(index, "sources")
        .split("|")
        .map((source) => source.trim())
        .filter(Boolean),
      id: getValueFromCell(index, "id"),
      title: getValueFromCell(index, "title"),
      module: getValueFromCell(index, "module"),
      priority: getValueFromCell(index, "priority"),
      severity: getValueFromCell(index, "severity"),
      preconditions: getValueFromCell(index, "preconditions"),
      steps: getValueFromCell(index, "steps"),
      expected_result: getValueFromCell(index, "expected_result"),
      automation_candidate: getValueFromCell(index, "automation_candidate")
    },
    index
  );
}

async function copyRow(index) {
  const snapshot = getSnapshotForRow(index);
  if (!snapshot) {
    return;
  }

  await copyTextToClipboard(toSingleRowTabbedText(snapshot));
  setStatus(`Copied ${snapshot.id || `row ${index + 1}`} to the clipboard.`, "success");
  showToast("Row has been copied");
}

async function copyEntireTable() {
  if (!currentTestCases.length) {
    return;
  }

  await copyTextToClipboard(toTabbedText(currentTestCases));
  setStatus(`Copied ${currentTestCases.length} test cases to the clipboard.`, "success");
}

function normalizeDocxText(value) {
  const normalized = String(value ?? "")
    .replace(/\r?\n+/g, " | ")
    .trim();
  return normalized || "—";
}

function createDocxRun(text, { bold = false } = {}) {
  const runProps = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:r>${runProps}<w:t xml:space="preserve">${escapeXml(normalizeDocxText(text))}</w:t></w:r>`;
}

function createDocxParagraph(text, options = {}) {
  const spacing = options.tight ? '<w:pPr><w:spacing w:after="120"/></w:pPr>' : "";
  return `<w:p>${spacing}${createDocxRun(text, options)}</w:p>`;
}

function createDocxTableCell(text, { bold = false } = {}) {
  return `
    <w:tc>
      <w:tcPr><w:tcW w:w="1080" w:type="dxa"/></w:tcPr>
      <w:p>${createDocxRun(text, { bold })}</w:p>
    </w:tc>
  `;
}

function buildDocxDocumentXml() {
  const tableRows = getTableMatrix(currentTestCases)
    .map((row, rowIndex) => `<w:tr>${row.map((cell) => createDocxTableCell(cell, { bold: rowIndex === 0 })).join("")}</w:tr>`)
    .join("");

  const summary = currentSuite.suite_summary || "Generated from uploaded screenshots.";
  const sourceNames = selectedAssets.map((asset) => asset.file.name).join(" | ");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${createDocxParagraph(currentSuite.suite_name || "Test suite", { bold: true, tight: true })}
    ${createDocxParagraph(summary, { tight: true })}
    ${sourceNames ? createDocxParagraph(`Sources: ${sourceNames}`, { tight: true }) : ""}
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0"/>
          <w:left w:val="single" w:sz="8" w:space="0"/>
          <w:bottom w:val="single" w:sz="8" w:space="0"/>
          <w:right w:val="single" w:sz="8" w:space="0"/>
          <w:insideH w:val="single" w:sz="6" w:space="0"/>
          <w:insideV w:val="single" w:sz="6" w:space="0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${TABLE_HEADERS.map(() => '<w:gridCol w:w="1200"/>').join("")}</w:tblGrid>
      ${tableRows}
    </w:tbl>
    <w:sectPr>
      <w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="400" w:footer="400" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function toUint8Array(value) {
  return value instanceof Uint8Array ? value : ZIP_TEXT_ENCODER.encode(String(value));
}

function getCrc32Table() {
  if (getCrc32Table.cache) {
    return getCrc32Table.cache;
  }

  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let shift = 0; shift < 8; shift += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }

  getCrc32Table.cache = table;
  return table;
}

function crc32(bytes) {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date = new Date()) {
  const safeYear = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getSeconds() >> 1) |
    (date.getMinutes() << 5) |
    (date.getHours() << 11);
  const dosDate =
    date.getDate() |
    ((date.getMonth() + 1) << 5) |
    ((safeYear - 1980) << 9);

  return { dosDate, dosTime };
}

function concatBytes(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function createStoredZip(files) {
  const { dosDate, dosTime } = toDosDateTime();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = ZIP_TEXT_ENCODER.encode(file.name);
    const dataBytes = toUint8Array(file.data);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localChunks.push(localHeader, dataBytes);
    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localChunks, centralDirectory, endRecord]);
}

function buildDocxBlob() {
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: "word/document.xml",
      data: buildDocxDocumentXml()
    }
  ];

  return new Blob([createStoredZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function resetState() {
  selectedAssets = [];
  latestResult = null;
  latestScreenshotAnalysis = null;
  currentSuite = {
    suite_name: "",
    suite_summary: "",
    field_inventory: []
  };
  currentTestCases = [];
  resetGeneratedScriptState();
  fileInput.value = "";
  previewWrap.classList.add("hidden");
  previewGrid.innerHTML = "";
  fileName.textContent = "None";
  analyzeButton.disabled = true;
  addButton.disabled = false;
  syncTableActions();
  sourceNote.textContent = "The generated rows will appear here.";
  resultsBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="10">No test cases yet. Upload one or more screenshots and click Generate test suite.</td>
    </tr>
  `;
  setStatus("Upload one or more screenshots to start analyzing.");
}

async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

async function readFilesAsAssets(files) {
  const assets = [];

  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    assets.push({
      file,
      dataUrl
    });
  }

  return assets;
}

function renderPreviews(assets) {
  previewGrid.innerHTML = assets
    .map(
      ({ file, dataUrl }, index) => `
        <div class="preview-tile">
          <img src="${dataUrl}" alt="Screenshot preview ${index + 1}" />
          <span>${escapeHtml(file.name)}</span>
        </div>
      `
    )
    .join("");
}

async function handleSelection(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  if (!files.length) {
    resetState();
    return;
  }

  selectedAssets = await readFilesAsAssets(files);
  resetGeneratedScriptState();
  renderPreviews(selectedAssets);
  fileName.textContent = files.length === 1 ? files[0].name : `${files.length} screenshots selected`;
  previewWrap.classList.remove("hidden");
  analyzeButton.disabled = false;
  setStatus(
    files.length === 1
      ? `Ready to analyze ${files[0].name}.`
      : `Ready to analyze ${files.length} screenshots as one suite.`
  );
}

async function analyzeScreenshot() {
  if (!selectedAssets.length) {
    setStatus("Upload one or more screenshots first.", "error");
    return;
  }

  analyzeButton.disabled = true;
  downloadButton.disabled = true;
  copyTableButton.disabled = true;
  docxButton.disabled = true;
  addButton.disabled = true;
  setStatus("Generating a suite from the screenshots...", "busy");

  try {
    const response = await fetch(buildApiUrl("/api/analyze"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageDataUrl: selectedAssets[0]?.dataUrl || "",
        files: selectedAssets.map(({ file, dataUrl }) => ({
          filename: file.name,
          imageDataUrl: dataUrl
        }))
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Analysis request failed.");
    }

    latestResult = data;
    syncSuiteFromResult(data);
    resetGeneratedScriptState();
    ensureClientDepth();
    renderTable();
    const fieldCount = Array.isArray(data.field_inventory) ? data.field_inventory.length : 0;
    sourceNote.textContent =
      data.mode === "demo"
        ? `Demo mode: ${currentSuite.suite_name || "Test suite"}. ${currentSuite.suite_summary}.${fieldCount ? ` Field inventory: ${fieldCount} items.` : ""} Add OPENAI_API_KEY to switch to AI-backed analysis.`
        : `AI mode: ${currentSuite.suite_name || "Test suite"}. ${currentSuite.suite_summary}.${fieldCount ? ` Field inventory: ${fieldCount} items.` : ""}`;
    addButton.disabled = false;
    syncTableActions();
    setStatus(
      `Generated ${currentTestCases.length} test cases for ${currentSuite.suite_name || "the suite"}.`,
      "success"
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "An unexpected error occurred.", "error");
  } finally {
    analyzeButton.disabled = !selectedAssets.length;
  }
}

function downloadCsv() {
  if (!currentTestCases?.length) {
    return;
  }

  const blob = new Blob([toCsv(currentTestCases)], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${buildExportBaseName()}.csv`);
  setStatus("Exported the current table as CSV.", "success");
}

function downloadDocx() {
  if (!currentTestCases?.length) {
    return;
  }

  triggerDownload(buildDocxBlob(), `${buildExportBaseName()}.docx`);
  setStatus("Exported the current table as DOCX.", "success");
}

function buildPlaywrightRequestBody() {
  const language = normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript");
  return {
    testCases: currentTestCases.map((testCase) => ({
      title: testCase.title,
      steps: Array.isArray(testCase.steps) ? testCase.steps : [],
      expectedResult: testCase.expected_result
    })),
    screenshotAnalysis: latestScreenshotAnalysis || {},
    language,
    baseUrl: buildScriptBaseUrl(),
    testFileName: buildScriptFileName(language)
  };
}

async function generatePlaywrightScript() {
  if (!currentTestCases.length) {
    setStatus("Please generate test cases first.", "error");
    return;
  }

  if (generateScriptButton) {
    generateScriptButton.disabled = true;
  }
  if (copyScriptButton) {
    copyScriptButton.disabled = true;
  }
  if (downloadScriptButton) {
    downloadScriptButton.disabled = true;
  }
  setStatus("Generating Playwright script from the current test cases...", "busy");

  try {
    const response = await fetch(buildApiUrl("/api/generate-playwright-script"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildPlaywrightRequestBody())
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error("Could not parse Playwright script response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Script generation failed.");
    }

    syncScriptResult(data);

    const warningCount = Array.isArray(generatedScriptWarnings) ? generatedScriptWarnings.length : 0;
    setStatus(
      warningCount
        ? `Generated ${generatedPlaywrightFileName} with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
        : `Generated ${generatedPlaywrightFileName}.`,
      "success"
    );
    if (warningCount) {
      showToast("Script generated with AI selector warnings");
    } else {
      showToast("Playwright script generated");
    }
  } catch (error) {
    generatedPlaywrightScript = "";
    generatedSelectorConfidence = [];
    generatedScriptWarnings = [error instanceof Error ? error.message : "Script generation failed."];
    renderGeneratedScript();
    setStatus(error instanceof Error ? error.message : "Script generation failed.", "error");
  } finally {
    if (generateScriptButton) {
      generateScriptButton.disabled = !currentTestCases.length;
    }
  }
}

async function copyPlaywrightScript() {
  if (!generatedPlaywrightScript) {
    setStatus("Please generate a Playwright script first.", "error");
    return;
  }

  await copyTextToClipboard(generatedPlaywrightScript);
  setStatus("Copied the Playwright script to the clipboard.", "success");
  showToast("Playwright script copied");
}

function downloadPlaywrightScript() {
  if (!generatedPlaywrightScript) {
    setStatus("Please generate a Playwright script first.", "error");
    return;
  }

  const blob = new Blob([generatedPlaywrightScript], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, generatedPlaywrightFileName || buildScriptFileName(normalizeScriptLanguage(scriptLanguageSelect?.value || "typescript")));
  setStatus(`Downloaded ${generatedPlaywrightFileName || "generated-test.spec.ts"}.`, "success");
}

fileInput.addEventListener("change", async (event) => {
  const files = event.target.files;
  if (files?.length) {
    await handleSelection(files);
  }
});

clearButton.addEventListener("click", resetState);
analyzeButton.addEventListener("click", analyzeScreenshot);
downloadButton.addEventListener("click", downloadCsv);
copyTableButton.addEventListener("click", async () => {
  try {
    await copyEntireTable();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to copy the table.", "error");
  }
});
docxButton.addEventListener("click", downloadDocx);
addButton.addEventListener("click", addBlankCase);
if (generateScriptButton) {
  generateScriptButton.addEventListener("click", () => {
    generatePlaywrightScript().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Script generation failed.", "error");
    });
  });
}
if (copyScriptButton) {
  copyScriptButton.addEventListener("click", () => {
    copyPlaywrightScript().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Unable to copy the script.", "error");
    });
  });
}
if (downloadScriptButton) {
  downloadScriptButton.addEventListener("click", downloadPlaywrightScript);
}
if (scriptLanguageSelect) {
  scriptLanguageSelect.addEventListener("change", () => {
    updateScriptFileName();
    renderGeneratedScript();
  });
}
if (baseUrlInput) {
  baseUrlInput.addEventListener("input", () => {
    if (generatedPlaywrightScript) {
      setStatus("Base URL updated. Generate the script again to apply the new URL.", "info");
    }
  });
}

resultsBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const index = Number(target.dataset.index);
  if (!action || Number.isNaN(index)) {
    return;
  }

  if (action === "edit-row") {
    startEditingRow(index);
    return;
  }

  if (action === "cancel-row") {
    cancelEditingRow();
    return;
  }

  if (action === "save-row") {
    saveEditingRow(index);
    return;
  }

  if (action === "copy-row") {
    copyRow(index).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Unable to copy the row.", "error");
    });
    return;
  }

  if (action === "delete-row") {
    deleteRow(index);
  }
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const files = event.dataTransfer.files;
  if (files?.length) {
    await handleSelection(files);
  }
});

resetState();
updateScriptFileName();
renderGeneratedScript();
