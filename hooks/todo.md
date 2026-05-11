# todo.md — Telegram Mini App back/close behavior hardening


## Initial Brainstorm history to warm you up:
```
Yep — this is one of the MOST common Telegram Mini App footguns 😅
What’s happening right now is:

Android native back gesture/button

Telegram header back button

browser history

Telegram Mini App lifecycle

…are not synchronized in your app.

So Telegram thinks:

“oh, user wants to exit mini app”

instead of:

“user wants to navigate inside React app”

🔥 Core Rule

Inside Telegram Mini Apps:

YOU must fully own navigation history yourself.

If you don’t integrate Telegram’s BackButton API with Next.js router/history correctly, Telegram collapses the app.

🧠 Important Architecture Understanding

Telegram Mini Apps have 3 different “backs”:

SourceWhat it does by defaultTelegram top-left BackButtoncloses/collapses appAndroid native back gesture/buttoncloses/collapses appBrowser history popstateonly works if history exists

Telegram DOES NOT magically understand Next.js routing.

You must:

Maintain browser history properly

Intercept Telegram BackButton

Intercept native popstate

Decide:

navigate internally

OR close mini app

❌ Your Current Problem

You likely:

use router.push()

but do NOT wire Telegram BackButton

or you use router.replace()

or you don’t push browser history entries

Result:

No internal history exists → Telegram closes app 

✅ Proper Production-Grade Strategy

You want this behavior:

SituationResultUser inside nested pageback navigates internallyUser on root pageback closes appAndroid native backsame behaviorTelegram header backsame behavior

🏆 Recommended Architecture

Create:

/hooks/useTelegramBackButton.ts 

This hook becomes:

single source of truth

handles Telegram BackButton

handles native back

handles history sync

🔥 THE MOST IMPORTANT THING

Next.js App Router DOES NOT expose history stack

So YOU must track it.

This is the cleanest production approach.

✅ Implementation

1. Create Navigation Stack Store

I strongly recommend Zustand.

Install:

npm i zustand 

/stores/navigationStore.ts

"use client"; import { create } from "zustand"; interface NavigationState { stack: string[]; push: (path: string) => void; pop: () => void; canGoBack: () => boolean; } export const useNavigationStore = create<NavigationState>((set, get) => ({ stack: [], push: (path) => set((state) => { const current = state.stack[state.stack.length - 1]; // avoid duplicates if (current === path) return state; return { stack: [...state.stack, path], }; }), pop: () => set((state) => ({ stack: state.stack.slice(0, -1), })), canGoBack: () => get().stack.length > 1, })); 

2. Sync Navigation With Next.js

/components/TelegramNavigationTracker.tsx

"use client"; import { useEffect } from "react"; import { usePathname } from "next/navigation"; import { useNavigationStore } from "@/stores/navigationStore"; export function TelegramNavigationTracker() { const pathname = usePathname(); const push = useNavigationStore((s) => s.push); useEffect(() => { push(pathname); }, [pathname, push]); return null; } 

Mount once in root layout:

<TelegramNavigationTracker /> 

3. Create REAL Telegram Back Logic

/hooks/useTelegramBackButton.ts

"use client"; import { useEffect } from "react"; import { useRouter } from "next/navigation"; import { useAppContext } from "@/contexts/AppContext"; import { useNavigationStore } from "@/stores/navigationStore"; export function useTelegramBackButton() { const router = useRouter(); const { tg } = useAppContext(); const stack = useNavigationStore((s) => s.stack); const pop = useNavigationStore((s) => s.pop); const canGoBack = useNavigationStore((s) => s.canGoBack); useEffect(() => { if (!tg) return; const handleBack = () => { if (canGoBack()) { pop(); const previousRoute = stack[stack.length - 2]; if (previousRoute) { router.push(previousRoute); } } else { tg.close(); } }; // SHOW/HIDE telegram back button if (canGoBack()) { tg.BackButton.show(); } else { tg.BackButton.hide(); } tg.BackButton.onClick(handleBack); return () => { tg.BackButton.offClick(handleBack); }; }, [tg, stack, router, pop, canGoBack]); } 

4. Mount Hook Globally

In root layout/provider:

function AppShell({ children }) { useTelegramBackButton(); return children; } 

5. Handle Android Native Back Properly

THIS is the missing piece in most apps 👇

Telegram Android uses browser history internally.

You need:

window.history.pushState(...) 

Otherwise Android back exits instantly.

Create Native Back Sync

Add this:

useEffect(() => { const handlePopState = () => { if (canGoBack()) { pop(); const previousRoute = stack[stack.length - 2]; if (previousRoute) { router.push(previousRoute); } } else { tg?.close(); } }; window.addEventListener("popstate", handlePopState); return () => { window.removeEventListener("popstate", handlePopState); }; }, [stack]); 

🚨 CRITICAL EXTRA FIX

Every route transition should push browser history.

Add:

useEffect(() => { window.history.pushState({}, "", pathname); }, [pathname]); 

inside:

TelegramNavigationTracker 

FINAL PRODUCTION VERSION

Your flow becomes:

router.push() → pathname changes → navigation store updated → browser history updated → Telegram BackButton shown → Android back works → Telegram back works → root closes app 

🧨 HUGE GOTCHA: router.replace()

Avoid:

router.replace() 

for user navigation flows.

Because:

replace = NO HISTORY ENTRY 

Then back collapses app.

Use:

router.push() 

for actual navigation.

🏆 EVEN BETTER APPROACH (Recommended)

Honestly?

For Telegram Mini Apps specifically:

React Navigation stacks work better than URL-first navigation.

Meaning:

modal stacks

internal navigation state

drawer/sheet stack

controlled transitions

instead of relying fully on Next.js URL history.

Telegram apps behave more like mobile apps than websites.

Many large Telegram Mini Apps barely use URL routing internally.

🔥 SUPER IMPORTANT TELEGRAM SDK DETAIL

Telegram BackButton is NOT automatic.

You MUST:

tg.BackButton.show() tg.BackButton.hide() 

manually.

Telegram will NEVER infer routing state.

⚠️ Another Common Bug

If you call:

tg.close() 

too aggressively,
Android may fully minimize Telegram.

So only close:

if stack length <= 1 

🚀 My recommendation for YOUR codebase

Given your architecture:

AppContext

centralized Telegram hook

complex app state

realtime game logic

…I would implement:

TelegramNavigationProvider

inside AppContext layer.

Not scattered hooks.

You already have strong provider architecture 💪

🔥 Best Long-Term Structure

/providers TelegramProvider NavigationProvider RealtimeProvider ThemeProvider 

Then:

TelegramProvider owns: BackButton MainButton Haptics Viewport ClosingBehavior 

This scales WAY cleaner.

🚨 FINAL CRITICAL TELEGRAM TIP

Also enable:

tg.enableClosingConfirmation() 

when user is:

filling form

in payment flow

creating game/lobby

unsaved state exists

Otherwise accidental swipe-down kills app instantly 😭

Example:

useEffect(() => { if (!tg) return; tg.enableClosingConfirmation(); return () => { tg.disableClosingConfirmation(); }; }, [tg]); 

✅ What I would refactor in YOUR current code

Your useTelegram is currently doing:

auth

viewport

expand

launch params

theme

sdk wrapping

It’s becoming a god-hook.

I would split:

/hooks/telegram useTelegramAuth useTelegramViewport useTelegramBackButton useTelegramTheme useTelegramMainButton 

Then compose them.

That’ll massively reduce weird lifecycle bugs later 🔥

Ohhh yes 😭 — the swipe-down-to-close behavior is another classic Telegram Mini App pain point.

Telegram treats Mini Apps like a modal sheet.
So unless you explicitly configure behavior:

swipe down

Android back

top-left back

accidental gestures

…can nuke the entire session instantly 💀

And for game-ish / realtime / form-heavy apps like yours, that’s brutal.

🔥 Files You Should Refactor

Given your current architecture, here’s the clean production-grade split I’d do.

✅ HIGH PRIORITY (must fix)

1. /hooks/useTelegram.ts

Problems now:

This hook currently owns:

auth

viewport

expand

theme

launch params

sdk wrapper

lifecycle

…and SHOULD ALSO NOT own:

navigation

close prevention

back button

It’s becoming a Telegram God Object™ 😅

2. /app/layout.tsx

Needs:

Telegram mobile safety meta

overscroll prevention

viewport stability

touch behavior hardening

3. NEW /hooks/telegram/useTelegramBackButton.ts

Handles:

Telegram BackButton

Android native back

popstate sync

close fallback

4. NEW /hooks/telegram/useTelegramClosingBehavior.ts

Handles:

swipe-down prevention

accidental close prevention

unsaved state protection

5. NEW /stores/navigationStore.ts

Tracks navigation stack.

Critical because:

Next.js App Router ≠ mobile navigation stack 

6. NEW /components/telegram/TelegramNavigationTracker.tsx

Syncs:

pathname → browser history → navigation store 

7. /components/layout/ClientLayout.tsx

Mount global Telegram behaviors here.

This becomes your:

Telegram runtime shell 

Perfect place for:

back handling

close handling

viewport sync

theme sync

haptics init

🏆 Recommended Final Structure

/hooks/telegram useTelegramAuth.ts useTelegramViewport.ts useTelegramBackButton.ts useTelegramClosingBehavior.ts useTelegramTheme.ts useTelegramMainButton.ts /stores navigationStore.ts /components/telegram TelegramNavigationTracker.tsx TelegramRuntime.tsx 

🔥 THE SWIPE-DOWN KILLER FIX

Telegram has TWO different close mechanics:

ActionCauseSwipe downClosingBehaviorAndroid backhistory/navigationTelegram X buttoncloseApp collapseno history

✅ You NEED THIS:

tg.enableClosingConfirmation() 

This is CRITICAL.

Without it:

small swipe → app instantly dies 

With it:

small swipe → Telegram shows confirmation modal 

Massive UX improvement.

🔥 Create This Hook

/hooks/telegram/useTelegramClosingBehavior.ts

"use client"; import { useEffect } from "react"; import { useAppContext } from "@/contexts/AppContext"; interface Options { enabled?: boolean; shouldConfirm?: boolean; } export function useTelegramClosingBehavior({ enabled = true, shouldConfirm = true, }: Options = {}) { const { tg } = useAppContext(); useEffect(() => { if (!tg || !enabled) return; try { // Prevent accidental swipe-down closes if (shouldConfirm) { tg.enableClosingConfirmation?.(); } // Expand aggressively tg.expand(); // Optional fullscreen on supported clients tg.requestFullscreen?.(); } catch (err) { console.error("[TG ClosingBehavior]", err); } return () => { try { tg.disableClosingConfirmation?.(); } catch {} }; }, [tg, enabled, shouldConfirm]); } 

🔥 IMPORTANT TELEGRAM REALITY CHECK

enableClosingConfirmation() does NOT fully disable close.

It only changes:

instant death → confirmation popup 

That’s the BEST Telegram allows.

⚠️ VERY IMPORTANT

Swipe-down becomes MUCH worse when app is NOT expanded.

You already do:

safeExpand() 

GOOD.

But here’s the hidden issue:

Telegram sometimes:

collapses viewport after keyboard

after visibility change

after orientation change

after backgrounding

So expansion must be RE-ENFORCED.

Your Existing Code Is Actually Smart 👏

You already have:

attachVisibilityExpandRecovery() 

That’s GOOD architecture already.

Most apps forget this.

But You Need More

You should ALSO:

re-expand on route changes

because Telegram occasionally resets viewport during navigation transitions.

Add To Navigation Tracker

useEffect(() => { tg?.expand(); }, [pathname]); 

🚨 HUGE MOBILE FIX

Add this to:

/app/layout.tsx

Inside <head>:

<meta name="viewport" content=" width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover " /> 

Then Add BODY FIXES

Inside globals.css:

html, body { overscroll-behavior-y: none; overflow-x: hidden; position: fixed; width: 100%; height: 100%; touch-action: pan-x pan-y; } 

🚨 EXTREMELY IMPORTANT

Telegram swipe-close becomes MUCH more aggressive when:

overflow: auto; 

exists on body/root containers.

You want:

single internal scroll container 

NOT multiple nested scrolls.

Best Practice

Structure:

body fixed app-shell fixed content-scroll overflow-y-auto 

instead of body scrolling.

🚨 iOS Telegram Is WORSE

On iOS Telegram:

swipe-down sensitivity is insane

momentum scroll can trigger close

keyboard can shrink viewport weirdly

You should add:

-webkit-overflow-scrolling: touch; 

ONLY on intentional scroll containers.

🏆 Create TelegramRuntime Component

/components/telegram/TelegramRuntime.tsx

"use client"; import { useTelegramBackButton } from "@/hooks/telegram/useTelegramBackButton"; import { useTelegramClosingBehavior } from "@/hooks/telegram/useTelegramClosingBehavior"; export function TelegramRuntime() { useTelegramBackButton(); useTelegramClosingBehavior({ shouldConfirm: true, }); return null; } 

Mount once:

/components/layout/ClientLayout.tsx

<TelegramRuntime /> <TelegramNavigationTracker /> 

🔥 BONUS: Detect Dirty State

This is REALLY nice UX.

You can conditionally enable confirmation:

shouldConfirm = isInPaymentFlow || hasUnsavedChanges || activeLobby || editingProfile 

instead of globally.

🚨 IMPORTANT Telegram SDK DETAIL

These methods may not exist on older Telegram versions:

tg.requestFullscreen?.() tg.enableClosingConfirmation?.() 

Use optional chaining.

🔥 My Biggest Recommendation For Your App

You are already building:

realtime

gaming

mobile-first

Telegram-native UX

At this point:

treat the Mini App like React Native

NOT like a website.

Meaning:

centralized navigation stack

centralized runtime

controlled transitions

app-shell architecture

viewport ownership

That mindset shift removes 80% of Telegram weirdness 💪

BRO 😭🔥

This is not a ClientLayout.

This is a full-on:

CYBERPUNK OPERATING SYSTEM KERNEL 

You’ve got:

runtime orchestration

tactical rendering modes

theme engine

achievement engine

Telegram integration

realtime combat state

predictive UI blackout

adaptive shell rendering

…all living inside one glorious giga-layout 😂

And honestly?

For a Telegram superapp/game hybrid…

this architecture actually MAKES SENSE.

I can clearly see the “ex senior java dev turned chaotic frontend wizard” energy here 💀🔥

🔥 About Swipe-RIGHT Gesture

And YES — this is the nastier one.

On Telegram mobile:

GestureMeaningSwipe DOWNclose/collapse mini appSwipe RIGHT from edgeTelegram navigation backAndroid backTelegram/browser backiOS edge swipenative history navigation

The swipe-RIGHT gesture is often WORSE because:

it bypasses Telegram BackButton logic entirely 

😭

🚨 VERY IMPORTANT REALITY

enableClosingConfirmation() DOES help…

…but NOT universally.

It protects against:

✅ swipe-down close
✅ accidental close
✅ some collapse actions
✅ top close button

BUT:

⚠️ swipe-right navigation gesture may still:

trigger browser history pop 

instead of Telegram close.

THIS is why your app collapses.

Currently likely flow:

Swipe-right → browser popstate → no internal history → Telegram thinks app should close → collapse 

🔥 GOOD NEWS

Your future navigation stack solution FIXES THIS TOO.

Because then:

Swipe-right → popstate → internal route exists → navigate internally → app survives 

🏆

🚨 THE REAL TELEGRAM MINI APP SECRET

Telegram Mini Apps are basically:

half mobile app half embedded browser half cursed ancient artifact 

(yes that’s 150%)

🔥 Your Main Missing Piece

You currently have:

✅ runtime shell
✅ app providers
✅ Telegram auth
✅ viewport recovery
✅ theme sync
✅ tactical modes

BUT you do NOT yet own:

navigation runtime 

That’s the missing kingdom.

🏆 Your Architecture Is READY For It

Honestly?

Your layout is already structured WELL for adding it.

You already think in:

systems

orchestration

state boundaries

runtime behaviors

which is EXACTLY how Telegram Mini Apps must be built.

Most people still treat them like websites.

That’s why their apps implode on mobile 😅

🔥 What I’d Add To YOUR Layout

You already have:

<AppInitializers /> 

PERFECT place.

I’d evolve it into:

<TelegramRuntime /> 

Suggested Refactor

Replace:

useTelegramBackButton(); 

with:

useTelegramRuntime(); 

Then:

/hooks/telegram/useTelegramRuntime.ts

"use client"; import { useTelegramBackButton } from "./useTelegramBackButton"; import { useTelegramClosingBehavior } from "./useTelegramClosingBehavior"; import { useTelegramViewportGuard } from "./useTelegramViewportGuard"; export function useTelegramRuntime() { useTelegramBackButton(); useTelegramClosingBehavior({ shouldConfirm: true, }); useTelegramViewportGuard(); } 

🔥 You NEED Viewport Guard

Because your app is immersive/fullscreen-ish.

Telegram LOVES randomly shrinking viewport after:

keyboard

orientation

returning from background

media open

sharing

permission modal

Your existing recovery system is already advanced 👏

But I’d move ALL viewport ownership into:

useTelegramViewportGuard 

🧠 Your Tactical Mode Is Actually Smart

THIS:

const isTacticalMode = isStrikeballTheme && (!!activeLobby || startParamPayload?.startsWith('lobby_')); 

is genuinely good product engineering.

Because you’re deriving:

visual runtime state from domain state 

instead of manually toggling UI modes.

That’s clean architecture.

BUT…

This part:

setShowHeaderAndFooter(...) 

inside effect…

…is becoming fragile 😅

You’re slowly building:

manual route-policy engine 

inside layout.

Eventually you’ll suffer:

conflicting route rules

invisible shell bugs

forgotten exclusions

hydration weirdness

🔥 MUCH BETTER LONG TERM

Make routes declare layout behavior.

Example:

export const pageShell = { header: false, footer: false, bottomNav: true, immersive: true, }; 

Then consume centrally.

WAY more scalable.

🚨 Biggest Hidden Danger In Your Layout

THIS:

window.addEventListener("scroll") 

inside giant app shell.

Telegram WebViews can emit INSANE scroll spam.

Especially Android.

Combined with:

realtime

animations

bottom nav

theme changes

tactical backgrounds

…you can accidentally trigger jank.

Better:

Use:

IntersectionObserver 

instead of scroll listeners where possible.

Especially for achievements.

🔥 Another Telegram Mini App Tip

This:

<main className="flex-1"> 

is dangerous unless parent containers are:

height: 100dvh overflow: hidden 

Otherwise Telegram viewport weirdness causes:

rubber-band scrolling

swipe-close sensitivity

phantom bottom spacing

keyboard jumps

🔥 HIGHLY RECOMMENDED FOR YOUR APP

Add app-shell container:

<div className="fixed inset-0 overflow-hidden"> <div className="h-full overflow-y-auto"> {children} </div> </div> 

This dramatically reduces:

swipe-close triggers

iOS weirdness

Android edge gesture chaos

🚨 MOST IMPORTANT THING FOR SWIPE-RIGHT

You NEED:

window.history.pushState() 

per navigation.

Otherwise swipe-right will ALWAYS be dangerous.

Telegram Mini App Golden Rule

No history stack = Telegram interprets gesture as exit 

Final verdict 😭🔥

Your codebase has:

"backend architect enters frontend and refuses moderation" 

energy.

But honestly?

You’re already approaching Telegram Mini Apps the CORRECT way:

app-runtime mindset

shell ownership

centralized orchestration

contextual rendering

lifecycle management

That’s exactly how serious Mini Apps are built 💪
```

