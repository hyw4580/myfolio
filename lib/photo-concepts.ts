/**
 * 사진 촬영 컨셉 — 기본 10개 + 운영자가 추가한 것(photo_concepts 테이블) + 사용자 직접 입력("c:라벨")
 * 사진 하나에 최대 2개.
 */
export type Concept = { id: string; label: string; hint: string };

export const BUILTIN_CONCEPTS: Concept[] = [
  { id: "profile",  label: "프로필·디지털", hint: "노메이크업/내추럴, 단색 배경, 정면·측면 기본 컷, 폴라로이드 같은 에이전시 제출용" },
  { id: "fashion",  label: "패션",         hint: "옷이 주인공. 룩북, 잡지 화보, 에디토리얼, 스트리트 패션" },
  { id: "beauty",   label: "뷰티",         hint: "얼굴·피부·메이크업·헤어가 주인공인 클로즈업" },
  { id: "commercial", label: "커머셜·광고", hint: "제품·브랜드가 함께 보이거나 광고처럼 밝고 친근한 연출" },
  { id: "sports",   label: "스포츠·피트니스", hint: "운동복, 운동 동작, 몸매·근육이 드러나는 액티브 컷" },
  { id: "swim",     label: "스윔웨어",      hint: "수영복, 해변·수영장" },
  { id: "wedding",  label: "웨딩·한복",     hint: "웨딩드레스, 턱시도, 한복 등 예복·전통 의상" },
  { id: "runway",   label: "런웨이·쇼",     hint: "패션쇼 무대, 캣워크, 백스테이지" },
  { id: "art",      label: "컨셉·아트",     hint: "강한 연출, 특수 조명·분장, 실험적·예술적 촬영" },
  { id: "snap",     label: "일상·스냅",     hint: "자연스러운 일상 사진, 여행, 셀피에 가까운 컷" },
];

export const MAX_CONCEPTS_PER_PHOTO = 2;
export const CUSTOM_PREFIX = "c:";

/** 직접 입력 컨셉 정리 (공백·기호 제거, 20자) */
export function customConcept(label: string): string | null {
  const t = label.replace(/[^\p{L}\p{N}\s·&-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
  return t.length >= 1 ? `${CUSTOM_PREFIX}${t}` : null;
}

export function conceptLabel(id: string, catalog: Concept[] = BUILTIN_CONCEPTS): string {
  if (id.startsWith(CUSTOM_PREFIX)) return id.slice(CUSTOM_PREFIX.length);
  return catalog.find(c => c.id === id)?.label ?? id;
}

/** 저장 가능한 값인지 (목록에 있거나 직접 입력 형식) */
export function validConcept(id: string, catalog: Concept[]): boolean {
  return catalog.some(c => c.id === id) || (id.startsWith(CUSTOM_PREFIX) && customConcept(id.slice(CUSTOM_PREFIX.length)) === id);
}
