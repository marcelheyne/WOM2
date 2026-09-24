# WOM.fm Flyer Configuration Specification

## Purpose

Each WOM.fm flyer slot contains a `config.json` that supplies content and supported behaviour to the shared application.

Normal flyer production should change `config.json` and flyer-specific assets only. It should not modify `slot.html`, shared CSS or shared JavaScript.

This document describes the configuration currently consumed by `/assets/js/app.js`.

---

## Folder Structure

```text
/flyers/<brand>/<slot>/
  config.json
  audio/
  images/
```

- `<brand>` is normally `wom` or `cit` and is selected from the hostname.
- `<slot>` is a numeric flyer ID.
- Relative asset paths in `config.json` resolve from the slot folder.
- Root-relative paths and absolute `http`/`https` URLs are also accepted by the current application.

---

## Minimal Audio Config

```json
{
  "type": "playlist",
  "title": "Flyer title",
  "analytics": {
    "siteId": 1
  },
  "tracks": [
    {
      "title": "Track title",
      "src": "audio/01-track.mp3"
    }
  ]
}
```

At least one track is required.

---

## Top-Level Fields

| Field | Required | Purpose |
|---|---|---|
| `type` | Recommended | Current runtime format value; see compatibility table below |
| `title` | Recommended | Browser title, initial displayed title and standard share text |
| `analytics` | Recommended | Matomo configuration |
| `branding` | Optional | Logo and interface colors |
| `tracks` | Required | Ordered audio tracks |
| `interaction` | Optional | Interaction preset; defaults to `share` |
| `feedback` | Optional | Feedback behaviour and content |
| `cta` | Optional | Secondary website or telephone action |
| `actions` | Optional | Visibility of supported action buttons |
| `nudge` | Optional | Set to `false` to disable the WhatsApp engagement nudge |
| `ui` | Optional | Advanced shared-UI options documented below |

Unknown fields should not be assumed to affect the interface.

---

## Type Compatibility

Human-facing format names are defined in `FLYER_TYPES.md`. Existing runtime values are:

| `type` value | Meaning | Guidance |
|---|---|---|
| `playlist` | Audio | Used by canonical Audio configs, including one-track `/100` |
| `single` | Audio | Legacy one-track value; do not treat as a separate format |
| `auma` | Visual Audio | Canonical runtime value for Visual Audio |

Track count, not `type`, controls previous/next visibility.

Copy the value used by the canonical reference. Do not bulk-migrate existing configs during normal production.

---

## `analytics`

```json
"analytics": {
  "siteId": 1
}
```

- `siteId` selects the Matomo site.
- The shared application records flyer ID, flyer type and active track title as custom dimensions.
- The canonical numeric or alias URL is handled by the shared routing and analytics logic.

The legacy top-level `siteId` is also read, but new configs should use `analytics.siteId`.

---

## `branding`

```json
"branding": {
  "logo": "images/partner-logo.png",
  "alt": "Partner name",
  "primary": "#002874",
  "accent": "#0057b2",
  "logoHeight": 80
}
```

| Field | Purpose |
|---|---|
| `logo` | Relative, root-relative or absolute logo URL |
| `alt` | Logo alternative text |
| `primary` | Primary interface color |
| `accent` | Accent and default secondary-action color |
| `logoHeight` | Logo height in pixels |

If no valid logo is configured, the shared application hides the logo header.

---

## `tracks`

### Audio track

```json
{
  "title": "Track title",
  "src": "audio/01-track.mp3"
}
```

### Visual Audio track

```json
{
  "title": "Track title",
  "src": "audio/01-track.mp3",
  "image": {
    "src": "images/01-track.jpg",
    "alt": "Description of the visual"
  }
}
```

- Track order in the array is playback order.
- `title` is displayed and used in analytics.
- `src` points to the audio file.
- `image` supplies track-specific Visual Audio content.
- A string value for `image` is accepted for backward compatibility, but the object form with `src` and `alt` is preferred.
- `cover_art_url` is also read for backward compatibility.