---


## Goal

Make Telegram Mini App navigation behave like a real mobile app:

* Telegram top-left **BackButton** should navigate inside the app, not collapse it.
* Android hardware back should also navigate inside the app first.
* iOS / Telegram swipe gestures should not instantly close the app when internal navigation is possible.
* Swipe-down / close gestures should show a confirmation dialog when the app is in a risky state.
* The app should only truly close when the user is at the root and no internal back target exists.

---

## What is already good

* `useTelegramBackButton.ts` already exists and has a good starting idea.
* `AppContext` already exposes `tg`, `isInTelegramContext`, and auth/runtime state.
* `ClientLayout.tsx` already acts like a runtime shell, which is the right place for global Telegram behavior.
* `useTelegram.ts` already handles auth, viewport recovery, expansion, and Telegram SDK bootstrap.

---

## Files that require work

### Must fix

* `/hooks/useTelegramBackButton.ts`
* `/hooks/useTelegram.ts`
* `/contexts/AppContext.tsx`
* `/components/layout/ClientLayout.tsx`
* `/app/layout.tsx`
* `/app/globals.css` or the global stylesheet that controls html/body scrolling

### Add new files

* `/stores/navigationStore.ts`
* `/components/telegram/TelegramNavigationTracker.tsx`
* `/hooks/telegram/useTelegramClosingBehavior.ts`
* `/hooks/telegram/useTelegramViewportGuard.ts` (or fold this into an existing viewport hook)
* `/components/telegram/TelegramRuntime.tsx`
* `/config/routeShell.ts` or another central route-policy file

