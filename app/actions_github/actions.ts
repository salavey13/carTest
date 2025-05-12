"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins, notifyAdmin } from "@/app/actions";
// Используем стандартный console для логирования в server actions

// Интерфейсы
interface FileNode { path: string; content: string; }
interface GitTreeFile { path: string; sha: string; type: string; mode?: string; size?: number; url?: string; }
interface GitTreeResponseData { sha: string; url: string; tree: GitTreeFile[]; truncated: boolean; }
// Обновлен SimplePullRequest, чтобы включать больше полей, если они нужны, например, user.avatar_url
interface SimplePullRequest { 
    id: number; 
    number: number; 
    title: string; 
    html_url: string; 
    user?: { 
        login?: string | null; 
        avatar_url?: string | null; 
    } | null; 
    head: { ref: string }; 
    base: { ref: string }; 
    updated_at: string; 
}
interface ImageReplaceTask { targetPath: string; oldUrl: string; newUrl: string; } 

// --- Константы ---
const BATCH_SIZE = 40;
const DELAY_BETWEEN_BATCHES_MS = 600;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Улучшенная parseRepoUrl ---
function parseRepoUrl(repoUrl: string | null | undefined): { owner: string; repo: string } {
    if (!repoUrl || typeof repoUrl !== 'string') {
        console.error("[Action parseRepoUrl] Invalid GitHub URL: URL is empty or not a string. Provided:", repoUrl);
        throw new Error("Invalid GitHub URL: URL is empty or not a string.");
    }
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?\/?$/);
    if (!match || !match[1] || !match[2]) {
        console.error("[Action parseRepoUrl] Failed to parse GitHub URL with regex. URL:", repoUrl); 
        throw new Error(`Invalid GitHub URL format: ${repoUrl}`);
    }
    return { owner: match[1], repo: match[2] };
}


interface PrCheckResult {
    exists: boolean;
    prNumber?: number;
    prUrl?: string;
    branchName?: string; 
}

export async function checkExistingPrBranch(
    repoUrl: string,
    potentialBranchName: string
): Promise<{ success: boolean; data?: PrCheckResult; error?: string }> {
    let owner: string | undefined, repo: string | undefined;
    try {
        const repoInfo = parseRepoUrl(repoUrl);
        owner = repoInfo.owner;
        repo = repoInfo.repo;
        const rId = `${owner}/${repo}`;
        console.log(`[Action checkExistingPrBranch] Checking for existing PR with head branch '${potentialBranchName}' in ${rId}`);

        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error("GitHub token is missing.");
        const octokit = new Octokit({ auth: token });

        const { data: existingPrs } = await octokit.pulls.list({
            owner,
            repo,
            state: 'open',
            head: `${owner}:${potentialBranchName}`, 
        });

        if (existingPrs.length > 0) {
            const pr = existingPrs[0]; 
            console.log(`[Action checkExistingPrBranch] Found existing open PR #${pr.number} for branch '${potentialBranchName}'.`);
            return {
                success: true,
                data: {
                    exists: true,
                    prNumber: pr.number,
                    prUrl: pr.html_url,
                    branchName: potentialBranchName 
                }
            };
        } else {
            console.log(`[Action checkExistingPrBranch] No existing open PR found for branch '${potentialBranchName}'.`);
            return { success: true, data: { exists: false, branchName: potentialBranchName } };
        }

    } catch (error: any) {
        const repoId = owner && repo ? `${owner}/${repo}` : repoUrl;
        console.error(`[Action checkExistingPrBranch] Error checking for PR branch '${potentialBranchName}' in ${repoId}:`, error);
        let eM = error instanceof Error ? error.message : "Failed to check for existing PR";
        if (error.status === 404) { eM = `Repo ${repoId} not found (${error.status}).`; }
        else if (error.status === 403) { eM = `Permission denied (${error.status}) checking PRs for ${repoId}.`; }
        return { success: false, error: eM };
    }
}

