# Inkfold Portfolio Notes

## Project Summary

Inkfold is a desktop writing tool built with Electron for managing long-form writing in a local-first workflow.  
The project focuses on chapter-based drafting, binder organization, project notes, search, version history, and export without relying on a remote backend.

이 프로젝트는 로컬 폴더 기반으로 장편 글쓰기를 관리하는 Electron 데스크톱 앱입니다.  
핵심은 챕터 단위 집필, 바인더 구조 관리, 프로젝트 노트, 검색, 버전 히스토리, 내보내기를 서버 없이 로컬 환경에서 처리하는 데 있습니다.

## Motivation

I wanted a writing tool that behaves more like a controllable project folder than a closed document container. Many writing tools are convenient, but they often hide storage formats or make portability secondary.  
Inkfold was built to keep the project readable, portable, and local while still supporting the workflow features writers actually need.

문서를 앱 전용 포맷 안에 가두는 대신, 사용자가 직접 관리 가능한 프로젝트 폴더처럼 동작하는 글쓰기 툴을 만들고 싶었습니다.  
기존 툴들은 편리하지만 저장 구조가 닫혀 있거나 이동성과 백업이 부차적인 경우가 많아서, Inkfold는 로컬 저장과 실제 집필 흐름을 함께 만족시키는 방향으로 설계했습니다.

## My Role

- Personal project end to end
- UI structure and interaction design
- Electron app architecture
- IPC boundary design through `preload.js`
- Local persistence layer for documents, notes, history, and metadata
- Search, board view, and export implementation

## Core Problems Solved

### 1. Local-first project persistence

Instead of storing work in a remote service or opaque database, Inkfold stores project data inside the selected folder under `._scriv/`.  
This makes the project portable and keeps backup behavior simple.

로컬 우선 저장 구조를 위해 선택한 프로젝트 폴더 안에 `._scriv/` 디렉터리를 만들고, 그 아래에 문서/메타/히스토리를 저장하도록 설계했습니다.  
그 결과 프로젝트 이동, 백업, 복사가 단순해졌습니다.

### 2. Binder structure separate from document files

The app needs to support folders, notes, drag-and-drop reordering, and document traversal order.  
To solve this, I separated file storage from binder structure:

- document files are stored as individual JSON files
- binder hierarchy is stored in `index.json`
- document traversal order is normalized from binder nodes

문서 파일과 바인더 구조를 분리한 것이 핵심 설계 포인트였습니다.  
개별 문서는 각 JSON 파일에 저장하고, 폴더/노트/문서 노드의 계층 구조는 `index.json`에 저장해 정렬과 이동 로직을 독립적으로 처리했습니다.

### 3. Safe renderer-to-main communication

Electron apps can become messy if the renderer directly accesses Node APIs.  
Inkfold uses `preload.js` with `contextIsolation: true` and exposes only the project operations needed by the renderer through `window.api`.

Electron에서 렌더러가 Node API를 직접 건드리면 구조가 빠르게 흐트러질 수 있어서, `preload.js`를 통해 필요한 IPC API만 노출하는 방식으로 경계를 분리했습니다.  
이 구조는 기능이 늘어나도 책임 분리가 유지되도록 돕습니다.

### 4. Recoverable document history

Writing tools need a lightweight way to recover mistakes.  
Inkfold saves history snapshots over time and allows restoring older versions, while avoiding excessive duplicate snapshots through a time interval limit.

글쓰기 앱에서 복구 기능은 필수에 가깝다고 판단했습니다.  
그래서 저장 시점마다 스냅샷을 남기되, 너무 자주 중복 저장되지 않도록 간격 제한을 두고 히스토리 복원 기능을 구현했습니다.

## Architecture

```text
Renderer UI
  -> window.api
  -> IPC handlers in main/
  -> store/ persistence layer
  -> JSON files inside project/._scriv
```

### Layer Responsibilities

- `main/`
  - creates the window
  - registers IPC handlers
  - owns file-system-facing operations
  - handles export flows
- `renderer/`
  - manages view state and UI rendering
  - handles editing interactions, filters, board mode, and modals
- `store/`
  - normalizes data
  - reads and writes JSON files
  - maintains binder index, search, history, and character records

