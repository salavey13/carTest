"use client";

import React, { useState, useCallback, ChangeEvent } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faCopy, faSpinner, faCheckCircle, faTimesCircle, faFileCsv, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { uploadAdviceCsv } from '@/app/advice-upload/actions'; // We'll create this server action next
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { Toaster, toast } from 'react-hot-toast'; // Using react-hot-toast for notifications

// --- Instruction Generation ---
const SYSTEM_INSTRUCTION_TEMPLATE = `
You are an expert content processor. Your task is to watch the YouTube video at the following URL and convert its spoken content into a structured CSV format suitable for import into a database.

YouTube Video URL: %%YOUTUBE_URL%%

CSV Output Format Requirements:
1.  The CSV MUST have the following columns in this exact order: "article_title", "article_slug", "article_description", "section_order", "section_title", "section_content".
2.  The CSV MUST use a comma (,) as the delimiter.
3.  Text fields (especially "section_content") MUST be enclosed in double quotes ("") if they contain commas, newlines, or double quotes themselves. Double quotes within the content should be escaped by doubling them (e.g., "He said ""hello"".").
4.  "article_title": The main title of the article derived from the video. Use this same title for all rows belonging to this article.
5.  "article_slug": A URL-friendly version of the title (lowercase, spaces replaced with hyphens, remove special characters). Use this same slug for all rows belonging to this article. Keep it relatively short but descriptive. Example: "how-to-meditate-effectively".
6.  "article_description": A brief (1-2 sentence) summary of the entire article/video content. Use this same description for all rows belonging to this article.
7.  "section_order": A sequential integer number (1, 2, 3, ...) indicating the order of the section within the article. Each section should represent a logical chunk or topic from the video.
8.  "section_title": (Optional) A short, descriptive title for the specific section. Leave blank if no obvious title emerges, but try to create one if possible.
9.  "section_content": The transcribed and *lightly edited* text content of that specific section. Focus on clarity and readability. Remove filler words ("uh", "um"), correct obvious grammatical errors, and structure into paragraphs where appropriate. Preserve the core meaning and advice given in the video for that section. Ensure the content is properly quoted for CSV safety.

Processing Steps:
1.  Watch the video carefully.
2.  Identify the main topic and formulate the "article_title", "article_slug", and "article_description".
3.  Break the video content down into logical sections based on topic shifts or distinct pieces of advice.
4.  For each section, assign a sequential "section_order".
5.  Extract or formulate a "section_title" for each section if possible.
6.  Transcribe the spoken content for each section, edit it lightly for clarity (as described above), and place it in the "section_content" column, ensuring correct CSV quoting.
7.  Combine all sections into a single CSV output, repeating the article-level information (title, slug, description) for each section's row.

Example Row:
"How to Meditate Effectively","how-to-meditate-effectively","Learn the basics of mindfulness meditation to reduce stress and improve focus.",1,"Finding a Quiet Space","Find a comfortable and quiet location where you won't be disturbed. This could be a corner of your room, a park bench, or anywhere you feel at ease. Turn off notifications on your phone."

VERY IMPORTANT: Output ONLY the raw CSV data, starting directly with the header row ("article_title", "article_slug", ...). Do NOT include any introductory text, explanations, or ```csv ``` markers before or after the CSV data itself.
`;

