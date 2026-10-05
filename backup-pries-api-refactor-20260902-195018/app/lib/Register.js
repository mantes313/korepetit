/**
 * POST /api/register
 * Body: { name, email, password, role }
 * Returns: { ok, user } or { error }
 */
export async function registerUser({ name, email, password, role }) {
  if (!name || !email || !password) {
    return { ok: false, error: 'Name, email and password are required.' };
  }

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  // TODO: hash password (e.g. bcrypt), persist to database
  const user = { id: crypto.randomUUID(), name, email, role: role ?? 'student' };

  return { ok: true, user };
}
