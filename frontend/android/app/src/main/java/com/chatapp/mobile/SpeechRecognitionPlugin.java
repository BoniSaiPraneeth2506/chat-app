package com.chatapp.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Streaming voice dictation for the app.
 *
 * The WebView has no `window.SpeechRecognition`, so the web-only dictation code
 * falls apart inside the APK. This plugin wraps Android's SpeechRecognizer,
 * which recognises words ON-DEVICE as they are spoken and hands them to the
 * WebView live: "partial" events stream the growing sentence into the composer
 * while the user holds the microphone button, "result" delivers the final
 * transcript on release, and "error"/"end" clean up the session.
 *
 * Written as a local plugin (like SecureScreenPlugin) so the native surface
 * stays auditable and follows the project's two-file pattern. RECORD_AUDIO is
 * already requested at app launch in MainActivity; this plugin requests it at
 * dictation time as well as a fresh fallback.
 */
@CapacitorPlugin(
    name = "SpeechRecognition",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class SpeechRecognitionPlugin extends Plugin {

    private static final String EVENT_PARTIAL = "partial";
    private static final String EVENT_RESULT = "result";
    private static final String EVENT_ERROR = "error";
    private static final String EVENT_END = "end";

    private SpeechRecognizer recognizer = null;
    private boolean listening = false;

    private static final String[] ERROR_NAMES = {
        "", // 0 unused
        "network-timeout",
        "network",
        "audio",
        "server",
        "client",
        "speech-timeout",
        "no-match",
        "recognizer-busy",
        "insufficient-permissions",
        "language-not-supported",
        "language-unavailable",
    };

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
        JSObject ret = new JSObject();
        ret.put("available", available);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is not available on this device");
            return;
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            activeStartCall = call;
            requestPermissionForAlias("microphone", call, "permissionCallback");
            return;
        }
        runRecognizer(call);
    }

    private PluginCall activeStartCall = null;

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = getPermissionState("microphone") == PermissionState.GRANTED;
        if (!granted) {
            emitErrorLocked("insufficient-permissions");
            call.reject("Microphone permission denied");
            return;
        }
        runRecognizer(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recognizer != null && listening) {
            try {
                // Stops listening but delivers the final result event.
                recognizer.stopListening();
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    private void runRecognizer(PluginCall call) {
        try {
            if (recognizer != null) {
                try { recognizer.destroy(); } catch (Exception ignored) {}
                recognizer = null;
            }

            recognizer = SpeechRecognizer.createSpeechRecognizer(getActivity());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}

                @Override
                public void onError(int error) {
                    String name = error >= 0 && error < ERROR_NAMES.length
                        ? ERROR_NAMES[error]
                        : "unknown";
                    JSObject data = new JSObject();
                    data.put("code", error);
                    data.put("error", name);
                    notifyListeners(EVENT_ERROR, data);
                    // Every session ends, success or not — tell JS to release the UI.
                    JSObject end = new JSObject();
                    notifyListeners(EVENT_END, end);
                    destroyRecognizer();
                }

                @Override
                public void onPartialResults(Bundle results) {
                    emitText(EVENT_PARTIAL, results);
                }

                @Override
                public void onResults(Bundle results) {
                    emitText(EVENT_RESULT, results);
                }

                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            String language = call.getString("language", "");
            if (language == null || language.isEmpty()) {
                language = Locale.getDefault() != null ? Locale.getDefault().toString() : "en-IN";
            }
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            // Hold the mic open until the user lifts it: partials stream while
            // speaking, stop() delivers the final result.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 15000);

            listening = true;
            recognizer.startListening(intent);
            call.resolve();
        } catch (SecurityException e) {
            emitErrorLocked("insufficient-permissions");
            call.reject("No RECORD_AUDIO permission");
        } catch (Exception e) {
            call.reject("Failed to start recognizer: " + e.getMessage());
        }
    }

    private void emitText(String event, Bundle results) {
        String text = firstTranscript(results);
        JSObject data = new JSObject();
        data.put("text", text == null ? "" : text);
        notifyListeners(event, data);
    }

    private String firstTranscript(Bundle results) {
        if (results == null) return "";
        ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list != null && !list.isEmpty()) {
            String first = list.get(0);
            return first == null ? "" : first;
        }
        // Partial results on some builds come back under MATCHES / a different key.
        ArrayList<String> matches = results.getStringArrayList("matches");
        if (matches != null && !matches.isEmpty()) {
            String first = matches.get(0);
            return first == null ? "" : first;
        }
        return "";
    }

    private void emitErrorLocked(String name) {
        if (getBridge() == null) return;
        JSObject data = new JSObject();
        data.put("code", -1);
        data.put("error", name);
        notifyListeners(EVENT_ERROR, data);
        JSObject end = new JSObject();
        notifyListeners(EVENT_END, end);
    }

    private void destroyRecognizer() {
        listening = false;
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyRecognizer();
        super.handleOnDestroy();
    }
}