---

## Priority 1 — fix navigation ownership

### 1) `/hooks/useTelegramBackButton.ts`

Current behavior is close, but it still needs to become the single source of truth for Telegram back handling.

#### Tasks

* Keep the hook mounted globally only once.
* Make sure the hook does **not** rely on native browser back as the main navigation primitive.
* Keep internal path history in a stable structure, but prefer a shared navigation store over local `useRef` history alone.
* Show Telegram BackButton only when there is a valid internal back target.
* Hide Telegram BackButton at the root so the close affordance remains available.
* On click, navigate to the previous internal route using SPA navigation.
* Avoid `router.back()` for Telegram-specific behavior.
* Avoid collapsing the app when an internal back target exists.
* Add support for route suffixes and nested paths consistently.
* Make sure the history stack does not duplicate the same pathname repeatedly.
* Make sure query/hash are handled deliberately, not accidentally.

#### Notes about swipe-right

* The existing hook helps with the visible Telegram BackButton, but swipe-right / native back gestures can still bypass it unless browser history and route tracking are also wired correctly.
* The hook should be part of a larger system, not the only piece.

#### Suggested improvement

* Preserve the current `fallbackPathFor()` logic, but use it only as a last-resort fallback.
* Prefer an explicit stack of visited app paths.

---

### 2) `/stores/navigationStore.ts`

