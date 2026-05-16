# chatgpt-apps-masterclass

## Server

### 1. KV Namespace 생성

`server` 디렉토리에서 아래 명령어로 Cloudflare KV 네임스페이스를 생성합니다:

```bash
cd server
npx wrangler@latest kv namespace create FLASHCARDS_KV
```

### 2. wrangler.jsonc KV 바인딩 설정

생성된 KV namespace ID를 `wrangler.jsonc`에 추가합니다:

```jsonc
"kv_namespaces": [
  {
    "binding": "FLASHCARDS_KV",
    "id": "<생성된-namespace-id>",
    "remote": true
  }
]
```

### 3. Worker 타입 업데이트

`worker-configuration.d.ts`에 KV 바인딩 타입을 추가합니다:

```ts
interface Env {
  ASSETS: Fetcher;
  FLASHCARDS_KV: KVNamespace;
}
```

### 4. index.ts — create-deck 툴 구현

`FLASHCARDS_KV`를 사용해 플래시카드 덱을 저장하는 MCP 툴을 구현합니다.

- 덱 저장 키 패턴: `user:{username}:deck:{deckId}`
- 카드 구조: `{ front, back, hint, id, status }`
- 덱 생성 시 username을 Claude가 먼저 요청하도록 description에 명시
