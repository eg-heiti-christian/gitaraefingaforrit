import { Router, type Response } from 'express';
import {
  itemRequestSchema,
  type ErrorResponse,
  type ItemRequest,
  type ItemResponse,
} from '@practice/shared';
import { prisma } from '../db.js';

// The fields of ItemResponse, so userId stays on the server.
const itemFields = { id: true, name: true, description: true } as const;

/** The validated request body, or null after answering 400. */
function parseItem(body: unknown, res: Response): ItemRequest | null {
  const parsed = itemRequestSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  const error: ErrorResponse = { error: parsed.error.issues[0]?.message ?? 'Invalid item' };
  res.status(400).json(error);
  return null;
}

function sendNotFound(res: Response) {
  const body: ErrorResponse = { error: 'Item not found' };
  res.status(404).json(body);
}

export const itemsRouter = Router();

itemsRouter.get('/', async (_req, res) => {
  const items: ItemResponse[] = await prisma.practiceItem.findMany({
    where: { userId: res.locals.user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: itemFields,
  });
  res.json(items);
});

itemsRouter.post('/', async (req, res) => {
  const data = parseItem(req.body, res);
  if (!data) return;

  const item: ItemResponse = await prisma.practiceItem.create({
    data: { ...data, userId: res.locals.user.id },
    select: itemFields,
  });
  res.status(201).json(item);
});

// Update and delete put the owner in the where clause, so another user's item
// is never touched and looks the same as one that doesn't exist.
itemsRouter.put('/:id', async (req, res) => {
  const data = parseItem(req.body, res);
  if (!data) return;

  const [item] = await prisma.practiceItem.updateManyAndReturn({
    where: { id: req.params.id, userId: res.locals.user.id },
    data,
    select: itemFields,
  });
  if (!item) {
    sendNotFound(res);
    return;
  }
  const body: ItemResponse = item;
  res.json(body);
});

itemsRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.practiceItem.deleteMany({
    where: { id: req.params.id, userId: res.locals.user.id },
  });
  if (count === 0) {
    sendNotFound(res);
    return;
  }
  res.status(204).end();
});
