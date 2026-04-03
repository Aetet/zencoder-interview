# Runtime Documentation

## Overview

The **Runtime** is the core execution engine that orchestrates the conversation loop between the AI model and tools. It handles API communication, tool execution, permission checking, and session management.

**Source**: `rust/crates/runtime/src/conversation.rs`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ConversationRuntime                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Core Components                                │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                       │   │
│  │   ┌──────────────┐     ┌──────────────┐     ┌───────────────────┐  │   │
│  │   │   Session    │     │  ApiClient    │     │   ToolExecutor    │  │   │
│  │   │  (State)    │     │  (LLM Calls)  │     │  (Tool Execution) │  │   │
│  │   └──────────────┘     └──────────────┘     └───────────────────┘  │   │
│  │          │                    │                      │             │   │
│  │          │                    │                      │             │   │
│  │          ▼                    ▼                      ▼             │   │
│  │   ┌───────────────────────────────────────────────────────────┐   │   │
│  │   │                    Turn Loop                              │   │   │
│  │   │  1. Build API request (system + messages)                 │   │   │
│  │   │  2. Stream events from LLM                               │   │   │
│  │   │  3. Extract blocks (text, tool_use)                      │   │   │
│  │   │  4. Execute tools (permission check + hooks)              │   │   │
│  │   │  5. Add results to session                               │   │   │
│  │   │  6. Repeat until no more tool calls                      │   │   │
│  │   └───────────────────────────────────────────────────────────┘   │   │
│  │                           │                                          │   │
│  │                           ▼                                          │   │
│  │   ┌──────────────┐     ┌──────────────┐     ┌───────────────────┐  │   │
│  │   │UsageTracker  │     │HookRunner    │     │PermissionPolicy  │  │   │
│  │   │(Metrics)     │     │(Pre/Post)    │     │(Access Control)  │  │   │
│  │   └──────────────┘     └──────────────┘     └───────────────────┘  │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Types

### ApiRequest

The request sent to the LLM API:

```rust
pub struct ApiRequest {
    pub system_prompt: Vec<String>,              // System instructions
    pub messages: Vec<ConversationMessage>,      // Conversation history
}
```

**Example:**
```json
{
  "system_prompt": [
    "You are a helpful coding assistant.",
    "You have access to tools for file operations and shell commands."
  ],
  "messages": [
    { "role": "user", "blocks": [...] },
    { "role": "assistant", "blocks": [...] },
    { "role": "tool", "blocks": [...] }
  ]
}
```

### AssistantEvent

Events streamed from the LLM during generation:

```rust
pub enum AssistantEvent {
    TextDelta(String),                          // Text chunk
    ToolUse {                                   // Tool call request
        id: String,
        name: String,
        input: String,
    },
    Usage(TokenUsage),                          // Token usage for this turn
    MessageStop,                                // End of message
}
```

**Stream Example:**
```
[TextDelta] "I'll read the file"
[TextDelta] " to check its contents."
[ToolUse] {"id": "tool-1", "name": "read_file", "input": "{\"path\": \"main.rs\"}"}
[Usage] {"input_tokens": 156, "output_tokens": 89, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}
[MessageStop]
```

### TurnSummary

The result of a complete turn:

```rust
pub struct TurnSummary {
    pub assistant_messages: Vec<ConversationMessage>,  // Model responses
    pub tool_results: Vec<ConversationMessage>,       // Tool outputs
    pub iterations: usize,                            // API round-trips
    pub usage: TokenUsage,                            // Cumulative usage
}
```

---

## Block Types

### Block Hierarchy

```
ContentBlock (enum)
├── Text { text: String }
├── ToolUse { id, name, input }
└── ToolResult { tool_use_id, tool_name, output, is_error }
```

### Text Block

Plain text output from the model.

```rust
ContentBlock::Text {
    text: String,
}
```

**JSON:**
```json
{
  "type": "text",
  "text": "I'll analyze the code and provide a summary."
}
```

### ToolUse Block

Request to call a tool.

