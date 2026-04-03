# Errors Documentation

## Overview

This document catalogs all error types in Claw Code and provides guidance for displaying agent status and errors in the Zendash dashboard.

**Source Files:**
- `rust/crates/runtime/src/conversation.rs` - Runtime errors
- `rust/crates/runtime/src/session.rs` - Session errors
- `rust/crates/runtime/src/config.rs` - Configuration errors
- `rust/crates/runtime/src/permissions.rs` - Permission outcomes
- `rust/crates/api/src/error.rs` - API errors
- `rust/crates/mcp_stdio.rs` - MCP errors
- `rust/crates/plugins/src/lib.rs` - Plugin errors
- `rust/crates/lsp/src/error.rs` - LSP errors

---

## Error Taxonomy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Error Hierarchy                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AgentErrors                                                                 │
│  ├── API Errors           (Provider connectivity, auth, rate limits)       │
│  ├── Runtime Errors       (Turn execution, iteration limits)                 │
│  ├── Tool Errors          (Execution failures, unknown tools)                │
│  ├── Permission Errors    (Access denied, escalation failures)               │
│  ├── Session Errors       (Persistence, format, I/O)                        │
│  ├── MCP Errors           (Server connectivity, tool discovery)              │
│  ├── Plugin Errors        (Manifest validation, loading)                     │
│  └── Config Errors        (Parse errors, missing settings)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. API Errors

**Source**: `rust/crates/api/src/error.rs`

### ApiError Enum

```rust
pub enum ApiError {
    MissingCredentials {
        provider: &'static str,
        env_vars: &'static [&'static str],
    },
    ExpiredOAuthToken,
    Auth(String),
    InvalidApiKeyEnv(VarError),
    Http(reqwest::Error),
    Io(std::io::Error),
    Json(serde_json::Error),
    Api {
        status: reqwest::StatusCode,
        error_type: Option<String>,
        message: Option<String>,
        body: String,
        retryable: bool,
    },
    RetriesExhausted {
        attempts: u32,
        last_error: Box<ApiError>,
    },
    InvalidSseFrame(&'static str),
    BackoffOverflow {
        attempt: u32,
        base_delay: Duration,
    },
}
```

### Error Details

| Error | Code | Severity | Retryable | Description |
|-------|------|----------|-----------|-------------|
| `MissingCredentials` | `AUTH_001` | 🔴 Critical | No | No API key configured |
| `ExpiredOAuthToken` | `AUTH_002` | 🔴 Critical | No | OAuth token needs refresh |
| `Auth(String)` | `AUTH_003` | 🔴 Critical | No | General auth failure |
| `InvalidApiKeyEnv` | `AUTH_004` | 🔴 Critical | No | Env var parse error |
| `Http(reqwest::Error)` | `NET_001` | 🟡 Warning | **Yes** | Network connectivity |
| `Io(std::io::Error)` | `SYS_001` | 🔴 Critical | No | System I/O failure |
| `Json(serde_json::Error)` | `SYS_002` | 🔴 Critical | No | JSON parse failure |
| `Api { status, ... }` | varies | varies | `retryable` | Provider API error |
| `RetriesExhausted` | `NET_002` | 🔴 Critical | No | Max retries hit |
| `InvalidSseFrame` | `NET_003` | 🟡 Warning | **Yes** | Malformed stream |
| `BackoffOverflow` | `NET_004` | 🔴 Critical | No | Exponential backoff overflow |

### HTTP Status Code Mapping

| Status | Meaning | User-Facing Message | Retryable |
|--------|---------|---------------------|-----------|
| 400 | Bad Request | "Invalid request parameters" | No |
| 401 | Unauthorized | "Authentication failed" | No |
| 403 | Forbidden | "Access denied" | No |
| 429 | Rate Limited | "Too many requests, please wait" | **Yes** |
| 500 | Server Error | "Provider server error" | **Yes** |
| 502 | Bad Gateway | "Provider unavailable" | **Yes** |
| 503 | Service Unavailable | "Provider temporarily unavailable" | **Yes** |

---

## 2. Runtime Errors

**Source**: `rust/crates/runtime/src/conversation.rs`

### RuntimeError

```rust
pub struct RuntimeError {
    message: String,
}
```

