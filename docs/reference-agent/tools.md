# Tools Documentation

## Overview

The Claw Code agent has a built-in tool system that provides capabilities for file operations, shell commands, web access, and task management. Tools are defined with JSON schemas and execute through a permission-gated system.

---

## Tool Registry

**Source**: `rust/crates/tools/src/lib.rs`

### Built-in Tools (MVP)

| Tool | Name | Permission | Description |
|------|------|------------|-------------|
| 1 | `bash` | `DangerFullAccess` | Execute shell commands |
| 2 | `read_file` | `ReadOnly` | Read file contents |
| 3 | `write_file` | `WorkspaceWrite` | Create/overwrite files |
| 4 | `edit_file` | `WorkspaceWrite` | Modify file contents |
| 5 | `glob_search` | `ReadOnly` | Find files by pattern |
| 6 | `grep_search` | `ReadOnly` | Search file contents |
| 7 | `WebFetch` | `ReadOnly` | Fetch web pages |
| 8 | `WebSearch` | `ReadOnly` | Search the web |
| 9 | `TodoWrite` | `WorkspaceWrite` | Manage task list |
| 10 | `Skill` | `ReadOnly` | Load skill definitions |
| 11 | `Agent` | `DangerFullAccess` | Launch sub-agents |
| 12 | `ToolSearch` | `ReadOnly` | Find deferred tools |
| 13 | `NotebookEdit` | `WorkspaceWrite` | Edit Jupyter notebooks |
| 14 | `Sleep` | `ReadOnly` | Wait for duration |
| 15 | `SendUserMessage` | `ReadOnly` | Send message to user |
| 16 | `Config` | `WorkspaceWrite` | Get/set settings |
| 17 | `StructuredOutput` | `ReadOnly` | Return structured data |
| 18 | `REPL` | `DangerFullAccess` | Execute in REPL |
| 19 | `PowerShell` | `DangerFullAccess` | Run PowerShell commands |

---

## Tool Specifications

### 1. bash

Execute shell commands in the current workspace.

```json
{
  "name": "bash",
  "description": "Execute a shell command in the current workspace.",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": { "type": "string" },
      "timeout": { "type": "integer", "minimum": 1 },
      "description": { "type": "string" },
      "run_in_background": { "type": "boolean" },
      "dangerouslyDisableSandbox": { "type": "boolean" }
    },
    "required": ["command"]
  }
}
```

**Example Input:**
```json
{
  "command": "ls -la && npm test",
  "timeout": 60,
  "description": "List files and run tests"
}
```

**Example Output:**
```json
{
  "stdout": "total 128\ndrwxr-xr-x  6 dev  staff  4096 Apr  3 10:30 .\ndrwxr-xr-x  8 dev  staff  4096 Apr  3 10:30 ..\n...",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 1523
}
```

**Permission Level**: Requires `DangerFullAccess` - can execute arbitrary shell commands.

---

### 2. read_file

Read text file contents from the workspace.

```json
{
  "name": "read_file",
  "description": "Read a text file from the workspace.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "offset": { "type": "integer", "minimum": 0 },
      "limit": { "type": "integer", "minimum": 1 }
    },
    "required": ["path"]
  }
}
```

**Example Input:**
```json
{
  "path": "src/main.rs",
  "offset": 0,
  "limit": 100
}
```

**Example Output:**
```json
{
  "path": "src/main.rs",
  "content": "fn main() {\n    println!(\"Hello, world!\");\n}",
  "linesRead": 5,
  "totalLines": 150
}
```

---

### 3. write_file

Create or overwrite a file in the workspace.

```json
{
  "name": "write_file",
  "description": "Write a text file in the workspace.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "content": { "type": "string" }
    },
    "required": ["path", "content"]
  }
}
```

**Example Input:**
```json
{
  "path": "src/utils.rs",
  "content": "pub fn helper() -> String {\n    String::from(\"hello\")\n}"
}
```

**Example Output:**
```json
{
  "path": "src/utils.rs",
  "bytesWritten": 67,
  "success": true
}
```

---

### 4. edit_file

Replace text in a file using string matching.

