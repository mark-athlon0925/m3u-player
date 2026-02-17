# M3U Player

M3U URL을 등록하여 채널을 시청하는 웹 기반 TV 스트리밍 플레이어.

## 구조

```
├── index.html       # 메인 페이지 (채널 그리드, M3U/EPG 설정)
├── player.html      # 플레이어 페이지 (video.js + 채널 목록)
├── js/
│   ├── tv-common.js # 공통 로직 (Vue mixin, EPG 파서, 캐시, 로고 fallback)
│   └── util.js      # 유틸리티
└── img/
    ├── favicon.png
    └── favicon.ico
```

## 주요 기능

- M3U URL 등록 및 채널 목록 표시
- EPG(전자 프로그램 가이드) 연동 - 현재 방영 프로그램, 시간, 진행률 표시
- 채널 검색
- video.js 기반 HLS 스트리밍 재생
- 모바일 가로 모드 자동 풀스크린
- 플레이어 내 채널 전환 (페이지 새로고침 없음)

## 기술 스택

- Vue.js 2.7 + Vuetify 2.7
- video.js 8.5 + HLS
- dayjs
- m3u-parser-generator (M3U 파싱)

## 설정

1. 우측 상단 톱니바퀴(⚙) 클릭
2. M3U URL 입력 후 "불러오기"
3. (선택) EPG URL 추가 후 "불러오기"
4. EPG 시간 보정이 필요하면 시간 오프셋 설정

설정은 localStorage에 저장되어 브라우저에서 유지됩니다.