| Error | Cause | Recovery |
|-------|-------|----------|
| "conversation loop exceeded the maximum number of iterations" | Too many tool calls in single turn | User intervention |
| "assistant stream ended without a message stop event" | Provider protocol error | Retry |
| "assistant stream produced no content" | Empty response from model | Retry |

### ToolError

```rust
pub struct ToolError {
    message: String,
}
```

| Error | Cause | Recovery |
|-------|-------|----------|
| "unsupported tool: {name}" | Unknown tool requested | Bug in prompt |
| "tool execution failed: {reason}" | Tool failed to execute | Depends on tool |
| "permission denied: {reason}" | Permission policy blocked | User approval |

---

## 3. Session Errors

**Source**: `rust/crates/runtime/src/session.rs`

### SessionError Enum

```rust
pub enum SessionError {
    Io(std::io::Error),
    Json(JsonError),
    Format(String),
}
```

| Error | Cause | User-Facing |
|-------|-------|------------|
| `Io` | File not found, permission denied | "Could not load session: {details}" |
| `Json` | Corrupted session file | "Session file corrupted" |
| `Format` | Invalid session structure | "Invalid session format" |

---

## 4. Permission Errors

**Source**: `rust/crates/runtime/src/permissions.rs`

### PermissionOutcome

```rust
pub enum PermissionOutcome {
    Allow,
    Deny { reason: String },
}
```

### Permission Levels

| Level | Value | Tools Allowed |
|-------|-------|---------------|
| `ReadOnly` | 1 | read_file, glob_search, grep_search, WebFetch, WebSearch |
| `WorkspaceWrite` | 2 | + write_file, edit_file, TodoWrite, NotebookEdit |
| `DangerFullAccess` | 3 | + bash, PowerShell, REPL, Agent |
| `Prompt` | special | Ask user before dangerous operations |
| `Allow` | special | Allow all without prompting |

### Permission Denied Reasons

| Reason | Code | Description |
|--------|------|-------------|
| "tool 'bash' requires danger-full-access permission; current mode is read-only" | `PERM_001` | Mode too restrictive |
| "tool 'write_file' requires approval to escalate from workspace-write to danger-full-access" | `PERM_002` | Escalation denied |
| Pre-hook denied execution | `PERM_003` | Hook blocked tool |
| Post-hook flagged issue | `PERM_004` | Hook reported problem |

---

## 5. MCP Errors

**Source**: `rust/crates/runtime/src/mcp_stdio.rs`

### McpServerManagerError Enum

```rust
pub enum McpServerManagerError {
    Io(io::Error),
    JsonRpc {
        server_name: String,
        method: &'static str,
        error: JsonRpcError,
    },
    InvalidResponse {
        server_name: String,
        method: &'static str,
        details: String,
    },
    UnknownTool {
        qualified_name: String,
    },
    UnknownServer {
        server_name: String,
    },
}
```

### JsonRpcError

```rust
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    pub data: Option<JsonValue>,
}
```

| Code | Meaning | Example |
|------|---------|---------|
| -32600 | Invalid Request | Malformed JSON-RPC |
| -32601 | Method not found | Unknown MCP method |
| -32602 | Invalid params | Wrong tool arguments |
| -32603 | Internal error | Server-side failure |
| -32001 | Server error | Tool execution failed |

---

## 6. Plugin Errors

**Source**: `rust/crates/plugins/src/lib.rs`

### PluginError Enum

```rust
pub enum PluginError {
    Io(std::io::Error),
    Json(serde_json::Error),
    ManifestValidation(Vec<PluginManifestValidationError>),
    InvalidManifest(String),
    NotFound(String),
    CommandFailed(String),
}
```

### PluginManifestValidationError

| Error | Cause |
|-------|-------|
| EmptyField | Manifest missing required field |
| InvalidPermission | Unknown permission value |
| DuplicateEntry | Same tool/command defined twice |
| MissingPath | Referenced file doesn't exist |
| InvalidToolInputSchema | Tool schema not valid JSON Schema |

---

## 7. Config Errors

**Source**: `rust/crates/runtime/src/config.rs`

### ConfigError

```rust
pub enum ConfigError {
    Io(std::io::Error),
    Parse(String),
}
```

| Error | Cause |
|-------|-------|
| `Io` | Config file not readable |
| `Parse` | Invalid JSON in config |

---

## 8. Tool Execution Results

Beyond errors, tools can return `is_error` status in results:

