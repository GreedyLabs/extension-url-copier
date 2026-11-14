# URL Copier

현재 Chrome 탭의 주소를 단축키 한 번으로 클립보드에 복사하는 확장 프로그램입니다. URL의 쿼리나 해시를 바꾸지 않고 `tab.url`을 그대로 복사합니다.

## 설치 및 단축키

1. Chrome에서 `chrome://extensions`를 엽니다.
2. **개발자 모드**를 켜고 **압축해제된 확장 프로그램을 로드합니다**를 눌러 이 폴더를 선택합니다.
3. 기본 단축키 **Alt+Shift+C**를 누르면 현재 탭 주소가 복사됩니다. macOS에서는 **⌥⇧C**입니다.
4. 단축키를 변경하려면 확장 프로그램의 툴바 아이콘을 클릭합니다. Chrome의 `chrome://extensions/shortcuts` 페이지가 열립니다. 이 페이지에서 URL Copier의 **현재 탭 주소 복사** 단축키를 지정할 수 있습니다.

Chrome이 기본 단축키를 할당하지 않았거나 다른 확장 프로그램과 충돌하면 4단계에서 원하는 키를 직접 지정하세요. macOS의 ⌘⇧C와 Windows·Linux의 Ctrl+Shift+C는 Chrome 개발자도구의 요소 검사 단축키와 겹쳐 기본값으로 제안하지 않습니다.

## 동작 및 권한

단축키는 현재 탭의 URL을 일반 텍스트로 복사합니다. 확장 프로그램 자체 설정, 포맷 변환, 추적 파라미터 제거, 다중 탭 복사 기능은 없습니다. 툴바 아이콘은 Chrome 단축키 설정을 여는 용도입니다.

복사하면 웹페이지 우하단에 작은 확인 알림이 약 1.8초간 표시됩니다. 복사에 실패하면 실패 메시지를 표시합니다. 크롬 내부 페이지나 웹스토어처럼 알림을 표시할 수 없는 페이지에서는 툴바 아이콘의 배지와 툴팁으로 결과를 확인할 수 있습니다.

- `activeTab`: 단축키를 누른 현재 탭의 주소를 읽습니다.
- `clipboardWrite`: 주소를 클립보드에 씁니다.
- `offscreen`: Chrome 116 이상에서 호환되는 클립보드 쓰기를 위해 숨김 문서를 만듭니다. 복사가 끝나면 문서를 닫습니다.
- `scripting`: 단축키를 누른 페이지에 복사 결과 알림을 표시합니다.

Chrome이 특정 탭의 주소 접근을 제한하면 해당 주소는 복사할 수 없습니다.

## 개발

```bash
npm test       # node:test, 외부 패키지 의존성 없음
npm run icons # 아이콘 재생성
npm run build:zip # 제출용 url-copier.zip 생성 (npm run zip도 동일)
```

Chrome 116 이상이 필요합니다. 영어와 한국어 인터페이스를 제공합니다.

## Chrome 웹스토어 제출

`npm test && npm run build:zip`을 실행해 만든 `url-copier.zip`을 개발자 대시보드에 업로드합니다. ZIP 루트에 `manifest.json`이 있으며, 확장 실행 파일·아이콘·번역·LICENSE만 포함합니다.

최초 제출은 대시보드에서 새 항목을 만들고 이 ZIP을 업로드해 확장 프로그램 ID를 발급받습니다. 스토어 설명, 스크린샷, 개인정보 처리 및 권한 사용 목적은 대시보드에서 작성해야 합니다. 이후 업데이트에서는 `manifest.json`과 `package.json`의 버전을 함께 올립니다.

현재 스토어 항목 ID는 `djnljfclhmkmdpmdgjaocpoeinljckka`입니다. 영문·한국어 [개인정보처리방침](https://raw.githubusercontent.com/GreedyLabs/extension-url-copier/refs/heads/main/PRIVACY_POLICY.md)을 제공하며, 제출용 소개 이미지는 `store/feature-overview-1280x800.png`에 있습니다. 소개 이미지는 기능을 설명하는 그래픽이며 알림 예시는 미리보기로 표시합니다.

## CI 및 배포

스팀 확장 프로그램과 같은 `check → deploy` 구조로 [공통 배포 워크플로우](https://github.com/GreedyLabs/action-deploy-browser-extension)를 호출합니다. 이 저장소는 Node.js 22에서 테스트한 뒤 빌드 명령과 Chrome 스토어 설정을 전달합니다. ZIP 생성·아티팩트 보관·업로드 기록 복원·재시도는 공통 워크플로우가 담당합니다.

| 실행 조건 | 동작 |
| --- | --- |
| Pull request | 테스트만 실행 |
| `main` push | 테스트 후 ZIP을 만들어 웹스토어에 업로드 (`upload`) |
| `v*` 태그 push | 테스트 후 같은 커밋의 업로드 ZIP으로 심사 제출 (`publish`) |
| 수동 실행 | `status`·`upload`·`publish`·`deploy` 선택. 기본값 `status`는 스토어를 변경하지 않음 |

공통 워크플로우가 원본 ZIP과 처리 기록을 30일간 보관합니다. 업로드 실행의 Artifacts에서 `extension-package`를 내려받아 압축을 풀면 제출용 `url-copier.zip`이 나옵니다.

최초 등록 후 저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 설정합니다. 스토어 ID와 인증 키가 모두 있어야 배포가 실행됩니다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `CHROME_PUBLISHER_ID` | `3bac066d-35ba-4b41-a7a6-6e91336c16b3` |
| Variable | `CHROME_EXTENSION_ID` | `djnljfclhmkmdpmdgjaocpoeinljckka` |
| Secret | `CHROME_SERVICE_ACCOUNT_KEY` | 게시자 계정에 권한을 부여한 서비스 계정의 JSON 파일 내용 전체(원문) |

서비스 계정 권한과 Chrome Web Store API 활성화는 [공식 API 설정 안내](https://developer.chrome.com/docs/webstore/api/get-started)를 따릅니다.

일반 업데이트는 버전을 올려 `main`에 푸시한 뒤, 업로드가 성공한 같은 커밋에 `v0.1.1` 같은 태그를 붙여 제출합니다. `publish`는 원본 업로드 실행을 자동으로 찾습니다. 수동으로 특정 업로드를 지정하려면 `source-run-id`에 원본 업로드 실행 ID를 입력합니다. `deploy`는 업로드와 심사 제출을 한 번에 수행합니다. 심사 제출 완료와 스토어 공개는 별도 단계입니다.

## 라이선스

MIT © 2026 GreedyLabs — [LICENSE](LICENSE)
