Low-level architecture for reference agent. 

**1. Token Usage Tracking** (`rust/crates/runtime/src/usage.rs`)
- `TokenUsage`: input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
- `UsageTracker`: cumulative tracking across turns
- `ModelPricing`: per-model cost calculation (Haiku, Sonnet, Opus tiers)
- `UsageCostEstimate`: USD cost breakdown

**2. Session Management** (`rust/crates/runtime/src/session.rs`)
- `Session`: version, messages array
- `ConversationMessage`: role, blocks, usage (per message)
- `ContentBlock`: Text, ToolUse, ToolResult types
- JSON serialization for persistence

**3. Runtime Events** (`rust/crates/runtime/src/conversation.rs`)
- `TurnSummary`: assistant_messages, tool_results, iterations, usage
- `AssistantEvent`: TextDelta, ToolUse, Usage, MessageStop
- Per-turn tracking with iteration counting

**4. Server Architecture** (`rust/crates/server/src/lib.rs`)
- Session store with in-memory HashMap
- SSE event streaming for real-time updates
- Session creation timestamps
- Message counting

============

## Session management:
Based on the Rust code in rust/crates/runtime/src/session.rs, here's a concrete example:
{
  "version": 1,
  "messages": [
    {
      "role": "system",
      "blocks": [
        {
          "type": "text",
          "text": "You are a helpful coding assistant."
        }
      ]
    },
    {
      "role": "user",
      "blocks": [
        {
          "type": "text",
          "text": "Create a function that calculates fibonacci numbers"
        }
      ]
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "I'll create a fibonacci function for you."
        },
        {
          "type": "tool_use",
          "id": "tool-1",
          "name": "bash",
          "input": "{\"command\": \"cat > fibonacci.py << 'EOF'\\ndef fib(n):\\n    if n <= 1:\\n        return n\\n    return fib(n-1) + fib(n-2)\\n\\nfor i in range(10):\\n    print(f\"fib({i}) = {fib(i)}\")\\nEOF\"}"
        }
      ],
      "usage": {
        "input_tokens": 245,
        "output_tokens": 156,
        "cache_creation_input_tokens": 3200,
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
          "output": "File created: fibonacci.py",
          "is_error": false
        }
      ]
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "Created fibonacci.py. The function uses recursion with O(2^n) complexity. For production, you may want memoization:\n\n```python\nfrom functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)\n```"
        }
      ],
      "usage": {
        "input_tokens": 401,
        "output_tokens": 312,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 145
      }
    }
  ]
}
Key structures:
Field
version
messages
role
blocks
usage
type
Per-message token usage (attached to assistant only):
{
  "input_tokens": 401,
  "output_tokens": 312,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 145
}
Tool call format:
{
  "type": "tool_use",
  "id": "tool-1",
  "name": "bash",
  "input": "{\"command\": \"...\"}"
}
Tool result format:
{
  "type": "tool_result",
  "tool_use_id": "tool-1",
  "tool_name": "bash",
  "output": "File created: fibonacci.py",
  "is_error": false
}


## Runtime events

