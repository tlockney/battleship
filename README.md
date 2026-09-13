# Broadside

Two-player Battleship you can play from anywhere, designed for low vision.

- Open the page, enter a name, and share the game code or link.
- Each player's fleet stays on their own device (`localStorage`); only shots
  and results cross the network.
- Moves travel through a public [ntfy.sh](https://ntfy.sh) topic named after
  the game code. There is no server to run. ntfy keeps a topic's history for
  about 12 hours, so finish a game within that window. To self-host, change
  `RELAY` in `index.html` to your own ntfy instance.
- The text-size control and high-contrast marks (shape plus color) are for
  players with limited visual acuity. The boards are keyboard-navigable and
  screen-reader labelled.

## Develop

```sh
deno test          # rules in game.js
deno run -A jsr:@std/http/file-server .   # serve locally
```
