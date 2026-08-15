// Makes the status and navigation bars persistent and keeps the WebView below them.
import { existsSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const packageId = String(config.package_id ?? "com.example.app");
const themeColor = config.theme_color ?? "#000000";
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
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(Color.parseColor("${themeColor}"));
        getWindow().setNavigationBarColor(Color.parseColor("${themeColor}"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);

        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
`,
);

console.log("Applied persistent system bars and live display-cutout insets");