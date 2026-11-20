import { redirect, type Cookies } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions = {
	default: async ({ cookies }: { cookies: Cookies }) => {
		cookies.delete('AuthorizationToken', { path: '/' });
		throw redirect(303, '/signin');
	}
} satisfies Actions;