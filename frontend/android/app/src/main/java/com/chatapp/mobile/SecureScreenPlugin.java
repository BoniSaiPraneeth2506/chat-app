package com.chatapp.mobile;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Toggles FLAG_SECURE on the activity window.
 *
 * FLAG_SECURE makes Android refuse to screenshot or screen-record the window,
 * and hides it from the recent-apps thumbnail. It is the only way to enforce
 * this: nothing in the WebView or in JavaScript can prevent a system-level
 * screen capture, so a purely web implementation of "view once" is advisory at
 * best.
 *
 * Written as a local plugin rather than pulling in a dependency — it is two
 * window flags, and this keeps the native surface area auditable.
 *
 * The flag is applied only while view-once media is on screen, not for the
 * whole app, so ordinary screenshots keep working.
 */
@CapacitorPlugin(name = "SecureScreen")
public class SecureScreenPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        // Window flags must be touched on the UI thread.
        getActivity().runOnUiThread(() ->
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        );
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() ->
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        );
        call.resolve();
    }
}
