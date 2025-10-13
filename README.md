# Flash Tickets Monorepo

NestJS 기반 API(`api/`)와 Vite React 프론트엔드(`web/`)가 하나의 레포로 구성되어 있습니다.

## 개발 환경 준비

- Node.js 20.19.0 버전이 필요합니다. `nvm use` 명령이 자동으로 적용되도록 `.nvmrc`를 제공합니다.
- pnpm 10.17.1 (`corepack prepare pnpm@10.17.1 --activate`)

## 개발 서버 실행

```bash
pnpm install
pnpm --dir api install
pnpm --dir web install
pnpm dev
```

환경 변수는 `.env.example`를 참고해 `.env` 파일을 각 서비스 루트에 작성하세요.

> 참고: 현재 저장소에는 Docker Compose 설정이 포함되어 있지 않습니다.