With one track, previous/next controls are hidden. With multiple tracks, they are shown.

The query parameter `?t=<index>` can start playback at a zero-based track index. This is an advanced linking feature and must be tested before publication.

---

## `interaction`

```json
"interaction": {
  "preset": "share"
}
```

Supported presets:

| Preset | Behaviour |
|---|---|
| `share` | Standard WhatsApp and secondary sharing actions |
| `cta` | Standard actions with the configured secondary CTA |
| `feedback_basic` | Feedback replaces the initial actions |
| `feedback_2step_share` | Feedback first, then sharing actions |
| `feedback_2step_cta` | Feedback first, then CTA |

Missing or unknown values fall back to `share`.

---

## `feedback`

```json
"feedback": {
  "enabled": true,
  "kind": "sentiment",
  "showAfter": "play",
  "question": "How does this feel?",
  "showQuestionText": true,
  "thankYouAudioUrl": "audio/thanks.mp3"
}
```

| Field | Values and behaviour |
|---|---|
| `enabled` | Enables feedback when `true` |
| `kind` | `sentiment` for good/neutral/poor; other or omitted values use yes/no feedback |
| `showAfter` | `play` or `complete`; completion applies to the last track |
| `question` | Optional question text for sentiment feedback |
| `showQuestionText` | Question is shown only when explicitly `true` for sentiment feedback |
| `thankYouAudioUrl` | Optional audio played after a response |
| `mode` | Advanced override: `replace` or `append` |
| `phase` | Advanced override: `inline` or `two-step` |

The current app also reads feedback from `ui.feedback` for backward compatibility. New configs should use top-level `feedback`.

---

## `cta`

### Website CTA

```json
"cta": {
  "mode": "cta",
  "type": "url",
  "url": "https://example.org",
  "color": "#ea2264"
}
```

### Telephone CTA

```json
"cta": {
  "mode": "cta",
  "type": "call",
  "phone": "+49123456789"
}
```

| Field | Purpose |
|---|---|
| `mode` | Use `cta` for a CTA; otherwise the secondary action falls back to native sharing |
| `type` | `url`, `call` or `native` |
| `url` | Destination for a URL CTA |
| `phone` | Telephone number for a call CTA |
| `color` | Optional CTA color; falls back to the branding accent |

The legacy top-level `button` object is converted internally to `cta`. New configs should use `cta`.

---

## `actions`

```json
"actions": {
  "whatsapp": true,
  "secondary": true
}
```

- `whatsapp: false` hides the WhatsApp action.
- `secondary: false` hides the secondary share or CTA action.
- Omitted values default to visible when the interaction sequence reveals actions.

By default, visible actions are revealed after the first play. Set the advanced option below to show them immediately:

```json
"ui": {
  "actionsAfterPlay": false
}
```

---

## WhatsApp Nudge

After engagement, the shared application can animate the WhatsApp button once per flyer in a browser. This behaviour is enabled by default.

Disable it with:

```json
"nudge": false
```

Do not introduce new nudge timing fields without corresponding shared-app support.

---

## Unsupported Assumptions

The current application does not define general config fields for:

- descriptions or body copy
- arbitrary metadata
- custom sharing text separate from `title`
- QR destinations separate from the flyer URL
- language selection
- custom layout or additional UI sections

Do not add such fields and assume they work. A need for them requires an explicit shared-app change and documentation update.

---

## Validation Checklist

Before publishing a config:

- parse `config.json` as valid JSON
- confirm at least one track exists
- verify every referenced asset exists and loads
- verify track order and titles
- verify Visual Audio image and alternative text for every track
- verify branding and CTA destinations
- verify feedback timing and follow-up behaviour
- verify one-track or multi-track navigation behaviour
- verify the analytics site ID
- verify mobile and desktop layouts
- verify share and CTA actions
- confirm the published audio matches the approved script
- confirm no copied source-flyer assets or values remain

Approved scripts and approval records are stored in the canonical Drive folder documented in `FLYER_SPEC.md`.
