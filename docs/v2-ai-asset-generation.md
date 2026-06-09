# V2 AI Asset Generation

## Direction

Waffles V2 assets should be generated as a single mobile-game asset family: chunky pixel-inspired 3D illustration, crisp dark silhouettes, saturated maple-gold highlights, readable shapes at 32-120px, and no text unless the UI explicitly renders it. Assets must feel playful and premium without drifting into photorealism.

## Pipeline

1. Audit the existing V2 asset and confirm the in-game role before generating.
2. Generate a source PNG from the approved prompt template.
3. For cutout assets, generate on a removable chroma-key background and remove it locally.
4. Save raw sources and final exports under `public/images/v2/generated`.
5. Add the prompt, output path, dimensions, and approval status to this file.
6. Only replace `public/images/v2/*.webp` after the generated candidate is approved in the V2 sample UI.

## Shared Prompt Rules

- No words, logos, watermarks, captions, or UI labels inside the image.
- Center the subject with generous padding and a crisp silhouette.
- Use the same soft bevels, chunky proportions, black-brown outline, warm highlights, and saturated arcade palette across all assets.
- Cutout assets use a flat chroma-key source and local alpha extraction.
- Background scenes may be full-frame, but foreground sprites must be isolated.

## Prompt Templates

### Character Cutout

```text
Use case: stylized-concept
Asset type: mobile game character sprite, transparent-background source via chroma-key removal
Primary request: Create <character> for Waffles V2, a mobile trivia game.
Subject: <specific character description>. The character should read clearly at 48px-120px in a mobile UI.
Style: premium mobile game asset, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated maple-gold highlights, dark readable outline, playful but polished, no text.
Composition: centered full-body character, orthographic/front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no watermark, no extra props unless specified, no cast shadow, no contact shadow, no reflection.
```

### Reward Icon

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create <reward object> for Waffles V2.
Subject: <specific reward object>, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no watermark, no extra objects, no cast shadow, no reflection.
```

### Isometric World Tile

```text
Use case: stylized-concept
Asset type: mobile game isometric map tile
Primary request: Create <tile state> for the Waffles V2 level path.
Subject: one isometric waffle slab occupying a 2:1 diamond top face, with <state-specific details>.
Style: premium mobile game map tile, chunky pixel-inspired 3D illustration, crisp black-brown outline, maple-gold waffle material, readable at 48px-96px.
Composition: isolated tile centered in frame, top face aligned as a 2:1 isometric diamond, consistent depth, no labels.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no text, no numbers, no watermark, no extra scenery.
```

### Forest Prop

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create <forest prop> for the Waffles V2 twilight forest level map.
Subject: <specific prop>, compact and readable at 24px-80px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props unless specified.
```

## Asset Inventory

| Asset | Role | Target treatment | Status |
| --- | --- | --- | --- |
| `wally.webp` | Main mascot and CTA character | Character cutout | Candidate generated |
| `ticket.webp` | Ticket currency | Reward icon | Candidate generated |
| `flame.webp` | Streak indicator | Reward icon | Candidate generated |
| `trophy.webp` | Competition reward | Reward icon | Candidate generated |
| `heart-full.webp`, `heart-empty.webp`, `heart-broken.webp` | Lives states | Reward icon set | Candidate generated |
| `powerup-5050.webp`, `powerup-time.webp`, `powerup-skip.webp`, `powerup-shield.webp` | Shop power-ups | Reward icon set | Candidate generated |
| `chest-rainbow.webp`, `chest-purple.webp`, `chest-brown.webp` | League rewards | Reward icon set | Candidate generated |
| `medal-apprentice.webp`, `medal-silver.webp`, `medal-advanced.webp`, `medal-genius.webp`, `medal-master.webp` | League badges | Reward icon set | Candidate generated |
| `avatar-*.webp` | Player avatars | Character cutout set | Candidate generated |
| `boss-night-owl.webp` | Boss marker | Character cutout | Candidate generated |
| `waffle-slab-active.webp`, `waffle-slab-done.webp`, `waffle-slab-locked.webp` | Level path tiles | Isometric world tile set | Candidate generated |
| `forest-*.webp`, `terrain-stone.webp`, `cloud.webp` | Level scenery | Forest prop set | Candidate generated |
| `forest-scene-hero.webp` | Full-screen level scene | Background scene | Candidate generated |

