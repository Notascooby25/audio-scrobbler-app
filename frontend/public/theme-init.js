try {
  var params = new URLSearchParams(window.location.search);
  var urlSkin = params.get("skin");
  // Timeline is the default skin; keep this in step with DEFAULT_SKIN_ID in src/skins/index.js.
  var skin = urlSkin || localStorage.getItem("audio-scrobbler-skin") || "timeline";
  document.documentElement.setAttribute("data-skin", skin);
  var theme = localStorage.getItem("audio-scrobbler-theme");
  if (theme && (!skin || skin === "classic" || skin === "timeline")) {
    document.documentElement.setAttribute("data-theme", theme);
  } else if (skin === "sleeve") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  var accent = localStorage.getItem("audio-scrobbler-accent");
  if (accent) document.documentElement.setAttribute("data-accent", accent);
} catch (e) {}
