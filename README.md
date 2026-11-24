# computing-with-http

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

HTTP computing primitives: protocol codecs for headers, cookies, negotiation, SSE, WebSocket frames, ESI, and multipart bodies.

## Native qualification

Install the locked development closure with `npm ci --ignore-scripts`, then run
`npm test`. The suite builds the package and executes its compiled
[protocol checks](src/codecs/protocol.test.mts). Node Engineering replays those
tests against the packed build through the existing TypeScript project mapping.

The checks use published HTTP-date and WebSocket vectors, documented cookie and
media-type round trips, and complete SSE event framing. [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) · [WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.7) · [HTML event streams](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)
