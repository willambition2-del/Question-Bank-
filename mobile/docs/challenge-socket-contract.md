# Challenge REST and Socket.IO contract

Verified against backend commit `9734ec8`.

## Transport and authentication

REST uses the configured `/api/v1` base URL and bearer authentication. Socket.IO connects to the server origin with namespace `/challenges`, websocket transport, and `auth.token` containing the current access token. One shared socket instance is used. A successful REST token refresh reconnects an active socket with the new token; logout/session expiry disconnects it. Reconnection is followed by `challenge:state` and the client also emits `challenge:sync` for the active challenge.

## REST lifecycle

- `GET /challenges/modes`
- `POST /challenges/matchmaking` for `ONE_VS_ONE`, `LIGHTNING`, and `SURVIVAL`
- `POST /challenges` for invitation lobbies, including `TWO_VS_TWO`
- `GET /challenges`, `GET /challenges/history`, `GET /challenges/:id`
- `POST /challenges/:id/invitations`, `/accept`, `/reject`, `/cancel`
- `POST /challenges/:id/join`, `/leave`, `/ready`, `/rematch`
- `GET /challenges/:id/result`

The backend enum values are sent unchanged. `TWO_VS_TWO` uses a created lobby because matchmaking explicitly rejects that mode.

## Socket events

Client to server: `challenge:join`, `challenge:leave`, `challenge:ready`, `challenge:answer`, `challenge:sync`, `challenge:heartbeat`, `challenge:rematch`.

Server to client: `challenge:state`, `challenge:connection_restored`, `challenge:error`, `challenge:connection_lost`, `challenge:joined`, `challenge:participant_joined`, `challenge:participant_left`, `challenge:ready_updated`, `challenge:countdown`, `challenge:started`, `challenge:question`, `challenge:round_completed`, `challenge:score_updated`, `challenge:completed`.

## Authority rules

- Questions arrive only from `challenge:question` or the safe current-question projection in `challenge:state`.
- `challenge:answer` sends only the selected option/boolean. It never sends elapsed time, score, or correctness.
- Correctness, points, total score, hearts, completion, winner, and standings are accepted only from server events/REST results.
- The UI countdown and question clock are display-only. They never advance rounds or complete a challenge. At a server-provided `roundEndsAt`, the client requests `challenge:sync`; the server decides the next state.
- The backend does not expose the correct option in active challenge payloads, so the UI marks only whether the selected answer was correct and does not reveal another option.