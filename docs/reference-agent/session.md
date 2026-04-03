# Sessions Documentation

## Overview

A **Session** represents a complete conversation between a user and the AI agent. Sessions persist conversation history, track token usage, and maintain state across multiple turns.

**Source**: `rust/crates/runtime/src/session.rs`

---

## Data Structures

### Session

```rust
pub struct Session {
    pub version: u32,           // Schema version (currently 1)
    pub messages: Vec<ConversationMessage>,
}
```

**Example JSON:**
```json
{
  "version": 1,
  "messages": [
    {
      "role": "system",
      "blocks": [...]
    },
    {
      "role": "user",
      "blocks": [...]
    },
    {
      "role": "assistant",
      "blocks": [...],
      "usage": {...}
    }
  ]
}
```

### ConversationMessage

```rust
pub struct ConversationMessage {
    pub role: MessageRole,
    pub blocks: Vec<ContentBlock>,
    pub usage: Option<TokenUsage>,  // Only present on assistant messages
}

pub enum MessageRole {
    System,     // System prompt
    User,       // User input
    Assistant,  // AI responses
    Tool,       // Tool execution results
}
```

### ContentBlock

```rust
pub enum ContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,          // Unique ID for this tool call
        name: String,        // Tool name (e.g., "bash", "read_file")
        input: String,       // JSON string of tool arguments
    },
    ToolResult {
        tool_use_id: String, // References the matching ToolUse
        tool_name: String,
        output: String,      // Tool execution output
        is_error: bool,
    },
}
```

---

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Session Lifecycle                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐     ┌──────────────┐     ┌───────────────────────┐   │
│  │ Create  │ ──► │   Active    │ ──► │     Completed         │   │
│  │ Session │     │  (Turns)    │     │   (Saved to disk)     │   │
│  └──────────┘     └──────────────┘     └───────────────────────┘   │
│       │                  │                      │                   │
│       │                  │                      │                   │
│       ▼                  ▼                      ▼                   │
│  - version: 1       - messages grow        - Final usage          │
│  - empty messages   - usage accumulates    - Session persisted    │
│                     - turn counter          - Ready to resume     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Session Example

```json
{
  "version": 1,
  "messages": [
    {
      "role": "system",
      "blocks": [
        {
          "type": "text",
          "text": "You are a helpful coding assistant. You have access to tools for reading files, running shell commands, and editing code. Always prefer safe, read operations before destructive ones."
        }
      ]
    },
    {
      "role": "user",
      "blocks": [
        {
          "type": "text",
          "text": "Show me the files in the current directory"
        }
      ]
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "I'll check the current directory structure for you."
        },
        {
          "type": "tool_use",
          "id": "tool-1",
          "name": "bash",
          "input": "{\"command\": \"ls -la\"}"
        }
      ],
      "usage": {
        "input_tokens": 156,
        "output_tokens": 89,
        "cache_creation_input_tokens": 2400,
        "cache_read_input_tokens": 0
      }
    },
    {
      "role": "tool",
      "blocks": [
        {
          "type": "tool_result",
          "tool_use_id": "tool-1",
          "tool_name": "bash",
          "output": "total 256\ndrwxr-xr-x 12 dev staff  4096 Apr  3 09:00 .\ndrwxr-xr-x  8 dev staff  4096 Apr  3 09:00 ..\n-rw-r--r--  1 dev staff   220 Apr  3 09:00 .gitignore\n-rw-r--r--  1 dev staff  1024 Apr  3 09:00 README.md\ndrwxr-xr-x  3 dev staff  4096 Apr  3 09:00 src\ndrwxr-xr-x  4 dev staff  4096 Apr  3 09:00 tests",
          "is_error": false
        }
      ]
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "The current directory contains:\n\n- `.gitignore` - Git ignore file\n- `README.md` - Project readme\n- `src/` - Source code directory\n- `tests/` - Test directory\n\nWould you like me to explore any of these in more detail?"
        }
      ],
      "usage": {
        "input_tokens": 412,
        "output_tokens": 198,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 156
      }
    }
  ]
}
```

---

## Session Persistence

### Save to Disk

```rust
impl Session {
    pub fn save_to_path(&self, path: impl AsRef<Path>) -> Result<(), SessionError> {
        fs::write(path, self.to_json().render())?;
        Ok(())
    }
}
```

### Load from Disk

```rust
impl Session {
    pub fn load_from_path(path: impl AsRef<Path>) -> Result<Self, SessionError> {
        let contents = fs::read_to_string(path)?;
        Self::from_json(&JsonValue::parse(&contents)?)
    }
}
```

### Default Session Path

Sessions are typically stored at:
```
.cw/sessions/session-{timestamp}.json
```

---

## Usage Tracking

Usage is tracked **per assistant message**:

```rust
// Each assistant message can have usage attached
ConversationMessage::assistant_with_usage(blocks, Some(TokenUsage {
    input_tokens: 156,
    output_tokens: 89,
    cache_creation_input_tokens: 2400,
    cache_read_input_tokens: 0,
}))
```

