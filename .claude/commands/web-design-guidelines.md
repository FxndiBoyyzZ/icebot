# Web Design Guidelines Mode

You follow modern web design best practices and principles. Every decision is intentional, grounded in established design patterns, and optimized for usability.

## Core Principles

### 1. Visual Hierarchy
- Size: larger = more important
- Weight: bolder = more important  
- Color: higher contrast = more important
- Space: more surrounding space = more important
- Guide the eye: primary → secondary → tertiary action

### 2. Gestalt Principles
- **Proximity** — related items grouped together
- **Similarity** — same style = same type of thing
- **Continuation** — use alignment to create visual flow
- **Closure** — users complete incomplete shapes
- **Figure/ground** — clear separation of content from background

### 3. Layout Grids
- 12-column grid for desktop
- 4-column grid for mobile
- Consistent gutters: 16px (mobile), 24px (tablet), 32px (desktop)
- Max content width: 1280px, centered

### 4. Color Theory
- 60-30-10 rule: 60% neutral, 30% secondary, 10% accent
- Minimum contrast 4.5:1 for body text (WCAG AA)
- Minimum contrast 3:1 for large text and UI components
- Never use pure black (#000) — use very dark gray (#0a0a0a or slate-950)
- Never use pure white (#fff) on colored backgrounds — use off-white

### 5. Typography Hierarchy
```
H1: 36–60px / weight 700–800 / tracking -0.03em
H2: 28–36px / weight 700 / tracking -0.02em
H3: 20–24px / weight 600 / tracking -0.01em
Body: 15–16px / weight 400 / line-height 1.6
Small: 12–14px / weight 400–500
Caption: 11–12px / weight 500 / uppercase + tracking 0.08em
```

## UI Patterns

### Navigation
- Max 5–7 items in primary nav
- Active state must be obvious
- Mobile: bottom nav or hamburger (bottom preferred for thumb reach)
- Sticky header max 64px height

### Forms
- Labels above inputs (not placeholder-as-label)
- Error messages below the field, in red with icon
- Success state with green checkmark
- Required fields marked with asterisk + legend
- Input height: 40–44px (comfortable touch target)
- Group related fields visually

### Buttons
- Primary: filled, high contrast, main action
- Secondary: outlined or subtle fill, supporting action
- Ghost: text only, tertiary action
- Destructive: red, requires confirmation
- Size: min 36px height, min 44px touch target
- Never two primary buttons side by side

### Cards
- Consistent padding: 16–24px
- One primary action per card
- Clear visual boundary (border or shadow, not both)
- Hover state when interactive

### Tables
- Zebra striping or row separators for readability
- Sticky headers for long tables
- Right-align numbers
- Left-align text
- Action column on the right

### Empty States
- Always include: icon + title + description + CTA
- Be human and helpful (not "No data found")
- Illustration > generic icon when possible

### Loading States
- Skeleton for content areas (preserves layout)
- Spinner only for actions (button submitting, file uploading)
- Progress bar for long operations (>3s)

## Responsive Design Rules
- Mobile breakpoint: < 640px
- Tablet breakpoint: 640–1024px
- Desktop breakpoint: > 1024px
- Touch targets minimum 44×44px
- Never rely on hover for essential functionality on mobile
- Font size minimum 16px on mobile (prevents iOS zoom)

## Accessibility Checklist
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible (don't remove outline, style it instead)
- [ ] Color is not the only way to convey information
- [ ] Images have alt text
- [ ] Form inputs have labels (not just placeholders)
- [ ] Error messages are announced to screen readers
- [ ] Sufficient color contrast (4.5:1 for text)
- [ ] Skip navigation link for keyboard users
