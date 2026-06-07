<script lang="ts">
  import type { VideoQaPanelProps } from '@app/web/types/componentProps.js';
  import type { QaMessage, QaAnswer } from '@lib/types/qa.js';
  import { streamQa, loadQaThread, clearQaThread } from '@web/lib/qaStream.js';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';

  let { videoId, transcriptReady, onSeek }: VideoQaPanelProps = $props();

  let messages = $state<QaMessage[]>([]);
  let streamingText = $state('');
  let isStreaming = $state(false);
  let question = $state('');
  let errorMessage = $state('');
  let abortController: AbortController | null = $state(null);
  let messagesEl: HTMLDivElement | undefined = $state();

  // Load persisted thread on mount
  $effect(() => {
    if (videoId) {
      loadQaThread(videoId)
        .then((msgs) => {
          messages = msgs;
        })
        .catch(() => {
          // silently ignore — thread simply starts empty
        });
    }
  });

  // Auto-scroll to bottom when messages change
  $effect(() => {
    if (messagesEl && (messages.length > 0 || streamingText)) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  async function ask(): Promise<void> {
    const q = question.trim();
    if (!q || isStreaming) return;

    question = '';
    errorMessage = '';
    streamingText = '';
    isStreaming = true;
    abortController = new AbortController();

    // Optimistically add user message to view
    const tempUserMsg: QaMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    messages = [...messages, tempUserMsg];

    try {
      const answer = await streamQa(
        {
          videoId,
          question: q,
          history: messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(0, -1),
        },
        {
          onStarted: () => {
            streamingText = '';
          },
          onProgress: (text) => {
            streamingText += text;
          },
          onComplete: (ans: QaAnswer) => {
            streamingText = '';
            const assistantMsg: QaMessage = {
              id: ans.messageId,
              role: 'assistant',
              content: ans.content,
              citations: ans.citations,
              createdAt: new Date().toISOString(),
            };
            messages = [...messages, assistantMsg];
          },
          onError: (msg) => {
            errorMessage = msg;
          },
        },
        abortController.signal,
      );
      void answer; // already handled in onComplete
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped — don't show an error
      } else {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    } finally {
      isStreaming = false;
      streamingText = '';
      abortController = null;
    }
  }

  function stop(): void {
    abortController?.abort();
  }

  async function clearChat(): Promise<void> {
    await clearQaThread(videoId);
    messages = [];
    streamingText = '';
    errorMessage = '';
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  }

  /**
   * Split answer text into segments: plain text and clickable [mm:ss] / [h:mm:ss] markers.
   */
  function parseSegments(
    text: string,
  ): Array<{ type: 'text'; value: string } | { type: 'cite'; label: string; timeSec: number }> {
    const segments: Array<
      { type: 'text'; value: string } | { type: 'cite'; label: string; timeSec: number }
    > = [];
    const re = /\[(\d+:\d{2}(?::\d{2})?)\]/g;
    let last = 0;
    for (const match of text.matchAll(re)) {
      if (match.index > last) {
        segments.push({ type: 'text', value: text.slice(last, match.index) });
      }
      const parts = match[1].split(':').map(Number);
      const timeSec =
        parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      segments.push({ type: 'cite', label: match[0], timeSec });
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      segments.push({ type: 'text', value: text.slice(last) });
    }
    return segments;
  }
</script>

<Card as="section" class="qa-panel">
  <div class="qa-panel__head">
    <div>
      <p class="panel-eyebrow">Ask about the video</p>
      <h2 class="panel-title">Ask a question about this video.</h2>
    </div>
    {#if messages.length > 0 && !isStreaming}
      <Button variant="ghost" size="sm" onclick={clearChat}>Clear chat</Button>
    {/if}
  </div>

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
                {#if seg.type === 'text'}
                  {seg.value}
                {:else}
                  <button
                    class="qa-cite"
                    type="button"
                    onclick={() => onSeek(seg.timeSec)}
                    title="Seek to {seg.label}">{seg.label}</button
                  >
                {/if}
              {/each}
            </p>
          {/if}
        </div>
      {/each}

      {#if isStreaming && streamingText}
        <div class="qa-bubble qa-bubble--assistant qa-bubble--streaming">
          <p class="qa-bubble__text">
            {#each parseSegments(streamingText) as seg}
              {#if seg.type === 'text'}
                {seg.value}
              {:else}
                <button
                  class="qa-cite"
                  type="button"
                  onclick={() => onSeek(seg.timeSec)}
                  title="Seek to {seg.label}">{seg.label}</button
                >
              {/if}
            {/each}
            <span class="qa-cursor"></span>
          </p>
        </div>
      {:else if isStreaming}
        <div class="qa-bubble qa-bubble--assistant qa-bubble--streaming">
          <p class="qa-bubble__text qa-thinking">Thinking<span class="qa-cursor"></span></p>
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <p class="error-text qa-error">{errorMessage}</p>
    {/if}

    <div class="qa-input">
      <textarea
        class="qa-textarea"
        placeholder="Ask a question about this video…"
        bind:value={question}
        disabled={isStreaming}
        rows={2}
        onkeydown={handleKeydown}
      ></textarea>
      <div class="qa-actions">
        {#if isStreaming}
          <Button variant="secondary" size="sm" onclick={stop}>Stop</Button>
        {:else}
          <Button variant="primary" size="sm" disabled={!question.trim()} onclick={ask}>Ask</Button>
        {/if}
      </div>
    </div>
  {/if}
</Card>

<style>
  .qa-panel__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }

  .qa-empty {
    font-size: var(--vc-text-13);
    color: var(--vc-muted);
    padding: 12px 0;
  }

  .qa-messages {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
    padding: 4px 0 8px;
    scroll-behavior: smooth;
  }

  .qa-bubble {
    padding: 8px 12px;
    border-radius: var(--vc-radius-md);
    font-size: var(--vc-text-13);
    line-height: 1.55;
    max-width: 100%;
    word-break: break-word;
  }

  .qa-bubble--user {
    background: var(--vc-surface-raised);
    align-self: flex-end;
    max-width: 88%;
    color: var(--vc-text);
  }

  .qa-bubble--assistant {
    background: transparent;
    align-self: flex-start;
    color: var(--vc-text);
    border: 1px solid var(--vc-border);
  }

  .qa-bubble--streaming {
    opacity: 0.9;
  }

  .qa-bubble__text {
    margin: 0;
    white-space: pre-wrap;
  }

  .qa-thinking {
    color: var(--vc-muted);
    font-style: italic;
  }

  .qa-cursor {
    display: inline-block;
    width: 2px;
    height: 0.9em;
    background: var(--vc-accent);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
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
  }

  .qa-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .qa-textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-family: inherit;
    font-size: var(--vc-text-13);
    padding: 8px 10px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    line-height: 1.5;
    outline: none;
    min-height: 52px;
  }

  .qa-textarea:focus {
    border-color: var(--vc-accent);
  }

  .qa-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .qa-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