```rust
ContentBlock::ToolUse {
    id: String,       // Unique ID for this call (e.g., "tool-1")
    name: String,     // Tool name (e.g., "bash", "read_file")
    input: String,    // JSON string of arguments
}
```

**JSON:**
```json
{
  "type": "tool_use",
  "id": "tool-1",
  "name": "bash",
  "input": "{\"command\": \"ls -la\"}"
}
```

### ToolResult Block

Result from tool execution.

```rust
ContentBlock::ToolResult {
    tool_use_id: String,    // References the ToolUse ID
    tool_name: String,      // Tool that was called
    output: String,         // Execution output
    is_error: bool,         // Whether execution failed
}
```

**JSON:**
```json
{
  "type": "tool_result",
  "tool_use_id": "tool-1",
  "tool_name": "bash",
  "output": "total 128\ndrwxr-xr-x  6 dev staff  4096 Apr  3 src/",
  "is_error": false
}
```

---

## Block Formation Flow

### 1. API Streaming

The model generates content in real-time via Server-Sent Events (SSE):

```
event: content_block_start
data: {"type":"text","index":0}

event: content_block_delta
data: {"type":"text_delta","text":"I'll read that file"}

event: content_block_stop
data: {}

event: content_block_start
data: {"type":"tool_use","index":1,"id":"tool-1","name":"read_file"}

event: content_block_delta
data: {"type":"input_json_delta","partial_json":"{\"path\": \"main.rs\""}

event: content_block_stop
data: {}

event: message_stop
data: {"usage":{"input_tokens":156,"output_tokens":89,...}}
```

### 2. Event Aggregation

The runtime aggregates streaming events into blocks:

```rust
fn build_assistant_message(
    events: Vec<AssistantEvent>,
) -> Result<(ConversationMessage, Option<TokenUsage>), RuntimeError> {
    let mut text = String::new();
    let mut blocks = Vec::new();
    let mut usage = None;

    for event in events {
        match event {
            AssistantEvent::TextDelta(delta) => {
                text.push_str(&delta);
            }
            AssistantEvent::ToolUse { id, name, input } => {
                // Flush any pending text
                flush_text_block(&mut text, &mut blocks);
                // Add tool use block
                blocks.push(ContentBlock::ToolUse { id, name, input });
            }
            AssistantEvent::Usage(token_usage) => {
                usage = Some(token_usage);
            }
            AssistantEvent::MessageStop => {
                // Message complete
            }
        }
    }

    // Flush remaining text
    flush_text_block(&mut text, &mut blocks);

    Ok((ConversationMessage::assistant_with_usage(blocks, usage), usage))
}
```

### 3. Block Assembly

