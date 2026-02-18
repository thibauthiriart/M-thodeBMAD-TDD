# Step 1: Agent Loading and Party Mode Initialization

## MANDATORY EXECUTION RULES (READ FIRST):

- Load complete agent roster from manifest
- Parse agent data for conversation orchestration
- Introduce available agents to the user
- Always use the configured `{communication_language}` for output

## EXECUTION PROTOCOLS:

- Show agent loading process before presenting party activation
- Present [C] continue option after agent roster is loaded
- Only save when user chooses C (Continue)
- Update frontmatter `stepsCompleted: [1]` before loading next step
- Do not start conversation until C is selected

## CONTEXT BOUNDARIES:

- Agent manifest CSV is available at `{project-root}/_bmad/_config/agent-manifest.csv`
- User configuration from config.yaml is loaded and resolved
- Party mode is standalone interactive workflow
- All agent data is available for conversation orchestration

## YOUR TASK:

Load the complete agent roster from manifest and initialize party mode.

## AGENT LOADING SEQUENCE:

### 1. Load Agent Manifest

Begin agent loading process:

"Initializing **Party Mode** with the BMAD agent roster.

**Agent Manifest Loading:**"

Load and parse the agent manifest CSV from `{project-root}/_bmad/_config/agent-manifest.csv`

### 2. Extract Agent Data

Parse CSV to extract complete agent information for each entry:

**Agent Data Points:**

- **name** (agent identifier)
- **displayName** (display name for conversations)
- **title** (position and role description)
- **icon** (visual identifier emoji)
- **role** (capabilities and expertise summary)
- **identity** (specialization details)
- **communicationStyle** (communication approach)
- **principles** (decision-making philosophy and values)
- **module** (source module organization)
- **path** (file location reference)

### 3. Build Agent Roster

Create complete agent roster:

**Roster Building Process:**

- Combine manifest data with agent file configurations
- Validate agent availability and configuration completeness
- Organize agents by expertise domains for intelligent selection

### 4. Party Mode Activation

Generate party mode introduction:

"**Party Mode Activated**

Welcome {{user_name}}! The BMAD agent team is available for a collaborative discussion. All agents are ready to contribute their expertise.

**Available Agents:**

[Display 3-4 diverse agents to showcase variety]:

- [Icon] **[Agent Name]** ([Title]): [Brief role description]
- [Icon] **[Agent Name]** ([Title]): [Brief role description]
- [Icon] **[Agent Name]** ([Title]): [Brief role description]

**[Total Count] agents** are available.

**What would you like to discuss with the team?**"

### 5. Present Continue Option

After agent loading and introduction:

"**Agent roster loaded.** All BMAD experts are available.

**Ready to start the discussion?**
[C] Continue - Begin multi-agent conversation

### 6. Handle Continue Selection

#### If 'C' (Continue):

- Update frontmatter: `stepsCompleted: [1]`
- Set `agents_loaded: true` and `party_active: true`
- Load: `./step-02-discussion-orchestration.md`

## SUCCESS METRICS:

- Agent manifest successfully loaded and parsed
- Complete agent roster built
- Party mode introduction displayed
- Diverse agent sample showcased for user
- [C] continue option presented and handled correctly
- Frontmatter updated with agent loading status
- Proper routing to discussion orchestration step

## FAILURE MODES:

- Failed to load or parse agent manifest CSV
- Incomplete agent data extraction or roster building
- Not presenting [C] continue option after loading
- Starting conversation without user selection

## AGENT LOADING PROTOCOLS:

- Validate CSV format and required columns
- Handle missing or incomplete agent entries gracefully
- Cross-reference manifest with actual agent files
- Prepare agent selection logic for intelligent conversation routing

## NEXT STEP:

After user selects 'C', load `./step-02-discussion-orchestration.md` to begin the interactive multi-agent conversation with intelligent agent selection.
