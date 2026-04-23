"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { debugLogger as logger } from '@/lib/debugLogger';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; // Assuming you have this Shadcn component
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FaVideo, FaVolumeUp, FaSpinner, FaDownload as FaDownloadIcon, FaRocket } from "react-icons/fa6"; // Alias FaDownload
import Link from 'next/link';

// --- Constants ---
// !!! ЗАМЕНИ НА СВОИ URL ИЗ SUPABASE STORAGE !!!
const FFMPEG_BASE_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/ffmpeg-assets'; // Пример
const CORE_URL = `${FFMPEG_BASE_URL}/ffmpeg-core.js`;
const WASM_URL = `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`;
// const WORKER_URL = `${FFMPEG_BASE_URL}/ffmpeg-core.worker.js`; // Раскомментируй, если используешь worker

type ProcessingStatus = "idle" | "loadingEngine" | "reading" | "remuxing" | "done" | "error";

function VideoRemuxerPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [status, setStatus] = useState<ProcessingStatus>("loadingEngine");
    const [progress, setProgress] = useState(0); // 0-100
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const ffmpegRef = useRef(new FFmpeg());
    const outputFilename = useRef<string>("remuxed_output.mkv"); // Store filename

    // --- Load FFmpeg Engine ---
    useEffect(() => {
        const loadEngine = async () => {
            const ffmpeg = ffmpegRef.current;
            setStatus("loadingEngine");
            setProgress(0); // Show initial loading state
            logger.info("Remuxer: Loading FFmpeg engine...");

            ffmpeg.on('log', ({ message }) => {
                // Avoid flooding logs, maybe log only specific messages if needed
                // logger.debug(`FFmpeg Log: ${message}`);
            });

            // Progress handler - maps FFmpeg's 0-1 progress to 0-100
            ffmpeg.on('progress', ({ progress: p }) => {
                 if (status === 'remuxing') { // Only update during the remux phase
                    const currentProgress = Math.min(100, Math.max(0, Math.round(p * 100)));
                    logger.debug(`Remuxer FFmpeg Progress: ${currentProgress}%`);
                    setProgress(currentProgress);
                 }
            });

            try {
                // Dynamically create Blob URLs for loading to potentially help with CORS/caching
                 const coreBlobUrl = await toBlobURL(CORE_URL, 'text/javascript');
                 const wasmBlobUrl = await toBlobURL(WASM_URL, 'application/wasm');
                 // const workerBlobUrl = await toBlobURL(WORKER_URL, 'text/javascript'); // If using worker

                await ffmpeg.load({
                    coreURL: coreBlobUrl,
                    wasmURL: wasmBlobUrl,
                    // workerURL: workerBlobUrl, // Uncomment if using worker
                });
                logger.info("Remuxer: FFmpeg engine loaded successfully.");
                setStatus("idle");
                setProgress(0);
            } catch (err: any) {
                logger.error("Remuxer: Failed to load FFmpeg engine:", err);
                setErrorMessage(`Ошибка загрузки FFmpeg движка: ${err?.message || 'Unknown error'}. Проверь URL и CORS.`);
                setStatus("error");
                setProgress(0);
            }
        };
        loadEngine();

        // Cleanup function to potentially terminate FFmpeg if component unmounts
        // return () => {
        //     try {
        //         if (ffmpegRef.current.loaded) {
        //              // ffmpegRef.current.terminate(); // Be careful with terminate
        //         }
        //     } catch (e) {
        //         logger.warn("Remuxer: Error during FFmpeg cleanup:", e);
        //     }
        // };
    }, []); // Run only once on mount

    // --- Reset Output URL ---
    useEffect(() => {
        // Revoke old Object URL when component unmounts or outputUrl changes
        let currentUrl = outputUrl;
        return () => {
            if (currentUrl) {
                logger.debug("Remuxer: Revoking previous object URL:", currentUrl.substring(0, 50));
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [outputUrl]);

    // --- Main Remuxing Logic ---
    const handleRemux = useCallback(async () => {
        if (!videoFile || !audioFile || status !== "idle") {
            logger.warn("Remuxer: Remux skipped, invalid state or files.", { status, videoFile, audioFile });
            return;
        }
        if (!ffmpegRef.current.loaded) {
            setErrorMessage("Движок FFmpeg еще не загружен.");
            setStatus("error");
            return;
        }

        setStatus("reading");
        setProgress(0);
        setOutputUrl(null);
        setErrorMessage(null);
        const ffmpeg = ffmpegRef.current;
        const videoName = 'inputVideo' + videoFile.name.substring(videoFile.name.lastIndexOf('.')); // Use original extension
        const audioName = 'inputAudio' + audioFile.name.substring(audioFile.name.lastIndexOf('.'));
        outputFilename.current = `remuxed_${videoFile.name}`; // Use original video name

        logger.info("Remuxer: Starting remux process...", { video: videoName, audio: audioName, output: outputFilename.current });

        try {
            logger.debug("Remuxer: Reading files into memory...");
            // Add size checks here if desired
            const videoData = await fetchFile(videoFile);
            const audioData = await fetchFile(audioFile);
            logger.debug("Remuxer: Files read. Writing to virtual FS...");

            // Check if files already exist from a previous run and delete them
            try { await ffmpeg.deleteFile(videoName); } catch (e) {}
            try { await ffmpeg.deleteFile(audioName); } catch (e) {}
            try { await ffmpeg.deleteFile(outputFilename.current); } catch (e) {}


            await ffmpeg.writeFile(videoName, videoData);
            await ffmpeg.writeFile(audioName, audioData);
            logger.debug("Remuxer: Files written to FS.");

            setStatus("remuxing");
            setProgress(0); // Reset progress for FFmpeg command
            logger.info("Remuxer: Executing FFmpeg remux command...");

            await ffmpeg.exec([
                '-i', videoName,
                '-i', audioName,
                '-map', '0:v', // Map video from first input
                '-map', '1:a', // Map audio from second input
                '-c', 'copy',  // CRITICAL: Copy streams without re-encoding
                '-shortest',   // Finish when the shortest input ends (optional, but good practice)
                outputFilename.current
            ]);
            logger.info("Remuxer: FFmpeg command finished.");

            logger.debug("Remuxer: Reading output file from FS...");
            setStatus("reading"); // Indicate reading output
            setProgress(0); // Reset progress for read operation
            const outputData = await ffmpeg.readFile(outputFilename.current);
            logger.debug("Remuxer: Output file read.", { size: outputData.byteLength });

            const mimeType = videoFile.type.startsWith('video/') ? videoFile.type : 'video/mkv'; // Use original video MIME or default
            const blob = new Blob([outputData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            setOutputUrl(url);
            setStatus("done");
            setProgress(100);
            logger.info("Remuxer: Output file ready for download.", { url: url.substring(0, 50) });

            // Clean up files from virtual FS after successful processing
             try {
                 logger.debug("Remuxer: Cleaning up virtual FS...");
                 await ffmpeg.deleteFile(videoName);
                 await ffmpeg.deleteFile(audioName);
                 await ffmpeg.deleteFile(outputFilename.current);
                 logger.debug("Remuxer: Virtual FS cleaned.");
             } catch (cleanupError) {
                 logger.warn("Remuxer: Error during virtual FS cleanup:", cleanupError);
             }


        } catch (err: any) {
            logger.error("Remuxer: Error during remuxing:", err);
            setErrorMessage(`Ошибка обработки: ${err?.message || 'Неизвестная проблема'}. Проверьте консоль браузера (F12) для деталей.`);
            setStatus("error");
            setOutputUrl(null);
            setProgress(0);
        }
        // No finally block for setStatus("idle") here, keep it in "done" or "error" state

    }, [videoFile, audioFile, status]); // Dependencies

    const getStatusMessage = () => {
        switch (status) {
            case "idle": return "Готов к работе.";
            case "loadingEngine": return "Загрузка движка FFmpeg...";
            case "reading": return "Чтение файлов / Подготовка результата...";
            case "remuxing": return `Склейка... ${progress}%`;
            case "done": return "Готово! Можно скачивать.";
            case "error": return `Ошибка: ${errorMessage || 'Неизвестно'}`;
            default: return "";
        }
    };

    const isBusy = status === 'loadingEngine' || status === 'reading' || status === 'remuxing';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black p-4 sm:p-8 pt-24 flex justify-center items-start">
            <Card className="w-full max-w-2xl bg-dark-card border-brand-purple/30 shadow-glow-md glitch-border-animate">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-brand-green cyber-text flex items-center gap-2">
                        <FaRocket /> Локальный Видео Ремиксер
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Склейка видео и аудио прямо в браузере (Level 1: Remux). <br/>
                        Файлы не загружаются на сервер. Ограничение по памяти ~500MB.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Video Input */}
                        <div className="space-y-2">
                            <Label htmlFor="video-input" className="flex items-center gap-2 text-light-text">
                                <FaVideo className="text-brand-blue"/> Видео файл (.mkv, .mp4, .webm)
                            </Label>
                            <Input
                                id="video-input"
                                type="file"
                                accept=".mkv,.mp4,.webm,video/*"
                                onChange={(e) => { setVideoFile(e.target.files?.[0] || null); setOutputUrl(null); setStatus( prev => prev === 'error' || prev === 'done' ? 'idle' : prev); }}
                                className="text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-purple/80 file:text-white hover:file:bg-brand-purple"
                                disabled={isBusy}
                            />
                            {videoFile && <p className="text-xs text-muted-foreground truncate">Выбрано: {videoFile.name}</p>}
                        </div>

                        {/* Audio Input */}
                        <div className="space-y-2">
                            <Label htmlFor="audio-input" className="flex items-center gap-2 text-light-text">
                                <FaVolumeUp className="text-brand-orange"/> Аудио файл (.mp3, .ogg, .wav, .aac, .opus)
                            </Label>
                            <Input
                                id="audio-input"
                                type="file"
                                accept=".mp3,.ogg,.wav,.aac,.opus,audio/*"
                                onChange={(e) => { setAudioFile(e.target.files?.[0] || null); setOutputUrl(null); setStatus( prev => prev === 'error' || prev === 'done' ? 'idle' : prev); }}
                                className="text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-orange/80 file:text-white hover:file:bg-brand-orange"
                                disabled={isBusy}
                            />
                             {audioFile && <p className="text-xs text-muted-foreground truncate">Выбрано: {audioFile.name}</p>}
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center">
                        <Button
                            onClick={handleRemux}
                            disabled={!videoFile || !audioFile || isBusy}
                            size="lg"
                            className="bg-gradient-to-r from-brand-green via-brand-blue to-brand-purple text-black font-bold hover:scale-105 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3"
                        >
                            {isBusy ? <FaSpinner className="animate-spin mr-2" /> : <FaRocket className="mr-2"/>}
                            {status === 'loadingEngine' ? "Загрузка..." : status === 'reading' ? "Чтение..." : status === 'remuxing' ? "Склейка..." : "Создать Видео"}
                        </Button>
                    </div>

                     {/* Progress and Status */}
                     <div className="space-y-2 min-h-[40px]">
                        {(isBusy || status === 'done' || status === 'error') && (
                            <Progress value={progress} className="w-full [&>div]:bg-brand-green" />
                        )}
                        <p className={`text-center text-sm ${status === 'error' ? 'text-red-400' : status === 'done' ? 'text-brand-green' : 'text-muted-foreground'}`}>
                           {getStatusMessage()}
                        </p>
                    </div>

                     {/* Download Link */}
                    {outputUrl && status === 'done' && (
                        <div className="text-center mt-4 p-4 bg-green-900/30 border border-green-700 rounded-md">
                            <p className="text-lg font-semibold text-brand-green mb-2">Обработка завершена!</p>
                            <a
                                href={outputUrl}
                                download={outputFilename.current} // Use the stored filename
                                className="inline-flex items-center gap-2 px-6 py-2 bg-brand-green text-black rounded-md font-bold hover:bg-opacity-80 transition duration-300"
                            >
                                <FaDownloadIcon /> Скачать Результат
                            </a>
                        </div>
                    )}

                     {/* Link back */}
                     <div className='text-center mt-6'>
                        <Link href="/repo-xml" className="text-sm text-brand-blue hover:underline">
                            Вернуться в CyberVibe Studio
                        </Link>
                     </div>

                </CardContent>
            </Card>
        </div>
    );
}

export default VideoRemuxerPage;