Based on rust/crates/runtime/src/conversation.rs:
TurnSummary Example
{
  "assistant_messages": [
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "I'll check the current directory structure."
        },
        {
          "type": "tool_use",
          "id": "tool-1",
          "name": "bash",
          "input": "{\"command\": \"ls -la\"}"
        },
        {
          "type": "text",
          "text": "Found the project files. Now let me read the main config."
        },
        {
          "type": "tool_use",
          "id": "tool-2",
          "name": "read",
          "input": "{\"path\": \"config.json\"}"
        }
      ],
      "usage": {
        "input_tokens": 524,
        "output_tokens": 189,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 412
      }
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "text",
          "text": "Based on the config, I'll update the database connection string."
        },
        {
          "type": "tool_use",
          "id": "tool-3",
          "name": "edit",
          "input": "{\"path\": \"config.json\", \"old_string\": \"\\\"host\\\": \\\"localhost\\\"\", \"new_string\": \"\\\"host\\\": \\\"prod-db.internal\\\"\"}"
        }
      ],
      "usage": {
        "input_tokens": 892,
        "output_tokens": 98,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 680
      }
    }
  ],
  "tool_results": [
    {
      "role": "tool",
      "blocks": [
        {
          "type": "tool_result",
          "tool_use_id": "tool-1",
          "tool_name": "bash",
          "output": "total 128\ndrwxr-xr-x  6 dev  staff  4096 Apr  3 10:30 .\ndrwxr-xr-x  8 dev  staff  4096 Apr  3 10:30 ..\n-rw-r--r--  1 dev  staff  4096 Apr  3 10:30 config.json\n-rw-r--r--  1 dev  staff  4096 Apr  3 10:30 README.md\ndrwxr-xr-x  3 dev  staff  4096 Apr  3 10:30 src/\ndrwxr-xr-xr-x  3 dev  staff  4096 Apr  3 10:30 tests/",
          "is_error": false
        }
      ]
    },
    {
      "role": "tool",
      "blocks": [
        {
          "type": "tool_result",
          "tool_use_id": "tool-2",
          "tool_name": "read",
          "output": "{\n  \"database\": {\n    \"host\": \"localhost\",\n    \"port\": 5432,\n    \"name\": \"myapp\"\n  },\n  \"debug\": true\n}",
          "is_error": false
        }
      ]
    },
    {
      "role": "tool",
      "blocks": [
        {
          "type": "tool_result",
          "tool_use_id": "tool-3",
          "tool_name": "edit",
          "output": "Successfully edited config.json",
          "is_error": false
        }
      ]
    }
  ],
  "iterations": 2,
  "usage": {
    "input_tokens": 1416,
    "output_tokens": 287,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 1092
  }
}
---
AssistantEvent Stream Example
These events are emitted during streaming from the API:
[TextDelta] "I'll check the current directory"
[TextDelta] " structure."
[ToolUse] {"id": "tool-1", "name": "bash", "input": "{\"command\": \"ls -la\"}"}
[TextDelta] "Found the files. Now reading config..."
[ToolUse] {"id": "tool-2", "name": "read", "input": "{\"path\": \"config.json\"}"}
[Usage] {"input_tokens": 524, "output_tokens": 189, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 412}
[MessageStop]
As structured events:
[
  {
    "event": "TextDelta",
    "delta": "I'll check the current directory"
  },
  {
    "event": "TextDelta",
    "delta": " structure."
  },
  {
    "event": "ToolUse",
    "id": "tool-1",
    "name": "bash",
    "input": "{\"command\": \"ls -la\"}"
  },
  {
    "event": "TextDelta",
    "delta": "Found the files. Now reading config..."
  },
  {
    "event": "ToolUse",
    "id": "tool-2",
    "name": "read",
    "input": "{\"path\": \"config.json\"}"
  },
  {
    "event": "Usage",
    "input_tokens": 524,
    "output_tokens": 189,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 412
  },
  {
    "event": "MessageStop"
  }
]
---
Data Flow Summary
┌──────────────────────────────────────────────────────────────────────┐
│  API Stream (SSE)                                                    │
│  ┌────────────┬────────────┬─────────────┬────────────┬───────────┐ │
│  │ TextDelta  │ TextDelta  │  ToolUse    │   Usage    │MessageStop│ │
│  │ (chunk 1)  │ (chunk 2)  │             │            │           │ │
│  └────────────┴────────────┴─────────────┴────────────┴───────────┘ │
│                        │                                                      │
│                        ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  build_assistant_message()  - Aggregates events into ConversationMessage │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                        │                                                      │
│          ┌─────────────┴─────────────┐                                    │
│          ▼                           ▼                                    │
│  ┌───────────────────┐    ┌───────────────────┐                         │
│  │ assistant_message │    │   tool_result     │                         │
│  │ (with blocks)     │    │   messages        │                         │
│  └───────────────────┘    └───────────────────┘                         │
│          │                           │                                    │
│          └─────────────┬─────────────┘                                    │
│                        ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TurnSummary                                                        │   │
│  │  ├── assistant_messages: [ConversationMessage, ...]                  │   │
│  │  ├── tool_results: [ConversationMessage, ...]                       │   │
│  │  ├── iterations: 2                                                 │   │
│  │  └── usage: { input_tokens, output_tokens, cache_*, total }         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
Key metrics this produces:
Field
iterations
tool_results.length
usage.input_tokens
usage.cache_read_tokens
tool_results[].is_error