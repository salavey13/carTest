"use server";
import { supabaseAdmin, uploadImage } from "@/hooks/supabase";
import { google } from "googleapis";
import { Readable } from "stream";
import { sendTelegramMessage } from "@/app/actions"; // Import for notifications
import { logger } from "@/lib/logger";

// --- YouTube API Initialization ---
// Ensure OAuth 2.0 Client or API Key is configured properly
// For uploads and analytics that require channel owner permission, OAuth is needed.
// API Key might work for public data fetching (getVideoDetails).
// Placeholder - replace with actual authentication method (OAuth2 client recommended)
const youtube = google.youtube({
  version: "v3",
  // auth: process.env.YOUTUBE_API_KEY, // API Key (Limited permissions)
  // OR
  auth: /* Your configured OAuth2 client instance */ undefined, // Needs proper setup
});

const youtubeAnalytics = google.youtubeAnalytics({
  version: "v2",
  // auth: process.env.YOUTUBE_API_KEY, // API Key (Limited permissions)
  // OR
  auth: /* Your configured OAuth2 client instance */ undefined, // Needs proper setup
});

// Helper function to get authenticated YouTube client (placeholder)
async function getAuthenticatedYouTubeClient() {
    // Implement logic to get/refresh OAuth tokens for the channel owner
    // This is complex and depends on your auth flow (e.g., storing refresh tokens)
    // For now, we'll assume `youtube` and `youtubeAnalytics` are pre-configured
    if (!youtube.auth || !youtubeAnalytics.auth) {
        logger.error("YouTube client authentication not configured properly.");
        throw new Error("YouTube client authentication missing.");
    }
    return { youtube, youtubeAnalytics };
}

// --- Character Actions ---

export async function getCharacters() {
  logger.info("[YT Action] Fetching characters");
  try {
    const { data, error } = await supabaseAdmin.from("characters").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    logger.error("[YT Action] Error fetching characters:", error);
    return { success: false, error: error.message };
  }
}

export async function createCharacter(formData: FormData) {
  logger.info("[YT Action] Creating character");
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const imageFile = formData.get("imageFile") as File | null;
    const imageUrl = formData.get("imageUrl") as string; // URL provided directly
    const videoUrl = formData.get("videoUrl") as string;

    if (!name) throw new Error("Character name is required.");

    let finalImageUrl = imageUrl; // Use provided URL first

    // If a file is provided, upload it and override the URL
    if (imageFile) {
      const bucketName = "character-images"; // Ensure this bucket exists and is public
      const uploadResult = await uploadImage(bucketName, imageFile);
      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || "Failed to upload character image.");
      }
      finalImageUrl = uploadResult.publicUrl;
    }

    const characterData = {
      name,
      description: description || "",
      image_url: finalImageUrl || null,
      video_url: videoUrl || null,
    };

    const { data: newCharacter, error } = await supabaseAdmin
      .from("characters")
      .insert(characterData)
      .select()
      .single();

    if (error) throw error;

    logger.info(`[YT Action] Character '${name}' created successfully. ID: ${newCharacter.id}`);
    return { success: true, data: newCharacter };

  } catch (error: any) {
    logger.error("[YT Action] Error creating character:", error);
    return { success: false, error: error.message };
  }
}

