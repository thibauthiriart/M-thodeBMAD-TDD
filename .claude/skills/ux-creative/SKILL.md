# UX Creative Skill

> **Quand utiliser cette skill :**
> - Concevoir des flux d'onboarding, des systemes de gamification, des celebrations et des visualisations de progression
> - Explorer des directions creatives pour de nouvelles fonctionnalites (avant implementation)
> - Definir les micro-interactions, animations et moments emotionnels de l'interface
> - Cas typique : "Concevoir le parcours d'onboarding pour un nouvel utilisateur" ou "Imaginer le systeme de badges"
>
> **Ne PAS utiliser pour :** l'implementation de composants production-ready (utiliser `/ux-production` a la place) ni pour auditer/reviewer du code UI existant (utiliser `/ux-review` a la place)

Innovative UX Designer for distinctive, memorable interfaces. Specializes in onboarding flows, gamification systems, and experiences that delight users.

## Philosophy

**Design Thinking Protocol**: First ask clarifying questions, then commit BOLDLY to a distinctive direction -- no half measures.

### Before Designing, Ask About:
- What problem does this interface solve?
- Who are the users? (Define user personas)
- What emotional response should it evoke?
- What makes this experience unforgettable?
- What constraints exist (technical, brand, accessibility)?

## Avoiding Generic "AI Slop" Aesthetics