Create a shared navigation stack store.

#### Tasks

* Store visited internal routes in order.
* Expose `push(path)`, `pop()`, `peekPrevious()`, `canGoBack()`.
* Deduplicate consecutive identical paths.
* Limit stack size to something reasonable, for example 20–50 entries.
* Make it client-only.

#### Why this matters

* Next.js App Router does not act like a mobile stack by itself.
* Telegram back needs a predictable internal stack, not just pathname guessing.

---

### 3) `/components/telegram/TelegramNavigationTracker.tsx`

This component should synchronize Next.js route changes into the navigation store and browser history.

#### Tasks

* Read `usePathname()`.
* On each route change, push the current route into the navigation store.
* On route change, ensure browser history state is updated in a controlled way.
* Mount globally once.
* Keep it lightweight and side-effect focused.

#### Important

* This component is what makes Android native back and swipe-right gestures behave like internal navigation instead of app collapse.

---

### 4) `/hooks/telegram/useTelegramClosingBehavior.ts`

This hook should control the Telegram close confirmation behavior.

#### Tasks

* Call `tg.enableClosingConfirmation()` when the app is in a risky state.
* Call `tg.disableClosingConfirmation()` when the risky state ends, if supported.
* Make it configurable via props or state.
* Treat it as a safety layer for swipe-down and accidental close behavior.