// --- fetchRepoContents ---
// Сигнатура соответствует: repoUrl, branchName?, customToken?, imageTask?
export async function fetchRepoContents(
    repoUrl: string, 
    branchName?: string | null, 
    customToken?: string,
    imageTask?: ImageReplaceTask | null 
) {
  console.log(`[Action fetchRepoContents ENTRY] Fetching: ${repoUrl}, Branch: ${branchName ?? 'default'}, Token Provided: ${!!customToken}, ImageTask: ${!!imageTask}`);
  const startTime = Date.now(); 
  let owner: string | undefined, repo: string | undefined; 
  let targetBranch = branchName; 
  let isDefaultFetched = false;

  try {
    const token = customToken || process.env.GITHUB_TOKEN; 
    if (!token) {
        console.error("[Action fetchRepoContents] GitHub token is missing. Neither customToken nor process.env.GITHUB_TOKEN are set.");
        throw new Error("GitHub token is missing.");
    }
    const repoInfo = parseRepoUrl(repoUrl); 
    owner = repoInfo.owner; 
    repo = repoInfo.repo;
    console.log(`[Action fetchRepoContents PARSED] Owner: "${owner}", Repo: "${repo}" from URL: "${repoUrl}"`);

    if (!owner || !repo) { 
        console.error(`[Action fetchRepoContents] CRITICAL: Owner or Repo is undefined after parsing. Owner: "${owner}", Repo: "${repo}"`);
        throw new Error(`Critical error: Owner or Repo is undefined after parsing URL "${repoUrl}".`);
    }

    const octokit = new Octokit({ auth: token });
    
    const allowedRootFiles = new Set(['package.json','tailwind.config.ts','tsconfig.json','next.config.js','next.config.mjs','vite.config.ts','vite.config.js','README.md','seed.sql']); const allowedPrefixes = ['app/','src/','components/','contexts/','hooks/','lib/','styles/','types/','utils/','data/']; const excludedExactPaths = new Set([]); const excludedPrefixes = ['.git/','node_modules/','.next/','dist/','build/','out/','public/','supabase/migrations/','Configame/','components/ui/','.vscode/','.idea/','coverage/','storybook-static/','docs/','examples/','test/','tests/','__tests__/','cypress/','prisma/migrations/','assets/','static/','images/']; const excludedExtensions = ['.pl','.json','.png','.jpg','.jpeg','.gif','.svg','.ico','.webp','.avif','.mp4','.webm','.mov','.mp3','.wav','.ogg','.pdf','.woff','.woff2','.ttf','.otf','.eot','.zip','.gz','.tar','.rar','.env','.lock','.log','.DS_Store','.md','.csv','.xlsx','.xls','.yaml','.yml','.bak','.tmp','.swp','.map','.dll','.exe','.so','.dylib'];
    
    if (!targetBranch || targetBranch === 'default') {
        console.log(`[Action fetchRepoContents] Branch not specified or 'default'. Attempting to fetch repo info for default branch for ${owner}/${repo}.`);
        try { 
            const { data: repoData } = await octokit.repos.get({ owner, repo }); 
            targetBranch = repoData.default_branch; 
            isDefaultFetched = true; 
            console.log(`[Action fetchRepoContents] Default branch determined via repos.get for ${owner}/${repo}: ${targetBranch}`); 
        }
        catch (repoGetError: any) { 
            console.error(`[Action fetchRepoContents] Failed to get default branch via repos.get for ${owner}/${repo}:`, repoGetError); 
            if (repoGetError.status === 403 && repoGetError.message?.includes('rate limit')) { 
                await notifyAdmin(`⏳ Rate Limit getting default branch ${owner}/${repo}.`); 
                throw new Error("API rate limit hit checking default branch."); 
            } 
            if (!branchName && !targetBranch) { 
                 throw new Error(`Failed determine default branch for ${owner}/${repo}: ${repoGetError.message}`); 
            }
            targetBranch = targetBranch || 'default'; 
            console.warn(`[Action fetchRepoContents] Failed to determine default branch, proceeding with '${targetBranch}' for ${owner}/${repo}.`);
        }
    } else { 
        console.log(`[Action fetchRepoContents] Using specified branch: ${targetBranch} for ${owner}/${repo}`); 
    }

    if (!targetBranch) { 
        console.error("[Action fetchRepoContents] CRITICAL: Target branch is still undetermined after attempting to find default.");
        throw new Error("Target branch could not be determined."); 
    }

    let latestCommitSha: string; console.log(`[Action fetchRepoContents] Fetching ref/commit for branch: ${targetBranch} in ${owner}/${repo}...`);
    try { 
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` }); 
        latestCommitSha = refData.object.sha; 
        console.log(`[Action fetchRepoContents] SHA for branch '${targetBranch}' via getRef: ${latestCommitSha}`); 
    }
    catch (refError: any) { 
        if (refError.status === 404) { 
            console.warn(`[Action fetchRepoContents] getRef returned 404 for 'heads/${targetBranch}'. Trying getCommit as fallback...`); 
            try { 
                const { data: commitDataFallback } = await octokit.repos.getCommit({ owner, repo, ref: targetBranch }); 
                latestCommitSha = commitDataFallback.sha; 
                console.log(`[Action fetchRepoContents] SHA for branch '${targetBranch}' via getCommit fallback: ${latestCommitSha}`); 
            } catch (commitError: any) { 
                console.error(`[Action fetchRepoContents] All attempts to get SHA for branch '${targetBranch}' failed.`, commitError); 
                const bType = isDefaultFetched ? "default branch" : "branch"; 
                throw new Error(`Cannot find ${bType} '${targetBranch}' in ${owner}/${repo} (404).`); 
            } 
        } else if (refError.status === 403 && refError.message?.includes('rate limit')) { 
            await notifyAdmin(`⏳ Rate Limit during getRef for ${owner}/${repo} @ ${targetBranch}.`); 
            throw new Error("API rate limit hit fetching branch details."); 
        } else { 
            console.error(`[Action fetchRepoContents] Failed getRef for ${targetBranch}:`, refError); 
            throw new Error(`Failed to get git ref for branch ${targetBranch}: ${refError.message}`); 
        } 
    }
    
    const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha }); 
    const treeSha = commitData.tree.sha; 
    console.log(`[Action fetchRepoContents] Tree SHA: ${treeSha}. Fetching tree recursively...`); 
    let treeData: GitTreeResponseData;
    try { 
        const res = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: '1' }); 
        treeData = res.data as GitTreeResponseData; 
        if (treeData?.truncated) { 
            console.warn("[Action fetchRepoContents] Tree data was truncated by GitHub API."); 
            await notifyAdmin(`⚠️ Tree data truncated for ${owner}/${repo} @ ${targetBranch}. Some files might be missing.`); 
        } 
        if (!treeData || !Array.isArray(treeData.tree)) { 
            console.error("[Action fetchRepoContents] Invalid tree structure received from GitHub:", treeData); 
            throw new Error(`Invalid tree structure received for ${owner}/${repo} @ ${targetBranch}.`); 
        } 
        console.log(`[Action fetchRepoContents] Tree received with ${treeData.tree.length} items. Filtering files...`); 
    } catch (treeError: any) { 
        console.error(`[Action fetchRepoContents] getTree API call failed for ${treeSha}:`, treeError); 
        throw new Error(`Failed to get tree data: ${treeError.message || treeError}`); 
    }
    
    let filesToFetch = treeData.tree.filter((item): item is GitTreeFile => { if(item.type!=='blob'||!item.path||!item.sha) return false; const pL=item.path.toLowerCase(); if(excludedExactPaths.has(item.path)) return false; if(excludedPrefixes.some(p=>pL.startsWith(p))) return false; if(excludedExtensions.some(e=>pL.endsWith(e))) return item.path==='README.md'||allowedRootFiles.has(item.path); if(allowedRootFiles.has(item.path)) return true; if(allowedPrefixes.some(p=>pL.startsWith(p))) return true; return false; });
    console.log(`[Action fetchRepoContents] Filtered down to ${filesToFetch.length} files to fetch content for.`);
    
    const MAX_FILES_TO_FETCH = 500; 
    if (filesToFetch.length > MAX_FILES_TO_FETCH) { 
        console.warn(`[Action fetchRepoContents] File count (${filesToFetch.length}) exceeds limit (${MAX_FILES_TO_FETCH}). Truncating list.`); 
        await notifyAdmin(`⚠️ High file count (${filesToFetch.length}) for ${owner}/${repo} @ ${targetBranch}. List was truncated to ${MAX_FILES_TO_FETCH}.`); 
        filesToFetch = filesToFetch.slice(0, MAX_FILES_TO_FETCH); 
    }
    
    const allFiles: FileNode[] = []; 
    const totalFiles = filesToFetch.length; 
    if (totalFiles === 0) { 
        console.warn("[Action fetchRepoContents] No relevant files found after filtering."); 
        return { success: true, files: [] }; 
    }
    console.log(`[Action fetchRepoContents] Starting content fetching loop for ${totalFiles} files...`);
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) { 
        const bF = filesToFetch.slice(i, i + BATCH_SIZE); 
        const bN = Math.floor(i / BATCH_SIZE) + 1; 
        const tB = Math.ceil(totalFiles / BATCH_SIZE); 
        console.log(`[Action fetchRepoContents] Processing Batch ${bN}/${tB}...`); 
        const bP = bF.map(async (fI) => { 
            try { 
                const { data: bD } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fI.sha }); 
                if (typeof bD.content !== 'string' || typeof bD.encoding !== 'string') { console.warn(`[Action fetchRepoContents] Invalid blob data for ${fI.path}. Skipping.`); return null; } 
                let cnt: string; 
                if (bD.encoding === 'base64') { cnt = Buffer.from(bD.content, 'base64').toString('utf-8'); } 
                else if (bD.encoding === 'utf-8') { cnt = bD.content; } 
                else { console.warn(`[Action fetchRepoContents] Unsupported encoding '${bD.encoding}' for file ${fI.path}. Skipping.`); return null; } 
                const MAX_BYTES = 750*1024; 
                if (Buffer.byteLength(cnt, 'utf8') > MAX_BYTES) { console.warn(`[Action fetchRepoContents] Skipping large file (${(Buffer.byteLength(cnt,'utf8')/1024).toFixed(0)} KB): ${fI.path}`); return null; } 
                let pC: string; const fE=fI.path.split('.').pop()?.toLowerCase()||''; switch(fE){ case 'ts':case 'tsx':case 'js':case 'jsx':pC=`// /${fI.path}`;break; case 'css':case 'scss':pC=`/* /${fI.path} */`;break; case 'sql':pC=`-- /${fI.path}`;break; case 'py':case 'rb':case 'sh':case 'yml':case 'yaml':case 'env':pC=`# /${fI.path}`;break; case 'html':case 'xml':case 'vue':case 'svelte':pC=`<!-- /${fI.path} -->`;break; case 'md':pC=`<!-- /${fI.path} -->`;break; default:pC=`// /${fI.path}`; } if(cnt.trim()&&!cnt.trimStart().startsWith(pC)){cnt=`${pC}\n${cnt}`;}else if(!cnt.trim()){cnt=pC;}
                return { path: fI.path, content: cnt }; 
            } catch (fE: any) { 
                console.error(`[Action fetchRepoContents] Error fetching blob content for ${fI.path}:`, fE.status?`${fE.message} (${fE.status})`:fE); return null; 
            } 
        }); 
        const bR = await Promise.all(bP); 
        const vR = bR.filter((r): r is FileNode => r !== null); 
        allFiles.push(...vR); 
        if (vR.length < bR.length) { console.warn(`[Action fetchRepoContents] ${bR.length - vR.length} files in batch ${bN} failed or were skipped.`); } 
        if (i + BATCH_SIZE < totalFiles) { console.log(`[Action fetchRepoContents] Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`); await delay(DELAY_BETWEEN_BATCHES_MS); } 
    }
    
    const endTime = Date.now(); 
    console.log(`[Action fetchRepoContents] Successfully fetched ${allFiles.length} files from branch '${targetBranch}' in ${((endTime-startTime)/1000).toFixed(1)}s.`); 
    return { success: true, files: allFiles };
  } catch (error: any) {
    const endTime=Date.now(); 
    const repoId=owner&&repo?`${owner}/${repo}`:repoUrl; 
    const bInfo=targetBranch?` on branch '${targetBranch}'`:' (default branch determination)'; 
    console.error(`[Action fetchRepoContents] CRITICAL Error fetching from ${repoId}${bInfo}:`,error);
    
    let eM = error instanceof Error ? error.message : "Unknown error during file fetching";
    const status = error.status ? ` (${error.status})` : '';

    if(error.status===403&&error.message?.includes('rate limit')){await notifyAdmin(`⏳ Rate Limit for ${repoId}${bInfo}.`); eM = `GitHub API rate limit exceeded${status}.`;}
    else if(error.status===404||error.message?.includes('not found')){await notifyAdmin(`❌ 404 Not Found for ${repoId}${bInfo}.`); eM = `Repo, branch, or resource not found${status}.`;}
    else if(error.status===401||error.status===403){await notifyAdmin(`❌ Auth Error (${error.status}) for ${repoId}${bInfo}.`); eM = `GitHub Auth error${status}. Check token permissions.`;}
    else if(error.message?.startsWith('Too many files')){await notifyAdmin(`❌ Too many files reported by GitHub API for ${repoId}${bInfo}.`); eM = error.message;}
    else { await notifyAdmin(`❌ Ошибка извлечения файлов из ${repoId}${bInfo}:\n${eM}`); }
    
    return {success:false, error: eM};
  }
}

