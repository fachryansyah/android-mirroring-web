# android-mirror

Example implementation of Android screen mirroring in a browser using:

- scrcpy (captures the device screen as H.264)
- ffmpeg (converts the stream into a browser-friendly H.264 bytestream)
- Node.js + ws (broadcasts video bytes over WebSocket)
- WebCodecs (decodes H.264 in the browser and draws to a canvas)

This project is video-only (no audio, no device control).

## How it works

1. `server.cjs` creates a named pipe at `/tmp/scrcpy_pipe`.
2. It starts `scrcpy` and tells it to `--record` to that pipe in `mkv` format.
3. It starts `ffmpeg` to read the MKV stream from the pipe and output a raw H.264 Annex-B bytestream to stdout.
4. A WebSocket server (`ws://localhost:8081`) broadcasts the H.264 chunks to any connected browser clients.
5. `android.html` connects to the WebSocket, splits the incoming bytes into H.264 NAL units (by start codes), waits for SPS/PPS, configures a `VideoDecoder`, then feeds frames into WebCodecs and draws decoded frames to a `<canvas>`.

Files:

- [server.cjs](file:///Users/fahri/Projects/Autozone/android-mirror/server.cjs) — scrcpy + ffmpeg + WebSocket broadcaster
- [android.html](file:///Users/fahri/Projects/Autozone/android-mirror/android.html) — WebSocket receiver + H.264 parsing + WebCodecs decoding

## Requirements

- Node.js (any recent LTS)
- pnpm (optional, but this repo is configured for pnpm)
- scrcpy installed and available on PATH
- ffmpeg installed and available on PATH
- Android device with USB debugging enabled
- A browser with WebCodecs support (Chrome/Edge recommended)

Notes:

- This is macOS/Linux oriented: it uses `mkfifo` and `/tmp/...`.
- WebCodecs support is required; if your browser doesn’t support it, the page will show an error.

## Install

1. Connect your Android device and verify it’s visible:

```bash
adb devices
```

2. Install Node dependencies:

```bash
pnpm install
```

3. Install platform tools:

- macOS (Homebrew):

```bash
brew install scrcpy ffmpeg android-platform-tools
```

## Run

### 1) Start the Node server

From the project folder:

```bash
node server.cjs
```

You should see a log like:

- `WebSocket on ws://localhost:8081`

Keep this terminal running.

### 2) Open the UI

Option A (recommended): serve it over localhost (helps avoid browser security limitations):

```bash
npx serve .
```

Then open the shown URL in Chrome/Edge and click `android.html` (or open `/android.html` directly if your server supports it).

Option B: open the file directly:

- Open [android.html](file:///Users/fahri/Projects/Autozone/android-mirror/android.html) in your browser.

The page connects to `ws://localhost:8081`, then starts showing frames once it receives a keyframe.

## Troubleshooting

- Blank screen / stuck on “waiting for stream”
  - Make sure the Node server is running and `ws://localhost:8081` is reachable.
  - Make sure `scrcpy` can see the device (`adb devices`) and that you accepted the USB debugging prompt on the phone.
  - If you have multiple devices/emulators connected, disconnect extras so scrcpy can pick one.

- “WebCodecs not supported”
  - Use Chrome or Edge.

- `scrcpy: command not found` / `ffmpeg: command not found`
  - Install the missing tool and ensure it’s on your PATH.
