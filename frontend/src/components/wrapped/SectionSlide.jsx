// The title card that opens each half of the story, so the two parts are obvious.
export default function SectionSlide({ part, title, blurb }) {
  return (
    <>
      <p className="wrapped-part-number">{part}</p>
      <h2 className="wrapped-part-title">{title}</h2>
      <p className="wrapped-line">{blurb}</p>
    </>
  );
}
