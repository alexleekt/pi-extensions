# pi-event-horizon-provider

> Pi provider for Event Horizon — the boundary that collapses any model name to a configured target.

## Installation

From the `event-horizon` repository root:

```bash
# Symlink for local development
ln -s $(pwd)/pi-event-horizon-provider ~/.pi/agent/extensions/pi-event-horizon-provider

# Or install as a git package
pi install git:github.com/yourname/event-horizon
```

Then reload pi:

```
/reload
```

## Configuration

The extension reads `~/.pi/agent/config/event-horizon/instances.yaml`. If the file doesn't exist, it is auto-created with a default `local` instance:

```yaml
instances:
  local:
    url: http://localhost:4000
```

### Multiple instances

```yaml
instances:
  local:
    url: http://localhost:4000
  server1:
    url: http://server1.internal:4000
    context_window: 200000
    max_tokens: 16384
```

### API format

Each instance can use a different API format. The default is `openai-completions`:

```yaml
instances:
  local:
    url: http://localhost:4000
  local-anthropic:
    url: http://localhost:4000
    api: anthropic-messages
```

Available values:

| Value | Endpoint | When to use |
|-------|----------|-------------|
| `openai-completions` (default) | `/v1/chat/completions` | Widest compatibility. Works with virtually any model via LiteLLM. |
| `anthropic-messages` | `/v1/messages` | Native Claude features: thinking blocks, extended thinking, Anthropic-style cache control. |
| `openai-responses` | `/v1/responses` | OpenAI's newer API. Built-in reasoning, web search, and file parsing. Replaces `chat/completions`. |

**Note:** The Event Horizon proxy handles translation to the actual upstream model regardless of which API format you choose. The format only affects how Pi talks to the proxy.

### Override fields

| Field              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `url`              | **Required.** Event Horizon proxy base URL.           |
| `api`              | API format: `openai-completions` (default), `anthropic-messages`, or `openai-responses`. |
| `context_window`   | Override the model's context window.                  |
| `max_tokens`       | Override the model's max output tokens.               |
| `reasoning`        | Set to `true` if the target model supports reasoning. |
| `input`            | Comma-separated: `text`, `image`, or both.            |
| `cost_input`       | Cost per 1M input tokens.                             |
| `cost_output`      | Cost per 1M output tokens.                            |
| `cost_cache_read`  | Cost per 1M cached read tokens.                       |
| `cost_cache_write` | Cost per 1M cached write tokens.                      |

## Usage

After installation, Event Horizon instances appear in pi's model selector as `event-horizon/<name>`.

Use `/event-horizon` to see the status of all configured instances, including reachability and singularity targets.

Toggle the API format for an instance without editing the config file:

```
/event-horizon local anthropic
/event-horizon local openai
/event-horizon local responses
```

This updates `instances.yaml` in place and re-registers the provider immediately. Run `/model event-horizon/<name>` to switch to the new format.

## How model discovery works

The extension discovers model specs through a layered fallback:

1. **LiteLLM `/v1/models`** — If `singularity` has `model_info` in the LiteLLM config.
2. **Event Horizon `/health`** — Reads `target_model` and `model_info` from the proxy.
3. **`instances.yaml` overrides** — User-specified values in the config file.
4. **Static defaults** — Modern conservative values (256k context, 32k max tokens).

## Requirements

- Pi coding agent (latest)
- Event Horizon proxy running and reachable
