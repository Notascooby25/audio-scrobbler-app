# Gig "Support act" tick box: design

## Intent
The app guesses which logged gig was the support act (setlist.fm gives no start times), and
got it the wrong way round for Fat Dog / LEMONSUCKR. The owner wants to fix it by hand with
a tick box in Edit gig details, like "Cover band / Tribute act".

## Goals
- A "Support act" tick box in Edit gig details and in the manual "log a gig" form.
- Ticking it labels the gig "Support act" (label already exists on the gig page and timeline).
- Ticking auto-links it to the headliner: the other gig the user logged at the same venue on
  the same date that is not itself a support act. Linked supports move with the headliner and
  show under "On the bill".
- Ticking moves the gig's scrobbles to the support slot (first scrobble 18:45, plus 45 minutes
  per support already linked to that headliner) so timeline order is right.
- Unticking clears the label and link, and moves scrobbles back to the 20:00 headliner slot.

## Non-goals
- No automatic times from setlist.fm (the API has no doors or stage times).
- No optional start-time field (owner chose tick box only; can be added later).
- No change to the "add support acts?" prompt, the setlist.fm lookup or the database schema.

## Constraints
- `is_support_act` and `parent_setlist_id` columns already exist: no migration.
- UK English text. Follow `EditGigModal` / `ManualConcertModal` patterns.
- Only the owner's own gigs can be changed (existing `user_id` filter).

## Approaches
One sensible way. A time-based automatic sort was rejected because the data has no times; a
start-time field was rejected by the owner as more effort per gig than one tick.

## Decisions
- No headliner found: still labelled, `parent_setlist_id` stays empty.
- Several candidate headliners: pick the one logged first (lowest id). (Builder's call.)
- Ticking a gig that already has linked supports of its own: refused with
  "Remove its support acts first." (HTTP 400).
- Support change is applied after any date or venue change in the same save.
