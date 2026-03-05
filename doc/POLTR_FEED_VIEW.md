# Activity Tab - Technical Specification

## Overview

The Activity Tab displays a chronological feed of all community activity including comments, replies, new arguments, and milestones. Users can monitor discussions, discover new arguments, and track engagement on arguments they care about.

---

## Core Functionality

### Purpose
- Provide real-time view of all platform activity
- Show comments and replies with full argument context
- Notify users of new arguments and community milestones
- Help users track which content they've seen and voted on

### User Flow
1. User opens Activity Tab
2. Feed displays all activity in reverse chronological order (newest first)
3. User can filter activity by type using dropdown
4. User taps any activity card to navigate to full Detail Page
5. After viewing detail page, that activity is marked as "seen"

---

## Activity Types

### 1. Comment Activity
**Trigger:** User posts a top-level comment on an argument

**Display:**
- Activity type: "💬 [User] commented"
- Argument context (title, agreement %, vote count)
- Comment author and full comment text
- Timestamp (e.g., "2 min ago", "1 hour ago", "3 hours ago")
- User's vote badge if they voted on this argument

### 2. Reply Activity
**Trigger:** User replies to an existing comment

**Display:**
- Activity type: "💬 [User] replied to [Parent User]"
- Argument context (title, agreement %, vote count)
- Parent comment text (in gray/muted style)
- Reply comment text (indented, with visual connection indicator like └─)
- Timestamp
- User's vote badge if they voted on this argument

### 3. New Argument Activity
**Trigger:** Community member posts a new argument