export async function createGitHubPullRequest( repoUrl: string, files: FileNode[], prTitle: string, prDescription: string, commitMessage: string, branchName?: string ) {
  console.log("[Action] createGitHubPullRequest called..."); let owner: string|undefined, repo: string|undefined, baseBranch: string|undefined;
  try {
    const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GH token missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token }); const { data: repoData } = await octokit.repos.get({ owner, repo }); baseBranch = repoData.default_branch;
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` }); const baseSha = refData.object.sha;
    const MAX_BYTES=65000; let finalCommitMsg=commitMessage, finalPrDesc=prDescription; const enc=new TextEncoder();
    if(enc.encode(finalCommitMsg).length>MAX_BYTES){ try { finalCommitMsg=finalCommitMsg.substring(0,60000)+"...(trunc)"; } catch(e){console.warn("[Action] Commit msg trunc failed."); finalCommitMsg="Commit message truncated.";} console.warn(`[Action] Commit msg trunc.`);}
    if(enc.encode(finalPrDesc).length>MAX_BYTES){ try { finalPrDesc=finalPrDesc.substring(0,60000)+"\n\n...(trunc)"; } catch(e){console.warn("[Action] PR desc trunc failed."); finalPrDesc="PR description truncated.";} console.warn(`[Action] PR desc trunc.`);}
    const newBranch = branchName || `ai-patch-${Date.now()}`; let branchExists=false; let existingHeadSha:string|null=null;
    try { const { data: eRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${newBranch}` }); branchExists = true; existingHeadSha = eRef.object.sha; console.warn(`[Action] Branch '${newBranch}' exists (SHA: ${existingHeadSha}). Updating.`); }
    catch (error: any) { if (error.status === 404) { console.log(`[Action] Branch '${newBranch}' not found. Creating...`); branchExists = false; } else { throw error; } }
    if (!branchExists) { console.log(`[Action] Creating NEW branch '${newBranch}' from ${baseBranch} (SHA: ${baseSha})`); await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: baseSha }); console.log(`[Action] Branch '${newBranch}' created.`); }
    const baseTreeSha = branchExists && existingHeadSha ? (await octokit.git.getCommit({ owner, repo, commit_sha: existingHeadSha })).data.tree.sha : (await octokit.git.getCommit({ owner, repo, commit_sha: baseSha })).data.tree.sha;
    console.log(`[Action] Base tree SHA: ${baseTreeSha}. Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (f) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: f.content, encoding: "utf-8" }); return { path: f.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (e: any) { throw new Error(`Fail blob ${f.path}: ${e.message||e}`); } }) );
    console.log("[Action] Blobs created. Creating tree..."); const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTreeSha, tree }); console.log(`[Action] New tree: ${newTree.sha}. Creating commit...`);
    const parentSha = branchExists ? existingHeadSha! : baseSha; const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMsg, tree: newTree.sha, parents: [parentSha] }); console.log(`[Action] New commit: ${newCommit.sha}. Updating ref...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${newBranch}`, sha: newCommit.sha, force: false }); console.log(`[Action] Ref heads/${newBranch} updated.`);
    let prNumber: number|undefined; let prUrl: string|undefined; const { data: existingPrs } = await octokit.pulls.list({ owner, repo, head: `${owner}:${newBranch}`, state: 'open' });
    if (existingPrs.length > 0) { prNumber = existingPrs[0].number; prUrl = existingPrs[0].html_url; console.log(`[Action] Found existing PR #${prNumber}.`); const adminMsg = `🔄 PR #${prNumber} в ${owner}/${repo} обновлен.\nCommit: ${finalCommitMsg.split('\n')[0]}\n\n[Посмотреть](${prUrl})`; await notifyAdmins(adminMsg); }
    else if (!branchExists) { console.log(`[Action] Creating PR: '${prTitle}'...`); const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDesc, head: newBranch, base: baseBranch }); prNumber = pr.number; prUrl = pr.html_url; console.log(`[Action] PR created: ${prUrl}`); const chFiles = files.map((f) => f.path).join(", "); const adminMsg = `🔔 Создан PR #${prNumber} в ${owner}/${repo}\n${prTitle}\n${chFiles}\n\n[GitHub](${prUrl})`; await notifyAdmins(adminMsg); }
    else { console.warn(`[Action] Branch '${newBranch}' updated, no open PR found.`); const chFiles = files.map((f) => f.path).join(", "); const bUrl = `https://github.com/${owner}/${repo}/tree/${newBranch}`; const adminMsg = `🔄 Ветка '${newBranch}' обновлена (PR не найден).\n${finalCommitMsg.split('\n')[0]}\n${chFiles}\n\n[Ветка](${bUrl})`; await notifyAdmins(adminMsg); }
    return { success: true, prUrl, branch: newBranch, prNumber };
  } catch (error: any) { console.error("[Action] Error create/update PR:", error); const repoId=`${owner}/${repo}`; const aB=branchName||`ai-patch-...`; let eM=error instanceof Error?error.message:"Unknown error"; if(error.status===422&&error.message?.includes("No commit")){eM=`Base branch '${baseBranch||'?'}' empty?`;} else if(error.status===404){eM=`Repo ${repoId} or base '${baseBranch||'?'}' not found.`;} else if(error.status===403){eM=`Permission denied ${repoId}.`;} else if(error.status===409&&error.message?.includes('conflict')){eM=`Update conflict branch '${aB}'.`;} await notifyAdmin(`❌ Ошибка PR ${repoId}:\n${eM}`); return {success:false, error:eM}; }
}

