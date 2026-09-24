# WOM.fm Flyer Types

This file defines the canonical WOM.fm flyer formats and reference implementations.

Always follow `FLYER_SPEC.md` and `CONFIG_SPEC.md`.

## Core Principle

Flyer format, track count and interaction pattern are separate dimensions.

- The **format** describes how content is presented.
- **Track count** is derived from `tracks.length` and does not create a type.
- The **interaction pattern** controls sharing, CTA and feedback behaviour.

Do not create a new flyer type for a different number of tracks, CTA destination, feedback sequence, language, partner or production method.

---

## Canonical Base Formats

| Format | Purpose | Reference Flyer | Current config value |
|---|---|---|---|
| `audio` | Standard audio experience with one or more tracks | `/250` | Existing configs may use `playlist` or `single` |
| `visual-audio` | Audio with track-specific visual guidance | `/800` | `auma` |

### Audio

Audio flyers use the standard WOM.fm player.

- With one track, previous/next controls are automatically hidden.
- With multiple tracks, previous/next controls are shown.
- The same shared UI is used in both cases.

`/100` is the canonical one-track example. It is not a separate flyer type.

### Visual Audio

Visual Audio adds a track-specific image to the shared audio experience. The visual changes with the active track.

The current implementation and existing configs use the legacy value `auma`. Treat `visual-audio` as the human-readable format name and `auma` as the current runtime value.

---

## Interaction Patterns

Interaction patterns are configured independently of the base format.

| Preset | Behaviour |
|---|---|
| `share` | Reveal WhatsApp and the secondary share action |
| `cta` | Reveal the configured website or telephone action, with WhatsApp where enabled |
| `feedback_basic` | Collect simple yes/no feedback |
| `feedback_2step_share` | Collect feedback, then reveal sharing actions |
| `feedback_2step_cta` | Collect feedback, then reveal a CTA |

### Ambient Feedback

Ambient Feedback is a named interaction pattern, not a mutually exclusive base format.

It combines:

- an Audio or Visual Audio flyer
- sentiment feedback (`good`, `neutral`, `poor`)
- optional question text
- optional thank-you audio
- an optional follow-up share or CTA step

Canonical reference: `/700`.

Because interactions are composable, a Visual Audio flyer can also use Ambient Feedback. Do not create a new flyer type for that combination.

---

## Current Runtime Compatibility

Existing configs contain legacy `type` values:

| Existing value | Interpret as | Notes |
|---|---|---|
| `playlist` | Audio | Track count determines whether navigation is shown |
| `single` | Audio | Legacy one-track label; not a separate format |
| `auma` | Visual Audio | Activates the canonical Visual Audio behaviour |

Do not bulk-migrate existing configs as part of normal flyer production. Copy the canonical reference faithfully unless a separate migration has been approved.

`custom` is an exception process, not a routine config value. A genuinely new interaction or UI requires an explicit specification and approval before shared application code is changed.

---

## Reference Selection

When creating a flyer:

1. Select the base format: Audio or Visual Audio.
2. Select the interaction preset.
3. Use the canonical reference for the base format or the explicitly named reference flyer.
4. Copy only the reference slot's config and required assets.
5. Preserve the shared WOM.fm UI and interaction logic.
6. Change only content, assets, branding and approved configuration.

If the request does not fit the documented formats and interaction patterns, ask for clarification rather than inventing a new type or interface.

---

## Canonical References

- Audio, multiple tracks: `/250`
- Audio, one-track example: `/100`
- Visual Audio: `/800`
- Ambient Feedback pattern: `/700`

Canonical references should change only when a replacement has explicitly been approved as the standard implementation.
