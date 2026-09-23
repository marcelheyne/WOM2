# WOM.fm Flyer Types

This file defines the canonical reference flyer for each WOM.fm interaction type.

Always follow `/WOM2/flyers/FLYER_SPEC.md`.

## Core Principle

Flyer types describe the interaction model.

The number of audio tracks does not create a separate flyer type.

For example:

- 1 audio track = Audio Flyer
- multiple audio tracks = Audio Flyer

The shared application automatically adapts the controls to the number of tracks.

---

## Canonical Flyer Types

| Type | Purpose | Reference Flyer | Notes |
|---|---|---|---|
| `audio` | Standard audio experience with one or more tracks | `/250` | With one track, previous/next controls are automatically hidden. With multiple tracks, playlist navigation is enabled. |
| `visual-audio` | Audio combined with track-specific visual guidance | `/800` | Canonical stable Visual Audio example. Visual changes with the active audio track. |
| `ambient-feedback` | Simple sentiment / response interaction | `/700` | Canonical Ambient Feedback example. |
| `custom` | Exceptional project-specific interaction | None | Requires explicit specification and approval. Do not invent a new UI. |

## Audio Flyer Behaviour

Audio flyers use the standard WOM.fm audio interface.

### One track

When only one track is configured:

- show the standard player
- do not show previous/next controls
- retain progress, time and sharing/actions
- do not redesign the interface to compensate for the missing navigation

### Multiple tracks

When more than one track is configured:

- show previous/next controls
- preserve supplied track order
- update the displayed track title when tracks change

The same underlying Audio Flyer UI is used in both cases.

---

## Reference Selection

When creating a new flyer:

1. Determine the interaction type.
2. Use the canonical reference flyer listed above.
3. Follow `FLYER_SPEC.md`.
4. Preserve the reference UI and interaction pattern.
5. Change only content, assets, branding and explicitly requested configuration.

If the requested interaction does not fit one of the documented types, do not invent a new type or interface. Ask for clarification.

---

## Current Canonical References

- Audio: `/250`
- Visual Audio: `/800`
- Ambient Feedback: `/700`

Canonical references should only be changed when a newer flyer has explicitly been approved as the standard implementation.