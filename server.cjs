const { WebSocketServer } = require("ws");
const { spawn, execSync } = require("child_process");
const fs = require("fs");

const WS_PORT = 8081;
const PIPE_PATH = "/tmp/scrcpy_pipe";

async function start() {
  try { fs.unlinkSync(PIPE_PATH); } catch (_) {}
  execSync(`mkfifo ${PIPE_PATH}`);
  console.log(`Named pipe created: ${PIPE_PATH}`);

  const wss = new WebSocketServer({ port: WS_PORT });
  console.log(`WebSocket on ws://localhost:${WS_PORT}`);

  wss.on("connection", (ws) => {
    console.log("Browser client connected");
  });

  const scrcpy = spawn("scrcpy", [
    "--video-codec=h264",
    "--no-audio",
    "--no-control",
    "--no-playback",
    `--record=${PIPE_PATH}`,
    "--record-format=mkv",  // ✅ mkv supports streaming/non-seekable output
    "--max-fps=30",
    "--max-size=1280",
    "--video-bit-rate=2M",
  ]);

  scrcpy.stdout.on("data", (d) => console.log(`[scrcpy out] ${d.toString().trim()}`));
  scrcpy.stderr.on("data", (d) => console.log(`[scrcpy] ${d.toString().trim()}`));
  scrcpy.on("exit", (code) => {
    console.log(`scrcpy exited: ${code}`);
    try { fs.unlinkSync(PIPE_PATH); } catch (_) {}
    process.exit(code ?? 0);
  });

  console.log("Waiting for scrcpy to start...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Starting ffmpeg...");
  const ffmpeg = spawn("ffmpeg", [
    "-re",                          // read at native frame rate
    "-i", PIPE_PATH,                // mkv from pipe
    "-c:v", "copy",                 // no re-encode
    "-bsf:v", "h264_mp4toannexb",  // annexb start codes for browser
    "-f", "h264",
    "pipe:1",
  ]);

  ffmpeg.stdout.on("data", (chunk) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(chunk);
      }
    });
  });

  ffmpeg.stderr.on("data", (d) => console.log(`[ffmpeg] ${d.toString().trim()}`));
  ffmpeg.on("exit", (code) => console.log(`ffmpeg exited: ${code}`));

  process.on("SIGINT", () => {
    scrcpy.kill();
    ffmpeg.kill();
    try { fs.unlinkSync(PIPE_PATH); } catch (_) {}
    process.exit(0);
  });
}

start().catch(console.error);