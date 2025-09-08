[03:03:26.713] Running build in Washington, D.C., USA (East) – iad1
[03:03:26.713] Build machine configuration: 2 cores, 8 GB
[03:03:26.744] Cloning github.com/salavey13/carTest (Branch: feat/ai-1756917685542, Commit: ac3f107)
[03:03:30.138] Cloning completed: 3.394s
[03:03:34.526] Restored build cache from previous deployment (2yVKFJ8atPqHvxk2PCMaNi3DYp9G)
[03:03:35.466] Running "vercel build"
[03:03:36.031] Vercel CLI 47.0.5
[03:03:36.846] Running "install" command: `bun install`...
[03:03:36.883] bun install v1.2.21 (7c45ed97)
[03:03:36.909] [16.84ms] migrated lockfile from package-lock.json
[03:03:36.932] Resolving dependencies
[03:03:39.368] Resolved, downloaded and extracted [896]
[03:03:39.369] warn: incorrect peer dependency "embla-carousel@8.5.1"
[03:03:40.441] Saved lockfile
[03:03:40.441] 
[03:03:40.442] + docx@8.6.0 (v9.5.1 available)
[03:03:40.442] + lucide-react@0.542.0
[03:03:40.442] + react-icons@5.5.0
[03:03:40.442] 
[03:03:40.442] 62 packages installed [3.58s]
[03:03:40.442] Removed: 3
[03:03:40.452] Detected Next.js version: 14.2.28
[03:03:40.454] Running "bun run build"
[03:03:40.460] $ next build
[03:03:41.448]   ▲ Next.js 14.2.28
[03:03:41.449]   - Experiments (use with caution):
[03:03:41.450]     · webpackBuildWorker
[03:03:41.450]     · parallelServerCompiles
[03:03:41.450]     · parallelServerBuildTraces
[03:03:41.450] 
[03:03:41.525]    Creating an optimized production build ...
[03:04:04.406] Failed to compile.
[03:04:04.407] 
[03:04:04.407] ./app/wb/page.tsx
[03:04:04.407] Error: 
[03:04:04.407]   [31mx[0m Expression expected
[03:04:04.407]      ,-[[36;1;4m/vercel/path0/app/wb/page.tsx[0m:390:1]
[03:04:04.407]  [2m390[0m |     URL.revokeObjectURL(url);
[03:04:04.407]  [2m391[0m |     toast.success("CSV с изменениями скачан");
[03:04:04.407]  [2m392[0m |   };
[03:04:04.407]  [2m393[0m |     });
[03:04:04.407]      : [31;1m     ^[0m
[03:04:04.407]  [2m394[0m |     // локальный CSV и скачивание
[03:04:04.407]  [2m395[0m |     const csv = Papa.unparse(diffData);
[03:04:04.407]  [2m396[0m |     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
[03:04:04.407]      `----
[03:04:04.407] 
[03:04:04.407] Caused by:
[03:04:04.407]     Syntax Error
[03:04:04.407] 
[03:04:04.408] Import trace for requested module:
[03:04:04.408] ./app/wb/page.tsx
[03:04:04.408] 
[03:04:04.420] 
[03:04:04.421] > Build failed because of webpack errors
[03:04:04.659] error: script "build" exited with code 1
[03:04:04.678] Error: Command "bun run build" exited with 1```