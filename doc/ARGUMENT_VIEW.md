# Argument/Comment Feed View — Design Specification

The ballot detail page (`/ballots/[id]`) uses a social media feed layout with threaded comments, replacing the previous two-column PRO/CONTRA grid.

## Page Structure (top to bottom)

### 1. Ballot Header (unchanged)

The existing ballot card: title, topic, text, vote date, like button, language badge.

### 2. Filter & Sort Toolbar

A sticky horizontal bar that stays visible when scrolling.

**Filter Tabs** (left side):

| Tab | Behavior |
|-----|----------|
| `Alle` | Show all arguments, interleaved by sort order (default) |
| `Pro` | Only PRO arguments |
| `Contra` | Only CONTRA arguments |

Active tab gets a bottom border accent. Pro tab text is green, Contra tab text is red.

**Sort Dropdown** (right side):

| Option | Logic |
|--------|-------|
| `Zufall` | Random order (default) — ensures no argument gets systematic advantage |
| `Top` | `ORDER BY like_count DESC` |
| `Neu` | `ORDER BY created_at DESC` |
| `Diskutiert` | `ORDER BY comment_count DESC` |

**"Add Argument" Button** — right side of toolbar, prominent. Opens a modal/drawer to submit a new argument (type selector PRO/CONTRA, title, body).

### 3. Argument Feed (main content)

A single-column, vertically scrolling list of argument cards. Max width ~640px, centered (like Twitter/Bluesky). On mobile, full width with padding.

---

## Argument Card Anatomy

Each argument renders as a "post" in the feed:

```
┌─────────────────────────────────────────────────┐
│  ┌──┐  A. Eiger · 2h                    [PRO]  │
│  │BE│  ───────────────────                      │
│  └──┘                                           │
│                                                 │
│  Titel des Arguments                            │
│  Body text des Arguments, kann mehrzeilig       │
│  sein und wird vollständig angezeigt...         │
│                                                 │
│  [Preliminary]                                  │
│                                                 │
│  ♡ 24        💬 7        ↗ Share                │
│                                                 │
│  ── Threaded comments below ──────────────────  │
│                                                 │
│  │  ┌──┐  B. Matterhorn · 45min                │
│  │  │VS│  Comment text hier...                  │
│  │  └──┘  ♡ 3   💬 Reply                       │
│  │                                              │
│  │  │  ┌──┐  C. Pilatus · 20min                │
│  │  │  │LU│  Reply to the reply...             │
│  │  │  └──┘  ♡ 1   💬 Reply                    │
│  │                                              │
│  │  ┌──┐  @max.bsky.social · 1h    [Bluesky]   │
│  │  │🦋│  External Bluesky comment...           │
│  │  └──┘  ♡ 5                                   │
│                                                 │
│  Show 4 more replies...                         │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Write a comment...                     │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Author Row

- **Avatar**: A colored square (32x32px) using the user's `color` from their pseudonym profile, with the canton abbreviation (e.g. "BE", "VS") in white text inside. For external Bluesky comments, show a butterfly icon on blue background.
- **Display name**: The pseudonym `displayName` (e.g. "A. Eiger"). For external comments, the Bluesky handle.
- **Timestamp**: Relative time ("2h", "3d", "22. Feb."). Uses `createdAt` field.
- **Side badge**: A pill-shaped badge at the right end of the author row.
  - PRO: green background `#e8f5e9`, green text `#2e7d32`, label "Pro"
  - CONTRA: red background `#ffebee`, red text `#c62828`, label "Contra"

### Content

- **Title**: Bold, 16px, `#333`.
- **Body**: Regular, 14px, `#555`, line-height 1.6. Full text shown (no truncation — arguments are typically 1-3 paragraphs).

### Review Badge (only when peer review is enabled)

- `Preliminary`: orange pill `#fff3e0` / `#e65100`
- `Peer-reviewed`: green pill `#e8f5e9` / `#2e7d32`
- `Rejected`: red pill `#ffebee` / `#c62828` (only visible to author)

### Action Bar

- **Like**: `♡ 24` — heart icon + count. Filled red `#d81b60` when liked by viewer, grey `#8e8e8e` when not. Tap to toggle (uses existing rating/unrating API).
- **Comment**: `💬 7` — speech bubble + count. Tap scrolls to / opens the inline reply box.
- **Share**: `↗` — copies AT URI or web link to clipboard.

### Left Accent Line

A 3px vertical line on the left edge of the entire card. Green `#4caf50` for PRO, red `#ef5350` for CONTRA. Runs the full height of the card including comments.

---

## Threaded Comments (inline below each argument)

Comments are shown directly below their parent argument, inside the same card. This is the key social-media-like behavior — you see the conversation in context without navigating away.

### Display Rules

- Show the first **3 top-level comments** by default, sorted by `like_count DESC` (most liked first).
- Each top-level comment shows up to **1 nested reply** inline.
- If more exist: a "Show N more replies..." link loads the rest.
- Thread nesting is indicated by a vertical grey line (`#e0e0e0`, 2px) on the left, with 24px indentation per nesting level. Maximum visual nesting: 2 levels deep (deeper replies flatten to level 2 with a "replying to @Name" prefix).

