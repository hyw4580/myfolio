# 앱(iOS·안드로이드) 출시 가이드

앱은 **Capacitor**로 만들었고, 앱이 배포된 사이트를 열어 보여주는 구조입니다.
웹을 고치면 앱에도 바로 반영되고, 스토어 재심사는 앱 자체(아이콘·권한·네이티브 기능)를 바꿀 때만 필요합니다.

## 이미 준비된 것
| 항목 | 위치 |
|---|---|
| iOS 프로젝트 | `ios/` (Xcode로 열기: `npx cap open ios`) |
| 안드로이드 프로젝트 | `android/` (Android Studio로 열기: `npx cap open android`) |
| 앱 설정 (앱 ID `com.myfolio.app`, 열 주소) | `capacitor.config.ts` |
| 오프라인 안내 화면 | `native-shell/index.html` |
| 앱 안 로그인 (시스템 브라우저 → 앱 복귀) | `lib/oauth.ts`, `app/components/AppBridge.tsx` |
| 앱으로 돌아오는 주소 `com.myfolio.app://` | iOS `Info.plist`, Android `AndroidManifest.xml` |
| 사진·카메라 권한 안내 문구 (iOS) | `ios/App/App/Info.plist` |
| 회원 탈퇴 (스토어 필수) | 마이페이지 맨 아래 |
| Apple 로그인 버튼 (iOS 필수) | `lib/features.ts`의 `appleLogin` (설정 후 true) |
| 앱 안에서 결제 버튼·요금제 링크 숨김 (스토어 규정) | `lib/native.ts`의 `useIsNativeApp` |

## 출시 전에 할 일
1. **Xcode 설치** (App Store, 무료) → `sudo xcode-select -s /Applications/Xcode.app`
2. **Android Studio 설치** (무료, Java 포함)
3. **도메인 연결 후** `capacitor.config.ts`의 기본 주소를 실제 도메인으로 바꾸고 `npx cap sync`
4. **Supabase → Authentication → URL Configuration → Redirect URLs**에 추가
   - `com.myfolio.app://**` (앱 로그인 복귀)
5. **Apple 로그인 설정** (애플 개발자 계정 필요)
   - Apple Developer에서 Services ID·Key 생성 → Supabase → Authentication → Providers → Apple에 입력
   - `lib/features.ts`의 `appleLogin: true`
6. **앱 아이콘·시작 화면**: 1024×1024 아이콘 준비 → `npx @capacitor/assets generate` 로 일괄 생성
7. **개발자 계정**: Apple Developer Program(연 $99), Google Play Console(1회 $25)
8. **스토어 제출 자료**: 스크린샷, 설명, 개인정보처리방침 URL, 연령 등급, 데모 계정(심사용)

## 로컬에서 시뮬레이터로 확인
```bash
npm run dev                                   # 웹 서버 실행
CAP_SERVER_URL=http://localhost:3000 npx cap sync ios
npx cap run ios                               # 시뮬레이터 실행 (Xcode 필요)
```

## 심사에서 자주 걸리는 것
- **4.2 최소 기능**: 웹사이트를 감싸기만 한 앱은 반려 위험 → 공유 시트, 사진 업로드, 푸시 알림 등 앱 기능을 보여줄 것
- **4.8 Apple 로그인**: 구글·카카오 로그인이 있으면 필수
- **5.1.1 회원 탈퇴**: 앱 안에서 탈퇴 가능해야 함 (준비됨)
- **3.1.1 인앱결제**: 앱 안에서 디지털 구독을 팔려면 애플 인앱결제 필수. 현재는 앱에서 판매하지 않고(버튼·링크 숨김),
  웹에서 구독한 Pro를 앱에서 쓰는 방식 (3.1.3(b) 멀티플랫폼 서비스)

## 다음 단계 (선택)
- 푸시 알림: `@capacitor/push-notifications` + Firebase(안드로이드)·APNs(iOS) 설정
- 앱 안 결제: RevenueCat 등으로 애플·구글 결제 연동 (앱 전용 가격 설정)