## Technical Decisions

### Electron for desktop workflow

I chose Electron because this app is fundamentally desktop-oriented:

- it opens and manages local folders
- it reads and writes files directly
- it benefits from a persistent desktop writing environment

웹 서비스보다 파일 시스템과의 직접 상호작용이 중요한 프로젝트였기 때문에 Electron이 적합했습니다.

### JSON-based persistence instead of a database

I used JSON files because:

- the project should remain inspectable by humans
- backup and migration should stay simple
- the data model is structured but not complex enough to justify a database

데이터베이스보다 JSON 파일을 쓴 이유는 사용자가 프로젝트 구조를 직접 이해할 수 있게 하고, 복사와 백업을 쉽게 유지하기 위해서였습니다.

### Normalization and corruption handling

The persistence layer normalizes documents, index data, project notes, and characters before saving or after loading.  
If JSON parsing fails, the code backs up the corrupt file before surfacing the error.

저장 계층에서는 문서, 인덱스, 프로젝트 메타, 캐릭터 데이터를 정규화합니다.  
또한 JSON이 손상된 경우에는 원본을 백업한 뒤 오류를 처리하도록 만들어 복구 가능성을 남겼습니다.

### Export through generated HTML

Export is implemented by generating HTML from project data and then:

- saving the HTML as a Word-compatible `.doc`
- rendering the same HTML to PDF through an offscreen `BrowserWindow`

하나의 HTML 출력 경로를 기준으로 `.doc`와 PDF를 모두 만들도록 구성해, 내보내기 로직을 이중으로 관리하지 않도록 했습니다.

## Challenges and Trade-offs

### Keeping binder state consistent

The most error-prone part is keeping binder nodes, document files, and traversal order consistent when users create, move, rename, convert, or delete items.  
To reduce inconsistency, the index is normalized and missing or duplicate nodes are repaired during load.

문서 파일, 바인더 노드, 정렬 순서를 동시에 유지하는 부분이 가장 까다로웠습니다.  
그래서 인덱스 로드 시 정규화를 통해 누락 노드나 중복 노드를 정리하는 방식을 넣었습니다.

### Simplicity over heavy rich-text editing

The editor currently uses plain text areas for draft and notes.  
This is a trade-off: it avoids the complexity of rich-text editing while keeping the writing workflow stable and fast.

현재 편집기는 리치 텍스트보다 단순한 텍스트 편집에 집중했습니다.  
표현력은 제한되지만, 로컬 저장 구조와 히스토리, 검색, 정렬 기능을 안정적으로 만드는 데 우선순위를 두었습니다.

### File-based storage trade-offs

Local file storage improves portability, but it also means the app must handle invalid files, partial edits, and index recovery carefully.  
This project includes normalization and backup steps to reduce that risk, but that complexity moves into application code.

파일 기반 저장은 이동성과 투명성을 주는 대신, 손상된 JSON이나 어긋난 인덱스를 앱이 직접 처리해야 한다는 부담이 있습니다.

## What I Learned

- how to structure an Electron app around a clear renderer/main boundary
- how to design a local persistence layer that is inspectable and recoverable
- how quickly state complexity grows once hierarchy, search, history, and multiple views interact
- how important normalization is when local files are treated as project state

이 프로젝트를 통해 Electron 앱에서 프로세스 경계를 나누는 방법, 로컬 저장 계층을 설계하는 방법, 그리고 상태 정규화가 왜 중요한지 많이 배웠습니다.

## Future Improvements

- richer editor features without breaking the local-first model
- stronger testing around binder moves and history restore
- more complete character workflow in the visible UI
- better onboarding and screenshots for first-time users

## Portfolio Angle

If I were presenting this project in an interview or portfolio review, I would frame it as:

- a local-first desktop app
- an Electron architecture project with clear process boundaries
- a state-management and persistence design exercise
- a product built around a real writing workflow rather than a tutorial feature set

면접이나 포트폴리오 리뷰에서는 이 프로젝트를 단순한 글쓰기 앱이 아니라, 로컬 우선 저장 구조, Electron 아키텍처 분리, 상태 관리와 지속성 설계가 들어간 데스크톱 제품으로 설명할 수 있습니다.
