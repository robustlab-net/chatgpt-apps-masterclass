


```bash

npm create cloudflare@latest
name: server

npm i @modelcontextprotocol/sdk zod agents @modelcontextprotocol/ext-apps

.dev.vars에 추가후
npm run cf-typegen
그럼 env.변수를 확인할 수 있다.

npx @modelcontextprotocol/inspector

# secret api_key
npx wrangler@latest secret put API_KEY
```
