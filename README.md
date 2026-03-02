# Inkfold

Local-first writing studio built with Electron.  
Electron 기반의 로컬 중심 글쓰기 스튜디오입니다.

Inkfold is a desktop writing app that treats a local folder as the project itself. It lets you write chapters, organize a binder, manage project notes, search across your work, restore history, and export the whole project from one place.  
Inkfold는 로컬 폴더 자체를 하나의 프로젝트로 다루는 데스크톱 글쓰기 앱입니다. 챕터 작성, 바인더 정리, 프로젝트 노트 관리, 전체 검색, 히스토리 복원, 프로젝트 내보내기를 한곳에서 처리할 수 있습니다.

For a developer-focused portfolio write-up, see [PORTFOLIO.md](./PORTFOLIO.md).  
개발자 관점의 포트폴리오 설명은 [PORTFOLIO.md](./PORTFOLIO.md)에서 볼 수 있습니다.

## Overview | 개요

- Local-folder-based project workflow  
  로컬 폴더 기반 프로젝트 작업 방식
- Binder for chapters, folders, and project notes  
  챕터, 폴더, 프로젝트 노트를 위한 바인더 구조
- Split editor for draft and notes  
  본문과 메모를 분리한 에디터
- Writing helpers like counts, pinning, and focus mode  
  글자 수, 핀, 포커스 모드 같은 집필 보조 기능
- Search within the current chapter and across the whole project  
  현재 챕터 검색과 프로젝트 전체 검색
- Board view for chapter status and progress  
  챕터 상태와 흐름을 확인하는 보드 뷰
- Document history snapshots and restore  
  문서 히스토리 저장 및 복원
- Export to Word-compatible `.doc` and PDF  
  Word 호환 `.doc` 및 PDF 내보내기

## Why Inkfold | 왜 Inkfold인가

Inkfold is closer to managing your own project folder than locking your writing into a proprietary document container.  
Inkfold는 문서를 앱 내부 포맷에 가두기보다, 사용자가 직접 프로젝트 폴더를 관리하는 방식에 더 가깝습니다.

- Your project stays in a local folder, so backup and migration are simple.  
  프로젝트가 로컬 폴더에 남기 때문에 백업과 이동이 단순합니다.
- The data structure is straightforward enough for personal use and inspection.  
  데이터 구조가 비교적 단순해 개인 작업용으로 다루기 쉽습니다.
- Drafting, notes, organization, search, and export live in one desktop app.  
  집필, 메모, 정리, 검색, 내보내기 기능이 하나의 데스크톱 앱 안에 모여 있습니다.

## Features | 주요 기능

### Project Management | 프로젝트 관리

- Create a new project  
  새 프로젝트 생성
- Open an existing project folder  
  기존 프로젝트 폴더 열기
- Restore the last opened project automatically  
  마지막으로 열었던 프로젝트 자동 복원

### Binder | 바인더

- Create chapters  
  챕터 생성
- Create, rename, and delete folders  
  폴더 생성, 이름 변경, 삭제
- Create, rename, and delete project notes  
  프로젝트 노트 생성, 이름 변경, 삭제
- Reorder items with drag and drop  
  드래그 앤 드롭으로 항목 재정렬
- Filter pinned items only  
  핀된 항목만 필터링

### Writing | 집필

- Split editing with `Draft` and `Notes`  
  `Draft`와 `Notes`를 나눈 편집
- Chapter metadata management  
  챕터 메타데이터 관리
- Title  
  제목
- Synopsis  
  시놉시스
- Status: `draft`, `revise`, `done`  
  상태: `draft`, `revise`, `done`
- POV  
  POV
- Auto-save and manual save  
  자동 저장과 수동 저장
- Font size controls  
  글꼴 크기 조절
- Focus mode  
  포커스 모드

### Search | 검색

- Find inside the current chapter  
  현재 챕터 내부 검색
