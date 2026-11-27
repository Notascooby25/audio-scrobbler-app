import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Covers come from other websites, and the picture maker can only copy ones that allow it. Fetch each one up
// front: a cover we can copy becomes a local copy, and one we can't is removed so the coloured tile behind it
// shows instead of a blank hole.
async function inlineImages(node) {
  const images = Array.from(node?.querySelectorAll("img") || []);
  await Promise.all(
    images.map(async (img) => {
      try {
        const response = await fetch(img.src, { mode: "cors", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("bad response");
        // A data address, not a blob address: the app's security policy doesn't let the picture maker fetch blobs.
        img.src = await toDataUrl(await response.blob());
      } catch {
        img.remove();
      }
    })
  );
}

async function waitForImages(node) {
  const images = Array.from(node?.querySelectorAll("img") || []);
  await Promise.all(
    images.map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 5000); // never hang on a picture that won't load
          })
    )
  );
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Safari can cancel the download if the address is revoked straight away.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Makes a tall 1080 x 1920 picture of the current slide and hands it to the phone's share menu,
// or downloads it where sharing files isn't supported.
export default function ShareSlideButton({ slide, tone, filename }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stageRef = useRef(null);

  useEffect(() => {
    if (!busy) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts?.ready;
        await inlineImages(stageRef.current);
        await waitForImages(stageRef.current);
        const blob = await toBlob(stageRef.current, {
          width: 1080,
          height: 1920,
          pixelRatio: 1,
          cacheBust: true,
          imagePlaceholder: TRANSPARENT_PIXEL,
        });
        if (!blob) throw new Error("No image was made");
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "My year in review" });
          } catch (shareError) {
            if (shareError?.name === "AbortError") throw shareError;
            // Phones refuse a share that starts too long after the tap (making the picture takes a moment).
            download(blob, filename);
          }
        } else {
          download(blob, filename);
        }
      } catch (error) {
        if (!cancelled && error?.name !== "AbortError") {
          setMessage("Couldn't make the picture. Please try again.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, filename]);

  return (
    <>
      <button
        type="button"
        className="wrapped-share"
        disabled={busy}
        onClick={() => {
          setMessage("");
          setBusy(true);
        }}
      >
        {busy ? "Making picture…" : "Share"}
      </button>
      {message && (
        <p className="wrapped-share-message" role="alert">
          {message}
        </p>
      )}
      {busy && (
        <div className="wrapped-share-offscreen" aria-hidden="true">
          <div ref={stageRef} className={`wrapped-share-stage wrapped-tone-${tone}`}>
            <div className="wrapped-slide">{slide}</div>
          </div>
        </div>
      )}
    </>
  );
}