## Generated Candidates

### Wally Mascot

- Source: `public/images/v2/generated/wally-ai-source.png`
- Final: `public/images/v2/generated/wally-ai.png`
- Dimensions: 1151 x 1367
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; approved as a style seed, not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game character sprite, transparent-background source via chroma-key removal
Primary request: Create the main Waffles V2 mascot character, named Wally, as a friendly waffle adventurer for a mobile trivia game.
Subject: A cute anthropomorphic golden waffle character with a square waffle-grid body, small expressive eyes, tiny arms and legs, confident upbeat pose, playful but polished. The character should read clearly at 48px-120px in a mobile UI.
Style: premium mobile game asset, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated syrup-gold waffle tones, dark readable outline, subtle highlights, no text.
Composition: centered full-body character, orthographic/front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no watermark, no extra props, no cast shadow, no contact shadow, no reflection.
```

### Ticket Currency

- Source: `public/images/v2/generated/ticket-ai-source.png`
- Final: `public/images/v2/generated/ticket-ai.png`
- Dimensions: 1449 x 1085
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 ticket currency icon.
Subject: A single golden waffle-themed tournament ticket, shaped like a small rounded admission ticket with subtle waffle-grid embossing and maple-gold highlights, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Streak Flame

- Source: `public/images/v2/generated/flame-ai-source.png`
- Final: `public/images/v2/generated/flame-ai.png`
- Dimensions: 1234 x 1275
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 streak flame icon.
Subject: A single lively flame shaped like a maple-gold and coral arcade fire, with a small bright yellow inner flame and rounded chunky lobes, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, upright vertical flame, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Heart Full

- Source: `public/images/v2/generated/heart-full-ai-source.png`
- Final: `public/images/v2/generated/heart-full-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 full life heart icon.
Subject: A single full heart-shaped life icon, glossy coral-red with a warm maple-gold inner highlight and subtle waffle-grid bevel texture, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, front view with slight dimensional bevel, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Heart Empty

- Source: `public/images/v2/generated/heart-empty-ai-source.png`
- Final: `public/images/v2/generated/heart-empty-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 empty life heart icon.
Subject: A single empty heart-shaped life icon, hollow dark frame with muted charcoal interior, thin maple-gold bevel accents, and subtle waffle-grid structure visible in the border, clear at 24px-80px. It should look like the inactive version of the full life heart.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated but muted arcade color, soft bevels, high contrast, no text.
Composition: centered object, front view with slight dimensional bevel, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Heart Broken

- Source: `public/images/v2/generated/heart-broken-ai-source.png`
- Final: `public/images/v2/generated/heart-broken-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 broken life heart icon.
Subject: A single broken heart-shaped life icon, coral-red glossy heart split by one bold zigzag crack, slight separated halves but still one readable icon, warm maple-gold waffle-grid bevel texture, clear at 24px-80px. It should look like the damaged version of the full life heart.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, front view with slight dimensional bevel, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Power-Up Skip

- Source: `public/images/v2/generated/powerup-skip-ai-source.png`
- Final: `public/images/v2/generated/powerup-skip-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 skip power-up icon: a chunky curved fast-forward arrow wrapping around a small golden waffle tile, magenta arcade accents, premium pixel-inspired 3D mobile game style, crisp dark outline, high contrast, no text, no numbers, no logo. Centered with generous padding. Put it on a perfectly flat solid #00ff00 background, uniform edge to edge, with no shadow, no gradient, no glow on the background, no floor, no texture, and no #00ff00 in the object.
```

### Power-Up 50/50

