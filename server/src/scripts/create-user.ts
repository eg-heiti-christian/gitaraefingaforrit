// Creates a user, or sets a new password if the username exists. The web
// sign-up page covers new accounts; this is mainly for password resets.
// Run from the repo root: npm run user:create
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { MIN_PASSWORD_LENGTH, signupRequestSchema } from '@practice/shared';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/password.js';

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
  const rawUsername = await ask('Username: ');
  const password = await ask(`Password (at least ${MIN_PASSWORD_LENGTH} characters): `, {
    hidden: true,
  });
  const confirm = await ask('Repeat password: ', { hidden: true });

  const parsed = signupRequestSchema.safeParse({ username: rawUsername, password });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  if (password !== confirm) throw new Error('Passwords do not match.');
  const { username } = parsed.data;

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    // A password change logs out every existing session.
    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`Password updated for "${username}"; existing sessions were logged out.`);
  } else {
    await prisma.user.create({ data: { username, passwordHash } });
    console.log(`Created user "${username}".`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
