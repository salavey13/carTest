"use server";
import { supabaseAdmin } from "@/hooks/supabase";
import { google } from "googleapis";
import { Readable } from "stream";

// Initialize YouTube API
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

// Initialize YouTube Analytics API
const youtubeAnalytics = google.youtubeAnalytics({
  version: "v2",
  auth: process.env.YOUTUBE_API_KEY,
});

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

export async function uploadVideoToYouTube(formData: FormData) {
  const file = formData.get("video") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const tags = formData.get("tags") as string;

  if (!file || !title || !description) {
    throw new Error("Missing required fields");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const readable = Readable.from(buffer);

    const uploadResponse = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: tags ? tags.split(",").map(tag => tag.trim()) : [],
          categoryId: "22" // Entertainment category
        },
        status: {
          privacyStatus: "private", // Start as private, can be changed later
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: readable,
        mimeType: file.type
      }
    }, {
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.bytesRead / progressEvent.totalBytesEstimate) * 100
        );
        console.log(`Upload progress: ${progress}%`);
      }
    });

    if (!uploadResponse.data.id) {
      throw new Error("Upload completed but no video ID returned");
    }

    // Set thumbnail if available
    const thumbnail = formData.get("thumbnail") as File;
    if (thumbnail) {
      const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());
      await youtube.thumbnails.set({
        videoId: uploadResponse.data.id,
        media: {
          body: Readable.from(thumbnailBuffer),
          mimeType: thumbnail.type
        }
      });
    }

    return {
      success: true,
      videoId: uploadResponse.data.id,
      title,
      description
    };
  } catch (error) {
    console.error("YouTube upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during upload"
    };
  }
}

export async function getYouTubeAnalytics() {
  try {
    const response = await youtubeAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: "2023-01-01",
      endDate: new Date().toISOString().split("T")[0],
      metrics: "views,likes,dislikes,comments,estimatedMinutesWatched",
      dimensions: "video",
      sort: "-views"
    });

    return response.data.rows?.map((row) => ({
      videoId: row[0],
      views: row[1],
      likes: row[2],
      dislikes: row[3],
      comments: row[4],
      minutesWatched: row[5]
    })) || [];
  } catch (error) {
    console.error("YouTube analytics error:", error);
    throw new Error("Failed to fetch analytics data");
  }
}

export async function getVideoDetails(videoId: string) {
  try {
    const response = await youtube.videos.list({
      part: ["snippet", "contentDetails", "statistics"],
      id: videoId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error("Video not found");
    }

    return response.data.items[0];
  } catch (error) {
    console.error("Error fetching video details:", error);
    throw error;
  }
}

export async function updateVideoMetadata(videoId: string, metadata: {
  title?: string;
  description?: string;
  tags?: string[];
  privacyStatus?: string;
}) {
  try {
    const response = await youtube.videos.update({
      part: ["snippet", "status"],
      requestBody: {
        id: videoId,
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags
        },
        status: {
          privacyStatus: metadata.privacyStatus
        }
      }
    });

    return response.data;
  } catch (error) {
    console.error("Error updating video metadata:", error);
    throw error;
  }
}