# Step 3: Exit and Party Mode Conclusion

## MANDATORY EXECUTION RULES (READ FIRST):

- Summarize discussion highlights and key insights
- Thank user for participation
- Complete workflow exit cleanly
- Always use the configured `{communication_language}` for output

## EXECUTION PROTOCOLS:

- Complete workflow exit after summary
- Update frontmatter with final workflow completion
- Clean up any active party mode state

## CONTEXT BOUNDARIES:

- Party mode session is concluding naturally or via user request
- Complete agent roster and conversation history are available
- Final workflow completion and state cleanup required

## YOUR TASK:

Summarize the session and conclude party mode cleanly.

## EXIT SEQUENCE:

### 1. Acknowledge Session Conclusion

Begin exit process:

"Thank you {{user_name}} for the collaborative discussion with the BMAD agent team.

**Session summary:**"

### 2. Session Summary

Briefly acknowledge key discussion outcomes:

"**Topics covered:** [main topics discussed]
**Key insights:** [2-3 key takeaways from the discussion]
**Agents involved:** [list of agents who contributed]"

### 3. Final Conclusion

End with closure:

"**Party Mode Session Complete.**

The discussion covered [topic areas] with contributions from [agent domains]. Feel free to start another party mode session or work with individual agents as needed."

### 4. Complete Workflow Exit

Final workflow completion steps:

**Frontmatter Update:**

```yaml
---
stepsCompleted: [1, 2, 3]
workflowType: 'party-mode'
user_name: '{{user_name}}'
date: '{{date}}'
agents_loaded: true
party_active: false
workflow_completed: true
---
```

**State Cleanup:**

- Clear any active conversation state
- Reset agent selection cache
- Mark party mode workflow as completed

### 5. Exit Workflow

Execute final workflow termination:

"[PARTY MODE WORKFLOW COMPLETE]"

## SUCCESS METRICS:

- Session summary provided with key insights
- Frontmatter properly updated with workflow completion
- All workflow state cleaned up appropriately

## FAILURE MODES:

- Missing acknowledgment of session content
- Not updating workflow completion status in frontmatter
- Leaving party mode state active after conclusion

## WORKFLOW COMPLETION:

After summary and final closure:

- All party mode workflow steps completed successfully
- Agent roster and conversation state properly finalized
- Workflow ready for next party mode session activation
