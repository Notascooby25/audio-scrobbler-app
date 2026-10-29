import React from "react";

export default function UserGuideSection() {
  return (
    <section className="user-guide-section" aria-labelledby="guide-main-heading">
      <div className="guide-header">
        <h2 id="guide-main-heading">User Guide & Manual</h2>
        <p className="guide-subtitle">
          Everything you need to know about tracking your music, listening with friends, and
          unlocking radio tracklists.
        </p>
      </div>

      <nav className="guide-nav-pills" aria-label="Guide Chapters">
        <a href="#guide-getting-started" className="guide-pill">
          Getting Started
        </a>
        <a href="#guide-connecting" className="guide-pill">
          Connecting & Imports
        </a>
        <a href="#guide-friends" className="guide-pill">
          Copying Scrobbles
        </a>
        <a href="#guide-radio" className="guide-pill">
          BBC Sounds
        </a>
        <a href="#guide-exploring" className="guide-pill">
          Reports & Library
        </a>
        <a href="#guide-privacy" className="guide-pill">
          Privacy & Ownership
        </a>
        <a href="#guide-setlists" className="guide-pill">
          Set Lists & Concerts
        </a>
      </nav>

      {/* Chapter 1 */}
      <article id="guide-getting-started" className="guide-chapter">
        <h3>1. Getting Started & How It Works</h3>
        <p>
          Welcome to Audio Scrobbler! This app is your personal listening hub. It automatically logs
          the music you listen to across different services, building an independent history and
          deep insights that you own forever.
        </p>

        <div className="guide-callout">
          <strong>What happens automatically?</strong>
          <p>
            Once your Spotify account is connected, our background worker continuously polls your
            account (every 5 minutes by default). You do <em>not</em> need to keep this website open
            for your music to scrobble—it logs safely 24 hours a day, 7 days a week.
          </p>
        </div>

        <h4>Scrobbling Modes</h4>
        <ul>
          <li>
            <strong>Standard Background Polling:</strong> Checks your Spotify history every 5
            minutes (customizable in <em>Settings → Scrobble</em>). It grabs all newly completed
            songs since the last check.
          </li>
          <li>
            <strong>Real-time Scrobbling (Optional):</strong> If you have Spotify Premium and want
            up-to-the-minute precision, you can turn on Real-time Scrobbling in{" "}
            <em>Settings → Scrobble</em>. This checks Spotify every 10 seconds and logs a track as
            soon as you listen past your chosen completion percentage (e.g., 50%).
          </li>
          <li>
            <strong>Liked Songs Sync:</strong> Automatically keeps a mirror of your Spotify Liked
            Songs in your library, syncing once a day.
          </li>
        </ul>
      </article>

      {/* Chapter 2 */}
      <article id="guide-connecting" className="guide-chapter">
        <h3>2. Connecting & Importing History</h3>
        <p>
          You can access all data sources from the <strong>Connect</strong> page in the top menu.
        </p>
        <ol className="guide-steps">
          <li>
            <strong>Spotify Account:</strong> Click "Connect Spotify" on the Connect page to
            authenticate via Spotify's secure login. You can disconnect or reconnect at any time.
          </li>
          <li>
            <strong>Import Past History:</strong> Have years of Spotify or YouTube listening before
            joining this app? You can upload your official history files. Go to{" "}
            <strong>Connect → History File Import</strong> and drag in your Spotify{" "}
            <code>endsong.json</code> files or YouTube <code>watch-history.json</code>.
          </li>
          <li>
            <strong>Source Badges:</strong> Every track in your library displays a small badge
            (Spotify, YouTube, or BBC Sounds) showing exactly where that play came from. You can
            toggle these badges on or off in <em>Settings → General</em>.
          </li>
        </ol>
      </article>

      {/* Chapter 3 */}
      <article id="guide-friends" className="guide-chapter">
        <h3>3. Listening with Friends & Copying Scrobbles</h3>
        <p>
          A common dilemma with music scrobbling: you took a shared{" "}
          <strong>car journey or road trip</strong>, or hung out at a party, where a friend was
          connected to the car stereo or speaker. Their account logged the music, but yours missed
          out!
        </p>

        <div className="guide-callout">
          <strong>How to copy tracks you listened to together:</strong>
          <ol className="guide-steps" style={{ marginTop: "0.5rem" }}>
            <li>
              Go to <strong>Profile → Following</strong> and find your friend's profile (or search
              for their username under "Discover Users").
            </li>
            <li>
              On their Profile page, click the <strong>Copy Scrobbles</strong> button.
            </li>
            <li>
              Choose the <strong>Start Time</strong> and <strong>End Time</strong> of your journey
              or hangout.
            </li>
            <li>
              Click <strong>Copy Scrobbles</strong>. All songs played during that period will be
              added to your own listening history!
            </li>
          </ol>
        </div>

        <p className="guide-note">
          <strong>Safe & Smart Deduplication:</strong> If you played music on your own phone during
          part of that time, don't worry. The app automatically checks your library and skips any
          duplicate songs you had already scrobbled during that window.
        </p>
      </article>

      {/* Chapter 4 */}
      <article id="guide-radio" className="guide-chapter">
        <h3>4. BBC Sounds & Radio Tracklists (plus YouTube Concerts)</h3>
        <p>
          Listening to BBC Radio shows, or watching full live performances on YouTube like{" "}
          <strong>NPR Music Tiny Desk Concerts</strong>, <strong>KEXP in-studio sessions</strong>,
          or <strong>BBC Music Live Lounge</strong>? Our built-in extraction tools let you capture
          tracklists and scrobble them with ease.
        </p>

        <h4>Where to find them:</h4>
        <p>
          Go to <strong>Settings → Scrobble tab</strong> and scroll down to the bottom tools
          section. Use the segmented toggle to switch between <strong>Radio / BBC Sounds</strong>{" "}
          and <strong>YouTube Concerts</strong>.
        </p>

        <h4>Using the YouTube Scrobbler:</h4>
        <ol className="guide-steps">
          <li>
            <strong>Followed Channels:</strong> Follow go-to music channels like NPR Music (
            <code>@nprmusic</code>), KEXP (<code>@kexp</code>), or BBC Music (<code>@BBCMusic</code>
            ). Clicking a channel immediately loads its recent concert uploads and lets you search
            within that channel.
          </li>
          <li>
            <strong>Direct Video Link:</strong> Paste any YouTube video link directly into the URL
            input and click "Load Video & Setlist".
          </li>
          <li>
            <strong>Automatic Setlist Extraction:</strong> The app parses timestamps and setlist
            sections from the video description. You can check/uncheck tracks, edit any song or
            artist names inline, and adjust the listened-at time before scrobbling!
          </li>
        </ol>

        <h4>Using BBC Sounds (Scope Creep):</h4>
        <ol className="guide-steps">
          <li>
            <strong>Paste a Web Link:</strong> Copy the URL of any BBC Sounds episode from your
            browser (e.g., <code>https://www.bbc.co.uk/sounds/play/...</code>) and click "Fetch
            Tracklist".
          </li>
          <li>
            <strong>Followed Radio Shows:</strong> Follow your favorite radio shows so their latest
            episodes appear right inside the tool—no link hunting required!
          </li>
        </ol>

        <h4>What you can do with the extracted songs:</h4>
        <ul>
          <li>
            <strong>Scrobble into your history:</strong> Review the tracklist, uncheck any songs you
            didn't hear, choose the date and time you listened, and click "Scrobble Selected
            Tracks".
          </li>
          <li>
            <strong>Save as a Spotify Playlist:</strong> Click "Export to Spotify Playlist" to
            instantly create a new playlist in your Spotify account or append the songs to an
            existing playlist.
          </li>
        </ul>
      </article>

      {/* Chapter 5 */}
      <article id="guide-exploring" className="guide-chapter">
        <h3>5. Exploring Your Music & Reports</h3>
        <p>Your music comes alive through dedicated dashboards:</p>
        <ul>
          <li>
            <strong>Overview:</strong> Your quick command center. Features your top artists, albums,
            and tracks, plus the <strong>Time Capsule</strong>
            (rediscover "Forgotten Favorites" and "On This Day" moments, with one-click export to
            Spotify).
          </li>
          <li>
            <strong>Library:</strong> Browse every play you've ever logged. Filter by entity, toggle
            between list and grid views, search by keyword, and filter by custom date ranges.
          </li>
          <li>
            <strong>Reports:</strong> Deep analytical insights. Explore your listening heatmap (what
            days and times you listen most), your 24-hour listening clock, music breakdown by
            decade, top genres, and compare stats side-by-side with friends you follow.
          </li>
          <li>
            <strong>Shareable Image Cards:</strong> Want to brag about your top 5 albums or artists?
            In the Library, click the "Share" button to generate a beautiful, formatted image card
            ready to download or send directly to friends.
          </li>
        </ul>
      </article>

      {/* Chapter 6 */}
      <article id="guide-privacy" className="guide-chapter">
        <h3>6. Privacy, Cleanup & Data Ownership</h3>
        <p>You are always in complete control of your data:</p>
        <ul>
          <li>
            <strong>Blocking Items:</strong> Left background white noise or a podcast playing on
            Spotify? Click the three-dots menu on any track, album, or artist in your Library and
            select <em>Block</em>. Blocked items are permanently excluded from all stats, reports,
            and rankings without deleting your raw play logs. You can review and unblock items at
            any time in <em>Settings → General</em>.
          </li>
          <li>
            <strong>Cleaning Up Accidental Imports:</strong> Need to remove an import batch or wipe
            a specific date range? Visit <em>Settings → Danger Zone</em> to permanently delete
            scrobbles by source, date span, or file batch.
          </li>
          <li>
            <strong>Backfill Missing Artwork:</strong> If an imported track or obscure single is
            missing album art, go to <em>Settings → Data</em>
            and run "Backfill Missing Artwork" to automatically search Apple Music and Deezer for
            cover art.
          </li>
          <li>
            <strong>Export Your Complete History:</strong> You own your data. Go to{" "}
            <em>Settings → Data</em> to download your complete listening history anytime as a clean
            spreadsheet CSV or structured JSON file.
          </li>
        </ul>
      </article>

      {/* Chapter 7 */}
      <article id="guide-setlists" className="guide-chapter">
        <h3>7. Set Lists & Live Concert Tracking</h3>
        <p>
          Audio Scrobbler lets you track in-person concerts and gigs you attend, powered by
          Setlist.fm:
        </p>
        <ul>
          <li>
            <strong>Find & Log a Gig:</strong> Head to the <em>Set Lists</em> tab and tap{" "}
            <em>+ Log a Gig</em>. Search by artist name with optional filters for country, venue,
            month, or year. You can also paste direct Setlist.fm show/setlist links (e.g.{" "}
            <code>https://www.setlist.fm/show/...</code>) or 8-character setlist IDs into the search
            box to load any concert immediately. If an upcoming tour date isn't listed on Setlist.fm
            yet, tap <strong>+ Add Upcoming Show Manually</strong> to save it to your timeline with
            countdowns and notes. Results group into <em>Upcoming Shows</em> and <em>Past Shows</em>{" "}
            with a <em>View More Shows (+20)</em> button for long tours. Click{" "}
            <strong>✓ I WAS THERE</strong> to log past shows, or <strong>+ I'M GOING</strong> for
            future concerts.
          </li>
          <li>
            <strong>Gig Setlist Pages:</strong> Tap any gig in <em>My Gigs</em>, or inside an
            expanded artist, song or venue, to open its own setlist page: the date, venue and tour,
            then every song numbered in order, split into main set and encores, with guest, cover
            and tape notes. Use <em>&larr; Back</em> to return to exactly where you were (same tab,
            page and expanded row). From the gig page you can also <em>Refresh from Setlist.fm</em>,{" "}
            <em>Copy setlist</em>, or <em>Delete gig</em> (with an option to remove the support acts
            logged that night). In <em>Log a Gig</em> search results, tap a show&apos;s title to
            preview its songs before logging it.
          </li>
          <li>
            <strong>On the Bill:</strong> Under <em>My notes</em> on a gig&apos;s page, see the
            other acts who played that venue the same night. Acts you&apos;ve logged show{" "}
            <em>✓ I was there</em> and link to their own gig page; tap <em>+ I was there</em> next
            to any other act to log it (from a headliner&apos;s page it&apos;s saved as a support
            act), or <em>Undo</em> straight after.
          </li>
          <li>
            <strong>Already Logged &amp; Mistakes:</strong> If you log a gig you already have (the
            same Setlist.fm show, or the same artist on the same day), you&apos;re asked before
            it&apos;s logged again. Logged something by mistake? Tap <em>Undo</em> in the
            confirmation message, or use the small <em>Remove</em> link on the gig&apos;s row in{" "}
            <em>My Gigs</em>.
          </li>
          <li>
            <strong>Personal Gig Diary:</strong> Add your own memories (standing spots, who you went
            with, highlights) in the <em>My notes</em> box on each gig&apos;s page.
          </li>
          <li>
            <strong>Future Gigs & "I'M GOING":</strong> Concerts in the future automatically display{" "}
            <em>+ I'M GOING</em> instead of <em>✓ I WAS THERE</em>. In <em>My Gigs</em>, use the
            links under the heading to switch between <em>All</em>, <em>Attended</em>, or{" "}
            <em>Upcoming</em>.
          </li>
          <li>
            <strong>Support Acts on the Bill:</strong> When logging a show, the app automatically
            checks for other artists who performed at the same venue that night and prompts you to
            select any support bands you watched.
          </li>
          <li>
            <strong>Automatic Concert Scrobbles:</strong> All songs performed at the gig are
            sequenced chronologically and added into your listening history with source{" "}
            <code>setlistfm</code>, so they appear in your reports and charts.
          </li>
          <li>
            <strong>Live Music Statistics:</strong> <em>Artists Seen</em> ranks artists by times
            seen (then most recently seen), with a proportional bar so the gaps are obvious at a
            glance; tied artists share a rank. Tap an artist to list every gig you saw them at.{" "}
            <em>Songs Heard</em> counts every live performance and has a sidebar to narrow the table
            to one year or one artist; tap a song to see which gigs you heard it at. <em>Venues</em>{" "}
            ranks venues by nights visited; tap one to see every act you saw there.
          </li>
          <li>
            <strong>Setlist.fm Account Import & Export:</strong> Have an existing Setlist.fm profile
            (or want to selectively import gigs from a friend or family member's account)? Click{" "}
            <em>Import / Export</em> to enter their username or paste their full profile link (e.g.{" "}
            <code>https://www.setlist.fm/user/crispylettuce</code>), preview all attended gigs, tick
            the specific shows you attended, and import them with 1 click. You can also download
            your entire gig collection as JSON or CSV, and use <em>Import from a File</em> to load
            one of those files back in (for example, to restore a backup). Gigs you&apos;ve already
            logged are skipped.
          </li>
        </ul>
      </article>
    </section>
  );
}
