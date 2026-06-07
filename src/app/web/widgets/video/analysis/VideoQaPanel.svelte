<script lang="ts">
  import type { VideoQaPanelProps } from '@app/web/types/componentProps.js';
  import type { QaMessage, QaTextSegment } from '@lib/types/qa.js';
  import { streamQa, loadQaThread, clearQaThread } from '@web/lib/qaStream.js';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';
  import SectionHeader from '@web/components/SectionHeader.svelte';
  import Textarea from '@web/components/Textarea.svelte';

  let { videoId, transcriptReady, onSeek }: VideoQaPanelProps = $props();

  let messages = $state<QaMessage[]>([]);
  let isStreaming = $state(false);
  let errorMessage = $state('');
  let messagesEl: HTMLDivElement | undefined = $state();
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (videoId) {
      loadQaThread(videoId)
        .then((msgs) => {
          messages = msgs;
        })
        .catch(() => {});
    }
  });

  $effect(() => {
    if (messagesEl && messages.length > 0) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  async function ask(): Promise<void> {
    const q = textareaEl?.value.trim() ?? '';
    if (!q || isStreaming) return;
    if (textareaEl) textareaEl.value = '';
    errorMessage = '';
    isStreaming = true;

    messages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: q,
        citations: [],
        createdAt: new Date().toISOString(),
      },
    ];

    try {
      const answer = await streamQa({ videoId, question: q, history: messages.slice(0, -1) }, {});
      messages = [
        ...messages,
        {
          id: answer.messageId,
          role: 'assistant',
          content: answer.content,
          citations: answer.citations,
          createdAt: new Date().toISOString(),
        },
      ];
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      isStreaming = false;
    }
  }

  async function clearChat(): Promise<void> {
    await clearQaThread(videoId);
    messages = [];
    errorMessage = '';
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  }

  function parseSegments(text: string): QaTextSegment[] {
    const out: QaTextSegment[] = [];
    const re = /\[(\d+:\d{2}(?::\d{2})?)\]/g;
    let last = 0;
    for (const match of text.matchAll(re)) {
      if (match.index > last) out.push({ type: 'text', value: text.slice(last, match.index) });
      const parts = match[1].split(':').map(Number);
      const timeSec =
        parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      out.push({ type: 'cite', label: match[0], timeSec });
      last = match.index + match[0].length;
    }
    if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
    return out;
  }
</script>

<Card as="section" class="qa-panel">
  <SectionHeader
    eyebrow="Ask about the video"
    title="Q&A"
    subtitle={messages.length > 0
      ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
      : 'Transcript-grounded answers'}
  />

  {#if !transcriptReady}
    <p class="qa-empty">Load the transcript first to ask questions.</p>
  {:else}
    <div class="qa-messages" bind:this={messagesEl}>
      {#each messages as msg (msg.id)}
        <div class="qa-bubble qa-bubble--{msg.role}">
          {#if msg.role === 'user'}
            <p class="qa-bubble__text">{msg.content}</p>
          {:else}
            <p class="qa-bubble__text">
              {#each parseSegments(msg.content) as seg}
                {#if seg.type === 'text'}{seg.value}{:else}<button
                    class="qa-cite"
                    type="button"
                    onclick={() => onSeek(seg.timeSec)}
                    title="Seek to {seg.label}">{seg.label}</button
                  >{/if}
              {/each}
            </p>
          {/if}
        </div>
      {/each}

      {#if isStreaming}
        <p class="qa-thinking">Thinking…</p>
      {/if}
    </div>

    {#if errorMessage}
      <p class="qa-error">{errorMessage}</p>
    {/if}

    <Textarea
      placeholder="Ask a question about this video…"
      bind:el={textareaEl}
      disabled={isStreaming}
      rows={2}
      onkeydown={handleKeydown}
    />

    <div class="qa-actions">
      <Button variant="primary" onclick={ask} disabled={isStreaming}>
        {isStreaming ? 'Thinking…' : 'Ask'}
      </Button>
      {#if messages.length > 0 && !isStreaming}
        <Button variant="ghost" onclick={clearChat}>Clear chat</Button>
      {/if}
    </div>
  {/if}
</Card>

<style>
  .qa-empty {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    padding: 8px 0;
  }

  .qa-messages {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
    padding: 4px 0 8px;
  }

  .qa-bubble {
    padding: 8px 12px;
    border-radius: var(--vc-radius-md);
    font-size: var(--vc-text-13);
    line-height: 1.55;
    word-break: break-word;
  }

  .qa-bubble--user {
    background: var(--vc-surface-raised);
    align-self: flex-end;
    max-width: 88%;
    color: var(--vc-text);
  }

  .qa-bubble--assistant {
    align-self: flex-start;
    color: var(--vc-text);
    border: 1px solid var(--vc-border);
  }

  .qa-bubble__text {
    margin: 0;
    white-space: pre-wrap;
  }

  .qa-thinking {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    font-style: italic;
    margin: 0;
    padding: 4px 0;
  }

  .qa-cite {
    display: inline;
    background: none;
    border: none;
    padding: 0 1px;
    color: var(--vc-accent);
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .qa-cite:hover {
    opacity: 0.8;
  }

  .qa-error {
    margin: 4px 0 8px;
    font-size: var(--vc-text-12);
    color: var(--vc-error);
  }

  .qa-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 10px;
  }
</style>