```
┌─────────────────────────────────────────────────────────────────┐
│                   Streaming Events → Blocks                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Events Stream:                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │ TextDelta   │ │ TextDelta   │ │ ToolUse               │   │
│  │ "I'll"      │ │ " check"    │ │ id: tool-1           │   │
│  └──────────────┘ └──────────────┘ │ name: read_file      │   │
│          │                │         │ input: {...}        │   │
│          └────────┬───────┘         └───────────────────────┘   │
│                   ▼                                             │
│          ┌────────────────┐                                    │
│          │ Text Flushing  │                                    │
│          │ (when ToolUse) │                                    │
│          └────────────────┘                                    │
│                   │                                             │
│                   ▼                                             │
│  Final Blocks:                                                  │
│  ┌──────────────┐ ┌────────────────────────────────────────┐   │
│  │ Text         │ │ ToolUse                               │   │
│  │ "I'll check" │ │ id: "tool-1"                          │   │
│  └──────────────┘ │ name: "read_file"                     │   │
│                   │ input: "{\"path\": \"main.rs\"}"        │   │
│                   └────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Turn Execution Loop

```rust
pub fn run_turn(
    &mut self,
    user_input: impl Into<String>,
    prompter: Option<&mut dyn PermissionPrompter>,
) -> Result<TurnSummary, RuntimeError> {
    
    // 1. Add user message to session
    self.session.messages.push(ConversationMessage::user_text(user_input));

    let mut assistant_messages = Vec::new();
    let mut tool_results = Vec::new();
    let mut iterations = 0;

    // 2. Main loop (may iterate multiple times)
    loop {
        iterations += 1;
        
        // Check iteration limit
        if iterations > self.max_iterations {
            return Err(RuntimeError::new("max iterations exceeded"));
        }

        // 3. Build API request
        let request = ApiRequest {
            system_prompt: self.system_prompt.clone(),
            messages: self.session.messages.clone(),
        };

        // 4. Call LLM API
        let events = self.api_client.stream(request)?;
        
        // 5. Build assistant message from events
        let (assistant_message, usage) = build_assistant_message(events)?;
        
        // 6. Track usage
        if let Some(usage) = usage {
            self.usage_tracker.record(usage);
        }

        // 7. Extract pending tool calls
        let pending_tool_uses = extract_tool_uses(&assistant_message);

        // 8. Add message to session
        self.session.messages.push(assistant_message.clone());
        assistant_messages.push(assistant_message);

        // 9. If no tools, we're done
        if pending_tool_uses.is_empty() {
            break;
        }

        // 10. Execute each tool
        for (tool_use_id, tool_name, input) in pending_tool_uses {
            
            // Permission check
            let permission_outcome = self.permission_policy.authorize(
                &tool_name, &input, prompter.as_mut()
            );

            match permission_outcome {
                PermissionOutcome::Allow => {
                    // Pre-hook
                    let pre_hook = self.hook_runner.run_pre_tool_use(&tool_name, &input);
                    if pre_hook.is_denied() {
                        // Return denial
                        let result = tool_result(tool_use_id, tool_name, deny_message, true);
                        self.session.messages.push(result.clone());
                        tool_results.push(result);
                    } else {
                        // Execute tool
                        let (output, is_error) = match self.tool_executor.execute(&tool_name, &input) {
                            Ok(output) => (output, false),
                            Err(error) => (error.to_string(), true),
                        };

                        // Post-hook
                        let post_hook = self.hook_runner.run_post_tool_use(
                            &tool_name, &input, &output, is_error
                        );

                        // Return result
                        let result = tool_result(tool_use_id, tool_name, output, is_error);
                        self.session.messages.push(result.clone());
                        tool_results.push(result);
                    }
                }
                PermissionOutcome::Deny { reason } => {
                    // Return denial
                    let result = tool_result(tool_use_id, tool_name, reason, true);
                    self.session.messages.push(result.clone());
                    tool_results.push(result);
                }
            }
        }
    }

    Ok(TurnSummary {
        assistant_messages,
        tool_results,
        iterations,
        usage: self.usage_tracker.cumulative_usage(),
    })
}
```

---

## Complete Turn Example

### Input

User asks: "List the files in src/"

### Turn 1: API Request

```json
{
  "system_prompt": ["You are a helpful assistant..."],
  "messages": [
    {"role": "user", "blocks": [{"type": "text", "text": "List the files in src/"}]}
  ]
}
```

### Turn 1: API Response Events

```
[TextDelta] "I'll list the files in the src directory."
[ToolUse] {"id": "tool-1", "name": "bash", "input": "{\"command\": \"ls src/\"}"}
[Usage] {"input_tokens": 156, "output_tokens": 89, ...}
[MessageStop]
```

### Turn 1: Resulting Message

```json
{
  "role": "assistant",
  "blocks": [
    {"type": "text", "text": "I'll list the files in the src directory."},
    {
      "type": "tool_use",
      "id": "tool-1",
      "name": "bash",
      "input": "{\"command\": \"ls src/\"}"
    }
  ],
  "usage": {"input_tokens": 156, "output_tokens": 89, ...}
}
```

### Tool Execution

```json
{
  "role": "tool",
  "blocks": [
    {
      "type": "tool_result",
      "tool_use_id": "tool-1",
      "tool_name": "bash",
      "output": "main.rs\nlib.rs\nutils.rs",
      "is_error": false
    }
  ]
}
```

### Turn 2: API Request (Automatic)

```json
{
  "system_prompt": [...],
  "messages": [
    {"role": "user", "blocks": [{"type": "text", "text": "List the files in src/"}]},
    {"role": "assistant", "blocks": [...], "usage": {...}},
    {"role": "tool", "blocks": [...]}
  ]
}
```

### Turn 2: API Response

```
[TextDelta] "The src directory contains:\n- main.rs\n- lib.rs\n- utils.rs"
[Usage] {"input_tokens": 245, "output_tokens": 98, ...}
[MessageStop]
```

### TurnSummary

```json
{
  "assistant_messages": [
    {"role": "assistant", "blocks": [Text, ToolUse], "usage": {...}},
    {"role": "assistant", "blocks": [Text], "usage": {...}}
  ],
  "tool_results": [
    {"role": "tool", "blocks": [ToolResult]}
  ],
  "iterations": 2,
  "usage": {
    "input_tokens": 401,
    "output_tokens": 187,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 156
  }
}
```

---

## Message Role Semantics

| Role | Direction | Contains Usage | Contains Blocks |
|------|-----------|----------------|-----------------|
| `system` | System → User | No | Text only |
| `user` | User → System | No | Text only |
| `assistant` | System → User | **Yes** | Text, ToolUse |
| `tool` | System → User | No | ToolResult |

---

## Hooks (Pre/Post Tool Execution)

### Pre-Tool Hook

Runs before tool execution. Can modify input or deny execution.

```rust
pub fn run_pre_tool_use(&self, tool_name: &str, input: &str) -> HookRunResult {
    for hook in &self.pre_hooks {
        let result = run_hook(hook, tool_name, input);
        if result.is_deny() {
            return result;
        }
    }
    HookRunResult::allow()
}
```

### Post-Tool Hook

Runs after tool execution. Can modify output or flag issues.

```rust
pub fn run_post_tool_use(
    &self,
    tool_name: &str,
    input: &str,
    output: &str,
    is_error: bool,
) -> HookRunResult {
    for hook in &self.post_hooks {
        let result = run_hook(hook, tool_name, output);
        if result.is_deny() {
            return result;
        }
    }
    HookRunResult::allow()
}
```

---

## Usage Tracking

Usage is tracked per turn and accumulated:

```rust
pub struct UsageTracker {
    latest_turn: TokenUsage,
    cumulative: TokenUsage,
    turns: u32,
}

