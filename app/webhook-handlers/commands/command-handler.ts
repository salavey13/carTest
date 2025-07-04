import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { startCommand } from "./start";
import { rageCommand } from "./rage";
import { leadsCommand } from "./leads";
import { sauceCommand } from "./sauce";
import { fileCommand } from "./file";
import { offerCommand } from "./offer";
import { howtoCommand } from "./howto";
import { ctxCommand } from "./ctx";
import { profileCommand } from "./profile";


export async function handleCommand(update: any) {
 const text = update.message?.text;
 const chatId = update.message?.chat?.id;
 const userId = update.message?.from?.id;
 const username = update.message?.from?.username;

 logger.info(`[Command Handler] Received command: ${text}, Chat ID: ${chatId}, User ID: ${userId}`);

 if (!text || !chatId || !userId) {
  logger.warn("[Command Handler] Missing text, chatId, or userId. Ignoring.");
  return;
 }

 if (text.startsWith("/start")) {
  await startCommand(chatId, userId, username);
 } else if (text.startsWith("/rage")) {
  await rageCommand(chatId, userId);
 } else if (text.startsWith("/leads")) {
  await leadsCommand(chatId, userId);
 } else if (text.startsWith("/sauce")) {
  await sauceCommand(chatId, userId);
 } else if (text.startsWith("/file")) {
  await fileCommand(chatId, userId);
 } else if (text.startsWith("/offer")) {
  await offerCommand(chatId, userId);
 } else if (text.startsWith("/howto")) {
  await howtoCommand(chatId, userId);
 } else if (text.startsWith("/ctx")) {
  await ctxCommand(chatId, userId);
 } else if (text.startsWith("/profile")) {
  await profileCommand(chatId, userId, username);
 }
  else {
  logger.warn([Command Handler] Unknown command: ${text}. Ignoring.);
  // Optionally send a "command not found" message to the user.
 }
}
