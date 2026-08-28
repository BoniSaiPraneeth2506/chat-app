package com.chatapp.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    // Cold-start notification tap.
    //
    // When Chatty is force-killed and launched by tapping a notification, the
    // Capacitor push plugin hands the tap to JS only if the launch Intent happens
    // to carry "google.message_id" — which some OEMs (vivo) drop, so the tap is
    // silently lost and the app just opens to the home/root. This bridge is a
    // reliable fallback: it captures the structured notification `data` extras
    // (type, conversationId, messageId, senderId) off the launch Intent and lets
    // the JS side pull them once at boot, independent of the plugin's gate.
    // It only READS the launch Intent — it does not touch notification creation,
    // grouping, MessagingStyle, or ids.

    private String launchTapData = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate: the bridge is built there
        // and only picks up plugins known at that point.
        registerPlugin(SecureScreenPlugin.class);

        super.onCreate(savedInstanceState);

        captureLaunchTap(getIntent());
        // Expose the native tap bridge to the WebView. The WebView is created by
        // Capacitor inside super.onCreate above (load() builds it), so it is
        // available here.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(this, "AndroidBridge");
        }

        String[] mediaPermissions = { Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA };
        List<String> missing = new ArrayList<>();
        for (String permission : mediaPermissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), 1001);
        }
    }

    // A tap that resumes an existing task (app in background, process alive) also
    // arrives here. Preserve the plugin's own handling via super, then capture.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureLaunchTap(intent);
    }

    private synchronized void captureLaunchTap(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        Bundle b = intent.getExtras();

        Object convVal = b.get("conversationId");
        String conversationId = convVal != null ? String.valueOf(convVal) : null;

        // Fallback: check if notification data is inside a nested "data" string extra
        if ((conversationId == null || conversationId.isEmpty()) && b.containsKey("data")) {
            Object dataObj = b.get("data");
            if (dataObj instanceof String) {
                try {
                    JSONObject nestedObj = new JSONObject((String) dataObj);
                    if (nestedObj.has("conversationId")) {
                        conversationId = nestedObj.optString("conversationId");
                        launchTapData = nestedObj.toString();
                        android.util.Log.d("ChattyNotification", "[Android Intent] captured nested launch tap data: " + launchTapData);
                        return;
                    }
                } catch (Exception ignored) {}
            }
        }

        if (conversationId == null || conversationId.isEmpty()) return;

        try {
            JSONObject obj = new JSONObject();
            putString(obj, "type", b.get("type") != null ? String.valueOf(b.get("type")) : null);
            putString(obj, "conversationId", conversationId);
            putString(obj, "messageId", b.get("messageId") != null ? String.valueOf(b.get("messageId")) : null);
            putString(obj, "senderId", b.get("senderId") != null ? String.valueOf(b.get("senderId")) : null);
            launchTapData = obj.toString();
            android.util.Log.d("ChattyNotification", "[Android Intent] captured launch tap data: " + launchTapData);
        } catch (Exception e) {
            launchTapData = null;
        }
    }

    private static void putString(JSONObject obj, String key, String value) {
        try {
            if (value != null) obj.put(key, value);
        } catch (Exception ignored) {
        }
    }

    /**
     * Called from WebView JS (window.AndroidBridge.getLaunchTap()) at app boot.
     * Returns the captured cold-start tap data (JSON) exactly once, then clears
     * it so a later plugin event (if it does fire) is not double-consumed.
     */
    @JavascriptInterface
    public synchronized String getLaunchTap() {
        String data = launchTapData;
        launchTapData = null;
        return data == null ? "" : data;
    }
}
