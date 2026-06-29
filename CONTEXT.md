# Project Context

This document is the working memory for TestCraft AI. Keep it updated when the product shape, UI behavior, or generation strategy changes.

## Product Goal

- Build a system where a user uploads one or more screenshots of a target system.
- The system generates a QA test suite in table form.
- The table should be reviewable, editable, and exportable.
- The target use case is screenshot-driven test case generation for UI flows, forms, modal dialogs, uploads, and validation-heavy screens.

## Current User Preferences

- Go deeper than a generic test list.
- Do not stop at a fixed count like 11 or 12 just because it is convenient.
- For multi-screenshot inputs, treat them as one suite and infer flow across screenshots.
- Focus on field-level, cross-field, workflow, upload, validation, accessibility, responsive, and error-state coverage.
- Prefer text-first table output.
- Use a pencil icon in the action column to enter edit mode.
- Use a copy icon in the action column to copy a single row.
- Keep rows read-only by default.
- Allow adding a new test case directly from the table.
- Export must reflect the current edited table state.
- Support full-table copy in tabular form.
- Support both CSV and DOCX export with short readable filenames.
- Keep the interface clean and QA-oriented rather than decorative.

## Current UI Behavior

- The upload control accepts one or more images.
- Selected screenshots are shown as preview tiles.
- The table shows plain text in view mode.
- The action column contains:
  - Pencil icon to edit a row
  - Copy icon to copy one row
  - Delete action to remove a row
- In edit mode, a row switches to fields plus Save and Cancel.
- Add Test Case inserts a new editable row.
- CSV export uses the live current table, not the original model response.
- DOCX export uses the same live table state.
- Copy Table copies the current visible dataset as a tabular clipboard payload.

## Current Analysis Strategy

- The model is instructed to:
  - extract a field inventory
  - identify sections and actions
  - generate a deep suite rather than a shallow list
  - avoid stopping at an arbitrary number like 11
  - cover at least:
    - happy path
    - invalid/missing input
    - boundary/edge behavior
    - dropdown behavior
    - upload behavior
    - modal behavior
    - cross-field validation
    - accessibility
    - keyboard navigation
    - responsive layout
    - error states
- The backend also expands results if the raw model output is too shallow.

## Screenshot Examples Observed So Far

### Create New Property modal

Visible elements seen in uploaded screenshots:

- Property Name or Identifier
- Property Address
- City
- State dropdown
- ZIP Code
- Property Type dropdown
- Square Footage
- Year Built
- Notes textarea
- Photos upload area
- Documents section
- Documents category dropdown
- Documents upload area
- Cancel button
- Create Property button
- Close icon

Important behaviors to cover:

- Required field validation
- Cross-field address/state/ZIP consistency
- Dropdown option coverage
- Numeric boundaries for square footage and year built
- Notes freeform text handling
- Photo upload accepted/rejected files, size limits, multiple files
- Document upload accepted/rejected files
- Cancel/close behavior with unsaved changes

## Implementation Notes

- The backend should stay tolerant of both:
  - batch payloads with `files[]`
  - legacy single-image fallback payloads
- The app should continue working in demo mode without `OPENAI_API_KEY`.
- Prefer clear error messages over silent failure.
- Keep generated data normalized before rendering or exporting.

## Coding Preferences

- Keep the code readable and direct.
- Favor explicit state over hidden magic.
- Keep tables simple and text-first.
- Use small, understandable helpers.
- Preserve existing user changes unless explicitly asked to remove them.
- Do not introduce destructive git or filesystem actions without explicit permission.

## Verification Preferences

- Run syntax checks after edits when possible.
- If the sandbox blocks starting a server, verify by importing/parsing the modules instead.
- When something breaks, fix the actual source of the break rather than only masking it in the UI.

## Open Follow-Ups

- Consider splitting generated test cases into labeled sections like:
  - field validation
  - upload/document behavior
  - workflow and modal behavior
  - accessibility
  - cross-field rules
- Consider adding a suite summary panel if the table grows too large.
- Consider adding a duplicate detection or merge assist if screenshots overlap heavily.
