/**
 * Credit required by Skiddle's API terms: name them and show their unaltered logo wherever their
 * listings appear, and don't imply they endorse this app. Both official logo colours are shown;
 * CSS picks the one that suits the current theme.
 */
export default function SkiddleCredit() {
  return (
    <div className="sfm-skiddle-credit">
      <span className="sfm-skiddle-lead">Event listings from</span>
      <a
        className="sfm-skiddle-link"
        href="https://www.skiddle.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          className="sfm-skiddle-logo sfm-skiddle-logo-on-light"
          src="/skiddle/skiddle-logo-black-landscape.png"
          alt="Skiddle"
          width="1080"
          height="418"
        />
        <img
          className="sfm-skiddle-logo sfm-skiddle-logo-on-dark"
          src="/skiddle/skiddle-logo-white-landscape.png"
          alt=""
          aria-hidden="true"
          width="1080"
          height="418"
        />
      </a>
      <span className="sfm-skiddle-note">
        This app is not affiliated with or endorsed by Skiddle.
      </span>
    </div>
  );
}
