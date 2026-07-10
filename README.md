# timelim (name TBD)

This is a Chrome extension that lets users set time limits and checks if the limit has been reached, then blocks the website. Pretty simple, but the Chrome extension I used to use was buggy, so I thought I'd build one myself. I started this project over a year ago when I barely knew how to code at all, so the biggest hurdle I faced was learning JavaScript and just figuring out how DOM and everything web-related worked.

## features

-   set a time limit for any website
-   track screen time usage
-   resets daily!

## development

The popup UI is built with React + TypeScript via Vite. The service worker
(`public/background.js`) and blocking scripts stay plain JS and are copied
into the build as-is.

```
npm install        # once
npm run build      # type-checks and builds into dist/
npm run dev        # rebuilds on every file change
```

Load the extension by pointing chrome://extensions "Load unpacked" at the
**`dist/`** folder (not the repo root). After code changes, rebuild and hit
the reload button on the extension card.
