"use client";

import React, { useState, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext'; // Use AppContext
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faCopy, faSpinner, faCheckCircle, faFileCsv, faCircleInfo, faTriangleExclamation, faPaste, faList } from '@fortawesome/free-solid-svg-icons';
import { uploadAdviceCsv } from '@/app/advice-upload/actions'; // Ensure action path is correct
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { Toaster, toast } from 'react-hot-toast';
import Papa from 'papaparse'; // For client-side parsing/preview
import { cn } from "@/lib/utils";

// --- Instruction Generation ---
const SYSTEM_INSTRUCTION_TEMPLATE = `
You are an expert content processor... [Instructions remain the same as before] ... Do NOT include any introductory text, explanations, or \`\`\`csv \`\`\` markers before or after the CSV data itself.
`;

// Interface for parsed CSV row data (used for preview)
interface AdviceCsvRow {
    article_title: string;
    article_slug: string;
    article_description?: string | null;
    section_order: string; // Keep as string initially for parsing flexibility
    section_title?: string | null;
    section_content: string;
    [key: string]: any; // Allow other columns, though they might be ignored
}

// --- Component ---
export default function AdminAdviceUploadPage() {
    const { user, isAdmin, isAuthLoading } = useAppContext(); // Get user and isAdmin status
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [generatedInstruction, setGeneratedInstruction] = useState('');
    const [csvText, setCsvText] = useState(''); // State for pasted CSV text
    const [parsedData, setParsedData] = useState<AdviceCsvRow[] | null>(null); // State for preview data
    const [parseError, setParseError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
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
        handleCopyToClipboard(instruction); // Copy immediately
    }, [youtubeUrl]);

    const handleCopyToClipboard = useCallback((text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => { toast.success('Instructions copied to clipboard!'); })
            .catch(err => { toast.error('Failed to copy instructions.'); logger.error('Clipboard copy failed:', err); });
    }, []);

    // --- CSV Text Parsing & Preview Logic ---
    const handleParseCsv = useCallback(() => {
        if (!csvText.trim()) {
            toast.error('Please paste CSV data into the text area.');
            return;
        }
        setIsParsing(true);
        setParseError(null);
        setParsedData(null);
        setUploadStatus(null); // Reset upload status when parsing new data

        debugLogger.log('Parsing CSV text...');
        try {
            // Use PapaParse on the client side for preview
            Papa.parse<AdviceCsvRow>(csvText, {
                header: true,
                skipEmptyLines: 'greedy', // Skips lines that are empty OR just whitespace
                transformHeader: header => header.trim(),
                transform: value => value.trim(),
                complete: (results) => {
                    if (results.errors.length > 0) {
                        const firstError = results.errors[0];
                        const errorMsg = `CSV Parsing Error (Row ${firstError.row + 1}): ${firstError.message}. Check format/quoting.`;
                        logger.error('CSV parsing errors:', results.errors);
                        setParseError(errorMsg);
                        toast.error(errorMsg, { duration: 5000 });
                        setParsedData(null);
                    } else if (!results.data || results.data.length === 0) {
                         const errorMsg = 'CSV has no data rows or is empty.';
                         setParseError(errorMsg);
                         toast.error(errorMsg);
                         setParsedData(null);
                    } else {
                        // Basic validation of required headers
                        const requiredHeaders = ["article_title", "article_slug", "section_order", "section_content"];
                        const actualHeaders = Object.keys(results.data[0] || {});
                        const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));

                        if (missingHeaders.length > 0) {
                             const errorMsg = `Missing required CSV columns: ${missingHeaders.join(', ')}`;
                             setParseError(errorMsg);
                             toast.error(errorMsg, { duration: 5000 });
                             setParsedData(null);
                        } else {
                            setParsedData(results.data);
                            toast.success(`Parsed ${results.data.length} rows successfully. Ready to upload.`);
                            debugLogger.log(`Parsed ${results.data.length} rows. Preview data set.`);
                        }
                    }
                    setIsParsing(false);
                },
                error: (error) => {
                    logger.error('PapaParse critical error:', error);
                    setParseError(`CSV Parsing Failed: ${error.message}`);
                    toast.error(`CSV Parsing Failed: ${error.message}`);
                    setParsedData(null);
                    setIsParsing(false);
                }
            });
        } catch (error) {
            logger.error('Error during CSV parsing setup:', error);
            setParseError('An unexpected error occurred during parsing.');
            toast.error('An unexpected error occurred during parsing.');
            setParsedData(null);
            setIsParsing(false);
        }
    }, [csvText]);

    // --- Upload Logic (using parsed data) ---
    const handleUpload = async () => {
        // Change: Upload uses the raw CSV text state now, parsing happens server-side
        if (!csvText.trim()) {
             toast.error('No CSV data to upload.');
             return;
         }
        // Re-parse just before upload to ensure data integrity? Or trust the preview state?
        // Let's trust the preview state was triggered by the user pressing "Parse".
        // if (!parsedData || parsedData.length === 0) {
        //    toast.error('Please parse the CSV data first using the "Parse & Preview" button.');
        //    return;
        // }
        if (!user?.id) {
             toast.error('User information not available. Cannot verify admin status.');
             return;
        }

        setIsUploading(true);
        setUploadStatus(null);
        debugLogger.log(`Starting upload of pasted CSV data...`);

        try {
            // Pass the raw CSV content and user ID to the server action
            const result = await uploadAdviceCsv(csvText, user.id.toString());

            if (result.success) {
                toast.success(result.message || 'CSV uploaded and processed successfully!');
                setUploadStatus({ success: true, message: result.message || 'Upload successful.' });
                // Clear text area and parsed data on successful upload
                setCsvText('');
                setParsedData(null);
                setParseError(null);
            } else {
                toast.error(result.error || 'An unknown error occurred during upload.', { duration: 6000 });
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
    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center h-screen pt-24 bg-black">
                 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-brand-green" />
            </div>
        );
    }
    if (!isAdmin) {
        return (
            <div className="p-6 pt-32 text-center text-brand-pink">
                <FontAwesomeIcon icon={faTriangleExclamation} size="2x" className="mb-2" />
                <p className="font-semibold text-xl">Access Denied</p>
                <p className="text-gray-400">You do not have permission to access this page.</p>
            </div>
        );
    }

    // --- Render Page ---
    return (
        <div className={cn(
            "min-h-screen pt-24 pb-10 font-mono", // Added pt-24
            "bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200"
        )}>
            <Toaster position="top-center" reverseOrder={false} toastOptions={{
                className: '!bg-gray-800 !border !border-brand-purple/50 !text-gray-200 font-mono',
                success: {iconTheme: {primary: '#00FF9D', secondary: '#1a1a2e'}},
                error: {iconTheme: {primary: '#FF007A', secondary: '#1a1a2e'}},
            }}/>
            <div className="relative z-10 container mx-auto px-4 max-w-4xl space-y-8">
                <h1 className="text-3xl md:text-4xl font-bold text-center text-brand-green cyber-text glitch" data-text="Admin: Upload Advice Article">
                    Admin: Upload Advice Article
                </h1>

                {/* Section 1: Generate Instructions */}
                <div className="p-4 md:p-6 border border-brand-blue/30 rounded-lg bg-black/50 backdrop-blur-sm shadow-lg shadow-brand-blue/20">
                    <h2 className="text-xl font-semibold mb-3 text-brand-blue flex items-center gap-2">
                        <FontAwesomeIcon icon={faCopy} /> 1. Generate CSV Instructions
                    </h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Enter a YouTube video URL. Instructions for an AI bot (ChatGPT, Claude) to convert it to CSV will be generated and copied.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input
                            type="url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="flex-grow p-2 border rounded bg-gray-800/70 border-brand-blue/50 text-gray-200 focus:ring-2 focus:ring-brand-blue outline-none placeholder-gray-500"
                        />
                        <button
                            onClick={handleGenerateInstructions}
                            className="px-4 py-2 bg-brand-blue/80 text-black rounded hover:bg-brand-blue transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-black font-semibold"
                        >
                            <FontAwesomeIcon icon={faCopy} /> Generate & Copy
                        </button>
                    </div>
                    {generatedInstruction && (
                         <div className="mt-4 p-3 bg-gray-800/50 rounded border border-brand-blue/20">
                             <p className="text-sm font-medium text-brand-green flex items-center gap-2">
                                 <FontAwesomeIcon icon={faCheckCircle} /> Instructions generated and copied!
                             </p>
                             <textarea
                                readOnly
                                value={generatedInstruction}
                                rows={6}
                                className="w-full mt-2 p-2 border rounded text-xs bg-gray-900/60 border-gray-700 text-gray-300 whitespace-pre-wrap font-mono scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                             />
                         </div>
                     )}
                </div>

                {/* Section 2: Paste & Upload CSV */}
                <div className="p-4 md:p-6 border border-brand-green/30 rounded-lg bg-black/50 backdrop-blur-sm shadow-lg shadow-brand-green/20">
                    <h2 className="text-xl font-semibold mb-3 text-brand-green flex items-center gap-2">
                       <FontAwesomeIcon icon={faPaste} /> 2. Paste & Upload CSV Data
                    </h2>
                    <p className="text-sm text-gray-400 mb-1">
                        Paste the raw CSV data generated by the bot into the text area below.
                    </p>
                    <p className="text-xs text-brand-blue mb-4 flex items-center gap-1">
                        <FontAwesomeIcon icon={faCircleInfo} />
                        Required Columns: article_title, article_slug, article_description, section_order, section_title, section_content
                     </p>

                    <textarea
                        value={csvText}
                        onChange={(e) => {
                            setCsvText(e.target.value);
                            setParsedData(null); // Reset preview if text changes
                            setParseError(null);
                            setUploadStatus(null);
                        }}
                        placeholder="Paste CSV data here, starting with the header row..."
                        rows={10}
                        className="w-full p-2 border rounded bg-gray-800/70 border-brand-green/50 text-gray-200 focus:ring-2 focus:ring-brand-green outline-none placeholder-gray-500 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                    />

                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                         <button
                            onClick={handleParseCsv}
                            disabled={isParsing || !csvText.trim()}
                            className={cn(
                                "px-5 py-2 rounded text-black font-semibold transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black w-full sm:w-auto",
                                isParsing || !csvText.trim()
                                    ? 'bg-gray-500 cursor-not-allowed'
                                    : 'bg-yellow-400 hover:bg-yellow-500 focus:ring-yellow-400'
                            )}
                         >
                           {isParsing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faList} />}
                           {isParsing ? 'Parsing...' : 'Parse & Preview'}
                         </button>

                         <button
                            onClick={handleUpload}
                            disabled={isUploading || !parsedData || !!parseError || isParsing}
                            className={cn(
                                "px-5 py-2 rounded text-black font-semibold transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black w-full sm:w-auto",
                                isUploading || !parsedData || !!parseError || isParsing
                                    ? 'bg-gray-500 cursor-not-allowed'
                                    : 'bg-brand-green/80 hover:bg-brand-green focus:ring-brand-green'
                            )}
                        >
                            {isUploading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
                            {isUploading ? 'Uploading...' : 'Upload Parsed Data'}
                        </button>
                    </div>

                    {/* Parsing/Upload Status Area */}
                    {parseError && (
                         <div className="mt-4 p-3 rounded border border-brand-pink/50 bg-pink-900/30 text-brand-pink text-sm">
                             <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                             {parseError}
                         </div>
                     )}
                    {parsedData && !parseError && (
                         <div className="mt-4 p-3 rounded border border-yellow-500/50 bg-yellow-900/30 text-yellow-300 text-sm">
                             <FontAwesomeIcon icon={faCheckCircle} className="mr-2 text-brand-green" />
                             Parsed {parsedData.length} rows. Ready to upload.
                             <div className='mt-2 text-xs opacity-80'>
                                <p>Article Preview: "{parsedData[0]?.article_title}" ({parsedData[0]?.article_slug})</p>
                                <p>Description Preview: "{parsedData[0]?.article_description?.substring(0, 50)}..."</p>
                             </div>
                         </div>
                     )}
                    {uploadStatus && (
                        <div className={cn(
                            'mt-4 p-3 rounded border text-sm',
                             uploadStatus.success
                                ? 'bg-green-900/30 border-brand-green/50 text-brand-green'
                                : 'bg-red-900/30 border-brand-pink/50 text-brand-pink'
                        )}>
                            <FontAwesomeIcon icon={uploadStatus.success ? faCheckCircle : faTriangleExclamation} className="mr-2" />
                            {uploadStatus.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}