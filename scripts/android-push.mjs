// Wires Firebase Cloud Messaging into the generated Android project.
// Registers the device token with Wrapline natively, so the remote site
// needs no JavaScript changes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");

if (!config.push_enabled || !config.google_services_url) {
  console.log("Push notifications disabled for this build");
  process.exit(0);
}

const packageId = config.package_id ?? "com.example.app";
const packagePath = packageId.replace(/[^\w.]/g, "").split(".").join("/");

// 1. google-services.json is downloaded by the workflow into android/app/.
if (!existsSync("android/app/google-services.json")) {
  console.error("google-services.json missing");
  process.exit(1);
}

// 2. Root gradle: google-services plugin classpath.
const rootGradlePath = "android/build.gradle";
let rootGradle = readFileSync(rootGradlePath, "utf8");
if (!rootGradle.includes("com.google.gms:google-services")) {
  rootGradle = rootGradle.replace(
    /classpath ['"]com\.android\.tools\.build:gradle[^\n]*\n/,
    (match) => `${match}        classpath 'com.google.gms:google-services:4.4.2'\n`,
  );
  writeFileSync(rootGradlePath, rootGradle);
}

// 3. App gradle: plugin + firebase messaging dependency.
const appGradlePath = "android/app/build.gradle";
let appGradle = readFileSync(appGradlePath, "utf8");
if (!appGradle.includes("com.google.gms.google-services")) {
  appGradle += `\napply plugin: 'com.google.gms.google-services'\n`;
}
if (!appGradle.includes("firebase-messaging")) {
  appGradle = appGradle.replace(
    /dependencies \{/,
    `dependencies {\n    implementation platform('com.google.firebase:firebase-bom:33.5.1')\n    implementation 'com.google.firebase:firebase-messaging'`,
  );
}
writeFileSync(appGradlePath, appGradle);

// 4. Manifest: notification permission + default channel.
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes("POST_NOTIFICATIONS")) {
  manifest = manifest.replace(
    "</manifest>",
    `    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>`,
  );
}
if (!manifest.includes("WraplineMessagingService")) {
  manifest = manifest.replace(
    "</application>",
    `        <service
            android:name=".WraplineMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>`,
  );
}
writeFileSync(manifestPath, manifest);

// 5. Native token registration + notification display.
const javaDir = `android/app/src/main/java/${packagePath}`;
mkdirSync(javaDir, { recursive: true });

writeFileSync(
  `${javaDir}/WraplinePush.java`,
  `package ${packageId};

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public final class WraplinePush {
    public static final String CHANNEL_ID = "wrapline_default";
    private static final String REGISTER_URL = "${config.register_url}";
    private static final String DEVICE_KEY = "${config.device_key}";

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Notifications", NotificationManager.IMPORTANCE_HIGH);
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    public static void registerToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> send(token));
    }

    public static void send(final String token) {
        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("device_key", DEVICE_KEY);
                payload.put("token", token);
                payload.put("platform", "android");
                HttpURLConnection connection = (HttpURLConnection) new URL(REGISTER_URL).openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                OutputStream out = connection.getOutputStream();
                out.write(payload.toString().getBytes("UTF-8"));
                out.close();
                connection.getResponseCode();
                connection.disconnect();
            } catch (Exception ignored) {
            }
        }).start();
    }
}
`,
);

writeFileSync(
  `${javaDir}/WraplineMessagingService.java`,
  `package ${packageId};

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class WraplineMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        WraplinePush.send(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String title = message.getNotification() != null ? message.getNotification().getTitle() : "";
        String body = message.getNotification() != null ? message.getNotification().getBody() : "";
        String link = message.getData().get("link");

        Intent intent = link != null
            ? new Intent(Intent.ACTION_VIEW, Uri.parse(link))
            : new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pending = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        WraplinePush.createChannel(this);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, WraplinePush.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
`,
);

console.log("Firebase Cloud Messaging wired into the Android project");
