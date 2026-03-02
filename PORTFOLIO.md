
### Layer Responsibilities

- `main/`  
  창 생성, IPC 처리, 파일 시스템 접근, 내보내기
- `renderer/`  
  UI 상태 관리, 편집기, 보드 뷰, 모달
- `store/`  
  JSON 정규화, 저장/로드, 검색, 히스토리 관리

---

## Technical Choices

- **Electron**  
  로컬 파일 시스템 중심의 데스크톱 워크플로에 적합
- **JSON 기반 저장**  
  사람이 읽을 수 있고 백업 및 마이그레이션이 쉬움
- **HTML 기반 내보내기**  
  하나의 출력 경로로 Word(.doc) / PDF 생성

---

## Trade-offs

- 리치 텍스트 대신 단순 텍스트 편집기 선택  
  → 안정성과 저장 구조 우선
- 파일 기반 저장의 복잡성  
  → 정규화 및 손상 백업 로직으로 대응

---

## What I Learned

- Electron 앱에서 프로세스 경계 설계의 중요성
- 로컬 파일을 상태로 다룰 때 발생하는 복잡성
- 계층 구조 + 검색 + 히스토리가 결합될 때의 상태 관리
- 정규화 없이는 로컬 앱이 쉽게 무너진다는 점

---

## Future Improvements

- local-first 모델을 유지한 편집기 기능 확장
- 바인더 이동 및 히스토리 복원 테스트 강화
- 캐릭터 관리 UI 보강
- 첫 실행 가이드 및 스크린샷 추가

---

## Portfolio Framing

Inkfold는 다음을 보여주는 프로젝트입니다.

- 로컬-퍼스트 데스크톱 애플리케이션 설계
- Electron 아키텍처 및 IPC 경계 설계
- 파일 기반 상태 관리와 복구 설계
- 실제 글쓰기 워크플로를 기반으로 한 제품 개발

---

## 🇺🇸 English

## Project Overview

**Inkfold** is a local-first desktop writing tool built with Electron,  
designed to manage long-form writing projects as real, inspectable folders.

It supports:

- Chapter-based drafting
- Binder (folder) organization
- Project notes
- Search
- Recoverable document history
- Export to Word and PDF

All data is stored locally inside the selected project directory.

---

## Motivation

Many writing tools prioritize convenience while hiding storage formats  
or treating portability as a secondary concern.

Inkfold was built around a simple idea:

> A writing project should remain understandable, movable, and recoverable  
> even without the app.

Rather than a closed document container, Inkfold behaves like a  
**controllable project folder with writing-focused features on top**.

---

## My Role

- End-to-end personal project
- Application architecture and UI structure
- Electron renderer/main process separation
- IPC boundary design via `preload.js`
- Local persistence and recovery logic
- Search, history, and export implementation

---

## Key Design Decisions

### Local-first Persistence

Project data is stored under `._scriv/` inside the chosen folder.

- No server or account required
- Easy backup and migration
- Human-inspectable project structure

---

### Binder Structure Separated from Documents

- Documents stored as individual JSON files
- Binder hierarchy stored in `index.json`
- Traversal order derived from binder nodes

This separation keeps reordering, drag-and-drop, and recovery manageable.

---

### Safe Renderer ↔ Main Communication

- `contextIsolation: true`
- No direct Node API access from the renderer
- Explicit APIs exposed via `window.api`

---

### Recoverable History

- Time-based snapshots
- Duplicate suppression
- Restore previous versions when needed

---

## Architecture


---

## Trade-offs

- Plain text editor over rich text for stability
- File-based storage complexity handled through normalization and backups

---

## What I Learned

- Structuring Electron apps with clear process boundaries
- Designing inspectable and recoverable local persistence
- Managing complexity from hierarchy, search, and history
- The importance of normalization in file-based state

---

## Future Improvements

- Richer editing features without breaking local-first design
- Stronger tests for binder operations
- Improved onboarding and documentation

---

## Portfolio Framing

Inkfold demonstrates:

- Local-first desktop application design
- Electron architecture and IPC boundaries
- State management and persistence design
- Product thinking grounded in real writing workflows