### Comment Anatomy

- Same avatar + name + timestamp row as arguments, but smaller (28x28px avatar, 13px text).
- For `origin = 'extern'` comments: show a small Bluesky butterfly badge next to the name, and use the stored `handle` / `display_name` from the DB rather than the pseudonym.
- Comment text: 14px, `#444`, no title displayed (comments are short-form).
- Action row: `♡ count` and `💬 Reply` link (opens inline reply input).

### Inline Reply Input

- At the bottom of the comment thread area, a collapsed single-line text input: "Write a comment..."
- On focus, expands to a textarea (3 rows) with a "Send" button.
- Submitting creates an `app.ch.poltr.comment` record on the PDS via the firehose flow.

---

## Responsive Behavior

### Mobile (< 640px)

- Cards take full viewport width minus 16px padding on each side.
- The filter/sort toolbar becomes a horizontally scrollable pill bar.
- The "Add Argument" button becomes a floating action button (FAB) in the bottom-right corner, `+` icon, brand blue `#0085ff`.
- Comment thread indentation reduces to 16px per level.

### Desktop (> 640px)

- Feed column is max 640px, centered.
- The ballot header card can be wider (max 800px) to use the space.
- Sidebar space (left/right of feed) is empty or could later hold ballot metadata.

---

## Data Flow — API Changes

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `app.ch.poltr.comment.list` | GET | List comments for a ballot, with `argument_uri` filter, `parent_uri` threading, author profile join. Params: `ballot_rkey`, `argument_uri` (optional), `sort` (top/new), `limit`, `cursor`. |
| `app.ch.poltr.comment.create` | POST | Create a comment record on PDS. Params: `argument` (AT URI), `title`, `body`. |

### Existing Endpoint Enhancements

The argument list endpoint (`app.ch.poltr.argument.list`) needs:

- `sort` parameter: `random` (default), `top` (like_count DESC), `new` (created_at DESC), `discussed` (comment_count DESC)
- `type` filter parameter: `PRO`, `CONTRA`, or omit for all
- Join `app_profiles` to include author pseudonym data (`displayName`, `canton`, `color`) in the response

The comment list endpoint should join:

- `app_profiles` for intern comments (pseudonym data)
- Use stored `handle` / `display_name` for extern comments
- Return `parent_uri` so the frontend can build the thread tree

---

## New TypeScript Types

```typescript
interface CommentRecord {
  $type: 'app.ch.poltr.comment';
  title: string;
  body: string;
  argument: string;   // AT URI
  createdAt: string;
}

interface CommentWithMetadata {
  uri: string;
  cid: string;
  record: CommentRecord;
  author: {
    did: string;
    displayName?: string;
    canton?: string;
    color?: string;
    handle?: string;       // for extern comments
  };
  origin: 'intern' | 'extern';
  parentUri?: string;
  argumentUri: string;
  likeCount?: number;
  indexedAt?: string;
  viewer?: {
    like?: string;
  };
  replies?: CommentWithMetadata[];  // client-side threaded
}
```

The `ArgumentWithMetadata` type needs an `author` expansion:

```typescript
author: {
  did: string;
  displayName?: string;
  canton?: string;
  color?: string;
};
```

---

## Color & Visual Language

| Element | Color |
|---------|-------|
| PRO accent | `#4caf50` (border), `#e8f5e9` bg, `#2e7d32` text |
| CONTRA accent | `#ef5350` (border), `#ffebee` bg, `#c62828` text |
| Like active | `#d81b60` |
| Like inactive | `#8e8e8e` |
| Brand blue (buttons) | `#0085ff` |
| Card background | `#ffffff` |
| Page background | `#f5f5f5` |
| Thread connector line | `#e0e0e0` |
| External/Bluesky badge | `#1185fe` |
| Body text | `#555` |
| Muted text (timestamps, counts) | `#8e8e8e` |

---

## Interaction Summary

| Action | What happens |
|--------|-------------|
| Tap heart on argument | Toggle like (existing API), optimistic UI update |
| Tap heart on comment | Toggle like on comment (same API, subject = comment URI) |
| Tap "💬 7" on argument | Scroll to / focus the reply input below that argument |
| Tap "Reply" on a comment | Open inline reply input indented below that comment, set `parent_uri` |
| Tap "Show N more replies" | Fetch and render remaining comments for that argument |
| Tap filter tab (Pro/Contra/Alle) | Re-fetch arguments with `type` filter, reset scroll |
| Change sort (Top/Neu/Diskutiert/Zufall) | Re-fetch arguments with new `sort`, reset scroll |
| Tap "Add Argument" | Open modal: type selector (PRO/CONTRA), title input, body textarea, submit |
| Submit new argument | Create `app.ch.poltr.ballot.argument` record on PDS |
| Submit new comment | Create `app.ch.poltr.comment` record on PDS |