export async function updateBranch(
    repoUrl: string,
    files: FileNode[],
    commitMessage: string,
    branchName: string,
    prNumberToComment?: number | null,
    commentBody?: string | null
) {
    let owner: string | undefined, repo: string | undefined;
    const rIP = parseRepoUrl(repoUrl);
    owner = rIP.owner; repo = rIP.repo;
    const rId = `${owner}/${repo}`;
    console.log(`[Action] updateBranch '${branchName}' PR#: ${prNumberToComment ?? 'N/A'}. Comment body provided: ${!!commentBody}`); 

    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error("Token missing");
        if (!branchName) throw new Error("Branch required");
        const octokit = new Octokit({ auth: token });

        console.log(`[Action] Get HEAD ${branchName}...`);
        let baseSha: string;
        try {
            const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
            baseSha = refData.object.sha;
            console.log(`[Action] HEAD ${branchName}: ${baseSha}`);
        } catch (refError: any) {
            if (refError.status === 404) { console.error(`[Action] Branch '${branchName}' not found.`); throw new Error(`Branch '${branchName}' not found.`); }
            console.error(`[Action] Failed get ref ${branchName}:`, refError); throw new Error(`Failed get ref ${branchName}: ${refError.message}`);
        }

        const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
        const baseTree = baseCommitData.tree.sha;
        console.log(`[Action] Base tree ${baseSha}: ${baseTree}`);

        const MAX_BYTES = 65000;
        let finalMsg = commitMessage;
        const enc = new TextEncoder();
        if (enc.encode(finalMsg).length > MAX_BYTES) {
             try { finalMsg = finalMsg.substring(0, 60000) + "..."; } catch(e){console.warn("[Action] Commit msg substring failed."); finalMsg="Commit message truncated.";}
             console.warn(`[Action] Commit msg trunc.`);
        }

        console.log(`[Action] Creating ${files.length} blobs...`);
        const tree = await Promise.all(files.map(async (f) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: f.content, encoding: "utf-8" }); return { path: f.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (bE: any) { console.error(`[Action] Err blob ${f.path}:`, bE); throw new Error(`Failed blob ${f.path}: ${bE.message || bE}`); } }));
        console.log("[Action] Blobs done.");

        console.log(`[Action] Creating tree base ${baseTree}...`);
        const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
        console.log(`[Action] New tree: ${newTree.sha}`);

        console.log(`[Action] Creating commit tree ${newTree.sha}...`);
        const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalMsg, tree: newTree.sha, parents: [baseSha] });
        console.log(`[Action] New commit: ${newCommit.sha}`);

        console.log(`[Action] Updating ref heads/${branchName} to ${newCommit.sha}...`);
        await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: newCommit.sha, force: false });
        console.log(`[Action] Ref heads/${branchName} updated.`);

        if (prNumberToComment && commentBody) {
            const safeBodyStart = commentBody.substring(0, 100);
            console.log(`[Action] Attempting to add comment to PR #${prNumberToComment}. Body length: ${commentBody.length}. Body starts: "${safeBodyStart}..."`);
            try {
                let finalComment = commentBody;
                if (enc.encode(finalComment).length > MAX_BYTES) {
                    try { finalComment = finalComment.substring(0, 60000) + "\n\n...(truncated)"; } catch(e){console.warn("[Action] Comment body substring failed."); finalComment="Comment truncated.";}
                    console.warn(`[Action] Comment body for PR #${prNumberToComment} truncated.`);
                }
                await octokit.issues.createComment({
                    owner: owner!,
                    repo: repo!,
                    issue_number: prNumberToComment,
                    body: finalComment
                });
                console.log(`[Action] Comment successfully added to PR #${prNumberToComment}.`);
            } catch (cE: any) {
                console.error(`[Action] FAILED to add comment to PR #${prNumberToComment}:`, cE);
                const status = cE.status ? ` (${cE.status})` : '';
                let specificError = cE.message || 'Unknown error';
                if (cE.status === 403) { specificError += ' Check Token permissions (issues:write or pull_requests:write scope required)!'; }
                else if (cE.status === 404) { specificError += ` PR #${prNumberToComment} not found or token lacks permission.`; } 
                else if (cE.status === 422) { specificError += ` Unprocessable Entity (maybe comment format?).`; }
                else if (cE.status === 401) { specificError += ' Bad credentials (invalid token?).'; }
                await notifyAdmin(`⚠️ Не удалось добавить коммент к PR #${prNumberToComment}${status}:\n${specificError}`);
            }
        } else {
            if (!prNumberToComment) console.log(`[Action] Skip comment: no PR number provided.`);
            if (!commentBody) console.log(`[Action] Skip comment: no comment body provided.`);
        }
        
        const chFiles = files.map((f) => f.path).join(", ");
        const bUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`;
        const adminMsg = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalMsg.split('\n')[0]}\nFiles: ${chFiles}\n\n[Ветка](${bUrl})`;
        await notifyAdmins(adminMsg);
        return { success: true, commitSha: newCommit.sha, branch: branchName };
    } catch (error: any) {
        console.error(`[Action] Error update branch ${branchName}:`, error);
        let eM = error instanceof Error ? error.message : `Unknown error update ${branchName}`;
        if (error.status === 404) eM = `Repo/branch ${branchName} not found (404).`;
        else if (error.status === 403) eM = `Permission denied (403) update ${branchName}.`;
        else if (error.status === 409) eM = `Conflict update ${branchName} (409).`;
        else if (error.status === 422) eM = `Unprocessable (422) update ${branchName}: ${error.message}`;
        await notifyAdmin(`❌ Ошибка обновления '${branchName}':\n${eM}`);
        return { success: false, error: eM };
    }
}

