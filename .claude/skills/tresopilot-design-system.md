# TresoPilot Design System

Reference document for consistent design across the application.

## Brand Identity

**Product**: TresoPilot - SaaS de prospective financière
**Tagline**: "Si je veux X, qu'est-ce que ça implique?"
**Tone**: Professional, trustworthy, empowering

## Target Users

### Sophie - Dirigeante TPE/PME (Mode Simplifié)
- 1-50 salariés
- Pragmatique, pas experte en finance
- Usage: 1x/semaine, intensive en période stratégique
- Attente UX: Simple, visuel, gamifié

### Marc - DAF PME/ETI (Mode Expert)
- Expert financier (BFR, EBITDA, cash burn)
- Usage: quotidien à hebdomadaire
- Attente UX: Puissant, flexible, exports pro

## Color Palette

### Primary Colors
```css
--primary-50: #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* Primary */
--primary-600: #2563eb;  /* Primary hover */
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

### Semantic Colors
```css
/* Success - Profits, positive variances */
--success-light: #dcfce7;
--success: #22c55e;
--success-dark: #16a34a;

/* Warning - Thresholds, alerts */
--warning-light: #fef3c7;
--warning: #f59e0b;
--warning-dark: #d97706;

/* Error - Losses, critical issues */
--error-light: #fee2e2;
--error: #ef4444;
--error-dark: #dc2626;

/* Info - Neutral information */
--info-light: #e0f2fe;
--info: #0ea5e9;
--info-dark: #0284c7;
```

### Neutral Colors
```css
--slate-50: #f8fafc;   /* Background */
--slate-100: #f1f5f9;  /* Surface */
--slate-200: #e2e8f0;  /* Border */
--slate-300: #cbd5e1;  /* Border hover */
--slate-400: #94a3b8;  /* Muted text */
--slate-500: #64748b;  /* Secondary text */
--slate-600: #475569;  /* Body text */
--slate-700: #334155;
--slate-800: #1e293b;
--slate-900: #0f172a;  /* Primary text */
```

## Typography

### Font Stack
```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

### Type Scale
| Name | Size | Line Height | Use |
|------|------|-------------|-----|
| xs | 12px | 1.5 | Labels, captions |
| sm | 14px | 1.5 | Secondary text, table cells |
| base | 16px | 1.5 | Body text |
| lg | 18px | 1.5 | Subheadings |
| xl | 20px | 1.4 | Section titles |
| 2xl | 24px | 1.3 | Page titles |
| 3xl | 30px | 1.2 | Dashboard numbers |
| 4xl | 36px | 1.2 | Hero numbers |

### Font Weights
- Regular (400): Body text
- Medium (500): Labels, buttons
- Semibold (600): Headings, emphasis
- Bold (700): Dashboard metrics

## Spacing Scale

Based on 4px grid:
```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

## Component Specifications

### Buttons
```
Primary:
- Background: primary-600
- Text: white
- Hover: primary-700
- Padding: 8px 16px (sm), 10px 20px (md), 12px 24px (lg)
- Border radius: 6px
- Font weight: 500

Secondary:
- Background: transparent
- Border: 1px slate-300
- Text: slate-700
- Hover: slate-100 background

Danger:
- Background: error
- Hover: error-dark
```

### Form Inputs
```
Default:
- Border: 1px slate-300
- Border radius: 6px
- Padding: 8px 12px
- Focus: 2px primary-500 ring

Error:
- Border: error
- Ring: error-light

Disabled:
- Background: slate-100
- Text: slate-400
```

### Cards
```
Default:
- Background: white
- Border: 1px slate-200
- Border radius: 8px
- Shadow: sm (optional)
- Padding: 16px (compact), 24px (default)
```

### Tables
```
Header:
- Background: slate-50
- Font weight: 600
- Text: slate-700

Cells:
- Padding: 12px 16px
- Border bottom: 1px slate-200

Hover:
- Background: slate-50

Editable cells:
- Cursor: text
- Hover: primary-50 background
- Focus: 2px primary ring
```

## Icons

Using **Heroicons** (outline for UI, solid for emphasis)

### Common Icons
| Action | Icon |
|--------|------|
| Add | plus |
| Edit | pencil |
| Delete | trash |
| Save | check |
| Cancel | x-mark |
| Settings | cog-6-tooth |
| Menu | bars-3 |
| Expand | chevron-down |
| Collapse | chevron-up |
| Navigate | chevron-right |
| Info | information-circle |
| Warning | exclamation-triangle |
| Error | exclamation-circle |
| Success | check-circle |

## Motion

### Durations
```css
--duration-fast: 100ms;   /* Hover, focus */
--duration-normal: 200ms; /* Transitions */
--duration-slow: 300ms;   /* Modals, page transitions */
```

### Easings
```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
--breakpoint-2xl: 1536px; /* Extra large */
```

## Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 10;
--z-sticky: 20;
--z-fixed: 30;
--z-modal-backdrop: 40;
--z-modal: 50;
--z-tooltip: 60;
--z-toast: 70;
```

## Accessibility Guidelines

### Color Contrast
- Normal text: 4.5:1 minimum
- Large text (18px+ bold, 24px+ regular): 3:1 minimum
- UI components: 3:1 minimum

### Touch Targets
- Minimum: 44x44px
- Recommended: 48x48px on mobile

### Focus States
- Always visible
- 2px outline with offset
- Primary color

### Screen Reader
- Semantic HTML
- ARIA labels for icons
- Live regions for dynamic content

## Finance-Specific Patterns

### Currency Display
- Symbol: € (after number in French)
- Thousands separator: space
- Decimal: comma
- Negative: parentheses or red color
- Example: 1 234,56 € or (1 234,56 €)

### Percentage Display
- Positive: green with +
- Negative: red with -
- Neutral: gray
- Example: +12,5% or -3,2%

### Date Display
- Short: 15/01/2026
- Month: Janvier 2026
- Period: Jan. 2026

### Confidence Scores
- High (≥80%): Green badge "Haute confiance"
- Medium (50-79%): Orange badge "À vérifier"
- Low (<50%): Red badge "Incertain"
