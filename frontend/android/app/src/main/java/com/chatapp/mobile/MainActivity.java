package com.chatapp.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate: the bridge is built there
        // and only picks up plugins known at that point.
        registerPlugin(SecureScreenPlugin.class);

        super.onCreate(savedInstanceState);

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

    @Override
    public void onStart() {
        super.onStart();
        ChattyMessagingService.setAppForeground(true);
    }

    @Override
    public void onStop() {
        super.onStop();
        ChattyMessagingService.setAppForeground(false);
    }

    // A group notification tap reopens the app already pointing at the
    // conversation (Capacitor handles the in-app navigation). We clear that
    // conversation's stacked group here so, like WhatsApp, opening the chat
    // removes its notification card.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        clearNotificationForIntent(intent);
        setIntent(intent);
    }

    private void clearNotificationForIntent(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        Bundle extras = intent.getExtras();
        String conversationId = extras.getString("conversationId");
        if (conversationId != null && !conversationId.isEmpty()) {
            ChattyMessagingService.clearConversation(getApplicationContext(), conversationId);
        }
    }
}

