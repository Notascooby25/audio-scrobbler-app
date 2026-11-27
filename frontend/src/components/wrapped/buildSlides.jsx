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
  TopArtistSlide,
} from "./musicSlides";
import {
  gigPages,
  GigsCalendarSlide,
  GigsGlanceSlide,
  GigsHighlightsSlide,
  GigsListSlide,
  GigsMilesSlide,
} from "./gigSlides";
import SectionSlide from "./SectionSlide";
import Shapes, { SHAPE_CORNERS, SHAPE_VARIANTS } from "./Shapes";
import SummarySlide from "./SummarySlide";

// The slides for a snapshot, in order, in two parts (music, then gigs). A slide with nothing to show is left
// out, and so is any slide whose data an older snapshot doesn't have, so an old snapshot never crashes a
// newer design. Each slide says which part it belongs to and what colour tone it uses.
export function buildSlides(snapshot) {
  const { music, gigs } = snapshot;
  const both = Boolean(music && gigs);
  const slides = [
    { id: "intro", part: 1, label: "", tone: "dark", node: <IntroSlide snapshot={snapshot} /> },
  ];
  const add = (id, part, tone, node, label) => slides.push({ id, part, tone, label, node });

  if (music) {
    if (both) {
      add(
        "part-music",
        1,
        "accent",
        <SectionSlide part="1" title="Your music" blurb="What you played this year." />,
        "Music"
      );
    }
    add("minutes", 1, "dark", <MinutesSlide music={music} />, "Music");
    if (music.months?.length === 12) {
      add("months", 1, "dark", <MonthsSlide music={music} />, "Music");
    }
    if (music.top_artists?.length) {
      add("top-artist", 1, "dark", <TopArtistSlide music={music} />, "Music");
      add("artists", 1, "dark", <ArtistsSlide music={music} />, "Music");
    }
    if (music.top_songs?.length) add("songs", 1, "dark", <SongsSlide music={music} />, "Music");
    if (music.top_albums?.length) add("albums", 1, "dark", <AlbumsSlide music={music} />, "Music");
    if (music.top_genres?.length) add("genres", 1, "dark", <GenresSlide music={music} />, "Music");
    if (music.listener_label) add("clock", 1, "dark", <ClockSlide music={music} />, "Music");
    if (music.biggest_day) {
      add("biggest-day", 1, "dark", <BiggestDaySlide music={music} />, "Music");
    }
    if (music.new_artists != null) {
      add("new-artists", 1, "dark", <NewArtistsSlide music={music} />, "Music");
    }
  }

  if (gigs) {
    if (both) {
      add(
        "part-gigs",
        2,
        "accent",
        <SectionSlide part="2" title="Your gigs" blurb="Where you saw them live." />,
        "Gigs"
      );
    }
    add("gigs-glance", 2, "light", <GigsGlanceSlide gigs={gigs} />, "Gigs");
    const listed = gigs.gig_list?.length || 0;
    if (listed) {
      const { pages, size } = gigPages(listed);
      for (let page = 0; page < pages; page += 1) {
        add(
          `gigs-list-${page + 1}`,
          2,
          "light",
          <GigsListSlide gigs={gigs} page={page} pages={pages} size={size} />,
          "Gigs"
        );
      }
    }
    if (gigs.miles && gigs.miles.total > 0) {
      add("gigs-miles", 2, "light", <GigsMilesSlide gigs={gigs} />, "Gigs");
    }
    if (gigs.months_with_gigs?.length && gigs.busiest_month) {
      add("gigs-calendar", 2, "light", <GigsCalendarSlide gigs={gigs} />, "Gigs");
    }
    add("gigs-highlights", 2, "light", <GigsHighlightsSlide gigs={gigs} />, "Gigs");
  }

  slides.push({
    id: "summary",
    part: gigs ? 2 : 1,
    label: "",
    tone: "dark",
    node: <SummarySlide snapshot={snapshot} />,
  });

  return slides.map((slide, index) => ({
    ...slide,
    node: (
      <>
        <Shapes
          variant={SHAPE_VARIANTS[index % SHAPE_VARIANTS.length]}
          corner={SHAPE_CORNERS[index % SHAPE_CORNERS.length]}
        />
        <div className="wrapped-body">{slide.node}</div>
      </>
    ),
  }));
}