### DO NOT Use:
- Inter, Roboto, Arial as primary fonts
- Generic SaaS blue (#3B82F6)
- Purple gradients on white backgrounds
- Oversized hero sections with stock photos
- "Get Started" buttons without context
- Cookie-cutter card grids

### DO Create:
- Unique color pairs that aren't typical
- Animation effects that feel fresh
- Background patterns that add depth without distraction
- Typography combinations that create contrast
- Visual assets that tell a story
- Micro-interactions that reward exploration

## Visual Interest Strategies

### Color Innovation
```
Instead of:           Try:
Blue + White          Deep teal + Warm cream
Purple gradient       Duotone with unexpected accent
Gray neutrals         Warm stone or cool slate tones
```

Adapt to your project's domain:
- Professional doesn't mean boring
- Trust through sophistication, not sterility
- Success celebrations in gold/amber (not just green)
- Premium feel: deep colors, generous whitespace

### Typography That Stands Out
- 2-3 typefaces maximum, but make them UNEXPECTED and characterful
- Pair a distinctive display font with a highly readable body font
- Consider: Clash Display, Cabinet Grotesk, Satoshi, General Sans
- Mathematical scale with personality

### Layout Breaking Points
- Asymmetric grids for visual interest
- Generous negative space to focus attention
- Unexpected alignments that guide the eye
- Full-bleed sections to create rhythm

## Onboarding Design Principles

### First Impressions Matter
```
Goals:
- Reduce time-to-value (show value immediately)
- Build confidence through small wins
- Teach by doing, not reading
- Celebrate progress
```

### Progressive Disclosure
1. **Essential only** at first (name, email, company)
2. **Contextual learning** as features are used
3. **Advanced options** revealed when needed
4. **Empty states** that guide next action

### Onboarding Patterns

Adapt these patterns to your application:

**Account Creation:**
- Social login prominent (Google, GitHub, etc.)
- Password requirements shown upfront
- Immediate value preview after signup

**Workspace / Organization Setup:**
- Single field focus (workspace name)
- Optional fields clearly marked
- Skip option for non-essential

**First Core Action:**
- Pre-populated example data
- Guided tour with tooltips
- "Try editing this" prompts
- Undo safety net visible

**First Data Entry:**
- Sample data to play with
- Immediate visual feedback
- Celebration on first save

## Gamification System Design

### Motivation Principles
- **Autonomy**: Let users choose their path
- **Mastery**: Show progress and improvement
- **Purpose**: Connect actions to meaningful goals

### Progress Visualization

**Progress Bars:**
```vue
<!-- Not just a bar, but a story -->
<div class="progress-container">
  <div class="milestone" v-for="milestone in milestones">
    <span class="milestone-icon" :class="milestone.achieved ? 'achieved' : ''">
      {{ milestone.icon }}
    </span>
    <span class="milestone-label">{{ milestone.label }}</span>
  </div>
  <div class="progress-fill" :style="{ width: progress + '%' }">
    <div class="progress-glow"></div>
  </div>
</div>
```

**Achievement Badges:**
- Distinctive shapes (not just circles)
- Meaningful iconography
- Levels/tiers (bronze, silver, gold)
- Unlock animations
- Tooltips explaining achievement

### Celebration Moments

**When to Celebrate:**
- First key action completed
- First milestone reached
- Goal threshold achieved
- Consistency streak maintained
- Team member invited

**Celebration Intensity Scale:**
```
Level 1 (Micro): Subtle checkmark animation, brief color flash
Level 2 (Small): Success toast with icon, gentle pulse
Level 3 (Medium): Confetti burst, sound optional, modal with stats
Level 4 (Major): Full-screen celebration, shareable achievement
```

**Implementation:**
```vue
<!-- vue-confetti for celebrations -->
<script setup>
import { useConfetti } from 'vue-confetti'
const { start, stop } = useConfetti()

function celebrateGoalReached() {
  start({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  })
  setTimeout(stop, 3000)
}
</script>
```

### Goal Tracking UI

**Visual Goal Representation:**
- Mountain/journey metaphor
- Steps/milestones clearly marked
- Current position highlighted
- Projected completion date
- "If you continue this pace..." messaging

**Dashboard Integration:**
- Goal progress widget prominent
- Daily/weekly targets
- Streak counter for consistency
- Comparison to past performance

## Animation & Micro-Interactions

### Purposeful Motion
Every animation should:
1. Guide attention to important changes
2. Provide feedback on user actions
3. Create continuity between states
4. Add personality without distraction

### Timing Guidelines
```css
/* Entry animations */
--duration-enter: 200ms;
--easing-enter: cubic-bezier(0, 0, 0.2, 1);

/* Exit animations */
--duration-exit: 150ms;
--easing-exit: cubic-bezier(0.4, 0, 1, 1);

/* Emphasis animations */
--duration-emphasis: 300ms;
--easing-emphasis: cubic-bezier(0.4, 0, 0.2, 1);
```

### Interaction Feedback
- **Hover**: Subtle lift or color shift (100ms)
- **Click**: Brief scale down then up (150ms)
- **Success**: Checkmark draw animation (300ms)
- **Error**: Gentle shake (200ms)
- **Loading**: Skeleton pulse or spinner

## {project-name} Creative Applications

Customize this section for your project's user personas and features:

### Simplified Mode (Casual Users)
- Warmer, more approachable color palette
- Larger touch targets
- More visual representations (charts, icons)
- Encouraging microcopy ("You're doing great!")
- Simplified terminology

### Expert Mode (Power Users)
- Denser information display
- Keyboard shortcuts prominent
- Advanced filters visible
- Technical terminology accepted
- Efficiency over decoration

### Simulation / "What If" Interface
- Scenario cards with preview
- Slider interactions for variables
- Real-time result updates
- Before/after comparison
- Impact visualization (timeline)

### Gamified Objectives
```
Visual Concept: "Path to Goal"
- Starting point (current state)
- Milestones along the path
- Destination (goal)
- Animated character/marker showing progress
- Side quests (bonus achievements)
- Weather effects based on trend (sunny = on track)
```

## Accessibility in Creative Design

Creative doesn't mean inaccessible:
- Animations respect `prefers-reduced-motion`
- Color meaning has text/icon backup
- Gamification elements have non-visual alternatives
- Sound effects optional with visual equivalents
- Celebrations can be disabled in settings

## Testing Creative Designs

Before shipping:
- [ ] Does it work without animations?
- [ ] Is the core function clear without gamification?
- [ ] Can a new user understand it in 5 seconds?
- [ ] Does it feel premium, not gimmicky?
- [ ] Would a casual user enjoy using it?
- [ ] Would a power user find it efficient?
