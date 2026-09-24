# WOM.fm Flyer Specification

## Purpose

A WOM.fm flyer is a lightweight, mobile-first interface for accessing audio and related campaign content.

A flyer is **not a standalone website design**. It is a configured instance of the shared WOM.fm application.

The goal is consistency, speed, reliability and recognizability across all WOM.fm flyers.

---

## Core Principle

**Do not redesign the WOM.fm interface.**

Normal flyer production should change only a slot's `config.json` and flyer-specific assets.

When a reference flyer is specified:

1. Copy its slot folder as the configuration and asset starting point.
2. Preserve the shared DOM structure, layout, typography, controls, responsive behaviour and interaction logic.
3. Replace only the content, assets and approved configuration required for the new flyer.
4. Remove copied assets and references that are not used.
5. Make shared UI or application changes only when explicitly requested and approved.

Do not interpret “create a new flyer” as permission to create a new UI.

---

## System Boundaries

The WOM.fm Flyer System consists of:

- one shared HTML shell (`/slot.html`)
- shared application logic and styling (`/assets/`)
- brand-specific flyer slots (`/flyers/wom/` and `/flyers/cit/`)
- a `config.json` and assets for each slot
- central alias and routing configuration

Follow `FLYER_TYPES.md` for taxonomy and canonical references. Follow `CONFIG_SPEC.md` for supported configuration.

---

## Reference Flyers

- Audio, multiple tracks: `/250`
- Audio, one-track example: `/100`
- Visual Audio: `/800`
- Ambient Feedback interaction: `/700`

If a task specifies another reference flyer, that flyer is authoritative for the requested configuration and assets.

Do not combine UI elements from different flyers unless explicitly requested.

---

## What May Be Changed

Unless otherwise instructed, normal flyer production may change supported configuration and flyer-specific assets such as:

- slot number
- flyer and track titles
- track order
- audio files
- track-specific images and alternative text
- partner logo and alternative text
- primary and accent colors
- CTA URL or telephone number
- feedback question and thank-you audio
- visibility of supported actions
- analytics site ID

Do not assume that descriptions, arbitrary metadata, custom share text, QR destinations or language settings are supported config fields. If one is required, check the shared application and request clarification before changing shared code.

---

## What Must Normally Remain Unchanged

Unless explicitly requested, preserve:

- overall page structure
- player position and controls
- progress and time display
- share and CTA button placement
- typography hierarchy
- spacing and element sizes
- responsive and compact layouts
- animations and interaction logic
- accessibility behaviour
- analytics event logic
- asset-loading approach

Do not add new cards, panels, navigation, icons, headers, footers, decorative sections or explanatory UI.

---

## Mobile First

WOM.fm flyers are primarily designed for smartphones.

Always verify the flyer at mobile width. Primary content and controls must be usable without zooming.

Avoid:

- horizontal scrolling
- small tap targets
- unnecessary text
- excessive vertical spacing
- desktop-first layouts
- UI elements that compete with the primary action

The flyer should feel immediate and simple.

---

## Audio Behaviour

All Audio flyers use the same shared player.

For every Audio flyer:

- show one active track at a time
- retain the progress bar and elapsed/total time
- use the supplied track titles and order
- load audio from the established asset structure
- preserve configured sharing, CTA or feedback behaviour

When one track is configured, previous/next controls are automatically hidden. When multiple tracks are configured, they are shown.

Do not create custom playlist cards, waveform players, accordions, carousels or alternative audio controls unless explicitly requested.

---

## Branding

Partner branding should be integrated into the existing WOM.fm UI, not used to redesign it.

Prefer:

- a partner logo
- restrained primary and accent colors
- existing WOM.fm typography and layout

If a logo contains many colors, use only one or two compatible interface colors.

If a partner has not approved the flyer, do not imply endorsement. Use appropriate draft wording such as `Draft for review` or `Prototipo para revisión` in the approved content; do not invent an extra UI element solely for that label.

---

## Content Integrity and Script Storage

Do not rewrite supplied content unless editing has explicitly been requested.

Preserve approved:

- scripts
- track titles and order
- calls to action
- language
- partner names
- health, safety, financial or legal claims

The canonical repository for source scripts, reviewed scripts and approval records is:

<https://drive.google.com/drive/folders/1XKJDEOG_I7aUNXzTih9-9ULhqewE5Tex>

The deployed flyer folder should contain delivery assets and configuration, not the working script history. Before generating or publishing audio, confirm that the correct script version has been reviewed and approved in the canonical Drive folder.

For sensitive content, final scripts and rendered audio require appropriate human/content validation before public or community use.

---

## Production Workflow

Source material → script adaptation → content approval → recording or TTS → audio QA → flyer config/assets → technical QA → publish

TTS is a production method, not a flyer type.

Generated audio must be checked directly for completeness, pronunciation, language, pacing and file integrity, even if the generation tool reports an error.

---

## URLs and Routing

WOM.fm flyer URLs must always be written without `www`.

Correct: `wom.fm/270`

Incorrect: `www.wom.fm/270`

Flyers may use numeric slots or approved aliases. Aliases and canonical redirects are managed centrally; do not create or change them unless the task includes that scope.

---

## Slot Creation

Before creating a flyer:

1. Check whether the requested slot already exists.
2. If it is free, use it.
3. If it is occupied, do not overwrite it unless explicitly instructed.
4. Choose another slot only when the task permits this.
5. Copy the canonical reference slot folder.
6. Do not modify the reference flyer.

---

## Asset Handling

Keep flyer-specific assets inside the slot's established folder structure.

Use clear filenames that reflect track order where practical, for example:

- `01-alert-signs.mp3`
- `02-breathing.mp3`
- `03-diarrhea.mp3`

Do not leave unused assets or references from the source flyer.

Relative asset paths resolve from the slot folder. See `CONFIG_SPEC.md` for supported path behaviour.

---

## Analytics

Preserve the shared WOM.fm analytics implementation.

When copying a flyer:

- set the approved analytics site ID
- verify that tracking identifies the new slot or canonical alias
- preserve existing event names and tracking logic
- do not retain obsolete campaign-specific values

Do not replace analytics code as part of normal flyer creation.

---

## Sharing and CTA

Preserve the configured interaction pattern.

Verify the applicable actions:

- WhatsApp sharing
- native sharing or its clipboard fallback
- website CTA
- telephone CTA
- feedback followed by share or CTA

The standard share message uses the flyer title. Custom share text is not currently a documented config field.

The shared URL must point to the correct slot or canonical alias and must not contain `www`.

---

## Quality Assurance

Before considering a flyer complete, verify:

- correct slot or alias
- correct title, logo and branding
- correct track order
- all audio and image assets load
- play/pause, progress and time display work
- previous/next work for multiple tracks
- previous/next remain hidden for one track
- Visual Audio changes image with the active track
- configured feedback and thank-you audio work
- configured share or CTA actions work
- shared URL is correct and contains no `www`
- analytics use the approved site and flyer identity
- no references or unused assets from the source flyer remain
- mobile and desktop layouts match the canonical reference
- no unapproved UI or content changes were introduced
- final audio matches the approved script in the canonical Drive folder

---

## Agent Rule

**Prefer copying and replacing over redesigning and rebuilding.**

If unsure whether a UI change is allowed, preserve the shared implementation and ask for clarification.

Consistency is more important than creativity.