export async function revertLastCommitOnBranch(repoUrl: string, branchName: string): Promise<{ success: boolean; revertedToSha?: string; error?: string }> {
    console.log(`[Action] Reverting last commit on branch '${branchName}'...`);
    let owner: string | undefined, repo: string | undefined;
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error("GitHub token is missing in environment variables.");
        if (!branchName) throw new Error("Branch name is required to revert commit.");

        const repoInfo = parseRepoUrl(repoUrl);
        owner = repoInfo.owner;
        repo = repoInfo.repo;
        const rId = `${owner}/${repo}`;
        const octokit = new Octokit({ auth: token });

        let headSha: string;
        try {
            const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
            headSha = refData.object.sha;
            console.log(`[Action] Current HEAD of '${branchName}' is ${headSha}`);
        } catch (refError: any) {
            if (refError.status === 404) { throw new Error(`Branch '${branchName}' not found.`); }
            console.error(`[Action] Failed get ref ${branchName}:`, refError);
            throw new Error(`Failed to get ref for branch '${branchName}': ${refError.message}`);
        }

        let parentSha: string;
        try {
            const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: headSha });
            if (!commitData.parents || commitData.parents.length === 0) {
                throw new Error(`Commit ${headSha} on branch '${branchName}' has no parents (initial commit?). Cannot revert.`);
            }
            parentSha = commitData.parents[0].sha;
            console.log(`[Action] Parent commit SHA for '${branchName}' is ${parentSha}`);
        } catch (commitError: any) {
            console.error(`[Action] Failed get commit data ${headSha}:`, commitError);
            throw new Error(`Failed to get commit data for ${headSha}: ${commitError.message}`);
        }

        console.log(`[Action] Updating ref heads/${branchName} to parent SHA ${parentSha} (force=true)...`);
        await octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${branchName}`,
            sha: parentSha,
            force: true 
        });
        console.log(`[Action] Successfully reverted branch '${branchName}' to commit ${parentSha}.`);

        const adminMsg = `⏪ Откат последнего коммита на ветке '${branchName}' в ${rId} к ${parentSha.substring(0,7)}.`;
        await notifyAdmins(adminMsg);

        return { success: true, revertedToSha: parentSha };

    } catch (error: any) {
        console.error(`[Action] Error reverting last commit on branch '${branchName}':`, error);
        const repoId = owner && repo ? `${owner}/${repo}` : repoUrl;
        let eM = error instanceof Error ? error.message : "Unknown error during revert.";
        if (error.status === 404) { eM = `Repo ${repoId} or branch '${branchName}' not found (404).`; }
        else if (error.status === 403) { eM = `Permission denied (403) for reverting on ${repoId}/${branchName}. Check token permissions (repo scope).`; }
        else if (error.status === 422) { eM = `Unprocessable Entity (422) during revert on ${branchName}. Protected branch?`; } 
        await notifyAdmin(`❌ Ошибка отката коммита на '${branchName}' в ${repoId}:\n${eM}`);
        return { success: false, error: eM };
    }
}

export async function deleteGitHubBranch(repoUrl: string, branchName: string) { console.log("[Action] deleteGitHubBranch called..."); let owner: string|undefined; let repo: string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GH token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting delete branch 'refs/heads/${branchName}' in ${rId}...`); await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` }); console.log(`[Action] Delete request sent for ${branchName}. Verifying...`); await delay(2000); try { await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` }); console.error(`[Action] Verification failed: ${branchName} still exists.`); await notifyAdmin(`⚠️ Не удалось подтвердить удаление ${branchName}.`); return { success: false, error: "Branch delete verification failed." }; } catch (err: any) { if (err.status === 404) { console.log(`[Action] Verification ok: ${branchName} deleted.`); return { success: true }; } console.error(`[Action] Error during delete verification ${branchName}:`, err); await notifyAdmin(`⚠️ Ошибка проверки удаления ${branchName} (${err.status}): ${err.message}.`); return { success: true, warning: "Delete OK, check failed." }; } } catch (error: any) { console.error(`[Action] Error deleting branch ${branchName}:`, error); let eM = error instanceof Error ? error.message : "Failed delete"; if (error.status === 404 || error.status === 422) { eM = `Branch '${branchName}' not found/unprocessable (${error.status}).`; console.warn(`[Action] ${eM}`); } else if (error.status === 403) { eM = `Permission denied (403) deleting ${branchName}.`; console.error(`[Action] ${eM}`); } await notifyAdmin(`❌ Ошибка удаления ${branchName}:\n${eM}`); return { success: false, error: eM }; } }