```json
{
  "name": "edit_file",
  "description": "Replace text in a workspace file.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "old_string": { "type": "string" },
      "new_string": { "type": "string" },
      "replace_all": { "type": "boolean" }
    },
    "required": ["path", "old_string", "new_string"]
  }
}
```

**Example Input:**
```json
{
  "path": "config.json",
  "old_string": "\"debug\": false",
  "new_string": "\"debug\": true",
  "replace_all": false
}
```

**Example Output:**
```json
{
  "path": "config.json",
  "old_string": "\"debug\": false",
  "new_string": "\"debug\": true",
  "success": true,
  "replacements": 1
}
```

---

### 5. glob_search

Find files matching a glob pattern.

```json
{
  "name": "glob_search",
  "description": "Find files by glob pattern.",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": { "type": "string" },
      "path": { "type": "string" }
    },
    "required": ["pattern"]
  }
}
```

**Example Input:**
```json
{
  "pattern": "**/*.rs",
  "path": "src"
}
```

**Example Output:**
```json
{
  "matches": [
    "src/main.rs",
    "src/lib.rs",
    "src/cli.rs"
  ],
  "total": 3
}
```

---

### 6. grep_search

Search file contents with regex patterns.

```json
{
  "name": "grep_search",
  "description": "Search file contents with a regex pattern.",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": { "type": "string" },
      "path": { "type": "string" },
      "glob": { "type": "string" },
      "output_mode": { "type": "string" },
      "-B": { "type": "integer" },
      "-A": { "type": "integer" },
      "-C": { "type": "integer" },
      "context": { "type": "integer" },
      "-n": { "type": "boolean" },
      "-i": { "type": "boolean" },
      "type": { "type": "string" },
      "head_limit": { "type": "integer" },
      "offset": { "type": "integer" },
      "multiline": { "type": "boolean" }
    },
    "required": ["pattern"]
  }
}
```

**Example Input:**
```json
{
  "pattern": "fn main",
  "path": "src",
  "-n": true,
  "-i": true,
  "head_limit": 50
}
```

**Example Output:**
```json
{
  "matches": [
    {
      "path": "src/main.rs",
      "line_number": 1,
      "content": "fn main() {"
    },
    {
      "path": "src/lib.rs",
      "line_number": 42,
      "content": "    fn main() -> Result<(), Error> {"
    }
  ],
  "total": 2
}
```

---

### 7. WebFetch

Fetch and summarize web page content.

```json
{
  "name": "WebFetch",
  "description": "Fetch a URL, convert it into readable text, and answer a prompt about it.",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "format": "uri" },
      "prompt": { "type": "string" }
    },
    "required": ["url", "prompt"]
  }
}
```

**Example Input:**
```json
{
  "url": "https://api.rust-lang.org/stable.json",
  "prompt": "What is the latest stable Rust version?"
}
```

**Example Output:**
```json
{
  "url": "https://api.rust-lang.org/stable.json",
  "bytes": 1250,
  "code": 200,
  "codeText": "OK",
  "result": "Fetched https://api.rust-lang.org/stable.json\nContent preview:\n{\"package\": {\"name\": \"rust\", \"version\": \"1.76.0\"}}",
  "durationMs": 245
}
```

---

### 8. WebSearch

Search the web for current information.

```json
{
  "name": "WebSearch",
  "description": "Search the web for current information and return cited results.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "minLength": 2 },
      "allowed_domains": {
        "type": "array",
        "items": { "type": "string" }
      },
      "blocked_domains": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }
}
```

**Example Input:**
```json
{
  "query": "Rust async runtime 2026",
  "allowed_domains": ["github.com", "rust-lang.org"]
}
```

**Example Output:**
```json
{
  "query": "Rust async runtime 2026",
  "results": [
    {
      "type": "commentary",
      "content": "Search results for \"Rust async runtime 2026\". Include a Sources section in the final answer.\n- [Tokio 2.0 Released](https://github.com/tokio-rs/tokio)\n- [Async-Std v1.12](https://async.rs)"
    },
    {
      "type": "search_result",
      "tool_use_id": "web_search_1",
      "content": [
        { "title": "Tokio 2.0 Released", "url": "https://github.com/tokio-rs/tokio" },
        { "title": "Async-Std v1.12", "url": "https://async.rs" }
      ]
    }
  ],
  "durationSeconds": 1.45
}
```

