/** Present on Vercel so the UI knows to use the browser hub (not a Node /ws server). */
export default function handler(_req, res) {
  res.status(200).json({ clientMode: true });
}
