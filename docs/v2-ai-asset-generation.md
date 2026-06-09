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
| `ticket.webp` | Ticket currency | Reward icon | Pending |
| `flame.webp` | Streak indicator | Reward icon | Pending |
| `trophy.webp` | Competition reward | Reward icon | Pending |
| `heart-full.webp`, `heart-empty.webp`, `heart-broken.webp` | Lives states | Reward icon set | Pending |
| `powerup-5050.webp`, `powerup-time.webp`, `powerup-skip.webp`, `powerup-shield.webp` | Shop power-ups | Reward icon set | Pending |
| `chest-rainbow.webp`, `chest-purple.webp`, `chest-brown.webp` | League rewards | Reward icon set | Pending |
| `medal-apprentice.webp`, `medal-silver.webp`, `medal-advanced.webp`, `medal-genius.webp`, `medal-master.webp` | League badges | Reward icon set | Pending |
| `avatar-*.webp` | Player avatars | Character cutout set | Pending |
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
