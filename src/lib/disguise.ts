/** 레퍼런스 모드에서 공고 제목을 화면 이름처럼 바꾼다 */

export function hashOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SUFFIXES = [
  "Dashboard",
  "Web App",
  "Admin Console",
  "Design System",
  "Mobile App",
  "Landing Page",
  "Onboarding Flow",
  "Settings",
  "Analytics View",
  "Workspace",
];

const DROP = [
  /\[[^\]]*\]/g,
  /【[^】]*】/g,
  /<[^>]*>/g,
  /\((?:[^()]*?(?:채용|모집|경력|신입|정규직|계약직|인턴|년|급|명|무관|이상|이하|재택|주\s*\d)[^()]*?)\)/g,
  /\(주\)|㈜|주식회사/g,
  /\d+\s*[~\-]\s*\d+\s*년(?:\s*차)?/g,
  /\d+\s*년\s*(?:이상|이하|차)?/g,
  /(?:채용연계형|전환형|체험형)/g,
  /(?:경력직|경력사원|신입사원|신입|경력|정규직|계약직|인턴|파견직|프리랜서)/g,
  /(?:채용합니다|채용공고|채용|모집합니다|모집|영입|구인|공고|모십니다|찾습니다|합류)/g,
  /(?:담당자|담당|팀원|사원|대리급|과장급|차장급|부장급|팀장급|리드급|[가-힣]{1,2}급)/g,
  /(?:개발자|엔지니어|디자이너|기획자|매니저)/g,
  /\b(?:engineer|developer|designer|recruiting|hiring)\b/gi,
  /^\s*\d+\.\s*/g,
];

/** 회사명, 위치 같은 메타 외에 공고처럼 보이는 단어를 걷어낸 제목 + 화면 종류 */
export function disguiseTitle(title: string, seed: string) {
  let s = title;
  for (const re of DROP) s = s.replace(re, " ");
  s = s
    .replace(/[|/,·ㆍ_()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+-(?=\S)/g, " ")
    .replace(/[\-~&+:]+\s*$/g, "")
    .replace(/^\s*[\-~&+:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const suffix = SUFFIXES[hashOf(seed) % SUFFIXES.length];
  return s ? `${s} ${suffix}` : suffix;
}
