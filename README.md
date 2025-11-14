# LiteRT.js 실시간 전사 애플리케이션

LiteRT.js를 활용한 실시간 음성 인식 및 전사 애플리케이션입니다.

## 기능

- 실시간 음성 인식 및 텍스트 변환
- 전사 결과 실시간 표시
- 전사 기록 저장 및 관리
- 마이크 레벨 실시간 표시
- AI 기반 번역 및 요약 기능 (WebLLM)
- 다국어 지원 (브라우저 지원 언어에 따라)

## 사용 방법

1. 프로젝트 설치:
```bash
npm install
```

2. 개발 서버 실행:
```bash
npm run dev
```

또는 직접 `index.html` 파일을 브라우저에서 열기

## 요구사항

- 최신 브라우저 (Chrome, Edge, Safari 등)
- 마이크 권한 허용 필요
- HTTPS 환경 권장 (일부 브라우저에서 마이크 접근 제한)

## 기술 스택

- LiteRT.js - 경량 실시간 웹 프레임워크
- Web Speech API - 브라우저 내장 음성 인식
- Web Audio API - 마이크 레벨 모니터링
- WebLLM - 브라우저 내 AI 모델 실행
- Vanilla JavaScript

## GitHub Pages 배포

### 자동 배포 (GitHub Actions)

이 프로젝트는 GitHub Actions를 사용하여 자동으로 배포됩니다.

1. GitHub에 저장소 생성
2. 코드를 main 브랜치에 푸시:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

3. GitHub 저장소 설정에서 Pages 활성화:
   - Settings → Pages
   - Source: "GitHub Actions" 선택

4. main 브랜치에 푸시하면 자동으로 배포됩니다
5. 배포된 사이트는 `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME` 에서 확인할 수 있습니다

### 수동 배포

`gh-pages` 패키지를 사용하여 수동으로 배포할 수도 있습니다:

```bash
npm install --save-dev gh-pages
npm run deploy
```

## 라이브 데모

배포된 사이트: [https://YOUR_USERNAME.github.io/YOUR_REPO_NAME](https://YOUR_USERNAME.github.io/YOUR_REPO_NAME)