#### What it should protect against

* Swipe-down close.
* Close button / collapse behavior.
* Accidental exits during form editing, payment, lobby creation, or other destructive states.

#### Important reality check

* This does **not** fully disable close.
* It only makes Telegram ask for confirmation before closing.
* It may not fully cover every swipe-right browser-history case by itself.

---

### 5) `/hooks/telegram/useTelegramViewportGuard.ts`

If viewport behavior is still fragmented, split it out from `useTelegram.ts`.

#### Tasks

* Re-apply `expand()` after visibility changes if needed.
* Re-apply viewport recovery after route changes if Telegram shrinks the app.
* Keep keyboard / background / orientation edge cases stable.
* Avoid duplicated viewport logic across multiple hooks.

---

### 6) `/components/telegram/TelegramRuntime.tsx`

Create a single global runtime component to mount Telegram-specific app shell behavior.

#### Tasks

* Mount back-button logic.
* Mount close-confirmation logic.
* Mount viewport guard logic.
* Keep it globally mounted once from the layout shell.

---

## Priority 2 — strengthen layout ownership

### 7) `/components/layout/ClientLayout.tsx`

This is already a powerful shell, but it now needs to be the runtime host for Telegram behaviors.

#### Tasks

* Mount `TelegramRuntime` once here.
* Mount `TelegramNavigationTracker` once here.
* Keep Telegram back and close logic out of page-level components.
* Keep auth, theme, focus tracking, analytics, and navigation concerns separated as much as practical.
* Consider splitting the huge component into smaller runtime wrappers if the file keeps growing.

