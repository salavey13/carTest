"use server";

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const execAsync = promisify(exec);

const VPS_HOST = "212.67.11.25";
const VPS_USER = "root";
const SSH_KEY_PATH = path.join(process.env.HOME || "/root", ".ssh", "claudeclaw-ops");
const AUTHORIZED_KEYS_PATH = "/root/.ssh/authorized_keys";

export async function addSSHKeyToVPS(publicKey: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Проверяем, есть ли у нас доступ к VPS через существующий ключ
    const { stdout: testResult } = await execAsync(
      `ssh -i ~/.ssh/vip-bike-leads-read -o StrictHostKeyChecking=no -o BatchMode=yes ${VPS_USER}@${VPS_HOST} "echo test" 2>&1 || true`,
      { timeout: 10000 }
    );

    // Если forced command не позволяет выполнять произвольные команды,
    // нужно добавить ключ вручную
    if (!testResult.includes("test")) {
      return {
        success: false,
        error:
          "Нет прямого доступа к VPS. Добавь публичный ключ вручную:\n\n" +
          `ssh ${VPS_USER}@${VPS_HOST}\n` +
          `echo '${publicKey}' >> ${AUTHORIZED_KEYS_PATH}`,
      };
    }

    // Если есть доступ, добавляем ключ
    await execAsync(
      `ssh -i ~/.ssh/vip-bike-leads-read -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "echo '${publicKey}' >> ${AUTHORIZED_KEYS_PATH}"`,
      { timeout: 10000 }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка добавления ключа: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function restartBot(slug: string = "vip-bike"): Promise<{
  success: boolean;
  error?: string;
  output?: string;
}> {
  try {
    const serviceName = `claudeclaw-${slug}`;

    if (!existsSync(SSH_KEY_PATH)) {
      return {
        success: false,
        error: `SSH-ключ не найден: ${SSH_KEY_PATH}. Сначала запусти: bash scripts/restart-bot.sh --generate-key`,
      };
    }

    const { stdout, stderr } = await execAsync(
      `ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "sudo systemctl restart ${serviceName} && echo '✅ Сервис перезапущен' || echo '❌ Ошибка рестарта'"`,
      { timeout: 30000 }
    );

    const output = stdout + stderr;

    if (output.includes("✅")) {
      return { success: true, output };
    } else {
      return { success: false, error: output };
    }
  } catch (error) {
    return {
      success: false,
      error: `Ошибка рестарта: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getPublicKey(): Promise<{
  success: boolean;
  publicKey?: string;
  error?: string;
}> {
  try {
    const pubKeyPath = `${SSH_KEY_PATH}.pub`;
    if (!existsSync(pubKeyPath)) {
      return {
        success: false,
        error: `Публичный ключ не найден: ${pubKeyPath}`,
      };
    }

    const publicKey = await readFile(pubKeyPath, "utf-8");
    return { success: true, publicKey: publicKey.trim() };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка чтения ключа: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
