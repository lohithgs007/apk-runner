// Keeps the WebView inside Android's live safe area on edge-to-edge devices.
import { existsSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const packageId = String(config.package_id ?? "com.example.app");
const themeColor = config.theme_color ?? "#000000";
const pushEnabled = Boolean(config.push_enabled && config.google_services_url);
const activityFile = `android/app/src/main/java/${packageId.replaceAll(".", "/")}/MainActivity.java`;

if (!existsSync(activityFile)) {
  throw new Error(`MainActivity was not found at ${activityFile}`);
}

writeFileSync(
  activityFile,
  `package ${packageId};

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15 enforces edge-to-edge for targetSdk 35. Opt into it explicitly,
        // then move the WebView by the real status/navigation/cutout insets. This is
        // reliable even when the legacy decorFitsSystemWindows flag is ignored.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.parseColor("${themeColor}"));
        getWindow().setNavigationBarColor(Color.parseColor("${themeColor}"));
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("${themeColor}"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.show(WindowInsetsCompat.Type.systemBars());

        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
${pushEnabled ? `
        WraplinePush.createChannel(this);
        WraplinePush.registerToken();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 1001);
        }
` : ""}
    }
}
`,
);

console.log("Applied persistent system bars and live display-cutout insets");