- Source: `public/images/v2/generated/powerup-5050-ai-source.png`
- Final: `public/images/v2/generated/powerup-5050-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 50/50 power-up icon without text: two chunky waffle answer tiles side by side, one bright maple-gold active tile and one dim charcoal disabled tile, separated by a cyan lightning slash. Premium pixel-inspired 3D mobile game icon, crisp black-brown outline, saturated arcade colors, soft bevels, high contrast. Centered object with generous padding. Perfectly flat solid #ff00ff background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #ff00ff anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Power-Up Time

- Source: `public/images/v2/generated/powerup-time-ai-source.png`
- Final: `public/images/v2/generated/powerup-time-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 time power-up icon without text: a chunky golden stopwatch shaped like a small waffle timer, cyan clock hand, maple-gold bevels, tiny spark accents, premium pixel-inspired 3D mobile game icon, crisp black-brown outline, saturated arcade colors, high contrast. Centered object with generous padding. Perfectly flat solid #ff00ff background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #ff00ff anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Power-Up Shield

- Source: `public/images/v2/generated/powerup-shield-ai-source.png`
- Final: `public/images/v2/generated/powerup-shield-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 shield power-up icon without text: a chunky protective shield with a golden waffle-grid face, cyan rim glow accents, maple-gold bevels, sturdy heroic silhouette, premium pixel-inspired 3D mobile game icon, crisp black-brown outline, saturated arcade colors, high contrast. Centered object with generous padding. Perfectly flat solid #ff00ff background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #ff00ff anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Chest Rainbow

- Source: `public/images/v2/generated/chest-rainbow-ai-source.png`
- Final: `public/images/v2/generated/chest-rainbow-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then connected-background chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 rainbow reward chest icon without text: a chunky treasure chest with maple-gold waffle panels, rainbow gem trim, bright premium top-prize feel, crisp black-brown outline, soft bevels, saturated arcade colors, premium pixel-inspired 3D mobile game icon. Centered object with generous padding. Perfectly flat solid #ff00ff background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #ff00ff anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Chest Purple

- Source: `public/images/v2/generated/chest-purple-ai-source.png`
- Final: `public/images/v2/generated/chest-purple-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 purple reward chest icon without text: a chunky treasure chest with maple-gold waffle panels, deep purple gem trim, mid-tier magical reward feel, crisp black-brown outline, soft bevels, saturated arcade colors, premium pixel-inspired 3D mobile game icon. Centered object with generous padding. Perfectly flat solid #00ff00 background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #00ff00 anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Chest Brown

- Source: `public/images/v2/generated/chest-brown-ai-source.png`
- Final: `public/images/v2/generated/chest-brown-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Create a Waffles V2 brown reward chest icon without text: a chunky wooden treasure chest with dark espresso-brown wood, maple-gold waffle panels and simple bronze trim, common reward feel, crisp black-brown outline, soft bevels, saturated arcade colors, premium pixel-inspired 3D mobile game icon. Centered object with generous padding. Perfectly flat solid #00ff00 background edge-to-edge for removal, no shadows, no glow on the background, no gradient, no floor, no texture. Do not use #00ff00 anywhere in the icon. No words, no numbers, no logo, no watermark.
```

### Medal Apprentice

- Source: `public/images/v2/generated/medal-apprentice-ai-source.png`
- Final: `public/images/v2/generated/medal-apprentice-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game league badge reward icon
Primary request: Create the Waffles V2 apprentice league medal icon.
Subject: A single chunky beginner league medal, bronze-maple waffle medallion with a simple small ribbon loop, subtle waffle-grid embossing, friendly entry-tier feel, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp black-brown outline, saturated arcade colors, soft bevels, warm maple-gold highlights, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no letters, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Medal Silver

- Source: `public/images/v2/generated/medal-silver-ai-source.png`
- Final: `public/images/v2/generated/medal-silver-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game league badge reward icon
Primary request: Create the Waffles V2 silver league medal icon.
Subject: A single chunky silver league medal with a waffle-grid medallion face, cool silver rim, cyan-blue ribbon loop, polished mid-tier feel, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp black-brown outline, saturated arcade colors, soft bevels, warm maple-gold accent highlights, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no letters, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Medal Advanced

- Source: `public/images/v2/generated/medal-advanced-ai-source.png`
- Final: `public/images/v2/generated/medal-advanced-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game league badge reward icon
Primary request: Create the Waffles V2 advanced league medal icon.
Subject: A single chunky advanced league medal, polished emerald-green and maple-gold waffle medallion with angular gem trim and a compact ribbon loop, energetic upper-tier feel, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp black-brown outline, saturated arcade colors, soft bevels, warm maple-gold highlights, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no logo, no words, no letters, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Medal Genius

