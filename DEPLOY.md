# GitHub Pages 배포 가이드

## 자동 배포 (권장)

이 프로젝트는 GitHub Actions를 사용하여 자동 배포가 설정되어 있습니다.

### 배포 단계

1. **GitHub 저장소 생성**
   - GitHub에서 새 저장소를 생성합니다
   - 저장소 이름은 원하는 대로 설정할 수 있습니다 (예: `liteRT-transcription`)

2. **로컬 저장소 초기화 및 푸시**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. **GitHub Pages 설정**
   - 저장소의 **Settings** 탭으로 이동
   - 왼쪽 메뉴에서 **Pages** 선택
   - **Source** 섹션에서 **GitHub Actions** 선택
   - 저장

4. **자동 배포 확인**
   - main 브랜치에 코드를 푸시하면 자동으로 배포가 시작됩니다
   - **Actions** 탭에서 배포 진행 상황을 확인할 수 있습니다
   - 배포가 완료되면 `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME` 에서 사이트에 접근할 수 있습니다

### 배포 URL 형식

- 저장소 이름이 `liteRT-transcription`인 경우:
  - URL: `https://YOUR_USERNAME.github.io/liteRT-transcription`

- 저장소 이름이 `YOUR_USERNAME.github.io`인 경우:
  - URL: `https://YOUR_USERNAME.github.io`

## 수동 배포 (선택사항)

`gh-pages` 패키지를 사용하여 수동으로 배포할 수도 있습니다:

```bash
# gh-pages 설치
npm install --save-dev gh-pages

# 배포 실행
npm run deploy
```

## 주의사항

1. **HTTPS 필수**: 마이크 접근을 위해 HTTPS 환경이 필요합니다. GitHub Pages는 자동으로 HTTPS를 제공합니다.

2. **첫 배포 시간**: 첫 배포는 몇 분 정도 걸릴 수 있습니다.

3. **브라우저 호환성**: 최신 브라우저(Chrome, Edge, Safari)에서만 정상 작동합니다.

4. **마이크 권한**: 사용자가 마이크 권한을 허용해야 합니다.

## 문제 해결

### 배포가 실패하는 경우

1. GitHub Actions 탭에서 오류 로그 확인
2. 저장소 Settings → Pages에서 Source가 "GitHub Actions"로 설정되어 있는지 확인
3. `.github/workflows/deploy.yml` 파일이 올바르게 생성되었는지 확인

### 사이트가 표시되지 않는 경우

1. 배포가 완료되었는지 확인 (Actions 탭)
2. 브라우저 캐시 삭제 후 다시 시도
3. URL이 정확한지 확인

