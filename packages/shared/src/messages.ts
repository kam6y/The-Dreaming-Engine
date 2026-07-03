import { z } from "zod";

export const GAME_TITLE = "The Dreaming Engine";

export const clientPingMessageSchema = z.object({
  type: z.literal("ping"),
  sentAt: z.number().int().nonnegative()
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientPingMessageSchema
]);

export const serverStateMessageSchema = z.object({
  type: z.literal("state"),
  title: z.literal(GAME_TITLE)
});

export const serverPongMessageSchema = z.object({
  type: z.literal("pong"),
  sentAt: z.number().int().nonnegative(),
  receivedAt: z.number().int().nonnegative()
});

export const serverErrorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1)
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverStateMessageSchema,
  serverPongMessageSchema,
  serverErrorMessageSchema
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
