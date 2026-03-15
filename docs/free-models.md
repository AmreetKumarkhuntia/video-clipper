# Free Models via OpenRouter

This project supports [OpenRouter](https://openrouter.ai) as an LLM provider, which gives access to a number of completely free models (no cost per token).

## Setup

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=<model-id-from-table-below>
```

---

## Recommended Free Models for Transcript Analysis

These models have sufficient context length and instruction-following capability to work well with `generateObject` and structured transcript analysis.

| Model ID                                        | Name                              | Context |
| ----------------------------------------------- | --------------------------------- | ------- |
| `meta-llama/llama-3.3-70b-instruct:free`        | Meta: Llama 3.3 70B Instruct      | 128K    |
| `google/gemma-3-27b-it:free`                    | Google: Gemma 3 27B               | 131K    |
| `mistralai/mistral-small-3.1-24b-instruct:free` | Mistral: Mistral Small 3.1 24B    | 128K    |
| `nousresearch/hermes-3-llama-3.1-405b:free`     | Nous: Hermes 3 405B Instruct      | 131K    |
| `qwen/qwen3-next-80b-a3b-instruct:free`         | Qwen: Qwen3 Next 80B A3B Instruct | 262K    |

**Recommended default:** `meta-llama/llama-3.3-70b-instruct:free`

- Most battle-tested for structured JSON output
- Reliable with `generateObject` (which requires strict schema adherence)
- 128K context handles most YouTube transcripts comfortably

---

## All Available Free Models (as of March 2026)

| Model ID                                                        | Name                              | Context   |
| --------------------------------------------------------------- | --------------------------------- | --------- |
| `openrouter/hunter-alpha`                                       | Hunter Alpha                      | 1,048,576 |
| `openrouter/healer-alpha`                                       | Healer Alpha                      | 262,144   |
| `nvidia/nemotron-3-super-120b-a12b:free`                        | NVIDIA: Nemotron 3 Super          | 262,144   |
| `minimax/minimax-m2.5:free`                                     | MiniMax: MiniMax M2.5             | 196,608   |
| `openrouter/free`                                               | Free Models Router                | 200,000   |
| `stepfun/step-3.5-flash:free`                                   | StepFun: Step 3.5 Flash           | 256,000   |
| `arcee-ai/trinity-large-preview:free`                           | Arcee AI: Trinity Large Preview   | 131,000   |
| `liquid/lfm-2.5-1.2b-thinking:free`                             | LiquidAI: LFM2.5-1.2B-Thinking    | 32,768    |
| `liquid/lfm-2.5-1.2b-instruct:free`                             | LiquidAI: LFM2.5-1.2B-Instruct    | 32,768    |
| `nvidia/nemotron-3-nano-30b-a3b:free`                           | NVIDIA: Nemotron 3 Nano 30B A3B   | 256,000   |
| `arcee-ai/trinity-mini:free`                                    | Arcee AI: Trinity Mini            | 131,072   |
| `nvidia/nemotron-nano-12b-v2-vl:free`                           | NVIDIA: Nemotron Nano 12B 2 VL    | 128,000   |
| `qwen/qwen3-next-80b-a3b-instruct:free`                         | Qwen: Qwen3 Next 80B A3B Instruct | 262,144   |
| `nvidia/nemotron-nano-9b-v2:free`                               | NVIDIA: Nemotron Nano 9B V2       | 128,000   |
| `openai/gpt-oss-120b:free`                                      | OpenAI: gpt-oss-120b              | 131,072   |
| `openai/gpt-oss-20b:free`                                       | OpenAI: gpt-oss-20b               | 131,072   |
| `z-ai/glm-4.5-air:free`                                         | Z.ai: GLM 4.5 Air                 | 131,072   |
| `qwen/qwen3-coder:free`                                         | Qwen: Qwen3 Coder 480B A35B       | 262,000   |
| `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` | Venice: Uncensored                | 32,768    |
| `google/gemma-3n-e2b-it:free`                                   | Google: Gemma 3n 2B               | 8,192     |
| `google/gemma-3n-e4b-it:free`                                   | Google: Gemma 3n 4B               | 8,192     |
| `qwen/qwen3-4b:free`                                            | Qwen: Qwen3 4B                    | 40,960    |
| `mistralai/mistral-small-3.1-24b-instruct:free`                 | Mistral: Mistral Small 3.1 24B    | 128,000   |
| `google/gemma-3-4b-it:free`                                     | Google: Gemma 3 4B                | 32,768    |
| `google/gemma-3-12b-it:free`                                    | Google: Gemma 3 12B               | 32,768    |
| `google/gemma-3-27b-it:free`                                    | Google: Gemma 3 27B               | 131,072   |
| `meta-llama/llama-3.3-70b-instruct:free`                        | Meta: Llama 3.3 70B Instruct      | 128,000   |
| `meta-llama/llama-3.2-3b-instruct:free`                         | Meta: Llama 3.2 3B Instruct       | 131,072   |
| `nousresearch/hermes-3-llama-3.1-405b:free`                     | Nous: Hermes 3 405B Instruct      | 131,072   |

> Free models may have rate limits or availability constraints. Check [openrouter.ai/models](https://openrouter.ai/models) for the latest list.

---

## Notes

- Free models on OpenRouter are subject to rate limits (typically lower than paid tiers).
- Avoid models with context < 32K for long videos — chunks may not fit.
- Models marked `:free` are permanently free; others (like `openrouter/hunter-alpha`) may change pricing.
- If `generateObject` fails with a free model, it usually means the model doesn't follow JSON schema strictly enough — switch to `meta-llama/llama-3.3-70b-instruct:free` as a fallback.