**Display:**
- Activity type: "📝 [User] posted new argument"
- Argument title
- Preview text (first ~100-150 characters of argument body)
- Current stats (vote count, agreement %, category tag)
- Timestamp
- No vote badge (user hasn't voted yet on new arguments)

### 4. Milestone Activity
**Trigger:** Argument reaches approval threshold (community-approved status)

**Display:**
- Activity type: "✅ Argument approved"
- Argument context (title, agreement %, vote count)
- Milestone badge: "🎉 Approved by community"
- Timestamp
- User's vote badge if they voted on this argument

---

## User Context Tracking

### Seen/Unseen State
**Purpose:** Help users identify which activity they haven't reviewed yet

**Logic:**
- Default: All new activity items are "unseen" (hasSeen = false)
- Mark as "seen" when: User taps activity card and views the detail page
- Persist across sessions (store in user profile/database)

**Visual Treatment:**
- **Unseen:** Full opacity, blue dot indicator on left edge, slightly elevated (shadow)
- **Seen:** 85% opacity, no blue dot, standard shadow

### Voted State
**Purpose:** Show which arguments the user has already voted on

**Logic:**
- Check if current user has voted on the argument referenced in the activity
- Display vote badge only if user has voted
- Show vote direction (Agree/Disagree)

**Visual Treatment:**
- Green badge: "✓ You voted [direction]"
- Placed at bottom of activity card

---

## Filtering System

### Filter Options
Provide dropdown menu with 3 options:

1. **All Activity** (default)
   - Shows all activity types
   
2. **Arguments**
   - Shows only: new_argument + milestone types
   - Filters out: comment + reply types
   
3. **Comments**
   - Shows only: comment + reply types
   - Filters out: new_argument + milestone types

### UI Placement
- Dropdown button in header area
- Label: "All Activity ▼" (or current selection)
- Accessible above the feed, does not scroll with content

---

## Visual Design Specifications

### Card Background Colors (High Priority)

**Purpose:** Instant visual distinction between activity types

**Unseen Cards:**
- Comment/Reply: `#ffffff` (white)
- New Argument: `#bbdefb` (light blue)
- Milestone: `#ffecb3` (light gold/yellow)

**Seen Cards:**
- Same colors at 85% opacity

### Argument Context Box (High Priority)
Every comment/reply/milestone card includes an argument context section:

**Style:**
- Light gray background (`#f8f9fa`)
- Blue left border (3px, `#4a90e2`)
- Contains: Argument title (bold), Agreement %, Vote count
- Positioned below activity header, above comment content

**Purpose:** Provides immediate context about which argument is being discussed

### Thread Depth Visualization (Medium Priority)
For reply activities, show parent-child relationship:

**Parent Comment:**
- Gray/muted background
- Smaller text
- Format: "[Author]: [text]"

**Reply Comment:**
- Indented slightly
- Visual connector (e.g., └─ or similar)
- Normal styling

---

## Interaction Behaviors

### Tap Activity Card
**Action:** Navigate to Detail Page for that argument

**Detail Page Requirements:**
- Display full argument with all metadata
- Show all comments in threaded view
- If opened from comment/reply activity: scroll to and highlight that specific comment
- Mark this activity as "seen" for current user
- Provide voting interface
- Provide comment input

### Pull to Refresh (Optional)
- Allow user to manually refresh feed
- Fetch latest activity
- Maintain scroll position if possible

### Real-time Updates (Optional)
- New activity appears at top of feed automatically
- Show notification indicator (e.g., "3 new items" banner)
- User can tap to scroll to top and see new items

---

## Ordering & Pagination

### Default Order
- Reverse chronological (newest first)
- Most recent activity at top of feed

### Pagination
- Load initial batch (e.g., 20-30 items)
- Infinite scroll or "Load More" button for older activity
- Maintain seen/unseen state across pagination

---

## Edge Cases & Error Handling

### Deleted Content
**Scenario:** Argument or comment referenced in activity is deleted

**Handling:**
- Remove activity item from feed, OR
- Show placeholder: "This content is no longer available"
- Do not show broken/missing data

### User Not Found
**Scenario:** User who created activity has deleted account

**Handling:**
- Show "[Deleted User]" or "Anonymous" instead of username
- Keep activity visible (still valuable for context)

### No Activity
**Scenario:** Feed is empty (new user or quiet community)

**Handling:**
- Show empty state message
- Suggest actions: "Browse arguments to get started" with link to Arguments tab

### Filter Returns Empty
**Scenario:** User applies filter that returns no results

**Handling:**
- Show message: "No [type] activity yet"
- Keep filter applied, allow user to change selection

---

## Performance Considerations

### Data Loading
- Fetch activity items with all required nested data (argument info, user info, comment text) in single query
- Avoid N+1 queries for user context (hasVoted, hasSeen)
- Consider caching strategy for frequently accessed argument metadata

### Seen State Updates
- Update seen status asynchronously (don't block UI)
- Batch updates if possible (e.g., mark multiple items as seen at once)
- Optimistic UI update (mark as seen immediately, sync with backend)

---

## Accessibility Requirements

- Semantic HTML for activity cards (article or section elements)
- Accessible labels for interactive elements
- Keyboard navigation support (tab through cards, enter to open)
- Screen reader announcements for activity type and timestamp
- Sufficient color contrast (don't rely solely on color for unseen/seen)

---

## Future Enhancements (Out of Scope for V1)

- Follow specific arguments (filter to only followed)
- Notification settings (email/push for activity on arguments you care about)
- Activity search/filter by user or keyword
- Mute/hide specific arguments from feed
- Sort options (chronological vs. popularity)
- Activity analytics (which types of activity are most engaging)

---

## Testing Checklist

- [ ] All 4 activity types render correctly
- [ ] Unseen indicator (blue dot) appears on new items
- [ ] Seen state persists after viewing detail page
- [ ] Vote badge appears only when user has voted
- [ ] Thread depth visualization (parent + reply) displays correctly
- [ ] Filter dropdown correctly filters activity types
- [ ] Tapping card navigates to correct detail page
- [ ] Detail page highlights correct comment (for comment/reply activities)
- [ ] Timestamps display in relative format (2m, 1h, 3d ago)
- [ ] Empty states display appropriately
- [ ] Performance acceptable with 100+ activity items
- [ ] Real-time updates work (if implemented)
- [ ] Accessibility: keyboard navigation and screen readers

---

## Summary

The Activity Tab provides a unified, chronological view of all platform activity with clear visual distinctions between activity types, user context indicators (seen/unseen, voted), and the ability to filter by activity category. Each activity card provides full argument context and displays comment threads with proper parent-child relationships. Tapping any card navigates to a detail page where users can engage further with the argument and its discussions.