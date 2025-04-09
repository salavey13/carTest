# /supabase/vprtests/pic_prompts_eng67_1.md
Okay, here are the AI image generation prompts extracted from the English test SQL scripts, along with suggested paths/filenames.

You can use a base URL structure like `https://yourdomain.com/images/vpr/` or a relative path within your project like `/images/vpr/`. The filenames provide context about the test and question.

---

**English - Grade 6 - Variant 1 (Overwatch 2 Theme)**

1.  **Question 1: Heroes Grid**
    *   **Suggested Path/Filename:** `/images/vpr/english/6/eng6_var1_q1_heroes_grid.png`
    *   **Prompt:**
        ```
        Grid of 4 simple, friendly cartoon portraits in Overwatch 2 style: 1. Tracer (smiling, goggles on head, orange/brown hair). 2. Reinhardt (big smile, grey beard, inside helmet). 3. Mercy (smiling, blonde hair, halo). 4. Winston (gorilla wearing glasses, thoughtful smile).
        ```

2.  **Question 5: Payload near Checkpoint**
    *   **Suggested Path/Filename:** `/images/vpr/english/6/eng6_var1_q5_payload_checkpoint.png`
    *   **Prompt:**
        ```
        Simple cartoon scene from Overwatch 2 game. A bright blue glowing vehicle (payload) is inches away from a clearly marked white line (checkpoint) on a path. A large friendly character like Reinhardt stands protectively next to the payload. A shadowy enemy figure like Reaper is visible further down the path, looking towards them.
        ```

3.  **Question 12: Hero Actions**
    *   **Suggested Path/Filename:** `/images/vpr/english/6/eng6_var1_q12_hero_actions.png`
    *   **Prompt:**
        ```
        Simple, clear cartoon scene in Overwatch 2 style. Left: Soldier: 76 character running forward on ground level. Middle: Pharah character flying high up in a blue sky with clouds. Right: Ana character crouching slightly, aiming a long sniper rifle. Minimal background.
        ```

---

**English - Grade 7 - Variant 1 (Dota 2 Theme)**

1.  **Question 1: Heroes Grid**
    *   **Suggested Path/Filename:** `/images/vpr/english/7/eng7_var1_q1_heroes_grid.png`
    *   **Prompt:**
        ```
        Grid of 4 simple, clear cartoon portraits in Dota 2 style: 1. Phantom Assassin (female, masked, ethereal blue glow). 2. Crystal Maiden (female mage, blue icy theme, blonde hair, staff). 3. Axe (large red muscular male warrior, no shirt, big axe). 4. Pudge (large, fat, stitched-together creature, holding a hook).
        ```

2.  **Question 5: Team Fight**
    *   **Suggested Path/Filename:** `/images/vpr/english/7/eng7_var1_q5_team_fight.png`
    *   **Prompt:**
        ```
        Colorful cartoon top-down view of a Dota 2 battle. Five heroes with blue outlines are fighting five heroes with red outlines near a large stone tower. Bright spell effects (explosions, lasers, glowing areas) are visible between them. Minimalist background.
        ```

3.  **Question 12: Items Grid**
    *   **Suggested Path/Filename:** `/images/vpr/english/7/eng7_var1_q12_items_grid.png`
    *   **Prompt:**
        ```
        Grid of 4 simple, distinct cartoon items from Dota 2 on a neutral background: 1. Black King Bar (a golden sword glowing yellow). 2. Blink Dagger (a sharp blue dagger). 3. Tango (a single green leaf-like item). 4. Town Portal Scroll (a rolled-up paper scroll, slightly glowing red or blue).
        ```

---

**How to Use:**

1.  Generate images using your preferred AI image generation tool with the prompts above.
2.  Save the images using the suggested filenames (or your own consistent convention).
3.  Upload the images to a location accessible via URL (like your web server, CDN, or image hosting service).
4.  **Crucially:** Go back to the SQL scripts (`english_6_var1_overwatch.sql` and `english_7_var1_dota2.sql`) and replace the `"url": "placeholder_ai_prompt"` part in the `visual_data` JSON with the actual URL for each corresponding image.

Example update in SQL:
```sql
-- Before
-- ... VALUES (..., '{"type": "image", "url": "placeholder_ai_prompt", ...}'::jsonb) ...

-- After (assuming base URL https://yourcdn.com/images/vpr/)
-- ... VALUES (..., '{"type": "image", "url": "https://yourcdn.com/images/vpr/english/6/eng6_var1_q1_heroes_grid.png", ...}'::jsonb) ...
```
Run the updated SQL scripts to populate your database with questions linked to the correct images.