impl UsageTracker {
    pub fn record(&mut self, usage: TokenUsage) {
        self.latest_turn = usage;
        self.cumulative.input_tokens += usage.input_tokens;
        self.cumulative.output_tokens += usage.output_tokens;
        self.cumulative.cache_creation_input_tokens += usage.cache_creation_input_tokens;
        self.cumulative.cache_read_input_tokens += usage.cache_read_input_tokens;
        self.turns += 1;
    }
}
```

---

## Iteration Limit

Default: `usize::MAX` (effectively unlimited)

```rust
pub fn with_max_iterations(mut self, max_iterations: usize) -> Self {
    self.max_iterations = max_iterations;
    self
}
```

Prevents infinite loops when model keeps calling tools.

---

## Tool Executor Trait

Custom tool execution implementation:

```rust
pub trait ToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError>;
}
```

### Built-in Implementation

The CLI uses `CliToolExecutor` which delegates to `GlobalToolRegistry`:

```rust
impl ToolExecutor for CliToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        let value: Value = serde_json::from_str(input)
            .map_err(|e| ToolError::new(e.to_string()))?;
        
        self.registry.execute(tool_name, &value)
            .map_err(|e| ToolError::new(e))
    }
}
```

---

## Error Types

### RuntimeError

```rust
pub struct RuntimeError {
    message: String,
}

// Variants (conceptual):
// - "max iterations exceeded"
// - "conversation loop failed"
// - "assistant stream produced no content"
// - "assistant stream ended without message stop"
```

### ToolError

```rust
pub struct ToolError {
    message: String,
}

// Variants (conceptual):
// - "unsupported tool: <name>"
// - "tool execution failed: <reason>"
// - "permission denied: <reason>"
```