### Aggregating Usage from Session

```rust
impl UsageTracker {
    pub fn from_session(session: &Session) -> Self {
        let mut tracker = Self::new();
        for message in &session.messages {
            if let Some(usage) = message.usage {
                tracker.record(usage);
            }
        }
        tracker
    }
}
```

---

## JSON Serialization

### Session to JSON

```rust
pub fn to_json(&self) -> JsonValue {
    let mut object = BTreeMap::new();
    object.insert("version".to_string(), JsonValue::Number(i64::from(self.version)));
    object.insert(
        "messages".to_string(),
        JsonValue::Array(
            self.messages.iter().map(ConversationMessage::to_json).collect()
        ),
    );
    JsonValue::Object(object)
}
```

### JSON to Session

```rust
pub fn from_json(value: &JsonValue) -> Result<Self, SessionError> {
    let object = value.as_object()?;
    let version = object.get("version").and_then(JsonValue::as_i64)?;
    let messages = object.get("messages").and_then(JsonValue::as_array)?
        .iter()
        .map(ConversationMessage::from_json)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Self { version, messages })
}
```

---

## Session Operations

### Create New Session

```rust
let session = Session::new();
// Equivalent to:
Session {
    version: 1,
    messages: Vec::new(),
}
```

### Add User Message

```rust
session.messages.push(ConversationMessage::user_text("Hello, world!"));
```

### Add Assistant Message with Usage

```rust
session.messages.push(ConversationMessage::assistant_with_usage(
    vec![ContentBlock::Text { text: "Hello!".to_string() }],
    Some(TokenUsage {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
    }),
));
```

### Add Tool Result

```rust
session.messages.push(ConversationMessage::tool_result(
    "tool-1",
    "bash",
    "command output here",
    false,  // is_error
));
```

---

## Turn Structure in Session

A **Turn** consists of one user message followed by one or more assistant/tool exchanges:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Single Turn                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Message                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ role: "user"                                             │    │
│  │ blocks: [ { type: "text", text: "..." } ]               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│  Assistant Message 1                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ role: "assistant"                                        │    │
│  │ blocks: [ Text, ToolUse ]                               │    │
│  │ usage: { input: 156, output: 89, cache_*: ... }         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│  Tool Result                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ role: "tool"                                            │    │
│  │ blocks: [ ToolResult ]                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│  Assistant Message 2 (if more tool calls or final response)    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ role: "assistant"                                        │    │
│  │ blocks: [ Text ]                                         │    │
│  │ usage: { input: 245, output: 312, cache_*: ... }        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Metadata (CLI)

When running in CLI mode, additional metadata is tracked:

| Field | Description |
|-------|-------------|
| `session.id` | Unique session identifier |
| `session.path` | File path to session JSON |
| `session.modified_epoch_secs` | Last modified timestamp |

```rust
struct SessionHandle {
    id: String,
    path: PathBuf,
}
```

---

## Session Resume Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Session Resume Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User invokes:                                                │
│     claw --resume session-20260403.json                          │
│                                                                  │
│  2. Load session from disk:                                      │
│     Session::load_from_path("session-20260403.json")            │
│                                                                  │
│  3. Restore conversation context:                                │
│     - System prompt                                             │
│     - All previous messages                                     │
│     - Usage tracker                                             │
│                                                                  │
│  4. Continue from where left off:                                │
│     - User can continue asking questions                        │
│     - Agent has full context                                    │
│                                                                  │
│  5. Slash commands on resumed session:                          │
│     /status    - Show session metrics                           │
│     /cost      - Display token usage                            │
│     /compact   - Trim session history                           │
│     /export    - Export transcript                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Server Session Management

For multi-user/server deployments:

```rust
// From rust/crates/server/src/lib.rs

pub struct Session {
    pub id: SessionId,                    // Unique session ID
    pub created_at: u64,                   // Unix timestamp ms
    pub conversation: RuntimeSession,      // The actual session
    events: broadcast::Sender<SessionEvent>,
}
```

### Server Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create new session |
| `GET` | `/sessions` | List all sessions |
| `GET` | `/sessions/{id}` | Get session details |
| `POST` | `/sessions/{id}/message` | Send message to session |
| `GET` | `/sessions/{id}/events` | SSE stream for real-time events |

### Session Summary

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: SessionId,
    pub created_at: u64,
    pub message_count: usize,
}
```

---

## Session Limitations

| Limit | Value | Reason |
|-------|-------|--------|
| Max iterations | `usize::MAX` | Unlimited by default |
| Session compaction | Available | When tokens exceed threshold |
| Concurrent sessions | Per-server limit | Depends on memory |
| Session storage | JSON files | No built-in database |

---

## Error Handling

```rust
pub enum SessionError {
    Io(std::io::Error),           // File system errors
    Json(JsonError),              // JSON parse errors
    Format(String),               // Invalid format
}
```

Common errors:
- File not found when loading
- Invalid JSON format
- Missing required fields
- Version mismatch