export async function updateCharacter(id: number, formData: FormData) {
  logger.info(`[YT Action] Updating character ID: ${id}`);
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const imageFile = formData.get("imageFile") as File | null;
    const imageUrl = formData.get("imageUrl") as string;
    const videoUrl = formData.get("videoUrl") as string;

    if (!name) throw new Error("Character name is required.");

    // Fetch existing character to potentially delete old image if new one is uploaded
    const { data: existingChar, error: fetchError } = await supabaseAdmin
      .from("characters")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError) {
       logger.error(`[YT Action] Failed to fetch existing character ${id} for update:`, fetchError);
       // Decide if you want to proceed without checking old image_url or fail
       // For now, we proceed cautiously
    }

    let finalImageUrl = imageUrl; // Start with the potentially updated URL field

    // If a new image file is uploaded, process it
    if (imageFile) {
      const bucketName = "character-images";
      const uploadResult = await uploadImage(bucketName, imageFile);
      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || "Failed to upload updated character image.");
      }
      finalImageUrl = uploadResult.publicUrl;

      // Optional: Delete old image from storage if it exists and is different
      // This requires parsing the old URL to get the file path, which can be fragile.
      // Example (needs robust URL parsing):
      // if (existingChar?.image_url && existingChar.image_url !== finalImageUrl) {
      //   try {
      //     const oldFilePath = new URL(existingChar.image_url).pathname.split(`/storage/v1/object/public/${bucketName}/`)[1];
      //     if (oldFilePath) {
      //       await supabaseAdmin.storage.from(bucketName).remove([oldFilePath]);
      //       logger.info(`[YT Action] Deleted old image for character ${id}: ${oldFilePath}`);
      //     }
      //   } catch (deleteError) {
      //     logger.warn(`[YT Action] Failed to delete old image for character ${id}:`, deleteError);
      //   }
      // }
    }

    const characterData = {
      name,
      description: description || "",
      image_url: finalImageUrl || null,
      video_url: videoUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCharacter, error } = await supabaseAdmin
      .from("characters")
      .update(characterData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`[YT Action] Character ${id} updated successfully.`);
    return { success: true, data: updatedCharacter };
  } catch (error: any) {
    logger.error(`[YT Action] Error updating character ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteCharacter(id: number) {
  logger.info(`[YT Action] Deleting character ID: ${id}`);
  try {
     // Optional: Fetch character to get image URL for deletion from storage
     // const { data: existingChar, error: fetchError } = ... fetch character ...

    const { error } = await supabaseAdmin.from("characters").delete().eq("id", id);
    if (error) throw error;

     // Optional: Delete image from storage
     // if (existingChar?.image_url) { ... delete logic ... }

    logger.info(`[YT Action] Character ${id} deleted successfully.`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[YT Action] Error deleting character ${id}:`, error);
    return { success: false, error: error.message };
  }
}


// --- Task Actions ---
export async function createTask(taskData: {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  deadline?: string | null;
  priority?: "low" | "medium" | "high";
  assigned_to?: string | null; // Assuming assigned_to stores user_id
}) {
  logger.info("[YT Action] Creating task:", taskData.title);
  try {
      const dataToInsert = {
          ...taskData,
          status: taskData.status ?? 'todo', // Default status
          priority: taskData.priority ?? 'medium', // Default priority
          deadline: taskData.deadline || null, // Ensure null if empty string
          assigned_to: taskData.assigned_to || null,
      };
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(dataToInsert)
      .select()
      .single();
    if (error) throw error;
    logger.info(`[YT Action] Task '${taskData.title}' created successfully. ID: ${task.id}`);

    // Notify team after successful creation
    await notifyYtTeam(`✅ New Task Created: "${task.title}"`);

    return { success: true, data: task };
  } catch (error: any) {
    logger.error("[YT Action] Error creating task:", error);
    return { success: false, error: error.message };
  }
}