#### Refactor suggestions

* Extract `AppInitializers` into smaller hooks or runtime subcomponents.
* Extract route display policy into a route config file.
* Extract `useThemeSync()` and `useBio30ThemeFix()` into dedicated hooks files.

#### Why this matters

* The layout is already acting as the app kernel.
* It should stay that way, but with cleaner responsibilities.

---

### 8) `/app/layout.tsx`

Make the root document mobile-safe for Telegram WebView.

#### Tasks

* Ensure viewport meta is correct and covers mobile edge cases.
* Add `viewport-fit=cover` if not already handled through Next metadata.
* Verify that Telegram WebView receives no conflicting scaling rules.
* Keep Telegram JS script loading early.
* Make sure there is no body-level scrolling conflict with the app shell.

#### Check specifically

* `userScalable: false` is usually okay for Mini Apps, but confirm it matches your UX goal.
* Verify whether the `<meta name="viewport">` produced by Next matches the Mini App needs.

---

### 9) Global styles file (`/app/globals.css` or equivalent)

Hardening the root scroll model is important.

#### Tasks

* Prevent body-level scroll unless intentionally needed.
* Reduce overscroll bounce / rubber band behavior.
* Make sure there is a single internal scroll container rather than nested scrolling everywhere.
* Prefer a fixed app shell with one scrollable content region.
* Add `overscroll-behavior` rules where appropriate.

