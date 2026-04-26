import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { generateHealthResponse } from '../services/ai.service';
import { buildDogContext } from '../services/assistantContext.service';
import type { AIHealthResponse } from '../types/assistant';

// POST /api/assistant/chat
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message, dogId, conversationId } = req.body;
  const user = req.user!;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Rate limit: max 20 requests per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentMessages = await prisma.assistantMessage.count({
    where: {
      conversation: { userId: user.id },
      role: 'user',
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentMessages >= 20) {
    return res.status(429).json({
      error: 'Has alcanzado el limite de 20 consultas por hora. Por favor, espera un momento.',
    });
  }

  // Find or create conversation
  let conversation = conversationId
    ? await prisma.assistantConversation.findFirst({
        where: { id: conversationId, userId: user.id },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.assistantConversation.create({
      data: {
        userId: user.id,
        dogId: dogId || null,
        title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
      },
    });
  }

  // Save user message
  const userMessage = await prisma.assistantMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    },
  });

  // Get conversation history
  const historyMessages = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  });

  const conversationHistory = historyMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Build dog context if dogId provided
  let dogContext;
  const effectiveDogId = dogId || conversation.dogId;
  if (effectiveDogId && user.kennelId) {
    dogContext = await buildDogContext(effectiveDogId, user.kennelId);
  }

  // Generate AI response
  const { response, rawResponse } = await generateHealthResponse(
    message,
    conversationHistory,
    dogContext || undefined
  );

  // Save assistant message
  const assistantMessage = await prisma.assistantMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: JSON.stringify(response),
      rawContent: rawResponse,
    },
  });

  res.json({
    message: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: response,
      createdAt: assistantMessage.createdAt,
    },
    conversationId: conversation.id,
  });
});

// GET /api/assistant/conversations
export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  const conversations = await prisma.assistantConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      _count: { select: { messages: true } },
    },
  });

  res.json({ conversations });
});

// GET /api/assistant/conversations/:id
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const conversation = await prisma.assistantConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
    },
  });

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Parse assistant messages
  const parsedMessages = conversation.messages.map((m) => {
    if (m.role === 'assistant') {
      try {
        const parsed = JSON.parse(m.content) as AIHealthResponse;
        return { ...m, content: parsed };
      } catch {
        return m;
      }
    }
    return m;
  });

  res.json({
    conversation: {
      ...conversation,
      messages: parsedMessages,
    },
  });
});

// DELETE /api/assistant/conversations/:id
export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const conversation = await prisma.assistantConversation.findFirst({
    where: { id, userId: user.id },
  });

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  await prisma.assistantConversation.delete({ where: { id } });

  res.json({ message: 'Conversation deleted' });
});

// POST /api/assistant/conversations/:id/save-to-medical
export const saveToMedical = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dogId, content } = req.body;
  const user = req.user!;

  if (!dogId || !content) {
    return res.status(400).json({ error: 'dogId and content are required' });
  }

  // Verify conversation belongs to user
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id, userId: user.id },
  });

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Verify dog belongs to user's kennel
  const dog = await prisma.dog.findFirst({
    where: { id: dogId, kennelId: user.kennelId },
  });

  if (!dog) {
    return res.status(403).json({ error: 'Access denied to this dog' });
  }

  // Find veterinarian record for the user if they are a vet
  let vetId: string | undefined;
  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    vetId = vet?.id;
  }

  // Create medical record
  const medicalRecord = await prisma.medicalRecord.create({
    data: {
      dogId,
      type: 'CONSULTATION',
      date: new Date(),
      description: `Consulta con Asistente IA Petwelly:\n\n${content}`,
      vetId: vetId || '',
      createdBy: user.id,
    },
  });

  res.status(201).json({ medicalRecord });
});
