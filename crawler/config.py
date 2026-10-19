"""수집 키워드와 분류 규칙. 여기만 고치면 검색 범위가 바뀐다."""

# 각 사이트 검색창에 넣을 검색어
SEARCH_QUERIES = [
    # AI·기술 플랫폼 서비스 기획
    "AI 서비스 기획",
    "AI 기획",
    "플랫폼 기획",
    "B2B 서비스 기획",
    "SaaS 기획",
    # Technical PM
    "Technical PM",
    "TPM",
    "AI PM",
    "AI PO",
    # 프로덕트·UX 디자인
    "프로덕트 디자이너",
    "Product Designer",
    "UX 디자이너",
    "UI/UX 디자이너",
    "B2B 디자이너",
    # DevEx·개발자 플랫폼
    "개발자 경험",
    "개발자 플랫폼",
    "테크니컬 라이터",
    # 이전 공간 PM 경험을 살릴 수 있는 도메인
    "프롭테크",
    "디지털 트윈",
]

# ---------------------------------------------------------------------------
# 직무 단어 (제목 기준, 대소문자 무시)
# ---------------------------------------------------------------------------
PLANNER_ROLES = [
    "pm", "po", "product manager", "product owner", "프로덕트 매니저", "프로덕트 오너",
    "프로덕트매니저", "프로덕트오너", "기획", "planner", "product lead", "서비스 매니저",
    "제품 매니저", "제품매니저", "제품 관리",
]
TPM_ROLES = [
    "tpm", "technical pm", "technical product", "technical program", "테크니컬 pm",
    "테크니컬 프로덕트", "기술 pm", "기술pm", "기술 기획", "기술기획",
]
DESIGN_ROLES = [
    "product designer", "프로덕트 디자이너", "프로덕트디자이너", "프로덕트 디자인",
    "ux", "ui", "uxui", "uiux", "경험 디자이너", "서비스 디자이너", "서비스디자이너",
]
WRITER_ROLES = ["technical writer", "테크니컬 라이터", "테크니컬라이터", "기술 문서", "기술문서"]

# ---------------------------------------------------------------------------
# 도메인 단어
# ---------------------------------------------------------------------------
DEVEX_DOMAINS = [
    "devex", "developer experience", "개발자 경험", "개발자 플랫폼", "developer platform",
    "개발자 도구", "developer tool", "api", "sdk", "docs", "documentation", "개발 문서",
    "내부 플랫폼", "internal platform", "devops", "ci/cd",
]
TPM_DOMAINS = [
    "mlops", "ml ops", "llmops", "aiops", "gpu", "인프라", "infra", "클라우드", "cloud",
    "kubernetes", "쿠버네티스", "ml platform", "ml 플랫폼", "데이터 플랫폼", "data platform",
    "technical", "engineering", "엔지니어링",
]
TECH_DOMAINS = [
    "ai", "llm", "생성형", "genai", "gen ai", "인공지능", "머신러닝", "machine learning",
    "딥러닝", "에이전트", "agent", "rag", "챗봇", "chatbot", "플랫폼", "platform", "saas",
    "b2b", "솔루션", "solution", "데이터", "data", "자동화", "automation", "워크플로우",
    "workflow", "api", "it", "웹", "web", "프롭테크", "proptech", "디지털 트윈", "디지털트윈",
    "스마트시티", "스마트빌딩", "스마트 빌딩",
]
# 점수 가산: 지금 경력과 가까운 도메인일수록 위로
BONUS_DOMAINS = [
    "ai", "llm", "생성형", "에이전트", "agent", "mlops", "llmops", "aiops", "ops", "플랫폼",
    "platform", "b2b", "saas", "자동화", "프롭테크", "proptech", "디지털 트윈", "디지털트윈",
]

# 분류: (이름, [(직무 단어, 필요한 도메인 단어 또는 None)]). 위에서부터 먼저 걸리는 분류로 들어간다.
CATEGORIES = [
    ("DevEx·개발자 플랫폼", [
        (WRITER_ROLES, None),
        (PLANNER_ROLES + TPM_ROLES + DESIGN_ROLES, DEVEX_DOMAINS),
    ]),
    ("Technical PM", [
        (TPM_ROLES, None),
        (PLANNER_ROLES, TPM_DOMAINS),
    ]),
    ("프로덕트·UX 디자인", [
        (DESIGN_ROLES, None),
    ]),
    ("AI·플랫폼 서비스 기획", [
        (PLANNER_ROLES, TECH_DOMAINS),
    ]),
]

# 제목에 있으면 제외 (엔지니어 직군 등)
EXCLUDE_TERMS = [
    "engineer", "엔지니어", "developer", "개발자", "researcher", "연구원", "scientist",
    "사이언티스트", "마케터", "회계", "재무", "hr",
]
# EXCLUDE 단어가 있어도 이 단어가 함께 있으면 살린다 (예: "개발자 플랫폼 PM")
EXCLUDE_OVERRIDE = [
    "product manager", "product owner", "pm", "po", "기획", "프로덕트", "designer", "디자이너",
    "technical writer", "테크니컬 라이터",
]

# 무조건 제외 (직무 단어가 있어도 제외)
HARD_EXCLUDE_TERMS = [
    "영업기획", "영업 기획", "sales", "마케팅", "marketing", "경영기획", "재무기획", "인사기획",
    "교육기획", "전략기획", "사업기획", "상품기획", "콘텐츠 기획", "콘텐츠기획", "게임 기획", "게임기획",
    "강사", "교육생", "수강생", "국비", "인턴", "intern",
    "퍼블리셔", "퍼블리싱", "publisher", "쇼핑몰", "상세페이지",
    "영상", "편집", "게임 ui", "2d", "3d",
    "공장", "설비", "생산",  # 설비보전 TPM(Total Productive Maintenance)
]

# ---------------------------------------------------------------------------
# 연차 판정 (2026년 1월 입사 + 이전 공간 PM 경력 기준)
# ---------------------------------------------------------------------------
# 공고 최소 요구 연차가 이 값 이하이면 '적합'
CAREER_FIT_MAX = 3
# 이 값 이하이면 '도전', 넘으면 '상향'
CAREER_STRETCH_MAX = 5
# 제목에 있으면 '상향'
SENIOR_TERMS = [
    "시니어", "senior", "sr.", "lead", "리드", "head", "팀장", "파트장", "책임", "수석",
    "principal", "staff", "director", "디렉터",
]

# 이 일수 동안 다시 보이지 않은 공고는 목록에서 '마감 추정'으로 표시
STALE_DAYS = 14
