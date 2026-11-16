import type { CapacitorConfig } from "@capacitor/cli";

/**
 * myfolio 앱 설정.
 * 앱은 배포된 사이트(CAP_SERVER_URL)를 열어서 보여준다 — 웹을 고치면 앱에도 바로 반영.
 *  - 실제 출시:   CAP_SERVER_URL=https://내도메인  npx cap sync
 *  - 시뮬레이터:  CAP_SERVER_URL=http://localhost:3000  npx cap sync  (npm run dev 실행 중일 때)
 * native-shell/ 은 사이트에 연결하지 못할 때 보이는 안내 화면.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://myfolio-ashy.vercel.app";

const config: CapacitorConfig = {
  appId: "com.myfolio.app",
  appName: "myfolio",
  webDir: "native-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"), // 로컬 테스트(http)만 허용
    errorPath: "index.html",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#F8F7F4", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#FFFFFF" },
  },
};

export default config;