export default function AdminAdviceUploadPage() {
    const { user } = useTelegram();
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [generatedInstruction, setGeneratedInstruction] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);

    // --- Instruction Generation Logic ---
    const handleGenerateInstructions = useCallback(() => {
        if (!youtubeUrl || !youtubeUrl.trim().startsWith('https://')) {
            toast.error('Please enter a valid YouTube URL starting with https://');
            return;
        }
        const instruction = SYSTEM_INSTRUCTION_TEMPLATE.replace('%%YOUTUBE_URL%%', youtubeUrl.trim());
        setGeneratedInstruction(instruction);
        // Optionally copy to clipboard immediately
        handleCopyToClipboard(instruction);
    }, [youtubeUrl]);

    const handleCopyToClipboard = useCallback((text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => {
                toast.success('Instructions copied to clipboard!');
                debugLogger.log('Instructions copied successfully.');
            })
            .catch(err => {
                toast.error('Failed to copy instructions.');
                logger.error('Failed to copy instructions to clipboard:', err);
            });
    }, []);

    // --- CSV Upload Logic ---
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setUploadStatus(null); // Reset status on new file selection
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (file.type !== 'text/csv') {
                toast.error('Please select a CSV file (.csv)');
                setSelectedFile(null);
                event.target.value = ''; // Reset file input
                return;
            }
            setSelectedFile(file);
            debugLogger.log(`File selected: ${file.name}`);
        } else {
            setSelectedFile(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a CSV file to upload.');
            return;
        }
        if (!user?.id) {
             toast.error('User information not available. Cannot verify admin status.');
             return;
        }

        setIsUploading(true);
        setUploadStatus(null);
        debugLogger.log(`Starting upload for file: ${selectedFile.name}`);

        const formData = new FormData();
        formData.append('csvFile', selectedFile);
        // Include user ID for server-side verification
        formData.append('userId', user.id.toString());

        try {
            const result = await uploadAdviceCsv(formData); // Call server action

            if (result.success) {
                toast.success(result.message || 'CSV uploaded and processed successfully!');
                setUploadStatus({ success: true, message: result.message || 'Upload successful.' });
                setSelectedFile(null); // Clear selection on success
                // Optionally reset the file input visually
                const fileInput = document.getElementById('csv-upload-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } else {
                toast.error(result.error || 'An unknown error occurred during upload.');
                setUploadStatus({ success: false, message: result.error || 'Upload failed.' });
                logger.error('CSV Upload failed:', result.error);
            }
        } catch (error) {
            toast.error('A critical error occurred during upload.');
            setUploadStatus({ success: false, message: 'Client-side error during upload.' });
            logger.error('Critical error calling uploadAdviceCsv:', error);
        } finally {
            setIsUploading(false);
            debugLogger.log('Upload process finished.');
        }
    };

    // --- Admin Access Control ---
    // Replace 'admin' with your actual admin role/status identifier
    const isAdmin = user?.status === 'admin' || user?.role === 'admin';

    if (!user) {
        return (
            <div className="flex justify-center items-center h-screen">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" /> Loading user data...
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-6 text-center text-red-600">
                <FontAwesomeIcon icon={faTriangleExclamation} size="2x" className="mb-2" />
                <p className="font-semibold">Access Denied</p>
                <p>You do not have permission to access this page.</p>
            </div>
        );
    }

    // --- Render Page ---
    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto font-sans">
            <Toaster position="top-center" reverseOrder={false} />
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
                Admin: Upload Advice Article
            </h1>

            {/* Section 1: Generate Instructions */}
            <div className="mb-8 p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
                <h2 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">1. Generate CSV Instructions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter a YouTube video URL. The system will generate instructions for an AI bot
                    to convert the video content into the required CSV format. Copy these instructions
                    and provide them to the bot (e.g., ChatGPT, Claude).
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-grow p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={handleGenerateInstructions}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                        <FontAwesomeIcon icon={faCopy} />
                        Generate & Copy Instructions
                    </button>
                </div>
                {generatedInstruction && (
                     <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded border dark:border-gray-600">
                         <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center">
                             <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                             Instructions generated and copied! Provide the text below to the conversion bot.
                         </p>
                         <textarea
                            readOnly
                            value={generatedInstruction}
                            rows={8}
                            className="w-full mt-2 p-2 border rounded text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 whitespace-pre-wrap"
                         />
                     </div>
                 )}
            </div>

            {/* Section 2: Upload CSV */}
            <div className="p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
                <h2 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">2. Upload Advice CSV</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Upload the CSV file generated by the bot. Ensure it follows the exact format specified in the instructions.
                </p>
                 <p className="text-xs text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCircleInfo} />
                    Required Columns: article_title, article_slug, article_description, section_order, section_title, section_content
                 </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label htmlFor="csv-upload-input" className="cursor-pointer px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition duration-150 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faFileCsv} />
                        {selectedFile ? `Selected: ${selectedFile.name.substring(0, 20)}...` : 'Choose CSV File'}
                    </label>
                    <input
                        id="csv-upload-input"
                        type="file"
                        accept=".csv, text/csv"
                        onChange={handleFileChange}
                        className="hidden" // Hide the default input, use the label
                    />

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || !selectedFile}
                        className={`px-5 py-2 rounded text-white transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                            isUploading || !selectedFile
                                ? 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        }`}
                    >
                        {isUploading ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                            <FontAwesomeIcon icon={faUpload} />
                        )}
                        {isUploading ? 'Uploading...' : 'Upload & Process'}
                    </button>
                </div>

                {/* Upload Status Area */}
                {uploadStatus && (
                    <div className={`mt-4 p-3 rounded border text-sm ${
                        uploadStatus.success
                            ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                            : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                    }`}>
                        <FontAwesomeIcon icon={uploadStatus.success ? faCheckCircle : faTimesCircle} className="mr-2" />
                        {uploadStatus.message}
                    </div>
                )}
            </div>
        </div>
    );
}