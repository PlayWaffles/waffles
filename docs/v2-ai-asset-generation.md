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
| `boss-night-owl.webp` | Boss marker | Character cutout | Pending |
| `waffle-slab-active.webp`, `waffle-slab-done.webp`, `waffle-slab-locked.webp` | Level path tiles | Isometric world tile set | Pending |
| `forest-*.webp`, `terrain-stone.webp`, `cloud.webp` | Level scenery | Forest prop set | Pending |
| `forest-scene-hero.webp` | Full-screen level scene | Background scene | Pending |

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
