import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { actions } from './+page.server';

describe('sign-out action', () => {
    it('clears only the authentication cookie and redirects to sign-in after submission', async () => {
        const cookies: Cookies = {
            get: vi.fn(),
            getAll: vi.fn(() => []),
            set: vi.fn(),
            delete: vi.fn(),
            parse: vi.fn(),
            serialize: vi.fn(() => '')
        };

        await expect(actions.default({ cookies })).rejects.toMatchObject({
            status: 303,
            location: '/signin'
        });

        expect(cookies.delete).toHaveBeenCalledExactlyOnceWith('AuthorizationToken', { path: '/' });
        expect(cookies.set).not.toHaveBeenCalled();
    });
});