```rust
ContentBlock::ToolResult {
    tool_use_id: String,
    tool_name: String,
    output: String,
    is_error: bool,  // Tool reports failure
}
```

---

## Agent Status for UI

### Status Types

```typescript
type AgentStatus = 
  | 'idle'           // Waiting for input
  | 'thinking'       // Model processing
  | 'using_tool'      // Tool executing
  | 'waiting'         // Waiting for user
  | 'completed'       // Turn finished
  | 'error'           // Error occurred
  | 'cancelled';     // User cancelled
```

### Status Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Agent Status Flow                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────┐    User input    ┌──────────┐   Model thinking   ┌─────────┐ │
│  │ idle │ ───────────────► │ thinking │ ◄───────────────── │ waiting │ │
│  └──────┘                  └────┬─────┘                    └────┬────┘ │
│       ▲                         │                                  │      │
│       │                         │ Model decided                   │      │
│       │                         ▼                                  │      │
│       │                    ┌───────────┐                          │      │
│       │                    │ using_tool│◄─────────────────────────┘      │
│       │                    └─────┬─────┘                                 │
│       │                          │ Tool done                            │
│       │                          ▼                                      │
│       │    Tool called    ┌───────────┐                                  │
│       └───────────────────│ thinking  │◄─────────────────────────────┘
│                            └─────┬─────┘
│                                  │
│              ┌───────────────────┼───────────────────┐
│              │                   │                   │
│              ▼                   ▼                   ▼
│        ┌──────────┐       ┌──────────┐       ┌────────────┐
│        │ completed│       │   error  │       │  cancelled  │
│        └──────────┘       └──────────┘       └────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Display Recommendations

### 1. Status Indicator Component

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Status                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🟢 thinking        Model is processing your request...        │
│                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  idle   │  │thinking │  │  tool   │  │completed│           │
│  │   ⚪    │  │   🔵    │  │   🔶    │  │   ✅    │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Error Card Component

```tsx
interface ErrorCardProps {
  error: {
    code: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    retryable: boolean;
    timestamp: Date;
    context?: {
      tool?: string;
      session?: string;
      provider?: string;
    };
  };
  onRetry?: () => void;
  onDismiss?: () => void;
}

// Display
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 Error: AUTH_001                                         [✕] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Missing API Credentials                                           │
│                                                                   │
│ Anthropic API key not configured. Export ANTHROPIC_API_KEY       │
│ before running.                                                   │
│                                                                   │
│ ⚠ This error cannot be automatically retried.                  │
│                                                                   │
│ [View Setup Guide]                    [Dismiss]                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Error Timeline Component

```tsx
// Show errors in chronological order during session
interface ErrorTimelineProps {
  errors: Array<{
    id: string;
    timestamp: Date;
    status: 'thinking' | 'using_tool' | 'error';
    error?: ErrorInfo;
    message?: string;
    tool?: string;
  }>;
}

// Display
┌─────────────────────────────────────────────────────────────────┐
│ Session Timeline                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 10:30:45  🟢 Completed "Read src/main.rs"                      │
│ 10:30:42  🔵 Thinking...                                        │
│ 10:30:40  🔴 Error: Tool 'bash' execution failed              │
│            │ bash: command not found: npm                       │
│ 10:30:38  🔵 Thinking...                                        │
│ 10:30:35  🟡 Permission denied for 'bash'                     │
│            │ Requires danger-full-access                        │
│ 10:30:30  🔵 Thinking...                                        │
│ 10:30:25  🟢 Started session                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Error Summary Dashboard

```tsx
interface ErrorSummaryProps {
  metrics: {
    totalErrors: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    retryableRate: number;
    avgRecoveryTime: number;
  };
}

// Display
┌─────────────────────────────────────────────────────────────────┐
│ Error Analytics (Last 30 Days)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │    156    │  │     89     │  │    23%     │  │   4.2m   │ │
│  │  Total    │  │  Resolved  │  │ Retryable  │  │ Avg Fix  │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
│                                                                   │
│  By Category          By Severity                                │
│  ┌───────────────┐   ┌─────────────────────────────────────┐   │
│  │ Auth     ████ │   │ 🔴 Critical  ████████████████  45    │   │
│  │ Network  ███  │   │ 🟡 Warning  ████████████      78    │   │
│  │ Tool     ██  │   │ 🔵 Info     ██████            33    │   │
│  │ Perm    █    │   └─────────────────────────────────────┘   │
│  └───────────────┘                                               │
│                                                                   │
│  Top Errors                                                      │
│  1. MissingCredentials (AUTH_001)           45 occurrences        │
│  2. RateLimited (429)                     23 occurrences        │
│  3. ToolExecutionFailed (bash)             18 occurrences        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Event Schema for Error Tracking

```typescript
// Error event for ingestion
interface AgentErrorEvent {
  eventId: string;
  sessionId: string;
  organizationId: string;
  userId: string;
  
