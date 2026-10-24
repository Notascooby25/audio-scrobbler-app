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
              Go to <strong>Following</strong> in the top menu and find your friend's profile (or
              search for their username under "Discover Users").
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
        <h3>4. BBC Sounds & Radio Tracklists</h3>
        <p>
          Listening to BBC Radio 1, 6 Music, or 1Xtra shows? Radio stations play incredible music,
          but typically don't scrobble to Spotify. Our built-in radio extraction tool (known as{" "}
          <strong>Scope Creep</strong>) lets you capture radio tracklists with ease.
        </p>

        <h4>Where to find it:</h4>
        <p>
          Go to <strong>Settings → Scrobble tab</strong> and scroll down to the{" "}
          <strong>BBC Sounds Tools</strong> panel.
        </p>

        <h4>Two ways to pull a tracklist:</h4>
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
    </section>
  );
}