---

### 9. TodoWrite

Manage the session's task list.

```json
{
  "name": "TodoWrite",
  "description": "Update the structured task list for the current session.",
  "input_schema": {
    "type": "object",
    "properties": {
      "todos": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "content": { "type": "string" },
            "activeForm": { "type": "string" },
            "status": {
              "type": "string",
              "enum": ["pending", "in_progress", "completed"]
            }
          },
          "required": ["content", "activeForm", "status"]
        }
      }
    },
    "required": ["todos"]
  }
}
```

**Example Input:**
```json
{
  "todos": [
    {
      "content": "Fix authentication bug",
      "activeForm": "Fixing authentication bug",
      "status": "completed"
    },
    {
      "content": "Add unit tests",
      "activeForm": "Adding unit tests",
      "status": "in_progress"
    },
    {
      "content": "Update documentation",
      "activeForm": "Updating documentation",
      "status": "pending"
    }
  ]
}
```

**Example Output:**
```json
{
  "oldTodos": [...],
  "newTodos": [...],
  "verificationNudgeNeeded": false
}
```

---

### 10. Skill

Load a local skill definition from disk.

```json
{
  "name": "Skill",
  "description": "Load a local skill definition and its instructions.",
  "input_schema": {
    "type": "object",
    "properties": {
      "skill": { "type": "string" },
      "args": { "type": "string" }
    },
    "required": ["skill"]
  }
}
```

**Example Input:**
```json
{
  "skill": "code-review",
  "args": "--focus security"
}
```

**Example Output:**
```json
{
  "skill": "code-review",
  "path": "/home/user/.codex/skills/code-review/SKILL.md",
  "args": "--focus security",
  "description": "Performs a comprehensive code review",
  "prompt": "# Code Review Skill\n\nYou are a code reviewer..."
}
```

**Skill Search Paths** (in order):
1. `$CODEX_HOME/skills/<skill>/SKILL.md`
2. `$HOME/.agents/skills/<skill>/SKILL.md`
3. `$HOME/.config/opencode/skills/<skill>/SKILL.md`
4. `$HOME/.codex/skills/<skill>/SKILL.md`

---

### 11. Agent

Launch a specialized sub-agent task.

```json
{
  "name": "Agent",
  "description": "Launch a specialized agent task and persist its handoff metadata.",
  "input_schema": {
    "type": "object",
    "properties": {
      "description": { "type": "string" },
      "prompt": { "type": "string" },
      "subagent_type": { "type": "string" },
      "name": { "type": "string" },
      "model": { "type": "string" }
    },
    "required": ["description", "prompt"]
  }
}
```

**Example Input:**
```json
{
  "description": "Fix login bug",
  "prompt": "Find and fix the authentication bug in src/auth.rs",
  "subagent_type": "coder",
  "model": "claude-opus-4-6"
}
```

**Example Output:**
```json
{
  "agentId": "agent_abc123xyz",
  "name": "fix-login-bug",
  "description": "Fix login bug",
  "subagentType": "coder",
  "model": "claude-opus-4-6",
  "status": "running",
  "outputFile": "/home/user/.claw/agents/agent_abc123xyz.md",
  "manifestFile": "/home/user/.claw/agents/agent_abc123xyz.json",
  "createdAt": "2026-04-03T10:30:00Z",
  "startedAt": "2026-04-03T10:30:01Z",
  "completedAt": null,
  "error": null
}
```

---

### 12. NotebookEdit

Edit Jupyter notebook cells.

```json
{
  "name": "NotebookEdit",
  "description": "Replace, insert, or delete a cell in a Jupyter notebook.",
  "input_schema": {
    "type": "object",
    "properties": {
      "notebook_path": { "type": "string" },
      "cell_id": { "type": "string" },
      "new_source": { "type": "string" },
      "cell_type": { "type": "string", "enum": ["code", "markdown"] },
      "edit_mode": { "type": "string", "enum": ["replace", "insert", "delete"] }
    },
    "required": ["notebook_path"]
  }
}
```

