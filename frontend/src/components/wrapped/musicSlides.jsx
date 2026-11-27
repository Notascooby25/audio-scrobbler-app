import Cover from "./Cover";
import { Big, Chip, CoverList, playsDetail, sizeClass } from "./Pieces";
import { MONTH_NAMES, WEEKDAY_NAMES, formatDay, formatHour, formatNumber, plural } from "./format";

export function IntroSlide({ snapshot }) {
  const { year, date_to: dateTo, partial_from: partialFrom, music, gigs } = snapshot;
  const range = partialFrom
    ? `From ${formatDay(partialFrom, { withYear: true })} to ${formatDay(dateTo, { withYear: true })}`
    : `1 January to ${formatDay(dateTo, { withYear: true })}`;
  const about = music && gigs ? "music and gigs" : music ? "music" : "gigs";
  return (
    <>
      <p className="wrapped-year-mark">{year}</p>
      <Chip>Your year in {about}</Chip>
      <p className="wrapped-line">{range}</p>
      <p className="wrapped-note">Tap the right side to go on.</p>
    </>
  );
}

export function MinutesSlide({ music }) {
  const days = music.estimated_minutes / 1440;
  return (
    <>
      <Chip>You listened for about</Chip>
      <Big>{formatNumber(music.estimated_minutes)}</Big>
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
      <Chip>Your year in months</Chip>
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

export function TopArtistSlide({ music }) {
  const [top] = music.top_artists;
  return (
    <>
      <div className="wrapped-hero-art">
        <Cover src={top.artwork_url} name={top.name} className="wrapped-cover-hero" />
      </div>
      <Chip>Your top artist</Chip>
      <p className={`wrapped-hero-name ${sizeClass(top.name, { m: 12, s: 20 })}`}>{top.name}</p>
      <p className="wrapped-line">{plural(top.plays, "play")} this year.</p>
    </>
  );
}

export function ArtistsSlide({ music }) {
  return (
    <>
      <Chip>Your top artists</Chip>
      <CoverList items={music.top_artists} detail={playsDetail} />
    </>
  );
}

export function SongsSlide({ music }) {
  return (
    <>
      <Chip>Your top songs</Chip>
      <CoverList items={music.top_songs} detail={playsDetail} sub={(item) => item.artist} />
    </>
  );
}

export function AlbumsSlide({ music }) {
  return (
    <>
      <Chip>Your top albums</Chip>
      <CoverList items={music.top_albums} detail={playsDetail} sub={(item) => item.artist} />
    </>
  );
}

export function GenresSlide({ music }) {
  return (
    <>
      <Chip>Your top genres</Chip>
      <ol className="wrapped-genres">
        {music.top_genres.map((genre, index) => (
          <li key={genre.name} data-rank={index + 1}>
            <span className="wrapped-genre-name">{genre.name}</span>
            <span className="wrapped-genre-share">{Math.round(genre.share * 100)}%</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function ClockSlide({ music }) {
  return (
    <>
      <Chip>Your listening clock</Chip>
      <p className={`wrapped-big ${sizeClass(music.listener_label, { m: 8, s: 12 })}`}>
        {music.listener_label}
      </p>
      <p className="wrapped-line">
        You played most at <strong>{formatHour(music.busiest_hour)}</strong>, mostly on{" "}
        <strong>{WEEKDAY_NAMES[music.busiest_weekday]}</strong>.
      </p>
    </>
  );
}

export function BiggestDaySlide({ music }) {
  const day = music.biggest_day;
  const text = formatDay(day.date);
  return (
    <>
      <Chip>Your biggest day</Chip>
      <Big>{text}</Big>
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
      <Chip>New for you</Chip>
      <Big>{formatNumber(music.new_artists)}</Big>
      <p className="wrapped-line">artists you hadn&apos;t played before this year.</p>
      {music.new_artists_top?.length > 0 && (
        <>
          <p className="wrapped-line">Your top three:</p>
          <CoverList items={music.new_artists_top} detail={playsDetail} />
        </>
      )}
      {first && (
        <p className="wrapped-note">
          First song of the year: {first.name} by {first.artist}.
        </p>
      )}
    </>
  );
}
