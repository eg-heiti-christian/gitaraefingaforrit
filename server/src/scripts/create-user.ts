// Creates a user, or sets a new password if the email is already registered.
// The web sign-up page covers new accounts; this is mainly for password resets.
// Run from the repo root: npm run user:create
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { MIN_PASSWORD_LENGTH, signupRequestSchema } from '@practice/shared';
import { prisma } from '../db.js';
import { auth } from '../auth/auth.js';

// readline echoes typed characters to `output`; muting it hides the password.
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const isTTY = Boolean(process.stdin.isTTY);
const rl = createInterface({ input: process.stdin, output, terminal: isTTY });
// The iterator buffers lines, so piped input isn't lost between prompts.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  // Hidden input swallows the echoed newline; piped input has no echo at all.
  if (hidden || !isTTY) process.stdout.write('\n');
  if (done) throw new Error('Input ended before all questions were answered.');
  return value as string;
}

try {
  const rawEmail = await ask('Email: ');
  const existing = await prisma.user.findUnique({
    where: { email: rawEmail.trim().toLowerCase() },
  });
  const rawName = existing ? existing.name : await ask('Name: ');
  const password = await ask(`Password (at least ${MIN_PASSWORD_LENGTH} characters): `, {
    hidden: true,
  });
  const confirm = await ask('Repeat password: ', { hidden: true });

  const parsed = signupRequestSchema.safeParse({ name: rawName, email: rawEmail, password });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  if (password !== confirm) throw new Error('Passwords do not match.');
  const { name, email } = parsed.data;

  if (existing) {
    // Hashed the way Better Auth hashes it. The new password and the logout of
    // every existing session are written together, so neither happens alone.
    const credential = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: 'credential' },
    });
    if (!credential) throw new Error(`${email} has no password sign-in to reset.`);

    const passwordHash = await (await auth.$context).password.hash(password);
    await prisma.$transaction([
      prisma.account.update({ where: { id: credential.id }, data: { password: passwordHash } }),
      prisma.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`Password updated for ${email}; existing sessions were logged out.`);
  } else {
    // Sign-up also logs the new user in; no browser holds that session, so drop it.
    const { token } = await auth.api.signUpEmail({ body: { name, email, password } });
    if (token) await prisma.session.delete({ where: { token } });
    console.log(`Created user ${email}.`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