---

## Permission Model

Tools are gated by three permission levels:

| Level | Permission | Access |
|-------|------------|--------|
| 1 | `ReadOnly` | File reading, searching, web access |
| 2 | `WorkspaceWrite` | File modification, task management |
| 3 | `DangerFullAccess` | Shell execution, agent spawning |

### Tool Permission Mapping

```rust
// From rust/crates/tools/src/lib.rs

ToolSpec {
    name: "bash",
    required_permission: PermissionMode::DangerFullAccess,
},
ToolSpec {
    name: "read_file",
    required_permission: PermissionMode::ReadOnly,
},
ToolSpec {
    name: "write_file",
    required_permission: PermissionMode::WorkspaceWrite,
},
// ...
```

---

## Tool Selection Algorithm

When the AI model decides to use a tool, the selection process works as follows:

### 1. Model Receives Tool Definitions

The model is provided with all available tool definitions including:
- Tool name
- Description
- Input schema (JSON Schema format)

### 2. Model Decides Tool Call

The model outputs a `tool_use` block containing:
```json
{
  "type": "tool_use",
  "id": "tool-1",
  "name": "bash",
  "input": "{\"command\": \"ls -la\"}"
}
```

### 3. Permission Check

Before execution, the runtime checks:

```rust
// From rust/crates/runtime/src/conversation.rs

let permission_outcome = if let Some(prompt) = prompter.as_mut() {
    self.permission_policy.authorize(&tool_name, &input, Some(*prompt))
} else {
    self.permission_policy.authorize(&tool_name, &input, None)
};
```

### 4. Pre-Hook Execution (if configured)

```rust
let pre_hook_result = self.hook_runner.run_pre_tool_use(&tool_name, &input);
if pre_hook_result.is_denied() {
    // Return denial message
}
```

### 5. Tool Execution

```rust
let (mut output, mut is_error) = match self.tool_executor.execute(&tool_name, &input) {
    Ok(output) => (output, false),
    Err(error) => (error.to_string(), true),
};
```

### 6. Post-Hook Execution

```rust
let post_hook_result = self.hook_runner.run_post_tool_use(&tool_name, &input, &output, is_error);
```

### 7. Result Wrapping

The result is wrapped in a `tool_result` block:

```json
{
  "type": "tool_result",
  "tool_use_id": "tool-1",
  "tool_name": "bash",
  "output": "total 128\n...",
  "is_error": false
}
```

---

## Plugin Tools

Tools can be extended via plugins:

```rust
// From rust/crates/tools/src/lib.rs

pub struct GlobalToolRegistry {
    plugin_tools: Vec<PluginTool>,
}

impl GlobalToolRegistry {
    pub fn with_plugin_tools(plugin_tools: Vec<PluginTool>) -> Result<Self, String> {
        // Check for conflicts with built-in tools
        let builtin_names = mvp_tool_specs()
            .into_iter()
            .map(|spec| spec.name.to_string())
            .collect::<BTreeSet<_>>();
        
        for tool in &plugin_tools {
            if builtin_names.contains(&tool.definition().name) {
                return Err(format!("plugin tool conflicts with built-in"));
            }
        }
        Ok(Self { plugin_tools })
    }
}
```

---

## Tool Aliases

Shortcuts for common tool names:

| Alias | Expands To |
|-------|------------|
| `read` | `read_file` |
| `write` | `write_file` |
| `edit` | `edit_file` |
| `glob` | `glob_search` |
| `grep` | `grep_search` |

```rust
// From rust/crates/tools/src/lib.rs

let name_map = [
    ("read", "read_file"),
    ("write", "write_file"),
    ("edit", "edit_file"),
    ("glob", "glob_search"),
    ("grep", "grep_search"),
].into_iter().collect();
```

---

## CLI Tool Filtering

Tools can be restricted via CLI:

```bash
# Allow only specific tools
claw --allowedTools read_file,glob_search "search the codebase"

# Use aliases
claw --allowedTools read,glob "find files"
```

The `normalize_allowed_tools` function handles:
- Comma/whitespace separation
- Alias expansion
- Validation against known tools
