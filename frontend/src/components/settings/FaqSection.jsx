import React, { useState } from "react";

const FAQ_DATA = [
  {
    id: "sync-delay",
    category: "Sync & Scrobbles",
    question: "Why is there a delay before my song appears?",
    answer: (
      <>
        <p>
          By default, the app uses <strong>Background Polling</strong>, which checks Spotify once
          every 5 minutes for newly finished songs. This prevents hitting Spotify's strict API rate
          limits.
        </p>
        <p>
          If you have <strong>Spotify Premium</strong> and want songs to log immediately while
          listening, you can enable <em>Real-time Scrobbling</em> in{" "}
          <strong>Settings → Scrobble</strong>. This polls every 10 seconds and logs tracks as soon
          as they reach your completion threshold (e.g. 50%).
        </p>
      </>
    ),
  },
  {
    id: "theme-accent-color",
    category: "General & Appearance",
    question: "Can I customize the site theme and accent color?",
    answer: (
      <p>
        <strong>Yes!</strong> In <strong>Settings → General</strong>, you can switch between Light,
        Dark, or System theme modes. You can also customize the site's accent color across buttons,
        active nav tabs, charts, and activity heatmaps using 8 curated song-title presets:{" "}
        <em>Blue Monday</em>, <em>Green Eyes</em>, <em>Red Red Wine</em>, <em>Purple Rain</em>,{" "}
        <em>Fool's Gold</em>, <em>Paint It Black</em>, <em>Pretty in Pink</em>, or{" "}
        <em>Orange Crush</em>.
      </p>
    ),
  },
  {
    id: "sync-closed-browser",
    category: "Sync & Scrobbles",
    question: "Does the app keep scrobbling if I close the browser?",
    answer: (
      <p>
        <strong>Yes!</strong> Your listening is scrobbled by our background server independently of
        your browser. Once you connect your Spotify account, you can close the browser or shut down
        your computer, and all your plays will continue logging automatically.
      </p>
    ),
  },
  {
    id: "remaster-tags",
    category: "Sync & Scrobbles",
    question: 'Why are songs with "(Remastered)" or "[Live]" grouped separately?',
    answer: (
      <p>
        Streaming services often append labels like <em>"(2011 Remaster)"</em> or{" "}
        <em>"- Live at Wembley"</em> to track titles. If you want these merged into clean song names
        for cleaner analytics and charts, turn on <strong>"Strip remaster tags"</strong> in{" "}
        <strong>Settings → Scrobble</strong>.
      </p>
    ),
  },
  {
    id: "youtube-scrobbler",
    category: "Sync & Scrobbles",
    question: "Can I scrobble music concerts and live sessions from YouTube?",
    answer: (
      <p>
        <strong>Yes!</strong> Head to <strong>Settings → Scrobble</strong> and switch to the{" "}
        <strong>YouTube Concerts</strong> tab. You can follow channels like NPR Music (Tiny Desk),
        KEXP, or BBC Music, browse recent concert uploads or search within the channel, or paste any
        YouTube video URL directly. The app extracts the setlist, allows you to edit track names
        inline, and scrobbles them directly into your history.
      </p>
    ),
  },
  {
    id: "car-friends",
    category: "Friends & Social",
    question: "How do I scrobble music a friend played in the car or at a party?",
    answer: (
      <>
        <p>
          If you shared a car journey or hangout where someone else was connected to the aux or
          speaker:
        </p>
        <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
          <li>
            Go to <strong>Profile → Following</strong> and open your friend's profile.
          </li>
          <li>
            Click the <strong>Copy Scrobbles</strong> button at the top of their profile.
          </li>
          <li>
            Select the <strong>Start Time</strong> and <strong>End Time</strong> of the trip or
            hangout.
          </li>
          <li>
            Click <strong>Copy Scrobbles</strong>.
          </li>
        </ol>
        <p>The songs they listened to during that time window will be added to your own history.</p>
      </>
    ),
  },
  {
    id: "car-duplicates",
    category: "Friends & Social",
    question: "Will copying a friend's scrobbles duplicate songs I already listened to?",
    answer: (
      <p>
        <strong>No.</strong> The app contains built-in deduplication. Any tracks you had already
        scrobbled during that time range are automatically detected and safely skipped.
      </p>
    ),
  },
  {
    id: "privacy-visibility",
    category: "Friends & Social",
    question: "Can other people see my listening history?",
    answer: (
      <p>
        Only users who you follow (and who follow you back) can view your profile and listening
        reports. Furthermore, any artist, album, or track you have added to your{" "}
        <strong>Blocked Items</strong> is automatically hidden from everyone, including yourself,
        across all public reports and rankings.
      </p>
    ),
  },
  {
    id: "bbc-playlists",
    category: "BBC Sounds & Radio",
    question: "Can I add BBC Sounds tracks directly to my Spotify playlists?",
    answer: (
      <p>
        <strong>Yes!</strong> When you extract an episode tracklist using the{" "}
        <em>Scope Creep Tools</em> in <strong>Settings → Scrobble</strong>, you have the option to
        either scrobble the tracks into your listening history, export them as a brand-new Spotify
        playlist, or append them to one of your existing Spotify playlists.
      </p>
    ),
  },
  {
    id: "bbc-followed-shows",
    category: "BBC Sounds & Radio",
    question: "What does 'Followed Shows' do in the radio tool?",
    answer: (
      <p>
        Instead of manually copying web links from the BBC Sounds website every time a new episode
        airs, you can "Follow" shows (like Gilles Peterson, Mary Anne Hobbs, or Essential Mix).
        Their latest episodes will automatically appear in a convenient dropdown inside the radio
        tool.
      </p>
    ),
  },
  {
    id: "blocking-vs-deleting",
    category: "Library & Data Maintenance",
    question: "What's the difference between Blocking an artist and Deleting scrobbles?",
    answer: (
      <ul>
        <li>
          <strong>Blocking:</strong> Excludes an artist, album, or track from your charts, heatmaps,
          top lists, and reports. The underlying scrobble remains in the database so you can unblock
          it later in <em>Settings → General</em> if you change your mind. Great for podcasts, white
          noise, or sleep tracks.
        </li>
        <li>
          <strong>Deleting:</strong> Permanently and irreversibly wipes the scrobbles from your
          database. Use <em>Settings → Danger Zone</em> when you need to erase an accidental import
          or bad date range.
        </li>
      </ul>
    ),
  },
  {
    id: "artwork-missing",
    category: "Library & Data Maintenance",
    question: "How do I fix missing album artwork?",
    answer: (
      <p>
        If some tracks in your library are missing artwork (common with older YouTube files or rare
        singles), go to <strong>Settings → Data</strong> and click{" "}
        <strong>"Backfill Missing Artwork"</strong>. The app will automatically search Apple Music
        and Deezer to fetch high-resolution covers. Songs from gigs you&apos;ve logged get their
        artwork automatically in the background, so you don&apos;t need to do anything for those.
      </p>
    ),
  },
  {
    id: "export-data",
    category: "Library & Data Maintenance",
    question: "Can I download all my listening data?",
    answer: (
      <p>
        <strong>Yes.</strong> You have full ownership of your data. Visit{" "}
        <strong>Settings → Data</strong> to download your entire scrobble history anytime as a
        spreadsheet-ready <code>CSV</code> file or raw <code>JSON</code>.
      </p>
    ),
  },
  {
    id: "mobile-push",
    category: "Mobile & Notifications",
    question: "How do I enable device push notifications on iPhone or Android?",
    answer: (
      <>
        <p>
          You can receive weekly recap summaries and listening streak notifications right on your
          device:
        </p>
        <ul>
          <li>
            <strong>iPhone / iPad (iOS):</strong> You must first add this app to your Home Screen.
            In Safari, tap the <strong>Share</strong> button, select{" "}
            <strong>Add to Home Screen</strong>, open the app from your home screen icon, and visit{" "}
            <em>Settings → Notifications</em> to enable push alerts.
          </li>
          <li>
            <strong>Android & Desktop:</strong> Visit <em>Settings → Notifications</em>, click{" "}
            <strong>Enable Device Notifications</strong>, and accept your browser's permission
            prompt.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "setlists-scrobbling",
    category: "Set Lists & Gigs",
    question: "How does concert scrobbling from Setlist.fm work?",
    answer: (
      <>
        <p>
          When you log attendance for a concert under the <strong>Set Lists</strong> tab, the app
          retrieves the artist's full setlist and checks for any support bands who played at that
          venue that evening.
        </p>
        <p>
          The songs are sequenced chronologically backwards through the evening (support acts first,
          headliner later) and stored in your primary listening history with source{" "}
          <code>setlistfm</code>. If you delete a gig from its setlist page, those concert scrobbles
          are removed too, and you can choose whether to remove the support acts logged that night.
        </p>
      </>
    ),
  },
  {
    id: "setlists-import-export",
    category: "Set Lists & Gigs",
    question: "Can I import past attended gigs from my Setlist.fm profile (or a friend's profile)?",
    answer: (
      <p>
        <strong>Yes!</strong> Click the <strong>Import / Export</strong> button in the Set Lists
        tab, enter their Setlist.fm username or paste their full profile link (e.g.{" "}
        <code>crispylettuce</code> or <code>https://www.setlist.fm/user/crispylettuce</code>), and
        click Preview Gigs. You can review the full concert list and tick checkboxes for only the
        gigs you actually attended before importing, or use Select All / Deselect All. The app will
        import only the selected concerts while safely honoring Setlist.fm's daily rate limits. If a
        big import reaches the daily limit, it pauses and carries on automatically after midnight
        UTC; you&apos;ll get a notification when it&apos;s done.
      </p>
    ),
  },
  {
    id: "setlists-festival-name",
    category: "Set Lists & Gigs",
    question: "Can I say which festival a gig was at?",
    answer: (
      <p>
        <strong>Yes.</strong> When you tick <em>This was a festival</em> on a gig, type its name in
        the <em>Festival name</em> box, such as Victorious Festival 2026. The name appears above the
        venue on the gig page, and in My Gigs and Songs Heard in place of the venue. Festivals are
        grouped without their year, so V Festival – 2009 and V Festival – 2008 count as one festival
        on a venue's page. Setlist.fm doesn&apos;t record festival names, so the app can&apos;t fill
        this in for you.
      </p>
    ),
  },
  {
    id: "setlists-furthest-gigs",
    category: "Set Lists & Gigs",
    question: "How far have I travelled to gigs?",
    answer: (
      <p>
        <strong>Set your home city.</strong> Go to <em>Settings → General</em> and enter the city
        you live in, such as Leeds, United Kingdom. The Gigs tab on Reports then shows your five
        furthest venues in kilometres, measured as the crow flies. A festival appears once, and
        tapping it shows every band you saw there. A venue the map doesn't know is placed at its
        city and marked approximate. Venues are looked up on OpenStreetMap in the background, a
        batch every couple of minutes, so a long history fills in by itself. Only you see these
        distances.
      </p>
    ),
  },
  {
    id: "setlists-download-profile",
    category: "Set Lists & Gigs",
    question: "I hit the Setlist.fm daily limit. How do I avoid fetching the same profile again?",
    answer: (
      <p>
        <strong>Download it once.</strong> After you preview a profile, tap{" "}
        <em>Download these gigs</em>. It saves every show on that profile, with its songs, to a
        file. Later, use <em>Import from file</em> with that file. Importing a downloaded file uses
        no Setlist.fm calls. Profile pages are also kept for a day, so previewing and importing the
        same profile doesn&apos;t fetch them twice.
      </p>
    ),
  },
  {
    id: "setlists-import-file",
    category: "Set Lists & Gigs",
    question: "Can I import gigs from a CSV or JSON file?",
    answer: (
      <p>
        <strong>Yes.</strong> In <strong>Import / Export</strong>, choose a .csv or .json file under{" "}
        <em>Import from a File</em>. It reads the same files the Export buttons create, so you can
        restore a backup or move gigs between accounts. JSON files bring their songs with them; CSV
        files look the songs up on Setlist.fm from each gig&apos;s link. Gigs you&apos;ve already
        logged are skipped, and any rows that can&apos;t be read are listed by line number.
      </p>
    ),
  },
  {
    id: "setlists-daily-limit",
    category: "Set Lists & Gigs",
    question: 'What does "daily Setlist.fm limit reached" mean?',
    answer: (
      <p>
        Setlist.fm allows the app around 1,400 requests a day, shared by everyone using it, and the
        count resets at midnight UTC. The app reuses what it has already downloaded, so normal use
        rarely gets close. If an import does reach the limit, it pauses and finishes itself after
        the reset. You can see or cancel a paused import in <strong>Import / Export</strong>.
      </p>
    ),
  },
  {
    id: "setlists-on-the-bill",
    category: "Set Lists & Gigs",
    question: "Can I see who else played at a gig, and log the support acts I saw?",
    answer: (
      <p>
        <strong>Yes.</strong> Open any gig and look under <em>My notes</em> for{" "}
        <strong>On the bill</strong>. It lists the other acts Setlist.fm has for that venue and
        night (up to 10), plus any you&apos;ve logged yourself. A tick means you&apos;ve already
        logged them; tap <em>+ I was there</em> to add one. Upcoming gigs usually have nobody listed
        until after the show.
      </p>
    ),
  },
  {
    id: "setlists-edit-gig",
    category: "Set Lists & Gigs",
    question: "I logged a gig with the wrong date or venue. Can I fix it?",
    answer: (
      <p>
        <strong>Yes.</strong> Open the gig and tap <em>Edit details</em>. You can change the artist,
        venue, city, country, date and tour. The songs you heard move to the corrected night, and
        support acts you logged with it move too. <em>Refresh from Setlist.fm</em> keeps your
        corrections and only updates the song list.
      </p>
    ),
  },
  {
    id: "setlists-went-with",
    category: "Set Lists & Gigs",
    question: "Can I add the friends I went to a gig with?",
    answer: (
      <p>
        <strong>Yes, if you follow them.</strong> On the gig&apos;s page, tap <em>+ Add people</em>{" "}
        under <em>Went with</em>. Each person gets a notification and a <em>Were you there?</em> box
        on their My Gigs. The gig is only added to their account if they choose{" "}
        <em>Add to my gigs</em>, and your notes are never shared. Anyone who already logged the show
        is simply linked.
      </p>
    ),
  },
  {
    id: "setlists-friends-gigs",
    category: "Set Lists & Gigs",
    question: "Can I see the gigs my friends have been to?",
    answer: (
      <p>
        <strong>Yes, if you follow them.</strong> Open their profile and tap <em>View Gigs</em> to
        browse their gigs, artists seen, songs heard and venues. It&apos;s read-only and their notes
        are never shown. If you were at one of their gigs too, open it and tap{" "}
        <em>+ I was there too</em> to add it to your own gigs, songs and support acts included.
      </p>
    ),
  },
  {
    id: "setlists-festivals",
    category: "Set Lists & Gigs",
    question: "How do I mark a gig as a festival?",
    answer: (
      <p>
        <strong>Tick the box.</strong> When you add a gig, or tap <em>Edit details</em> on an
        existing one, tick <em>This was a festival</em>. Festival gigs appear under a{" "}
        <em>Festivals</em> heading at the bottom of the <em>Venues</em> tab.
      </p>
    ),
  },
  {
    id: "setlists-gig-reports",
    category: "Set Lists & Gigs",
    question: "What do the gig reports show?",
    answer: (
      <p>
        <strong>The Gigs tab on Reports.</strong> It shows how many gigs you've been to per month
        and per year, with festivals counted separately. The <em>live gap</em> lists artists you
        play a lot on Spotify but have never seen live. The <em>gig bump</em> compares your average
        Spotify plays in the two weeks before and after each past gig. Gigs from the last two weeks
        are left out of the bump until their full window has passed.
      </p>
    ),
  },
  {
    id: "setlists-duplicates",
    category: "Set Lists & Gigs",
    question: "What happens if I log a gig I've already logged, or log one by mistake?",
    answer: (
      <p>
        You&apos;ll see a <strong>Gig already logged</strong> message asking if you&apos;re sure.
        Logging the same Setlist.fm show again just refreshes its songs; it never adds a second
        copy. To undo a mistake, tap <em>Undo</em> in the confirmation straight after logging, or
        use the small <em>Remove</em> link on the gig in My Gigs.
      </p>
    ),
  },
  {
    id: "setlists-view-songs",
    category: "Set Lists & Gigs",
    question: "Can I view the songs played at a gig, see encores, or copy the setlist?",
    answer: (
      <p>
        <strong>Yes!</strong> Tap any gig in <em>My Gigs</em> (or inside an expanded artist, song or
        venue) to open its setlist page. Songs are numbered in order and split into main sets and
        encores, with guest features, cover artist notes and tape intro tags. Tap{" "}
        <em>Copy setlist</em> to copy it as text, and <em>&larr; Back</em> to return to the list
        where you left it.
      </p>
    ),
  },
  {
    id: "setlists-gig-notes",
    category: "Set Lists & Gigs",
    question: "Can I add personal notes or memories to my gigs?",
    answer: (
      <p>
        <strong>Yes.</strong> Every attended gig supports personal diary notes. Open the gig from My
        Gigs and use the <em>My notes</em> box to write any personal memories (e.g. standing spots,
        who you attended with, favorite encore track). Your notes are securely saved in your
        database and displayed alongside the concert.
      </p>
    ),
  },
  {
    id: "setlists-future-gigs",
    category: "Set Lists & Gigs",
    question: "Can I track future gigs or concerts I'm planning to go to?",
    answer: (
      <p>
        <strong>Yes.</strong> Any concert with a future date automatically displays{" "}
        <strong>+ I&apos;m going</strong> instead of <em>✓ I was there</em>. In My Gigs, tap{" "}
        <strong>Upcoming</strong> under the heading to see shows on your horizon.
      </p>
    ),
  },
  {
    id: "setlists-stats-features",
    category: "Set Lists & Gigs",
    question: "How do the Artists Seen, Songs Heard, and Venues statistics work?",
    answer: (
      <>
        <p>The statistics tabs reflect every gig you have logged:</p>
        <ul>
          <li>
            <strong>Artists Seen:</strong> Ranked by times seen, then most recently seen. Uses
            tie-aware ranks (artists with the same count share a position) and proportional visual
            bars. Tap an artist to expand every gig you saw them at.
          </li>
          <li>
            <strong>Songs Heard:</strong> Counts live song plays. Use the sidebar to filter down to
            a single year or artist, and tap any song to see the exact concerts where you heard it.
          </li>
          <li>
            <strong>Venues:</strong> Ranks venues by distinct nights visited (even if support acts
            were saved with slight venue naming variations). Tap a venue to see all acts you watched
            there.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "setlists-refresh-latest",
    category: "Set Lists & Gigs",
    question: "Does 'Refresh from Setlist.fm' always get the newest tracklist?",
    answer: (
      <p>
        <strong>Yes.</strong> Clicking <em>Refresh from Setlist.fm</em> on any gig page always
        fetches the latest version directly from Setlist.fm, bypassing older cached copies so newly
        updated encore tracks or tape intros appear immediately.
      </p>
    ),
  },
  {
    id: "setlists-upcoming-missing",
    category: "Set Lists & Gigs",
    question: "What if an upcoming gig isn't appearing in search on Setlist.fm?",
    answer: (
      <p>
        Setlist.fm's general search API only indexes past concerts. To log an upcoming show, you can
        paste its direct Setlist.fm show/setlist link (e.g.{" "}
        <code>https://www.setlist.fm/show/...</code>) or 8-character setlist ID directly into the
        search bar, or tap <strong>+ Add Upcoming Show Manually</strong> in the Log a Gig tab to
        enter the artist, venue, city, and date.
      </p>
    ),
  },
];

export default function FaqSection() {
  const [searchQuery, setSearchQuery] = useState("");

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredFaqs = FAQ_DATA.filter((item) => {
    if (!trimmedQuery) return true;
    return (
      item.question.toLowerCase().includes(trimmedQuery) ||
      item.category.toLowerCase().includes(trimmedQuery)
    );
  });

  // Group by category
  const categories = Array.from(new Set(filteredFaqs.map((item) => item.category)));

  return (
    <section className="faq-section" aria-labelledby="faq-main-heading">
      <div className="faq-header">
        <h2 id="faq-main-heading">Frequently Asked Questions</h2>
        <p className="faq-subtitle">
          Quick answers to common questions about syncing, copying tracks, radio tools, and privacy.
        </p>

        <div className="faq-search-bar">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions..."
            aria-label="Search FAQ questions"
            className="faq-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="faq-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredFaqs.length === 0 ? (
        <div className="faq-empty">
          <p>
            No questions matched your search. Try searching for "sync", "car", "radio", or "delete".
          </p>
        </div>
      ) : (
        <div className="faq-groups">
          {categories.map((category) => (
            <div key={category} className="faq-category-group">
              <h3 className="faq-category-title">{category}</h3>
              <div className="faq-items-list">
                {filteredFaqs
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <details key={item.id} className="faq-item">
                      <summary className="faq-question">
                        <span>{item.question}</span>
                      </summary>
                      <div className="faq-answer">{item.answer}</div>
                    </details>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
