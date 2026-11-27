import { MONTH_NAMES, WEEKDAY_NAMES, formatDay, formatHour, formatNumber, plural } from "./format";

export function IntroSlide({ snapshot }) {
  const { year, date_to: dateTo, partial_from: partialFrom, music } = snapshot;
  const range = partialFrom
    ? `From ${formatDay(partialFrom, { withYear: true })} to ${formatDay(dateTo, { withYear: true })}`
    : `1 January to ${formatDay(dateTo, { withYear: true })}`;
  return (
    <>
      <p className="wrapped-kicker">Audio Scrobbler</p>
      <h2 className="wrapped-title">{music ? `Your ${year} in music` : `Your ${year}`}</h2>
      <p className="wrapped-line">{range}</p>
      <p className="wrapped-note">Tap the right side to go on.</p>
    </>
  );
}

export function MinutesSlide({ music }) {
  const days = music.estimated_minutes / 1440;
  return (
    <>
      <p className="wrapped-kicker">You listened for about</p>
      <p className="wrapped-big">{formatNumber(music.estimated_minutes)}</p>
      <p className="wrapped-line">
        minutes. That&apos;s about {days >= 10 ? Math.round(days) : days.toFixed(1)} days.
      </p>
      <p className="wrapped-note">Estimated from track length.</p>
    </>
  );
}

export function MonthsSlide({ music }) {
  const peak = Math.max(...music.months, 1);
  return (
    <>
      <p className="wrapped-kicker">Your year in months</p>
      <div className="wrapped-bars" aria-hidden="true">
        {music.months.map((count, index) => (
          <div key={MONTH_NAMES[index]} className="wrapped-bar-col">
            <div className="wrapped-bar" style={{ height: `${(count / peak) * 100}%` }} />
            <span>{MONTH_NAMES[index][0]}</span>
          </div>
        ))}
      </div>
      <p className="wrapped-line">
        Your busiest month was <strong>{MONTH_NAMES[music.busiest_month - 1]}</strong>.
      </p>
    </>
  );
}

function RankList({ items, detail }) {
  return (
    <ol className="wrapped-list">
      {items.map((item) => (
        <li key={`${item.name}-${item.artist || ""}`}>
          <span className="wrapped-truncate">{item.name}</span>
          <span className="wrapped-list-detail">{detail(item)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ArtistsSlide({ music }) {
  return (
    <>
      <p className="wrapped-kicker">Your top artists</p>
      <RankList items={music.top_artists} detail={(item) => `${formatNumber(item.plays)} plays`} />
    </>
  );
}

export function SongsSlide({ music }) {
  const [first] = music.top_songs;
  return (
    <>
      <p className="wrapped-kicker">Your top songs</p>
      <p className="wrapped-line">
        Number one: <strong className="wrapped-truncate">{first.name}</strong> by {first.artist},{" "}
        {plural(first.plays, "play")}.
      </p>
      <RankList items={music.top_songs} detail={(item) => item.artist} />
    </>
  );
}

export function AlbumsSlide({ music }) {
  return (
    <>
      <p className="wrapped-kicker">Your top albums</p>
      <RankList items={music.top_albums} detail={(item) => item.artist} />
    </>
  );
}

export function GenresSlide({ music }) {
  return (
    <>
      <p className="wrapped-kicker">Your top genres</p>
      <RankList items={music.top_genres} detail={(item) => `${Math.round(item.share * 100)}%`} />
    </>
  );
}

export function ClockSlide({ music }) {
  return (
    <>
      <p className="wrapped-kicker">Your listening clock</p>
      <p className="wrapped-title">{music.listener_label}</p>
      <p className="wrapped-line">
        You played most at <strong>{formatHour(music.busiest_hour)}</strong>, mostly on{" "}
        <strong>{WEEKDAY_NAMES[music.busiest_weekday]}</strong>.
      </p>
    </>
  );
}

export function BiggestDaySlide({ music }) {
  const day = music.biggest_day;
  return (
    <>
      <p className="wrapped-kicker">Your biggest day</p>
      <p className="wrapped-big">{formatDay(day.date)}</p>
      <p className="wrapped-line">
        {plural(day.plays, "play")}, about {formatNumber(day.minutes)} minutes.
      </p>
    </>
  );
}

export function NewArtistsSlide({ music }) {
  const first = music.first_song;
  return (
    <>
      <p className="wrapped-kicker">New for you</p>
      <p className="wrapped-big">{formatNumber(music.new_artists)}</p>
      <p className="wrapped-line">artists you hadn&apos;t played before this year.</p>
      {first && (
        <p className="wrapped-note">
          First song of the year: <span className="wrapped-truncate">{first.name}</span> by{" "}
          {first.artist}.
        </p>
      )}
    </>
  );
}
