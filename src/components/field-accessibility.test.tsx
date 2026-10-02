import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Field } from './ui';

describe('Accessible field feedback', () => {
  it('associates the visible label, hint and error with the existing input', () => {
    const markup = renderToStaticMarkup(<Field label="Đơn giá" hint="Theo giờ" error="Đơn giá chưa hợp lệ"><input id="rate" aria-describedby="existing-help" /></Field>);
    expect(markup).toContain('for="rate"');
    expect(markup).toContain('aria-invalid="true"');
    const descriptionIds = markup.match(/aria-describedby="([^"]+)"/)?.[1].split(' ') || [];
    expect(descriptionIds).toContain('existing-help');
    expect(descriptionIds).toHaveLength(3);
    for (const id of descriptionIds.filter(id => id !== 'existing-help')) expect(markup).toContain(`id="${id}"`);
  });
  it('handles controls in a composite wrapper and preserves nested field labels', () => {
    const markup = renderToStaticMarkup(<Field label="Khoảng giờ" hint="Giờ dạy"><div><input id="start" /><Field label="Giờ kết thúc" error="Chưa hợp lệ"><input id="end" /></Field></div></Field>);
    const start = markup.match(/<input[^>]+id="start"[^>]*>/)?.[0] || '';
    const end = markup.match(/<input[^>]+id="end"[^>]*>/)?.[0] || '';
    expect(start).toContain('aria-describedby');
    expect(end).toContain('aria-invalid="true"');
    expect(markup).toContain('for="end"');
    expect(markup).not.toMatch(/<label[^>]*>(?:(?!<\/label>).)*<label/);
  });
});
