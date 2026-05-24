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

### Override fields

| Field              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `url`              | **Required.** Event Horizon proxy base URL.           |
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

## How model discovery works

The extension discovers model specs through a layered fallback:

1. **LiteLLM `model_info`** — If `config.yaml` has `model_info` for the `singularity` alias.
2. **Event Horizon `/health`** — Reads `target_model` and `model_info` from the proxy.
3. **Hardcoded registry** — Matches `target_model` against known upstream models.
4. **`instances.yaml` overrides** — User-specified values in the config file.
5. **Static defaults** — Safe conservative values (128k context, 16k max tokens).

## Requirements

- Pi coding agent (latest)
- Event Horizon proxy running and reachable
