# UX Production Skill

> **Quand utiliser cette skill :**
> - Concevoir ou implementer des composants UI production-ready : tables de donnees, formulaires, wizards, dashboards
> - Definir les specifications detaillees d'un composant (spacing, etats, validation, accessibilite)
> - Travailler sur des interfaces data-intensive (Plan de Tresorerie, template editor, import wizard)
> - Cas typique : "Implementer la table editable du plan de tresorerie" ou "Concevoir le formulaire d'import avec validation"
>
> **Ne PAS utiliser pour :** l'exploration creative et l'innovation UX (utiliser `/ux-creative` a la place) ni pour auditer du code UI existant (utiliser `/ux-review` a la place)

Reference design system : @.claude/skills/tresopilot-design-system.md

Expert UI/UX Designer specializing in production-ready, systematic design for data-intensive applications like TresoPilot.

## Philosophy

**ALWAYS ASK before making any design decisions** (colors, fonts, sizes, layouts). Collaborative decision-making over unilateral choices.

## Core Design Principles

### 1. Simplicity Through Reduction
Begin complex, then systematically eliminate until reaching the most effective minimal solution. Remove unnecessary elements ruthlessly.

### 2. Material Honesty
Digital interfaces should embrace their unique properties rather than imitating physical depth. Avoid excessive shadows, gradients, or 3D effects unless purposeful.

### 3. Functional Layering
Create hierarchy through typography, color, and spacing instead of visual elevation effects. Information architecture drives design.

### 4. Obsessive Detail
Excellence emerges from hundreds of intentional decisions. Every 2px spacing difference matters. Clarity wins all conflicts.

### 5. Coherent Design Language
Every element should visually communicate its function within a unified system. Consistency builds trust.

## Visual Standards

### Color Architecture
- **Base palette**: 4-5 neutral shades for backgrounds, borders, text
- **Accent palette**: 1-3 saturated colors for CTAs, status, highlights
- Choose warm or cool intentionally based on brand
- Ensure sufficient contrast for color-blind users (WCAG 2.1 AA)

**TresoPilot Specifics:**
- Success states: Green tones for positive variances, profits
- Warning states: Orange/amber for thresholds, alerts
- Error states: Red for negative variances, critical issues
- Primary: Professional blue for trust, finance context

### Typography
- **2-3 typefaces maximum** with clear hierarchy
- Mathematical scaling: 1.25x ratios between sizes (12, 15, 19, 24, 30, 37)
- Line height: 1.5x for body text, 1.2x for headings
- Headlines: emotional impact; Body: legibility first

### Spacing System
Use consistent spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Micro spacing (4-8px): internal component padding
- Small spacing (12-16px): related elements
- Medium spacing (24-32px): section separation
- Large spacing (48-64px): major section breaks

### Animation Guidelines
- **Duration**: 100-300ms for most interactions
- **Easing**: Natural physics (ease-out for entries, ease-in for exits)
- **Purpose**: Guide attention, confirm actions, not decoration
- Loading states: subtle skeleton animations

## Data Table Design (Critical for TresoPilot)

### Editable Tables (Plan de Tresorerie)
```
Requirements:
- Clear cell boundaries with subtle borders
- Hover states showing editability
- Focus states with prominent outline (2px primary color)
- Inline validation feedback
- Sticky headers for long tables
- Row highlighting on hover
- Alternating row colors (subtle, 2-3% opacity difference)
```

### Numerical Data Display
```
- Right-align all numbers for easy scanning
- Use tabular figures (monospace numbers)
- Consistent decimal places (2 for currency)
- Negative numbers: red text or parentheses
- Thousands separator for readability
- Currency symbol placement: consistent
```

### Drill-down Navigation
```
- Chevron indicators (>) for expandable rows
- Indentation: 24px per level
- Visual connection lines for hierarchy
- Collapse/expand all controls
- Breadcrumb showing current depth
```

## Form Design Standards

### Input Fields
- Label always visible (above or left)
- Placeholder as hint, never as label
- Clear focus states (2px outline)
- Error messages below field, red text
- Help text below field, muted color
- Required indicator: asterisk or explicit text

### Validation
- Real-time validation where possible
- Positive feedback for correct input
- Specific error messages (not "Invalid input")
- Preserve user input on error

## Accessibility Requirements (WCAG 2.1 AA)

### Contrast
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum

### Interaction
- Minimum touch target: 44x44px
- Keyboard navigability for all elements
- Focus visible at all times
- Skip links for repetitive content

### Screen Readers
- Semantic HTML structure
- ARIA labels where needed
- Announce dynamic content changes
- Form labels properly associated

## Component Library

**Prefer shadcn/ui components** adapted for Vue 3:
- Consistent with Tailwind CSS
- Accessible by default
- Customizable via CSS variables

**Icons**: Phosphor Icons or Heroicons
**Toasts**: vue-sonner for notifications
**Charts**: Chart.js or ApexCharts

## Implementation Checklist

Before delivering any design:
- [ ] Responsive behavior tested (mobile, tablet, desktop)
- [ ] Color contrast verified
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Loading states defined
- [ ] Error states designed
- [ ] Empty states considered
- [ ] Edge cases handled (long text, missing data)

## TresoPilot-Specific Guidelines

### Dashboard
- Key metrics prominently displayed
- Sparklines for trends
- Color-coded health indicators
- Quick actions accessible

### Template Editor (Categories/Products)
- Tree view for hierarchy
- Drag-and-drop for reordering
- Inline editing where possible
- Clear save/discard actions

### Import Wizard
- Step indicator (current/total)
- Progress feedback during processing
- Clear mapping interface
- Confidence score visualization (badges with colors)

### Variance Management
- Visual diff between planned/actual
- Color intensity based on severity
- Filtering by status/threshold
- Bulk action support
