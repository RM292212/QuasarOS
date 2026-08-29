# Design System

**File:** `docs/06-design/DesignSystem.md`  
**Status:** Normative

## Design principles

- Scientific clarity over decoration.
- Dense information without visual disorder.
- Consistent interaction between 2-D charts and 3-D scenes.
- Accessible by default.
- Dark-first visualization workspace with optional light theme.
- Physical units and data state remain visible.

## Design tokens

### Color roles

- Application background.
- Elevated panel.
- Canvas background.
- Primary text.
- Secondary text.
- Border.
- Accent.
- Focus.
- Success.
- Warning.
- Error.
- Information.
- Missing data.
- Selected object.

Scientific palettes are separate from interface colors.

### Spacing

Use an 8 px base grid:

- `4`: compact internal spacing.
- `8`: standard control spacing.
- `16`: group spacing.
- `24`: section spacing.
- `32+`: major layout separation.

### Typography

- Sans-serif UI font.
- Monospace for IDs, coordinates, numerical diagnostics, and code-like values.
- Minimum standard body size: 14–16 px.
- Tabular numerals for scientific values.

## Components

- Button.
- Icon button.
- Toggle.
- Checkbox.
- Select.
- Numeric input.
- Slider with numeric companion input.
- Tabs.
- Accordion.
- Tree.
- Data table.
- Tooltip.
- Popover.
- Dialog.
- Status badge.
- Progress indicator.
- Color scale.
- Scientific legend.
- Empty state.
- Error state.
- Split panel.

## Scientific value component

Every numerical value component supports:

- Value.
- Unit.
- Precision.
- Validity.
- Approximate/exact badge.
- Uncertainty.
- Source/derived badge.
- Copy action.

## Icons

Icons shall have labels or accessible names. Scientific topology icons distinguish volume, surface, vector, profile, trajectory, terrain, and derived data.

## Themes

Themes shall preserve semantic contrast and scientific palette meaning. Theme changes shall not alter transfer-function data.

## Component requirements

All shared components require keyboard support, focus behavior, disabled explanation, loading state, error state, and visual-regression coverage.
