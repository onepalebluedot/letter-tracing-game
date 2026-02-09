# Rainbow Letter Tracing

A colorful, touch-friendly toddler web game for practicing letter tracing on iPad or desktop browsers.

## Features

- Large letter tracing canvas with playful visuals
- Color picker for brush color selection
- Letter selector (`A-Z`) and random letter button
- Voice playback for the current letter
- Completion celebration feedback
- Cloudflare Worker-ready deployment setup

## Project Structure

- `index.html` - App layout and controls
- `styles.css` - Visual design and responsive styles
- `app.js` - Tracing logic, touch input, letter flow
- `worker.js` - Cloudflare Worker request handler for static assets
- `wrangler.toml` - Wrangler configuration

## Run Locally

1. Install dependencies:
   - `npm install`
2. Start local dev server with Wrangler:
   - `npm run dev`
3. Open the local URL shown by Wrangler in your browser.

## Deploy to Cloudflare Workers

1. Authenticate:
   - `npx wrangler login`
2. Deploy:
   - `npm run deploy`

## Gameplay

1. Pick a letter from the dropdown or tap **Random Letter**.
2. Pick a brush color.
3. Trace the letter on the canvas.
4. Tap **Say Letter** to hear the selected letter.
5. Tap **Clear** to try again on the same letter.

## Notes

- Built for touch-first interaction (`pointer` events).
- Works best on modern Safari/Chrome browsers.