export async function getTasks() {
  logger.info("[YT Action] Fetching tasks");
  try {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    logger.error("[YT Action] Error fetching tasks:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTask(id: string, taskData: {
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  deadline?: string | null;
  priority?: "low" | "medium" | "high";
  assigned_to?: string | null;
}) {
  logger.info(`[YT Action] Updating task ID: ${id}`);
  try {
    const dataToUpdate = {
      ...taskData,
      deadline: taskData.deadline === "" ? null : taskData.deadline, // Handle empty string for date
      assigned_to: taskData.assigned_to || null,
      updated_at: new Date().toISOString(),
    };
    // Remove undefined fields to avoid overwriting with null unless intended
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[key as keyof typeof dataToUpdate]);


    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    logger.info(`[YT Action] Task ${id} updated successfully.`);
    // Optional: Notify based on status change etc.
    // if (taskData.status) await notifyYtTeam(`🔄 Task Updated: "${task.title}" Status: ${task.status}`);

    return { success: true, data: task };
  } catch (error: any) {
    logger.error(`[YT Action] Error updating task ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteTask(id: string) {
  logger.info(`[YT Action] Deleting task ID: ${id}`);
  try {
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
    if (error) throw error;
    logger.info(`[YT Action] Task ${id} deleted successfully.`);
    await notifyYtTeam(`🗑️ Task Deleted: Task with ID ${id} was removed.`); // Notify after successful deletion
    return { success: true };
  } catch (error: any) {
    logger.error(`[YT Action] Error deleting task ${id}:`, error);
    return { success: false, error: error.message };
  }
}

// --- YouTube Video Upload & Metadata ---

// (uploadVideoToYouTube exists, but needs robust auth)
export async function uploadVideoToYouTube(formData: FormData) {
  logger.info("[YT Action] Attempting to upload video to YouTube");
  const file = formData.get("video") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const tags = formData.get("tags") as string;
  const thumbnail = formData.get("thumbnail") as File | null; // Allow optional thumbnail

  if (!file || !title || !description) {
     logger.error("[YT Action] Missing required fields for YouTube upload.");
    return { success: false, error: "Missing required fields (video, title, description)" };
  }

  try {
    const { youtube: authYoutube, youtubeAnalytics: authAnalytics } = await getAuthenticatedYouTubeClient(); // Get authenticated client

    const buffer = Buffer.from(await file.arrayBuffer());
    const readable = Readable.from(buffer);

    logger.info(`[YT Action] Uploading video titled: ${title}`);
    const uploadResponse = await authYoutube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: tags ? tags.split(",").map(tag => tag.trim()).filter(Boolean) : [],
          categoryId: "22", // Example: Entertainment
        },
        status: {
          privacyStatus: "private", // Default to private
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: readable,
        mimeType: file.type || 'video/*', // Provide mime type
      },
    }, {
      // Note: onUploadProgress is client-side concept, not directly available in server action like this.
      // You'd need a different mechanism (websockets, polling) to report progress back to the client.
    });

    if (uploadResponse.status !== 200 || !uploadResponse.data.id) {
      logger.error("[YT Action] YouTube upload API call failed:", uploadResponse.status, uploadResponse.statusText, uploadResponse.data);
      throw new Error(`YouTube upload failed: ${uploadResponse.statusText || 'Unknown API error'}`);
    }
    const videoId = uploadResponse.data.id;
    logger.info(`[YT Action] Video uploaded successfully. YouTube Video ID: ${videoId}`);

    // Set thumbnail if provided
    if (thumbnail) {
      logger.info(`[YT Action] Uploading thumbnail for video ID: ${videoId}`);
      try {
        const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());
        const thumbReadable = Readable.from(thumbnailBuffer);
        await authYoutube.thumbnails.set({
          videoId: videoId,
          media: {
            body: thumbReadable,
            mimeType: thumbnail.type || 'image/*',
          },
        });
         logger.info(`[YT Action] Thumbnail set successfully for video ID: ${videoId}`);
      } catch (thumbError: any) {
        // Log thumbnail error but don't fail the whole upload
        logger.warn(`[YT Action] Failed to set thumbnail for ${videoId}:`, thumbError.message || thumbError);
      }
    }

    // Save metadata to our database AFTER successful upload
     const saveMetaResult = await saveVideoMetadata({
       youtube_id: videoId,
       title: title,
       description: description,
       tags: tags ? tags.split(",").map(tag => tag.trim()).filter(Boolean) : [],
       status: 'uploaded', // Or 'private' matching YouTube status
       uploaded_by: /* Get current user ID if applicable */ null,
       // Add other relevant fields like character_id if linked
     });

     if (!saveMetaResult.success) {
         logger.warn(`[YT Action] Video ${videoId} uploaded to YouTube, but failed to save metadata to DB: ${saveMetaResult.error}`);
         // Return success but include a warning
         return {
             success: true,
             videoId: videoId,
             title,
             description,
             warning: "Video uploaded to YouTube, but failed to save metadata locally.",
         };
     }

    return {
      success: true,
      videoId: videoId,
      title,
      description,
    };
  } catch (error: any) {
    logger.error("[YT Action] YouTube upload error:", error);
    return {
      success: false,
      error: error.message || "Unknown error during YouTube upload",
    };
  }
}

export async function saveVideoMetadata(metadata: {
  youtube_id: string;
  title: string;
  description: string;
  tags?: string[];
  status?: string;
  uploaded_by?: string | null; // user_id of uploader
  // Add other fields like character_id, scheduled_publish_time etc.
}) {
  logger.info(`[YT Action] Saving video metadata to DB for YouTube ID: ${metadata.youtube_id}`);
  try {
    const { data, error } = await supabaseAdmin
      .from("videos") // Assuming a 'videos' table exists
      .insert({
        ...metadata,
        tags: metadata.tags || [], // Ensure tags is an array
      })
      .select()
      .single();

    if (error) {
       // Handle potential duplicate youtube_id if it's a unique constraint
       if (error.code === '23505') {
           logger.warn(`[YT Action] Metadata for YouTube video ${metadata.youtube_id} already exists. Attempting update.`);
           // Optionally try to update instead of failing
           const { data: updateData, error: updateError } = await supabaseAdmin
               .from("videos")
               .update({ ...metadata, tags: metadata.tags || [], updated_at: new Date().toISOString() })
               .eq("youtube_id", metadata.youtube_id)
               .select()
               .single();
           if (updateError) {
               logger.error(`[YT Action] Failed to update existing metadata for ${metadata.youtube_id}:`, updateError);
               throw updateError; // Throw update error if update fails
           }
           logger.info(`[YT Action] Existing metadata for ${metadata.youtube_id} updated.`);
           return { success: true, data: updateData };
       }
       throw error; // Throw other errors
    }

    logger.info(`[YT Action] Metadata saved successfully for DB ID: ${data.id}`);
    return { success: true, data };
  } catch (error: any) {
    logger.error("[YT Action] Error saving video metadata:", error);
    return { success: false, error: error.message };
  }
}

// --- YouTube Analytics & Details ---
// (getYouTubeAnalytics, getVideoDetails, updateVideoMetadata exist, need auth)

export async function getYouTubeAnalytics() {
  logger.info("[YT Action] Fetching YouTube Analytics");
  try {
     const { youtube: authYoutube, youtubeAnalytics: authAnalytics } = await getAuthenticatedYouTubeClient();

    // Example: Get basic channel stats for the last 30 days
    // Adjust parameters (ids, startDate, endDate, metrics, dimensions) as needed
    const response = await authAnalytics.reports.query({
      ids: "channel==MINE", // Requires OAuth with youtube.readonly or youtubeanalytics.readonly scope
      startDate: "28daysAgo", // Or a specific date YYYY-MM-DD
      endDate: "today", // Or a specific date YYYY-MM-DD
      metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,subscribersGained",
      // dimensions: "day", // Example: group by day
      // filters: "video==VIDEO_ID", // Example: filter by specific video
      // sort: "-views" // Example: sort by views descending
    });

    if (response.status !== 200) {
         logger.error("[YT Action] YouTube Analytics API call failed:", response.status, response.statusText, response.data);
        throw new Error(`YouTube Analytics fetch failed: ${response.statusText || 'Unknown API error'}`);
    }

    logger.info("[YT Action] YouTube Analytics fetched successfully.");
    return { success: true, data: response.data }; // Return the raw analytics data structure
  } catch (error: any) {
    logger.error("[YT Action] YouTube analytics error:", error);
    return { success: false, error: "Failed to fetch YouTube analytics data: " + error.message };
  }
}


export async function getVideoDetails(videoId: string) {
   logger.info(`[YT Action] Fetching details for video ID: ${videoId}`);
   if (!videoId) return { success: false, error: "Video ID is required." };
  try {
     const { youtube: authYoutube } = await getAuthenticatedYouTubeClient(); // Auth might not be strictly needed if video is public

    const response = await authYoutube.videos.list({
      part: ["snippet", "contentDetails", "statistics", "status"], // Include status
      id: [videoId], // API expects an array of IDs
    });

    if (response.status !== 200) {
        logger.error(`[YT Action] YouTube videos.list API call failed for ${videoId}:`, response.status, response.statusText, response.data);
        throw new Error(`YouTube video details fetch failed: ${response.statusText || 'Unknown API error'}`);
    }

    if (!response.data.items || response.data.items.length === 0) {
      logger.warn(`[YT Action] Video not found on YouTube: ${videoId}`);
      return { success: false, error: "Video not found on YouTube" };
    }

    logger.info(`[YT Action] Details fetched successfully for video ID: ${videoId}`);
    return { success: true, data: response.data.items[0] };
  } catch (error: any) {
    logger.error(`[YT Action] Error fetching video details for ${videoId}:`, error);
    return { success: false, error: "Failed to fetch video details: " + error.message };
  }
}

export async function updateVideoMetadata(videoId: string, metadata: {
  title?: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "private" | "public" | "unlisted";
  categoryId?: string;
  // Add other updatable fields from snippet/status as needed
}) {
  logger.info(`[YT Action] Updating metadata for video ID: ${videoId}`);
   if (!videoId) return { success: false, error: "Video ID is required." };
   if (Object.keys(metadata).length === 0) return { success: false, error: "No metadata provided for update." };

  try {
     const { youtube: authYoutube } = await getAuthenticatedYouTubeClient(); // Auth is required for updates

    // Fetch existing video data to build the update request body correctly
    const detailsResult = await getVideoDetails(videoId);
    if (!detailsResult.success || !detailsResult.data) {
        return { success: false, error: `Cannot update metadata: ${detailsResult.error}` };
    }
    const currentSnippet = detailsResult.data.snippet!;
    const currentStatus = detailsResult.data.status!;

    // Prepare the request body, only including parts that are being updated
    const requestBody: any = { id: videoId }; // ID is required
    let partsToUpdate: string[] = [];

    if (metadata.title || metadata.description || metadata.tags || metadata.categoryId) {
        partsToUpdate.push("snippet");
        requestBody.snippet = {
            title: metadata.title ?? currentSnippet.title,
            description: metadata.description ?? currentSnippet.description,
            tags: metadata.tags ?? currentSnippet.tags,
            categoryId: metadata.categoryId ?? currentSnippet.categoryId,
        };
    }
    if (metadata.privacyStatus) {
         partsToUpdate.push("status");
         requestBody.status = {
             privacyStatus: metadata.privacyStatus ?? currentStatus.privacyStatus,
             // Include other status fields if necessary to avoid them being reset
             publishAt: currentStatus.publishAt,
             selfDeclaredMadeForKids: currentStatus.selfDeclaredMadeForKids,
             embeddable: currentStatus.embeddable,
             license: currentStatus.license,
             publicStatsViewable: currentStatus.publicStatsViewable,
         };
    }

     if (partsToUpdate.length === 0) {
         return { success: false, error: "No valid metadata fields provided for update." };
     }

    const response = await authYoutube.videos.update({
      part: partsToUpdate,
      requestBody: requestBody,
    });

     if (response.status !== 200) {
         logger.error(`[YT Action] YouTube videos.update API call failed for ${videoId}:`, response.status, response.statusText, response.data);
         throw new Error(`YouTube metadata update failed: ${response.statusText || 'Unknown API error'}`);
     }

    logger.info(`[YT Action] Metadata updated successfully for video ID: ${videoId}`);

    // Update our local DB as well
    const dbUpdateResult = await saveVideoMetadata({ // Using saveVideoMetadata which handles insert/update
        youtube_id: videoId,
        title: requestBody.snippet?.title ?? currentSnippet.title!,
        description: requestBody.snippet?.description ?? currentSnippet.description!,
        tags: requestBody.snippet?.tags ?? currentSnippet.tags,
        status: requestBody.status?.privacyStatus ?? currentStatus.privacyStatus,
    });
     if (!dbUpdateResult.success) {
         logger.warn(`[YT Action] YouTube metadata for ${videoId} updated, but DB update failed: ${dbUpdateResult.error}`);
     }


    return { success: true, data: response.data };
  } catch (error: any) {
    logger.error(`[YT Action] Error updating video metadata for ${videoId}:`, error);
    return { success: false, error: "Failed to update video metadata: " + error.message };
  }
}


// --- Notifications ---
export async function notifyYtTeam(message: string) {
  logger.info("[YT Action] Notifying YouTube Team:", message);
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.error("[YT Action] TELEGRAM_BOT_TOKEN not set. Cannot notify team.");
    return { success: false, error: "Telegram bot token not configured." };
  }
  try {
    const { data: teamMembers, error } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("role", "ytTeam"); // Assuming 'ytTeam' role exists

    if (error) throw error;

    if (!teamMembers || teamMembers.length === 0) {
      logger.warn("[YT Action] No users found with role 'ytTeam'. Cannot notify.");
      return { success: false, error: "No YouTube team members found." };
    }

    let successCount = 0;
    for (const member of teamMembers) {
      const result = await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN,
        `📢 YT Team Notification:\n${message}`,
        [], // No buttons
        undefined, // No image URL
        member.user_id // Send to each member
      );
      if (result.success) {
        successCount++;
      } else {
        logger.warn(`[YT Action] Failed to send notification to team member ${member.user_id}: ${result.error}`);
      }
    }

    logger.info(`[YT Action] Sent notification to ${successCount}/${teamMembers.length} team members.`);
    return { success: true, sentCount: successCount, totalMembers: teamMembers.length };
  } catch (error: any) {
    logger.error("[YT Action] Error notifying YouTube team:", error);
    return { success: false, error: error.message };
  }
}