- Source: `public/images/v2/generated/medal-genius-ai-source.png`
- Final: `public/images/v2/generated/medal-genius-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game league badge reward icon
Primary request: Create the Waffles V2 genius league medal icon.
Subject: A single chunky genius league medal, violet-purple and bright maple-gold waffle medallion with star-like gem facets around the rim and a compact royal ribbon loop, brilliant high-tier feel, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp black-brown outline, saturated arcade colors, soft bevels, warm maple-gold highlights, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no letters, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Medal Master

- Source: `public/images/v2/generated/medal-master-ai-source.png`
- Final: `public/images/v2/generated/medal-master-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game league badge reward icon
Primary request: Create the Waffles V2 master league medal icon.
Subject: A single chunky master league medal, premium black obsidian and radiant maple-gold waffle medallion with crown-like top facets, tiny red-orange jewel accents, ultimate champion feel, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp black-brown outline, saturated arcade colors, soft bevels, warm maple-gold highlights, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no letters, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```

### Avatar Fox

- Source: `public/images/v2/generated/avatar-fox-ai-source.png`
- Final: `public/images/v2/generated/avatar-fox-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 fox player avatar.
Subject: A friendly orange fox adventurer avatar, head-and-shoulders bust with perky ears, confident small smile, teal neckerchief, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Bear

- Source: `public/images/v2/generated/avatar-bear-ai-source.png`
- Final: `public/images/v2/generated/avatar-bear-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 bear player avatar.
Subject: A friendly cream-and-honey bear adventurer avatar, head-and-shoulders bust with round ears, warm curious expression, small purple collar scarf with a maple-gold badge accent, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Frog

- Source: `public/images/v2/generated/avatar-frog-ai-source.png`
- Final: `public/images/v2/generated/avatar-frog-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 frog player avatar.
Subject: A cheerful green frog adventurer avatar, head-and-shoulders bust with big expressive eyes, rounded cheeks, small magenta bow tie, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #0000ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #0000ff anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Panda

- Source: `public/images/v2/generated/avatar-panda-ai-source.png`
- Final: `public/images/v2/generated/avatar-panda-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 panda player avatar.
Subject: A playful panda adventurer avatar, head-and-shoulders bust with black-and-white face, bright cyan cap or headband, red-orange accent band, upbeat expression, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Owl

- Source: `public/images/v2/generated/avatar-owl-ai-source.png`
- Final: `public/images/v2/generated/avatar-owl-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 owl player avatar.
Subject: A clever purple owl adventurer avatar, head-and-shoulders bust with round golden eyes, small teal goggles resting on the face or forehead, compact feathers, wise upbeat expression, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Cat

- Source: `public/images/v2/generated/avatar-cat-ai-source.png`
- Final: `public/images/v2/generated/avatar-cat-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 cat player avatar.
Subject: A sleek gray cat adventurer avatar, head-and-shoulders bust with green eyes, small purple cape collar, tiny maple-gold pendant, calm clever expression, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Dog

- Source: `public/images/v2/generated/avatar-dog-ai-source.png`
- Final: `public/images/v2/generated/avatar-dog-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 dog player avatar.
Subject: A happy golden dog adventurer avatar, head-and-shoulders bust with floppy ears, tongue-out smile, blue collar with tiny maple-gold charm, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Avatar Rabbit