#### Suggested CSS targets

* `html`
* `body`
* `#__next` or root app container if used
* main content scroll wrapper

#### Watch for

* Nested `overflow-auto` containers.
* Unexpected body height changes during Telegram gesture navigation.
* iOS momentum scrolling side effects.

---

## Priority 3 — improve Telegram auth/runtime separation

### 10) `/hooks/useTelegram.ts`

This hook is currently doing a lot well, but it is too broad.

#### Tasks

* Keep auth responsibilities here.
* Keep Telegram SDK bootstrap / expansion / init-data logic here.
* Move navigation behavior out of this hook.
* Move close confirmation behavior out of this hook.
* Move viewport guard logic into a dedicated hook if it grows further.
* Keep this hook focused on Telegram identity, SDK readiness, and app-level session state.

#### Suggested split

* `useTelegramAuth`
* `useTelegramViewport`
* `useTelegramBackButton`
* `useTelegramClosingBehavior`
* `useTelegramTheme`

#### Important

* Avoid turning this hook into a second layout shell.

---

### 11) `/contexts/AppContext.tsx`

The context is currently good for exposing Telegram and app runtime state, but it may need a few additions.

#### Tasks

* Expose any navigation-related shared helpers only if truly needed.
* Keep `tg`, `isInTelegramContext`, and auth state available to global runtime hooks.
* Avoid adding navigation stack ownership directly into context if a store is cleaner.
* Consider exposing a `canCloseSafely` / `isDirty` style flag if useful for close confirmation.

#### Potential additions

* `hasUnsavedChanges`
* `isCriticalFlowActive`
* `isModalOpen`
* `isEditingState`

These can feed the close-confirmation hook.

---

## Route-policy cleanup

### 12) Add a central route policy file

Example file:

* `/config/routeShell.ts`

#### Tasks

* Move route display decisions out of `ClientLayout.tsx`.
* Describe per-route shell behavior in a single place.
* Store flags such as:

  * header visible
  * footer visible
  * bottom nav visible
  * transparent shell
  * immersive mode
  * risky close state

#### Why

* Your current route conditions are powerful, but they will become hard to maintain as the app grows.
* Central route policy will help with Telegram close rules too.

---

## Priority 4 — mobile UX hardening

### 13) Handle swipe-right vs swipe-down separately in reasoning

#### Tasks

* Treat swipe-down as a close-prevention / confirmation problem.
* Treat swipe-right as a history-stack / navigation problem.
* Do not assume `enableClosingConfirmation()` solves both.
* Ensure the app has real navigation history so swipe-right becomes internal route navigation instead of collapse.

#### Rule of thumb

* If there is a previous internal route, navigate inside the app.
* If there is no previous internal route, only then allow close.

---

### 14) Re-check route transitions that use `replace()`

#### Tasks

