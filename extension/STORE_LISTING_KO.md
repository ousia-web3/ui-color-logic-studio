# Chrome 웹 스토어 등록 문안

## 이름

UI 컬러 로직 스튜디오

## 짧은 설명

웹 이미지와 현재 화면을 분석해 UI 팔레트, 안전한 텍스트 대비와 디자인 토큰을 만듭니다.

## 상세 설명

UI 컬러 로직 스튜디오는 디자이너가 웹 이미지와 화면 캡처에서 반복적으로 색을 고르고 대비를 확인하는 작업을 줄여주는 로컬 우선 도구입니다.

- 웹 이미지 우클릭 분석
- 현재 탭 화면 캡처 분석
- 상품·콘텐츠·배너별 독립 팔레트
- WCAG 대비 검사와 예외 중심 빠른 검수
- CSS, Tailwind, Figma Tokens 내보내기
- 프로젝트별 브라우저 자동 저장과 JSON 백업
- 별도 AI API 및 외부 이미지 전송 없음

이미지와 프로젝트 데이터는 사용자의 Chrome 프로필 안에 저장됩니다. 확장프로그램 삭제 또는 사이트 데이터 삭제 시 제거될 수 있으므로 중요한 프로젝트는 JSON으로 백업할 수 있습니다.

## 카테고리

개발자 도구 또는 생산성

## 개인정보 처리방침 URL

https://ui-color-logic-studio.study2100-ai.chatgpt.site/extension-privacy.html

## 지원 URL

https://ui-color-logic-studio.study2100-ai.chatgpt.site/manual.html

## 권한 설명

- `activeTab`: 사용자가 요청했을 때 현재 화면을 캡처합니다.
- `contextMenus`: 이미지와 페이지 우클릭 분석 메뉴를 제공합니다.
- `storage`, `unlimitedStorage`: 캡처 전달과 로컬 프로젝트 저장에 사용합니다.
- 선택 사이트 접근: 사용자가 우클릭한 웹 이미지를 불러올 때 해당 사이트에 대해서만 요청합니다.
