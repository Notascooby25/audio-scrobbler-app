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
            Go to <strong>Following</strong> and open your friend's profile.
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
        and Deezer to fetch high-resolution covers.
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