  // Error classification
  category: 'api' | 'runtime' | 'tool' | 'permission' | 'mcp' | 'plugin' | 'config';
  errorCode: string;        // e.g., "AUTH_001", "NET_001"
  errorType: string;        // e.g., "MissingCredentials", "Http"
  
  // Details
  message: string;          // Full error message
  stackTrace?: string;      // If available
  
  // Context
  toolName?: string;       // If tool-related
  provider?: string;       // If API-related
  mcpServer?: string;      // If MCP-related
  
  // Resolution
  severity: 'critical' | 'warning' | 'info';
  retryable: boolean;
  resolved: boolean;
  resolvedAt?: string;
  
  // Timing
  occurredAt: string;
  durationMs?: number;      // How long error state lasted
}
```

---

## Error Code Reference Table

| Code | Type | Category | Message | Retryable |
|------|------|----------|---------|-----------|
| AUTH_001 | MissingCredentials | API | No API key configured | No |
| AUTH_002 | ExpiredOAuthToken | API | OAuth token expired | No |
| AUTH_003 | Auth | API | Authentication failed | No |
| NET_001 | Http | API | Network error | **Yes** |
| NET_002 | RetriesExhausted | API | Max retries exceeded | No |
| NET_003 | InvalidSseFrame | API | Malformed stream | **Yes** |
| NET_004 | BackoffOverflow | API | Backoff exceeded limits | No |
| RUNTIME_001 | MaxIterations | Runtime | Too many iterations | No |
| RUNTIME_002 | StreamEnded | Runtime | Stream terminated early | **Yes** |
| RUNTIME_003 | NoContent | Runtime | Empty model response | **Yes** |
| TOOL_001 | UnknownTool | Tool | Tool not found | No |
| TOOL_002 | ExecutionFailed | Tool | Tool execution error | Depends |
| PERM_001 | ModeDenied | Permission | Mode too restrictive | No |
| PERM_002 | EscalationDenied | Permission | User denied escalation | No |
| PERM_003 | HookDenied | Permission | Pre-hook blocked | No |
| PERM_004 | HookFlagged | Permission | Post-hook flagged | No |
| SESSION_001 | IoError | Session | File system error | No |
| SESSION_002 | JsonError | Session | Session corrupted | No |
| SESSION_003 | FormatError | Session | Invalid session format | No |
| MCP_001 | ServerNotFound | MCP | MCP server not found | No |
| MCP_002 | ToolNotFound | MCP | MCP tool not found | No |
| MCP_003 | JsonRpcError | MCP | JSON-RPC protocol error | Depends |
| MCP_004 | ConnectionFailed | MCP | Server unreachable | **Yes** |
| PLUGIN_001 | ManifestInvalid | Plugin | Plugin manifest error | No |
| PLUGIN_002 | LoadFailed | Plugin | Plugin failed to load | No |
| PLUGIN_003 | ValidationFailed | Plugin | Plugin validation error | No |
| CONFIG_001 | ParseError | Config | Config file invalid | No |
| CONFIG_002 | MissingFile | Config | Config file not found | No |

---

## Alerting Recommendations

### Critical Alerts (PagerDuty)

- `AUTH_001` - Missing credentials (org-wide impact)
- `AUTH_002` - Expired tokens affecting users
- `RUNTIME_001` - Repeated iteration limits

### Warning Alerts (Slack)

- `NET_001` - Network errors > 5% of requests
- `TOOL_002` - Tool failures > 10% of calls
- `MCP_004` - MCP server connection issues

### Info Logs (Dashboard only)

- `PERM_001` - Permission denials (for analytics)
- `SESSION_002` - Session corruption (user impact)
- `CONFIG_001` - Config warnings