export async function mergePullRequest(repoUrl: string, pullNumber: number) { console.log("[Action] mergePullRequest called..."); let owner: string|undefined; let repo: string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({auth:token}); console.log(`[Action] Merging PR #${pullNumber} in ${rId}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state !== 'open') { console.warn(`[Action] PR #${pullNumber} not open (${prData.state}).`); throw new Error(`PR #${pullNumber} not open (${prData.state}).`); } if (prData.merged) { console.warn(`[Action] PR #${pullNumber} already merged.`); return { success: true, message: "PR already merged." }; } if (!prData.mergeable) { console.warn(`[Action] PR #${pullNumber} not mergeable (${prData.mergeable_state}). Check delay...`); await delay(2000); const { data: prUpd } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (!prUpd.mergeable) { console.error(`[Action] PR #${pullNumber} still not mergeable (${prUpd.mergeable_state}).`); throw new Error(`PR #${pullNumber} not mergeable (${prUpd.mergeable_state}).`); } console.log(`[Action] PR #${pullNumber} became mergeable.`); } await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" }); console.log(`[Action] PR #${pullNumber} merged in ${rId}.`); const adminMsg = `🚀 Изменения #${pullNumber} в ${rId} смержены!\n\n[GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`; await notifyAdmins(adminMsg); return { success: true }; } catch (error: any) { console.error(`[Action] Merge fail PR #${pullNumber} in ${rId}:`, error); let eM = error instanceof Error ? error.message : "Merge failed"; if (error.status === 405) { eM = `PR #${pullNumber} not mergeable (405).`; console.error(`[Action] ${eM}`, error.response?.data); } else if (error.status === 404) { eM = `PR #${pullNumber} not found (404).`; console.error(`[Action] ${eM}`); } else if (error.status === 403) { eM = `Permission denied (403) merge PR #${pullNumber}.`; console.error(`[Action] ${eM}`); } else if (error.status === 409) { eM = `Merge conflict PR #${pullNumber} (409).`; console.error(`[Action] ${eM}`); } await notifyAdmin(`❌ Ошибка мержа PR #${pullNumber} в ${rId}:\n${eM}`); return { success: false, error: eM }; } }

export async function getOpenPullRequests(repoUrl: string): Promise<{ success: boolean; pullRequests?: SimplePullRequest[]; error?: string }> {
    let owner: string | undefined, repo: string | undefined;
    try {
        const repoInfo = parseRepoUrl(repoUrl); 
        owner = repoInfo.owner;
        repo = repoInfo.repo;
        const rId = `${owner}/${repo}`;

        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error("GH token missing");
        const octokit = new Octokit({ auth: token });
        console.log(`[Action getOpenPullRequests] Fetching open PRs for ${rId}...`); 
        const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
        const cleanData: SimplePullRequest[] = data.map(pr => ({
            id: pr.id,
            number: pr.number,
            title: pr.title || 'Untitled',
            html_url: pr.html_url || '#',
            user: pr.user ? { login: pr.user.login, avatar_url: pr.user.avatar_url } : undefined,
            head: { ref: pr.head?.ref || 'unknown' },
            base: { ref: pr.base?.ref || 'unknown' }, 
            updated_at: pr.updated_at || new Date().toISOString(),
        }));
        console.log(`[Action getOpenPullRequests] Found ${cleanData.length} open PRs for ${rId}.`); 
        return { success: true, pullRequests: cleanData };
    } catch (error: any) {
        const repoId = owner && repo ? `${owner}/${repo}` : repoUrl; 
        console.error(`[Action getOpenPullRequests] CRITICAL Error fetch PRs ${repoId}:`, error); 
        let eM = error instanceof Error ? error.message : "Failed fetch PRs";
        const status = error.status ? ` (${error.status})` : '';

        if (error.message.startsWith("Invalid GitHub URL")) { 
            eM = error.message; 
        } else if (error.status === 404) {
            eM = `Repo ${repoId} not found${status}.`;
            await notifyAdmin(`❌ Ошибка 404 при получении PR ${repoId}. Проверь URL/доступ.`);
        } else if (error.status === 403) {
            eM = `Permission denied${status} fetch PRs ${repoId}. Проверь права токена.`;
            await notifyAdmin(`❌ Ошибка 403 при получении PR ${repoId}. Проверь права токена.`);
        } else if (error.status === 401) {
             eM = `Bad credentials${status} fetch PRs ${repoId}. Токен невалиден?`;
             await notifyAdmin(`❌ Ошибка 401 при получении PR ${repoId}. Токен невалиден?`);
        } else if (error.message?.includes('rate limit')) { 
             eM = `GitHub API rate limit exceeded${status} fetch PRs ${repoId}.`;
             await notifyAdmin(`⏳ Rate Limit при получении PR ${repoId}.`);
        } else {
            await notifyAdmin(`❌ Неизвестная ошибка (${status || 'N/A'}) при получении PR ${repoId}:\n${eM}`);
            console.error(`[Action getOpenPullRequests] Non-critical/Unknown error fetch PRs ${repoId}: Status=${status}`, error);
        }
        return { success: false, error: eM };
    }
}

export async function getGitHubUserProfile(username: string) { try { const token=process.env.GITHUB_TOKEN; const octokit=new Octokit({auth:token}); const {data:userProfile}=await octokit.users.getByUsername({username}); return { success: true, profile:{ login:userProfile.login, avatar_url:userProfile.avatar_url, html_url:userProfile.html_url, name:userProfile.name, }, }; } catch (error: any) { if (error.status===404){ console.log(`[Action] User '${username}' not found.`); return { success:false, error:"User not found.", profile:null }; } console.error(`[Action] Error fetch profile ${username}:`, error); return { success:false, error:error instanceof Error?error.message:"Failed fetch profile", profile:null }; } }

export async function approvePullRequest(repoUrl: string, pullNumber: number) { console.log("[Action] approvePullRequest called..."); let owner:string|undefined; let repo:string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({auth:token}); console.log(`[Action] Approving PR #${pullNumber} in ${rId}...`); await octokit.pulls.createReview({owner,repo,pull_number:pullNumber,event:"APPROVE",body:"Approved."}); console.log(`[Action] PR #${pullNumber} approved in ${rId}.`); return {success:true}; } catch (error: any) { console.error(`[Action] Approve failed PR #${pullNumber} in ${rId}:`, error); let eM = error instanceof Error ? error.message : "Approve fail"; if(error.status===404){eM=`PR #${pullNumber} not found (404).`;} else if(error.status===403){eM=`Permission denied (403) approving PR #${pullNumber}.`;} else if(error.status===422&&error.message?.includes("review cannot be submitted")){console.warn(`[Action] Cannot approve PR #${pullNumber}: ${error.message}`); eM=`Cannot approve PR #${pullNumber}: ${error.message}`; return {success:false, error:eM};} await notifyAdmin(`❌ Ошибка одобрения PR #${pullNumber} в ${rId}:\n${eM}`); return { success: false, error: eM }; } }

export async function closePullRequest(repoUrl: string, pullNumber: number) { console.log("[Action] closePullRequest called..."); let owner:string|undefined; let repo:string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({auth:token}); console.log(`[Action] Closing PR #${pullNumber} in ${rId}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state === 'closed') { console.warn(`[Action] PR #${pullNumber} already closed.`); return { success: true, message: "PR already closed." }; } await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" }); console.log(`[Action] PR #${pullNumber} closed in ${rId}.`); await notifyAdmins(`☑️ PR #${pullNumber} в ${rId} закрыт.`); return { success: true }; } catch (error: any) { console.error(`[Action] Closing PR #${pullNumber} failed:`, error); let eM = error instanceof Error ? error.message : "Failed close PR"; if(error.status===404){eM=`PR #${pullNumber} not found (404).`;} else if(error.status===403){eM=`Permission denied (403) closing PR #${pullNumber}.`;} await notifyAdmin(`❌ Ошибка закрытия PR #${pullNumber} в ${rId}:\n${eM}`); return { success: false, error: eM }; } }