- Source: `public/images/v2/generated/avatar-rabbit-ai-source.png`
- Final: `public/images/v2/generated/avatar-rabbit-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game player avatar character cutout
Primary request: Create the Waffles V2 rabbit player avatar.
Subject: A sweet white rabbit adventurer avatar, head-and-shoulders bust with tall ears, pink bow, small teal scarf, bright friendly expression, compact rounded proportions, clear at 32px-96px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated arcade colors, warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered avatar bust, front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Boss Night Owl

- Source: `public/images/v2/generated/boss-night-owl-ai-source.png`
- Final: `public/images/v2/generated/boss-night-owl-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game boss marker character cutout
Primary request: Create the Waffles V2 Night Owl boss character.
Subject: A dramatic twilight forest owl boss, full-body compact character with broad wings folded like a cloak, deep purple feathers, glowing golden eyes, tiny crown-like maple-gold brow feathers, sturdy talons, confident challenge pose. The character should feel tougher than the player avatars but still cute and readable at 80px-160px.
Style: premium mobile game character sprite, chunky pixel-inspired 3D illustration, crisp silhouette, soft bevels, saturated twilight purple and midnight blue palette with warm maple-gold highlights, dark readable black-brown outline, playful but polished, no text.
Composition: centered full-body character, orthographic/front three-quarter view, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no brand logos, no words, no letters, no numbers, no watermark, no extra props, no sparkles, no cast shadow, no contact shadow, no reflection.
```

### Waffle Slab Active

- Source: `public/images/v2/generated/waffle-slab-active-ai-source.png`
- Final: `public/images/v2/generated/waffle-slab-active-ai.png`
- Dimensions: 1536 x 1024
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game isometric map tile
Primary request: Create the active waffle slab tile for the Waffles V2 level path.
Subject: One isometric waffle slab occupying a 2:1 diamond top face, warm maple-gold waffle material, raised active rim, subtle cyan glow accents along the edges, and a clear playable-current-state feel without labels.
Style: premium mobile game map tile, chunky pixel-inspired 3D illustration, crisp black-brown outline, soft bevels, saturated arcade color, maple-gold highlights, readable at 48px-96px.
Composition: isolated tile centered in frame, top face aligned as a 2:1 isometric diamond, consistent depth, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no text, no numbers, no letters, no logo, no watermark, no extra scenery, no cast shadow, no reflection.
```

### Waffle Slab Done

- Source: `public/images/v2/generated/waffle-slab-done-ai-source.png`
- Final: `public/images/v2/generated/waffle-slab-done-ai.png`
- Dimensions: 1536 x 1024
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game isometric map tile
Primary request: Create the completed waffle slab tile for the Waffles V2 level path.
Subject: One isometric waffle slab occupying a 2:1 diamond top face, warm maple-gold waffle material, completed-state polished surface, small raised checkmark-shaped maple-gold inset made from geometry only, subtle celebratory emerald accent trim, no labels.
Style: premium mobile game map tile, chunky pixel-inspired 3D illustration, crisp black-brown outline, soft bevels, saturated arcade color, maple-gold highlights, readable at 48px-96px.
Composition: isolated tile centered in frame, top face aligned as a 2:1 isometric diamond, consistent depth matching the active tile, generous padding, no cropping.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no numbers, no letters, no logo, no watermark, no extra scenery, no cast shadow, no reflection.
```

### Waffle Slab Locked

- Source: `public/images/v2/generated/waffle-slab-locked-ai-source.png`
- Final: `public/images/v2/generated/waffle-slab-locked-ai.png`
- Dimensions: 1536 x 1024
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game isometric map tile
Primary request: Create the locked waffle slab tile for the Waffles V2 level path.
Subject: One isometric waffle slab occupying a 2:1 diamond top face, muted dark maple waffle material, locked-state reinforced rim, small chunky padlock-shaped inset made from geometry only, charcoal side panels, subtle dim blue-gray trim, no labels.
Style: premium mobile game map tile, chunky pixel-inspired 3D illustration, crisp black-brown outline, soft bevels, saturated but muted arcade color, readable at 48px-96px.
Composition: isolated tile centered in frame, top face aligned as a 2:1 isometric diamond, consistent depth matching the active tile, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no text, no numbers, no letters, no logo, no watermark, no extra scenery, no cast shadow, no reflection.
```

### Forest Floor Tile

