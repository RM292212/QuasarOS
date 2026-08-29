# Frontend Implementation

**File:** `docs/05-implementation/FrontendImplementation.md`  
**Status:** Normative

## Application structure

    apps/web/src/
      app/
      routes/
      features/
      components/
      state/
      services/
      accessibility/
      styles/

Feature folders may contain UI, hooks, selectors, and tests, but domain contracts remain in shared packages.

## State

Use:

- TanStack Query for server-owned state.
- Zustand for domain interaction state.
- Component state for local transient UI.
- Renderer-owned structures for GPU resources.

Do not duplicate query results into Zustand without a documented reason.

## Main features

- Dataset browser.
- Ocean Overview.
- Scientific Volume Lab.
- Timeline.
- Layer manager.
- Transfer-function editor.
- Observation explorer.
- Inspector.
- Analysis panel.
- Settings and diagnostics.

## Data validation

All API and worker responses shall be validated against versioned schemas. Unknown fields may be tolerated; invalid required fields fail explicitly.

## Rendering integration

React creates and disposes rendering hosts. Babylon.js owns its render loop. Frame-by-frame renderer state shall not trigger React rerenders.

## Requests

- Use typed API clients.
- Use query keys containing all scientific identity parameters.
- Cancel stale requests.
- Bound retries.
- Avoid fetching large arrays through JSON.
- Refresh expired signed URLs through the API.

## Accessibility

Use semantic HTML, visible focus, keyboard operation, accessible dialogs, live regions, reduced motion, chart tables, and canvas alternatives.

## Performance

- Lazy-load workspaces.
- Virtualize long catalog lists.
- Use workers for decoding.
- Memoize measured expensive selectors.
- Avoid unnecessary component rerenders.
- Keep large binary buffers outside React state.

## Error behavior

Each feature supplies loading, empty, incomplete, authorization, and failure states. A blank canvas is never an acceptable error state.
