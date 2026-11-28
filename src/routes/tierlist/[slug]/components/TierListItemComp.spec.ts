import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(fileURLToPath(new URL('./TierListItemComp.svelte', import.meta.url)), 'utf8');

describe('tier-list item tag control', () => {
    it('uses an accessible plus control to open tag assignments', () => {
        expect(componentSource).toMatch(/<summary[^>]*title="Add tag"[^>]*aria-label="Add or remove tags for \{item\.artifact\.title\}"[^>]*>\+<\/summary>/);
    });

    it('shows the control on item hover or keyboard focus, and keeps it available on touch devices', () => {
        expect(componentSource).toMatch(/opacity:\s*0;/);
        expect(componentSource).toMatch(/\.tier-item:hover \.tier-item-tag-editor/);
        expect(componentSource).toMatch(/\.tier-item:focus-within \.tier-item-tag-editor/);
        expect(componentSource).toMatch(/\.tier-item-tag-editor\[open\]/);
        expect(componentSource).toMatch(/@media \(hover:\s*none\)/);
    });

    it('falls back to the no-poster placeholder when poster metadata or image loading fails', () => {
        expect(componentSource).toMatch(/let posterLoadFailed = false;/);
        expect(componentSource).toMatch(/\.catch\(\(\) => \{\s*posterLoadFailed = true;/);
        expect(componentSource).toMatch(/posterUrl && !posterLoadFailed/);
        expect(componentSource).toMatch(/onerror=\{\(\) => posterLoadFailed = true\}/);
        expect(componentSource).toContain('No poster');
    });
});
