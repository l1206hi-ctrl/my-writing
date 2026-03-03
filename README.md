# Inkfold

Inkfold는 장편 글쓰기를 위해 만든 **로컬-퍼스트(local-first) 데스크톱 글쓰기 애플리케이션**입니다.  
Electron 기반으로 제작되었으며, 서버나 클라우드에 의존하지 않고 **프로젝트 폴더 단위로 글을 관리**하는 것을 목표로 합니다.

---

## ✨ Features

- 📁 **Project-based writing**
  - 글을 하나의 문서가 아닌 프로젝트 폴더 단위로 관리
  - 챕터, 노트, 메모를 바인더 구조로 정리

- 💾 **Local-first storage**
  - 모든 데이터는 로컬 파일(JSON / Markdown)로 저장
  - 외부 서버, 계정, 네트워크 연결 없이 사용 가능

- 🕓 **Version History**
  - 일정 간격으로 글 상태를 자동 스냅샷으로 저장
  - 중복 저장 방지 및 히스토리 개수 제한

- 🔍 **Full-text Search**
  - 프로젝트 전체(챕터, 노트, 메타 정보) 검색
  - 검색 결과 미리보기 제공

- 📤 **Export**
  - 작성한 글을 HTML / PDF 형식으로 내보내기
  - PDF는 Electron의 `printToPDF` 기능 사용

---

## 🖼 Screenshots

> 실제 사용 화면 예시

<img width="2328" height="1520" alt="lnkfold mian" src="https://github.com/user-attachments/assets/5b8bd938-c623-461f-b2f1-a10031cb5ecc" />

---

## 🏗 Architecture Overview

Inkfold는 Electron의 **Main / Renderer 프로세스 분리 구조**를 따릅니다.

- **Main Process**
  - 애플리케이션 창 생성 및 수명 관리
  - 파일 시스템 접근
  - IPC 핸들러 정의

- **Renderer Process**
  - 사용자 인터페이스(UI)
  - 글 편집, 바인더 조작, 검색 등 사용자 상호작용 처리

- **Preload**
  - `contextIsolation` 환경에서 필요한 API만 안전하게 노출
  - Renderer ↔ Main 간 IPC 통신 담당

---

## 📂 Data Structure

프로젝트는 일반 폴더 형태로 저장되며, 내부에 전용 관리 폴더를 가집니다.

---


- `index.json` : 바인더 구조 및 문서 순서 관리
- `history/` : 자동 저장된 버전 스냅샷
- JSON 기반으로 사람이 직접 열어볼 수 있는 구조

---

## 🛠 Tech Stack

- **Electron** – 데스크톱 애플리케이션 프레임워크
- **JavaScript (ES Modules)** – Renderer 로직
- **Node.js APIs** – 파일 시스템 처리
- **HTML / CSS** – UI 구성

> UI 라이브러리보다는  
> **로컬 저장 구조와 실제 글쓰기 워크플로 설계**에 중점을 둔 프로젝트입니다.

---

## 🎯 Motivation

기존 글쓰기 도구들은 편리하지만,  
파일 구조가 숨겨져 있거나 클라우드 의존도가 높은 경우가 많았습니다.

Inkfold는  
> “글을 하나의 프로젝트 폴더처럼,  
> 내가 완전히 통제할 수 있었으면 좋겠다”

라는 개인적인 문제의식에서 출발한 프로젝트입니다.

---

## 🚧 Status

- 개인 학습 및 실사용 목적의 프로젝트
- 기능 및 구조는 지속적으로 개선 중

---

## 📌 Notes

이 프로젝트는 AI 도구의 도움을 받아 구현 속도를 높였으며,  
기능 기획, 구조 이해, 통합, 테스트 및 수정은 직접 진행했습니다.  
학습과 실험을 목적으로 한 개인 프로젝트입니다.