- Global search across the project  
  프로젝트 전체 검색
- Draft text  
  본문
- Notes  
  메모
- Title  
  제목
- Synopsis  
  시놉시스
- POV  
  POV
- Project notes  
  프로젝트 노트

### Board View | 보드 뷰

- Card-style chapter overview  
  카드 형태 챕터 보기
- Filter by status  
  상태별 필터
- Search filter  
  검색 필터
- Filter chapters missing a synopsis  
  시놉시스가 없는 챕터만 필터링

### History | 히스토리

- Save document snapshots over time  
  문서 스냅샷 기록
- Restore previous versions  
  이전 버전 복원
- Keep up to 30 history entries  
  최대 30개 히스토리 보관

### Export | 내보내기

- Export as Word-compatible `.doc`  
  Word 호환 `.doc`로 내보내기
- Export as PDF  
  PDF로 내보내기
- Include project notes in the export  
  프로젝트 노트 포함 출력

## Project Structure | 프로젝트 구조

```text
.
├─ main/
├─ renderer/
├─ store/
├─ assets/
├─ index.html
├─ styles.css
├─ main.js
├─ preload.js
└─ package.json
```

### Directory Roles | 디렉터리 역할

- `main/`
  - Electron main-process logic
  - Window creation, IPC registration, export handling
  - Electron 메인 프로세스 로직
  - 윈도우 생성, IPC 등록, 내보내기 처리
- `renderer/`
  - UI, state management, and event handling
  - Editor, binder, search, board, and history view logic
  - UI, 상태 관리, 이벤트 처리
  - 에디터, 바인더, 검색, 보드, 히스토리 화면 로직
- `store/`
  - Project data persistence layer
  - Documents, project metadata, search, history, and character data
  - 프로젝트 데이터 저장 계층
  - 문서, 프로젝트 메타, 검색, 히스토리, 캐릭터 데이터 처리
- `assets/`
  - Static resources such as the app icon
  - 앱 아이콘 같은 정적 리소스

## Local Storage Format | 로컬 저장 구조

Inkfold creates a `._scriv` directory inside the project folder to store internal data.  
Inkfold는 프로젝트 폴더 안에 `._scriv` 디렉터리를 생성해 내부 데이터를 저장합니다.

```text
my-project/
└─ ._scriv/
   ├─ index.json
   ├─ project.json
   ├─ characters.json
   ├─ history/
   │  └─ <docId>/
   │     └─ <timestamp>.json
   └─ <docId>.json
```

### Stored Files | 저장 파일

- `index.json`
  - Binder structure, document order, and node mapping
  - 바인더 구조, 문서 순서, 노드 매핑
- `project.json`
  - Project note metadata
  - 프로젝트 노트 메타데이터
- `characters.json`
  - Character data
  - 캐릭터 데이터
- `<docId>.json`
  - Individual chapter data
  - 개별 챕터 데이터
- `history/<docId>/<timestamp>.json`
  - Document history snapshots
  - 문서 히스토리 스냅샷

## Tech Stack | 기술 스택

- Electron
- Vanilla JavaScript
- HTML / CSS
- electron-builder

## Getting Started | 시작하기

```bash
npm install
npm start
```

## Build | 빌드

```bash
npm run pack
npm run dist
```

- `npm run pack`
  - Create a runnable packaged build without an installer
  - 설치 파일 없이 실행 가능한 패키지 생성
- `npm run dist`
  - Create a distributable installer build
  - 배포용 설치 파일 생성

## Notes | 참고

- All project data is stored in a local folder.  
  모든 프로젝트 데이터는 로컬 폴더에 저장됩니다.
- Document auto-save runs after a short delay.  
  문서 자동 저장은 짧은 지연 후 실행됩니다.
- History snapshots are rate-limited to avoid excessive duplicate saves.  
  히스토리 스냅샷은 중복 저장이 과도하게 쌓이지 않도록 간격 제한이 있습니다.
