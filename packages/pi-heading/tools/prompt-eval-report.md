# Prompt Evaluation Report

- **Model**: firepass
- **Date**: 2026-05-20T06:00:14.070Z
- **Test cases**: 8

## Summary

| Metric | Topic | Goal |
|--------|-------|------|
| Average score (0-5) | 2.00 | 2.00 |
| Perfect 5/5 | 0 | 0 |
| Failed (≤2) | 8 | 8 |

## Per-Case Results

### Input: "How do I fix the memory leak in my Rust service?"

**Topic** (14 words, score 2/5):
```text
The user wants me to act as a topic tagger. I need to distill
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (28 words, score 2/5):
```text
The user wants me to extract the single concrete goal from the message: "How do I fix the memory leak in my Rust service?"

According to the rules
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "hi there"

**Topic** (14 words, score 2/5):
```text
The user wants me to tag the topic of the message "hi there".
According
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (24 words, score 2/5):
```text
The user message is "hi there", which is a greeting. According to the rules: "If the message is a greeting, vague, or social: output
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "Can you help me write a Python script to parse JSON?"

**Topic** (14 words, score 2/5):
```text
The user wants me to distill their message into a topic label of 1-
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (28 words, score 2/5):
```text
The user wants me to extract the single concrete goal from the message: "Can you help me write a Python script to parse JSON?"

According to the rules
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "actually i want to use kubernetes instead"

**Topic** (15 words, score 2/5):
```text
The user wants me to distill the message "actually i want to use kubernetes instead
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (29 words, score 2/5):
```text
The user is stating a shift in their approach: they want to use Kubernetes instead of something else previously discussed. This is a concrete goal. I need to capture
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "lets try it. btw we should probably move the debug log to /t…"

**Topic** (14 words, score 2/5):
```text
The user wants me to distill the message into a topic label of 1-
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (29 words, score 2/5):
```text
The user is providing a message that contains a concrete goal: moving a debug log to /tmp and renaming it to avoid accidental version control commits. I need to
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "help me set up docker for this project"

**Topic** (15 words, score 2/5):
```text
The user wants me to distill the message "help me set up docker for this
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (30 words, score 2/5):
```text
The user wants help setting up Docker for a project. This is a concrete goal. I need to write one concise sentence in active voice using the user's exact terminology
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "The user is suggesting a full code review of the extension l…"

**Topic** (14 words, score 2/5):
```text
The user wants me to distill the message into a topic label of 1-
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (28 words, score 2/5):
```text
The user wants me to extract the single concrete goal from the message: "The user is suggesting a full code review of the extension logic"

Wait, looking at
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

### Input: "I think the topic response quality is really low, it's givin…"

**Topic** (14 words, score 2/5):
```text
The user wants me to distill their message into a topic label of 1-
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

**Goal** (28 words, score 2/5):
```text
The user is expressing dissatisfaction with response quality, specifically that it's giving paragraphs of things. This seems like feedback or a complaint about the current interaction style. They
```

| Criterion | Pass |
|-----------|------|
| Within 12 words | ❌ |
| No meta-commentary | ❌ |
| No wrapping quotes | ✅ |
| No markdown fences | ✅ |

---
*End of report*