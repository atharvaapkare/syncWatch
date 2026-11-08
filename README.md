# SyncWatch

Watch together with no relayed stream. Every device plays its own copy; only play / pause / seek and a small drift correction are synced over WebSockets.

## Run
```
npm install
npm start          # http://localhost:3000
```

## Use with a friend (different networks)
Run one of these next to the server, then share the URL it prints:
```
npx cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```
Or deploy the folder free on Render / Railway / Fly.io (start command: `npm start`).

## Modes
- **My file**: each person opens their own copy of the same file (best quality, works offline). Optional .srt/.vtt subtitles.
- **Video link**: direct .mp4 / .webm / .m3u8 URL; every device streams it directly.
- **Website**: shares a site URL with the room, plus a synced 5-second countdown and chat. Websites can't be remote-controlled from another page, so each person presses play at "GO".

Tip: for a perfect sync on Website mode, one person can say "pause at 0:00" and everyone starts on the countdown.
