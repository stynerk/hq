# 에이전트 정의

에이전트 하나를 Markdown 파일 하나로 정의한다. 프론트매터는 설정이고, 본문은 그 에이전트가 따르는 지시다. 이 폴더가 정본이며, 런타임별 파일은 여기서 만들어 쓴다.

## 계층

| 종류 | 에이전트 | 런타임 | 사람과 대화 | 누구에게 보고 |
|---|---|---|---|---|
| 대표 | [hq-lead](hq-lead.md) 총괄 (Tony) | Claude | HJ (#hq) | HJ |
| 대표 | [service-pm](service-pm.md) 서비스PM (Tony) | Claude | HJ (#프로젝트) | HJ |
| 대표 | [dev-pm](dev-pm.md) 개발PM (Cap) | Codex | 서비스PM, HJ가 직접 물을 때 | 서비스PM |
| 서브 | [researcher](subagents/researcher.md) | Claude | 없음 | 서비스PM |
| 서브 | [reviewer](subagents/reviewer.md) | Claude (다른 모델 권장) | 없음 | 서비스PM |
| 서브 | [implementer](subagents/implementer.md) | Codex | 없음 | 개발PM |
| 서브 | [qa](subagents/qa.md) | Codex | 없음 | 개발PM |
| 서브 | [release](subagents/release.md) | Codex | 없음 | 개발PM |

규칙:

- 대표만 서브에이전트를 부른다. 서브에이전트는 다른 서브에이전트를 부르지 않는다.
- 서브에이전트는 받은 일만 하고 결과를 짧게 돌려준다. 결정은 대표가 한다.
- 개발PM의 서브에이전트는 GitHub Issue 하나를 단위로 일한다. 같은 Issue를 두 서브에이전트가 동시에 잡지 않는다.
- 이름은 모든 프로젝트에 공통이다. Claude 쪽 대표는 **CPO Tony**로, #hq에서는 총괄, 프로젝트 채널에서는 서비스PM으로 일한다. Codex 쪽 대표는 **CTO Cap**으로, 모든 프로젝트의 개발PM이다(2026-11-17 HJ 결정). 역할 파일은 Tony와 Cap이 채널에 따라 쓰는 모드다.
- 프로젝트별 차이(페르소나 보정, 관문)는 [projects/](../projects/)에서 정한다. 역할의 내용은 여기서만 정한다.

## 파일 형식

```markdown
---
name: service-pm            # 고유 이름, 영문 kebab-case
title: 서비스PM              # 사람이 부르는 이름
kind: lead                  # lead | subagent
runtime: claude             # claude | codex
reports_to: HJ              # 보고 대상 (에이전트 name 또는 HJ)
delegates_to: [researcher, reviewer]   # lead만. 부를 수 있는 서브에이전트
description: 한 문장. 언제 이 에이전트를 쓰는지
tools: Read, Grep, Glob     # 선택. claude 서브에이전트의 허용 도구
sandbox: read-only          # 선택. codex 서브에이전트의 샌드박스 (read-only | workspace-write)
---

본문: 이 에이전트의 역할, 하는 일, 하지 않는 일, 일하는 기준, 완료의 정의.
```

## 런타임 매핑

정의는 여기 한 곳에 두고, 각 프로젝트 저장소에는 런타임이 읽는 형식으로 내보낸다. 내보내기 스크립트는 3단계(봇 구축)에서 만든다. 그 전까지 대표 에이전트는 이 폴더의 파일을 직접 읽는다.

| 런타임 | 내보내는 위치 | 형식 |
|---|---|---|
| Claude Code | `<프로젝트>/.claude/agents/<name>.md` | 같은 Markdown. Claude Code는 `name`, `description`, `tools`, `model`을 읽고 나머지 키는 쓰지 않는다 |
| Codex | `<프로젝트>/.codex/agents/<name>.toml` | `name`, `description`, `developer_instructions`(= 본문), 샌드박스 설정 |

대표 에이전트(총괄, 서비스PM, 개발PM)는 서브에이전트로 내보내지 않는다. 디스코드 릴레이가 세션을 열 때 해당 파일의 본문과 프로젝트 설정을 지시로 넣는다.

## 바꾸는 법

- 역할 내용을 바꾸면 여기만 고친다. 프로젝트 저장소의 사본은 내보내기로 다시 만든다.
- 새 서브에이전트를 추가하면 위 표와 대표의 `delegates_to`를 함께 고친다.
- 바꾼 이유는 커밋 메시지에 한 줄로 남긴다. HJ의 지시로 바꿨으면 [DECISIONS.md](../DECISIONS.md)에도 적는다.
