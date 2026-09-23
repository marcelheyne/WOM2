# WOM.fm Flyer Specification

## Purpose

A WOM.fm flyer is a lightweight, mobile-first interface for accessing audio or other campaign content.

A flyer is **not a standalone website design**.

When creating a new flyer, always start from an existing WOM.fm flyer of the same type and preserve its established interface patterns.

The goal is consistency, speed, reliability and recognizability across all WOM.fm flyers.

---

## Core Principle

**Do not redesign the WOM.fm interface.**

A new flyer is an instance of the existing WOM.fm system.

When a reference flyer is specified:

1. Copy the reference flyer as the technical and visual starting point.
2. Preserve its DOM structure, layout, spacing, typography, player controls, responsive behaviour and interaction patterns.
3. Replace only the content and assets required for the new flyer.
4. Make design changes only when explicitly requested.

Do not interpret “create a new flyer” as permission to create a new UI.

---

## Reference Flyers

Always use a flyer of the same functional type as the starting point.

Examples:

- Audio-only playlist: use an existing audio-only flyer, e.g. `/250`
- Other flyer types: use the closest existing WOM.fm implementation specified in the task

If the task specifies a reference flyer, that flyer is authoritative.

Do not combine UI elements from different flyers unless explicitly requested.

---

## What May Be Changed

Unless otherwise instructed, the following elements may be changed:

- slot number
- page title
- playlist title
- track titles
- audio files
- descriptions
- logos
- partner branding
- background or accent colors
- metadata
- sharing text
- QR-related destination
- language
- analytics identifiers or configuration
- other content explicitly named in the task

---

## What Must Normally Remain Unchanged

Unless explicitly requested, preserve:

- overall page structure
- player position
- play/pause control
- previous/next controls
- progress bar
- time display
- share buttons
- WhatsApp button
- button placement
- typography hierarchy
- spacing
- element sizes
- responsive layout
- mobile behaviour
- desktop behaviour
- animations
- interaction logic
- existing accessibility behaviour
- existing analytics logic
- existing asset-loading approach

Do not add new cards, panels, navigation elements, icons, headers, footers, decorative sections or explanatory UI.

Do not move controls because another arrangement appears more attractive.

---

## Mobile First

WOM.fm flyers are primarily designed for smartphones.

Always verify the flyer at mobile width.

The primary content and controls must be usable without zooming.

Avoid:

- horizontal scrolling
- small tap targets
- unnecessary text
- excessive vertical spacing
- desktop-first layouts
- UI elements that compete with the primary action

The flyer should feel immediate and simple.

---

## Audio-only Playlist Flyers

For an audio-only playlist:

- retain the established WOM.fm audio player
- show one active track at a time
- retain previous and next navigation
- retain the progress bar and elapsed/total time
- retain WhatsApp and share functionality
- use the supplied track titles
- load audio files from the established asset structure
- preserve the playlist order exactly as supplied

Do not create custom playlist cards, waveform players, accordions, carousels or alternative audio controls unless explicitly requested.

---

## Branding

Partner branding should be integrated into the existing WOM.fm UI, not used to redesign it.

Prefer:

- partner logo
- restrained accent color adaptation
- existing WOM.fm typography and layout

Avoid deriving an entire color palette from a visually complex partner logo.

If a partner logo contains many colors, keep the WOM.fm interface simple and use only one or two compatible accent colors.

WOM.fm should remain visually coherent even when partner branding changes.

---

## Prototype Branding

If a partner has not yet formally approved the flyer, do not imply endorsement.

Use wording such as:

- `Prototipo para revisión`
- `Draft for review`
- equivalent wording appropriate to the language

Do not state or imply that a partner recommends, validates or endorses the content unless explicitly confirmed.

---

## Content Integrity

Do not rewrite supplied content unless the task explicitly asks for editing.

Preserve:

- track order
- track titles
- scripts
- calls to action
- language
- partner names

Do not invent additional claims, especially for health, safety, financial or legal content.

---

## URLs

WOM.fm flyer URLs must always be written without `www`.

Correct:

`wom.fm/270`

Incorrect:

`www.wom.fm/270`

The `www` hostname may route differently and must not be used for flyer links.

---

## Slot Creation

Before creating a new flyer:

1. Check whether the requested slot already exists.
2. If it is free, use it.
3. If it is occupied, do not overwrite it unless explicitly instructed.
4. Choose the next suitable free slot only if the task permits this.

Create the new flyer by copying the specified reference flyer.

Do not modify the reference flyer.

---

## Asset Handling

Keep flyer-specific assets inside the established folder structure.

Use clear, predictable filenames.

For audio playlists, filenames should preferably reflect track order.

Example:

- `01-alert-signs.mp3`
- `02-breathing.mp3`
- `03-diarrhea.mp3`

Do not leave unused assets copied from the reference flyer.

Do not leave references to assets belonging to the source flyer.

---

## Analytics

Preserve the existing WOM.fm analytics implementation.

When copying a flyer:

- verify that tracking refers to the new slot
- verify that old playlist or campaign identifiers are not retained
- preserve existing event names and tracking logic unless explicitly requested otherwise

Do not redesign or replace analytics code as part of normal flyer creation.

---

## Sharing

Preserve existing sharing functionality.

Verify:

- WhatsApp sharing
- generic share button
- shared URL
- shared title/text where applicable

The shared URL must point to the new WOM.fm slot and must not contain `www`.

---

## Quality Assurance

Before considering a flyer complete, verify all of the following:

- correct slot
- correct title
- correct logo
- correct branding
- correct track order
- all audio files load
- play/pause works
- previous/next works
- progress bar works
- elapsed and total time work
- WhatsApp sharing works
- generic sharing works
- shared URL is correct
- no references to the source flyer remain
- analytics point to the correct flyer
- layout matches the reference flyer
- mobile layout works correctly
- desktop layout remains functional
- no unnecessary UI elements were introduced
- no supplied text was unintentionally altered

---

## Agent Rule

When working on WOM.fm flyers:

**Prefer copying and replacing over redesigning and rebuilding.**

If unsure whether a UI change is allowed, preserve the reference implementation.

Consistency is more important than creativity.