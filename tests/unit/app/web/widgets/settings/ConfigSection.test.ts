import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ConfigSection from '@app/web/widgets/settings/ConfigSection.svelte';
import type { ConfigFieldDescriptor, ConfigGroupDescriptor } from '@lib/types/config.js';

function field(
  key: string,
  widget: ConfigFieldDescriptor['widget'],
  options?: string[],
): ConfigFieldDescriptor {
  return {
    key,
    label: key,
    description: `${key} description`,
    widget,
    required: false,
    secret: false,
    defaultValue: widget === 'toggle' ? false : '',
    ...(options ? { options } : {}),
  };
}

describe('read-only settings controls', () => {
  it('renders every settings widget as a disabled native control', () => {
    const group: ConfigGroupDescriptor = {
      id: 'test',
      label: 'Test',
      fields: [
        field('TEXT', 'text'),
        field('NUMBER', 'number'),
        field('PROMPT', 'textarea'),
        field('CHOICE', 'select', ['a', 'b']),
        field('RANGE', 'slider'),
        field('ENABLED', 'toggle'),
        field('LLM_PROVIDER', 'select', ['openai']),
      ],
    };

    const { body } = render(ConfigSection, {
      props: { group, values: {}, disabled: true },
    });

    expect(body).toMatch(/<textarea[^>]*disabled/);
    expect(body).toMatch(/<select[^>]*disabled/);
    expect(body).toMatch(/type="range"[^>]*disabled/);
    expect(body).toMatch(/type="checkbox"[^>]*disabled/);
    expect(body).toMatch(/type="text"[^>]*disabled/);
    expect(body.match(/<button[^>]*disabled/g)?.length).toBe(9);
  });
});
