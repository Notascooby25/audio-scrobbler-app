import {
  AlbumsSlide,
  ArtistsSlide,
  BiggestDaySlide,
  ClockSlide,
  GenresSlide,
  IntroSlide,
  MinutesSlide,
  MonthsSlide,
  NewArtistsSlide,
  SongsSlide,
} from "./musicSlides";
import {
  GigsCalendarSlide,
  GigsGlanceSlide,
  GigsHighlightsSlide,
  GigsMilesSlide,
} from "./gigSlides";
import SummarySlide from "./SummarySlide";

// The slides for a snapshot, in order. A slide with nothing to show is left out, and so is any slide
// whose data an older snapshot doesn't have, so an old snapshot never crashes a newer design.
export function buildSlides(snapshot) {
  const { music, gigs } = snapshot;
  const slides = [{ id: "intro", node: <IntroSlide snapshot={snapshot} /> }];

  if (music) {
    slides.push({ id: "minutes", node: <MinutesSlide music={music} /> });
    if (music.months?.length === 12) {
      slides.push({ id: "months", node: <MonthsSlide music={music} /> });
    }
    if (music.top_artists?.length) {
      slides.push({ id: "artists", node: <ArtistsSlide music={music} /> });
    }
    if (music.top_songs?.length) {
      slides.push({ id: "songs", node: <SongsSlide music={music} /> });
    }
    if (music.top_albums?.length) {
      slides.push({ id: "albums", node: <AlbumsSlide music={music} /> });
    }
    if (music.top_genres?.length) {
      slides.push({ id: "genres", node: <GenresSlide music={music} /> });
    }
    if (music.listener_label) slides.push({ id: "clock", node: <ClockSlide music={music} /> });
    if (music.biggest_day)
      slides.push({ id: "biggest-day", node: <BiggestDaySlide music={music} /> });
    if (music.new_artists != null) {
      slides.push({ id: "new-artists", node: <NewArtistsSlide music={music} /> });
    }
  }

  if (gigs) {
    slides.push({ id: "gigs-glance", node: <GigsGlanceSlide gigs={gigs} /> });
    if (gigs.miles && gigs.miles.total > 0) {
      slides.push({ id: "gigs-miles", node: <GigsMilesSlide gigs={gigs} /> });
    }
    if (gigs.months_with_gigs?.length && gigs.busiest_month) {
      slides.push({ id: "gigs-calendar", node: <GigsCalendarSlide gigs={gigs} /> });
    }
    slides.push({ id: "gigs-highlights", node: <GigsHighlightsSlide gigs={gigs} /> });
  }

  slides.push({ id: "summary", node: <SummarySlide snapshot={snapshot} /> });
  return slides.map((slide, index) => ({ ...slide, tone: index % 2 === 0 ? "dark" : "light" }));
}