- Source: `public/images/v2/generated/forest-floor-tile-ai-source.png`
- Final: `public/images/v2/generated/forest-floor-tile-ai.png`
- Dimensions: 1254 x 1254
- Alpha: no
- Mode: built-in image generation
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game repeatable terrain texture tile
Primary request: Create the Waffles V2 twilight forest floor tile.
Subject: A square top-down forest floor texture tile with soft moss, dark teal grass, tiny leaf shapes, subtle waffle-maple flecks, and enough edge continuity to work as a repeated CSS background. No large focal object.
Style: premium mobile game terrain texture, chunky pixel-inspired 3D illustration, saturated twilight forest palette, soft bevels, dark readable shapes, warm maple-gold accent flecks, playful but polished.
Composition: full-frame square texture, evenly distributed details, no central subject, no border, no labels.
Background: full image is the texture tile; no chroma-key background.
Constraints: no text, no numbers, no letters, no logo, no watermark, no characters, no UI elements, no hard seams.
```

### Cloud

- Source: `public/images/v2/generated/cloud-ai-source.png`
- Final: `public/images/v2/generated/cloud-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 cloud prop for the twilight forest level map.
Subject: One soft compact cloud puff, pale blue-white with lavender twilight shadow, rounded chunky lobes, readable at 24px-80px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark subtle outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Terrain Stone

- Source: `public/images/v2/generated/terrain-stone-ai-source.png`
- Final: `public/images/v2/generated/terrain-stone-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 terrain stone prop for the twilight forest level map.
Subject: A compact cluster of two or three faceted bluish-gray stones, chunky and readable at 24px-80px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accent edge highlights.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Cabin

- Source: `public/images/v2/generated/forest-cabin-ai-source.png`
- Final: `public/images/v2/generated/forest-cabin-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 forest cabin prop for the twilight forest level map.
Subject: A tiny cozy forest cabin, compact wooden hut with maple-gold window glow, dark teal roof, sturdy readable silhouette at 48px-96px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Pond

- Source: `public/images/v2/generated/forest-pond-ai-source.png`
- Final: `public/images/v2/generated/forest-pond-ai.png`
- Dimensions: 1536 x 1024
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 forest pond prop for the twilight forest level map.
Subject: A small oval twilight pond with glossy deep cyan water, rounded mossy edge stones, a few maple-gold highlights, compact and readable at 48px-96px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, slight top/front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Frog

- Source: `public/images/v2/generated/forest-frog-ai-source.png`
- Final: `public/images/v2/generated/forest-frog-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 forest frog prop for the twilight forest level map.
Subject: A tiny green forest frog sitting low with bright curious eyes, compact and readable at 16px-40px, simpler than the player avatar frog.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #0000ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #0000ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Tree Pine

- Source: `public/images/v2/generated/forest-tree-pine-ai-source.png`
- Final: `public/images/v2/generated/forest-tree-pine-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 pine tree prop for the twilight forest level map.
Subject: A compact evergreen pine tree with stacked triangular boughs, dark teal needles, warm maple-gold edge highlights, sturdy short trunk, readable at 40px-96px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Tree Bush

- Source: `public/images/v2/generated/forest-tree-bush-ai-source.png`
- Final: `public/images/v2/generated/forest-tree-bush-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 rounded tree bush prop for the twilight forest level map.
Subject: A compact rounded leafy bush or small tree clump, layered dark green and teal leaves, chunky base, warm maple-gold rim highlights, readable at 32px-80px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Mushroom

- Source: `public/images/v2/generated/forest-mushroom-ai-source.png`
- Final: `public/images/v2/generated/forest-mushroom-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 mushroom prop for the twilight forest level map.
Subject: A small cluster of two chunky forest mushrooms with coral-red caps, cream spots, stout stems, teal shadow underside, readable at 20px-48px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Flowers

- Source: `public/images/v2/generated/forest-flowers-ai-source.png`
- Final: `public/images/v2/generated/forest-flowers-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 flowers prop for the twilight forest level map.
Subject: A tiny cluster of bright forest flowers and leaves, maple-gold and cyan blossoms on dark teal foliage, compact and readable at 20px-48px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Stump

- Source: `public/images/v2/generated/forest-stump-ai-source.png`
- Final: `public/images/v2/generated/forest-stump-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 forest stump prop for the twilight forest level map.
Subject: A small chunky cut tree stump with visible rings, dark bark sides, mossy teal accents, warm maple-gold top highlights, readable at 24px-64px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Signpost

