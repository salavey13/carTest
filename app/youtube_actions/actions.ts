"use server";
import { supabaseAdmin } from "@/hooks/supabase";
import { google } from "googleapis";
import { Readable } from "stream";

// --- Task Actions ---
export async function createTask(data: {
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  deadline?: string;
  assigned_to?: string;
}) {
  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .insert([data])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return task;
}

export async function getTasks() {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// --- Character Actions ---
export async function getCharacters() {
  const { data, error } = await supabaseAdmin.from("characters").select("*");
  if (error) throw new Error(error.message);
  return data;
}

// --- YouTube Actions ---
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_OAUTH_TOKEN,
});

export async function uploadVideoToYouTube(formData: FormData) {
  const file = formData.get("video") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const tags = formData.get("tags") as string;

  const buffer = Buffer.from(await file.arrayBuffer());
  const readable = Readable.from(buffer);

  try {
    const upload = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title, description, tags: tags.split(",").map((tag) => tag.trim()) },
        status: { privacyStatus: "public" },
      },
      media: { body: readable },
    });
    return { success: true, videoId: upload.data.id };
  } catch (error) {
    console.error("Upload failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

const youtubeAnalytics = google.youtubeAnalytics({
  version: "v2",
  auth: process.env.YOUTUBE_OAUTH_TOKEN,
});

export async function getYouTubeAnalytics() {
  try {
    const response = await youtubeAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: "2023-01-01",
      endDate: new Date().toISOString().split("T")[0],
      metrics: "views,likes",
      dimensions: "video",
    });
    return response.data.rows?.map((row) => ({
      videoId: row[0],
      views: row[1],
      likes: row[2],
    })) || [];
  } catch (error) {
    console.error("Analytics fetch failed:", error);
    throw new Error("Failed to fetch analytics");
  }
}