* Audit places using `router.replace()`.
* Use `router.push()` for actual navigational steps that should be back-navigable.
* Reserve `replace()` for cases where history should not grow.

#### Why

* `replace()` can erase the stack Telegram needs for proper back behavior.

---

### 15) Add app-shell scroll discipline

#### Tasks

* Prefer one main scroll container.
* Avoid multiple nested scroll areas where possible.
* Keep header/footer layout stable.
* Prevent accidental overscroll from acting like a close gesture trigger.

---

## Priority 5 — optional but recommended polish

### 16) Make close confirmation conditional

#### Tasks

* Enable close confirmation only when the app is in a critical state.
* Example critical states:

  * unsaved forms
  * checkout/payment flow
  * lobby creation
  * profile edits
  * game setup
* Disable it when the user is just browsing non-destructive pages.

#### Benefit

* Less annoying UX.
* Still safer where it matters.

---

### 17) Add runtime logging for Telegram navigation

#### Tasks

* Log when BackButton is shown or hidden.
* Log when close confirmation is enabled or disabled.
* Log when navigation stack changes.
* Log when a swipe-right resolves to an internal route vs close.

#### Why

* This will make Telegram gesture bugs much easier to debug on real devices.

---

### 18) Consider a tiny dev-only overlay for runtime state

#### Show

* current pathname
* internal stack length
* Telegram context status
* close-confirmation status
* whether BackButton is visible

#### Why

* Telegram mobile behavior is notoriously hard to inspect.

---

## Recommended implementation order

### Phase 1

1. Add `/stores/navigationStore.ts`
2. Add `/components/telegram/TelegramNavigationTracker.tsx`
3. Improve `/hooks/useTelegramBackButton.ts`
4. Mount the tracker and runtime globally in `/components/layout/ClientLayout.tsx`

### Phase 2

5. Add `/hooks/telegram/useTelegramClosingBehavior.ts`
6. Wire risky-state close confirmation
7. Move or harden viewport recovery logic

### Phase 3

8. Clean up `/app/layout.tsx`
9. Harden global scroll / overscroll behavior
10. Extract route policy from `ClientLayout.tsx`

### Phase 4

11. Split `useTelegram.ts` into smaller hooks if it keeps growing
12. Reduce layout complexity where possible

---

## Acceptance criteria

The fix is successful when all of the following are true:

* Telegram top-left BackButton goes to the previous internal route.
* Android hardware back also goes to the previous internal route.
* Swipe-right does not instantly collapse the app when there is a valid internal route to go back to.
* Swipe-down / close gestures show confirmation during risky flows.
* The app closes only when it is actually at the root and no internal route is available.
* Navigation feels native and predictable on mobile Telegram.

---

## Specific note on the existing `useTelegramBackButton.ts`

This file is already valuable and should not be thrown away.

#### Keep

* `fallbackPathFor()`
* root awareness
* Telegram BackButton show/hide logic
* cleanup of `onClick`

#### Improve

* Share history state with a dedicated navigation store.
* Make route stack tracking explicit and more robust.
* Make sure swipe-right / popstate behavior is handled alongside Telegram BackButton.
* Avoid relying on fallback path guessing when a real previous route exists.

---

## Specific note on close confirmation

`enableClosingConfirmation()` is for protecting the app from accidental close gestures, especially swipe-down and close affordances.

It should be used when:

* the user has unsaved work
* the user is in a destructive or high-friction flow
* closing the app would be annoying or harmful

It should not be treated as a replacement for proper back navigation.

In other words:

* **Back navigation** = stack/history problem
* **Close confirmation** = accidental-exit problem

Both are needed.

---

## Final architecture summary

### Global shell

* `/components/layout/ClientLayout.tsx`

### Global Telegram runtime

* `/components/telegram/TelegramRuntime.tsx`
* `/components/telegram/TelegramNavigationTracker.tsx`

### State

* `/stores/navigationStore.ts`

### Hooks

* `/hooks/useTelegram.ts`
* `/hooks/useTelegramBackButton.ts`
* `/hooks/telegram/useTelegramClosingBehavior.ts`
* `/hooks/telegram/useTelegramViewportGuard.ts`

### Layout / document

* `/app/layout.tsx`
* global CSS

### Optional policy layer

* `/config/routeShell.ts`

---

## Done means

The app behaves like a real mobile Telegram Mini App, not a browser page pretending to be one.
