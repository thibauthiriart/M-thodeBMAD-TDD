# Step 2: Discussion Orchestration and Multi-Agent Conversation

## MANDATORY EXECUTION RULES (READ FIRST):

- Select relevant agents based on topic analysis and expertise matching
- Generate responses based on each agent's documented expertise
- Enable cross-references between agents for dynamic conversation
- Always use the configured `{communication_language}` for output

## EXECUTION PROTOCOLS:

- Analyze user input for intelligent agent selection before responding
- Present [E] exit option after each agent response round
- Continue conversation until user selects E (Exit)
- Maintain conversation state and context throughout session
- Do not exit until E is selected or exit trigger detected

## CONTEXT BOUNDARIES:

- Complete agent roster with expertise profiles is available
- User topic and conversation history guide agent selection
- Exit triggers: `*exit`, `goodbye`, `end party`, `quit`

## YOUR TASK:

Orchestrate multi-agent conversations with intelligent agent selection and cross-agent references.

## DISCUSSION ORCHESTRATION SEQUENCE:

### 1. User Input Analysis

For each user message or topic:

**Analysis Criteria:**

- Domain expertise requirements (technical, business, creative, etc.)
- Complexity level and depth needed
- Conversation context and previous agent contributions
- User's specific agent mentions or requests

### 2. Intelligent Agent Selection

Select 2-3 most relevant agents based on analysis:

**Selection Logic:**

- **Primary Agent**: Best expertise match for core topic
- **Secondary Agent**: Complementary perspective or alternative approach
- **Tertiary Agent**: Cross-domain insight (if beneficial)

**Priority Rules:**

- If user names specific agent, prioritize that agent + 1-2 complementary agents
- Rotate agent participation over time to ensure inclusive discussion
- Balance expertise domains for comprehensive perspectives

### 3. Response Generation

Generate responses for each selected agent based on their expertise:

**Response Approach:**

- Apply agent's documented expertise and role
- Reflect their principles in reasoning
- Draw from their identity for domain-specific insights
- Keep responses focused and relevant

**Response Structure:**
[For each selected agent]:

"[Icon] **[Agent Name]**: [Response based on their expertise]

[Bash: .claude/hooks/bmad-speak.sh "[Agent Name]" "[Their response]"]"

### 4. Cross-Agent References

Enable agents to reference each other's contributions:

**Reference Patterns:**

- Agents can reference each other by name: "As [Another Agent] mentioned..."
- Building on previous points: "[Another Agent] makes a good point about..."
- Different perspectives: "I see it differently than [Another Agent]..."
- Follow-up questions between agents: "How would you handle [specific aspect]?"

**Conversation Flow:**

- Allow natural conversational progression
- Enable agents to ask each other questions
- Maintain professional discourse

### 5. Question Handling Protocol

Manage different types of questions appropriately:

**Direct Questions to User:**
When an agent asks the user a specific question:

- End that response round immediately after the question
- Clearly highlight: **[Agent Name] asks: [Their question]**
- Display: _[Awaiting user response...]_
- WAIT for user input before continuing

**Rhetorical Questions:**
Agents can ask thinking-aloud questions without pausing conversation flow.

**Inter-Agent Questions:**
Allow back-and-forth within the same response round.

### 6. Response Round Completion

After generating all agent responses for the round, let the user know they can continue the discussion, then show this menu option:

`[E] Exit Party Mode - End the session`

### 7. Exit Condition Checking

Check for exit conditions before continuing:

**Automatic Triggers:**

- User message contains: `*exit`, `goodbye`, `end party`, `quit`

**Natural Conclusion:**

- If conversation seems to be concluding, confirm if the user wants to exit party mode or continue.

### 8. Handle Exit Selection

#### If 'E' (Exit Party Mode):

- Read fully and follow: `./step-03-graceful-exit.md`

## SUCCESS METRICS:

- Intelligent agent selection based on topic analysis
- Responses grounded in each agent's documented expertise
- Cross-agent references enabled
- Question handling protocol followed correctly
- [E] exit option presented after each response round
- Conversation context and state maintained throughout

## FAILURE MODES:

- Generic responses not connected to agent expertise
- Poor agent selection not matching topic
- Ignoring user questions or exit triggers
- Continuing conversation without user input when questions asked

## CONVERSATION ORCHESTRATION PROTOCOLS:

- Maintain conversation memory and context across rounds
- Rotate agent participation for inclusive discussions
- Handle topic drift while maintaining productivity

## MODERATION GUIDELINES:

**Quality Control:**

- If discussion becomes circular, have bmad-master summarize and redirect
- Handle disagreements constructively
- Maintain respectful conversation environment

**Flow Management:**

- Guide conversation toward productive outcomes
- Balance depth with breadth of discussion
- Adapt conversation pace to user engagement level

## NEXT STEP:

When user selects 'E' or exit conditions are met, load `./step-03-graceful-exit.md` to conclude the party mode session.