- Source: `public/images/v2/generated/forest-signpost-ai-source.png`
- Final: `public/images/v2/generated/forest-signpost-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 forest signpost prop for the twilight forest level map.
Subject: A compact wooden signpost with one blank arrow plank, maple-gold edge highlights, teal moss at the base, readable at 32px-80px. The sign surface must be completely blank.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front three-quarter view, generous padding.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: no text, no symbols, no numbers, no letters, no watermark, no extra props, no cast shadow, no reflection.
```

### Forest Firefly

- Source: `public/images/v2/generated/forest-firefly-ai-source.png`
- Final: `public/images/v2/generated/forest-firefly-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 firefly prop for the twilight forest level map.
Subject: One tiny glowing firefly light sprite, round maple-gold body with two small teal wings, warm glow contained inside the subject silhouette, readable at 12px-24px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front view, generous padding.
Background: perfectly flat solid #0000ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #0000ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection, no glow spilling onto the background.
```

### Forest Moon

- Source: `public/images/v2/generated/forest-moon-ai-source.png`
- Final: `public/images/v2/generated/forest-moon-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game forest prop sprite
Primary request: Create the Waffles V2 moon prop for the twilight forest level map.
Subject: One crescent moon sprite, pale maple-gold crescent with soft lavender shadow side, compact and readable at 32px-80px.
Style: premium mobile game prop, chunky pixel-inspired 3D illustration, crisp silhouette, dark subtle outline, saturated twilight forest palette with warm maple accents.
Composition: centered isolated prop, front view, generous padding.
Background: perfectly flat solid #0000ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #0000ff anywhere in the subject.
Constraints: no text, no watermark, no extra props, no cast shadow, no reflection, no glow spilling onto the background.
```

### Forest Scene Hero

- Source: `public/images/v2/generated/forest-scene-hero-ai-source.png`
- Final: `public/images/v2/generated/forest-scene-hero-ai.png`
- Dimensions: 1024 x 1536
- Alpha: no
- Mode: built-in image generation
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game full-screen level background scene
Primary request: Create the Waffles V2 twilight forest hero scene.
Subject: A full-screen enchanted twilight forest clearing for a mobile trivia level map, with layered dark teal pine trees, rounded bushes, mossy forest floor, a small glowing pond, a tiny warm cabin in the distance, firefly lights, and a crescent moon above. Keep the center and lower foreground open enough for game path tiles or UI elements to overlay later.
Style: premium mobile game background, chunky pixel-inspired 3D illustration, saturated twilight forest palette, crisp readable silhouettes, soft bevels, warm maple-gold highlights, playful but polished, cohesive with Waffles V2 props and characters.
Composition: vertical-friendly scene with depth layers, open playable foreground, horizon in upper third, no cropping of key scenery, no framed border.
Background: full-frame scene, no chroma-key background, no transparency.
Constraints: no text, no numbers, no letters, no logo, no watermark, no UI elements, no characters as the main subject, no photorealism.
```

### Trophy

- Source: `public/images/v2/generated/trophy-ai-source.png`
- Final: `public/images/v2/generated/trophy-ai.png`
- Dimensions: 1254 x 1254
- Alpha: yes
- Mode: built-in image generation, then local chroma-key removal
- Status: first candidate; not yet wired into the sample
- Prompt:

```text
Use case: stylized-concept
Asset type: mobile game reward icon
Primary request: Create the Waffles V2 trophy icon.
Subject: A single golden trophy cup with waffle-grid embossing on the bowl, chunky handles, warm maple-gold highlights, and a small dark base, clear at 24px-80px.
Style: premium mobile game icon, chunky pixel-inspired 3D illustration, crisp dark black-brown outline, saturated arcade color, soft bevels, high contrast, no text.
Composition: centered object, slight front three-quarter angle, generous padding, no cropping.
Background: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.
Constraints: no logo, no words, no numbers, no watermark, no extra objects, no cast shadow, no reflection.
```
