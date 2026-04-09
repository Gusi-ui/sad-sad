import type { APIRoute } from 'astro';
import { loginWithEmailPassword } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const result = await loginWithEmailPassword(context, email, password);
  if (!result.ok) {
    return context.redirect('/login?error=1');
  }

  return context.redirect(result.account.role === 'ADMIN' ? '/admin' : '/w');
};

