package com.local.mikeoss;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.local.mikeoss.nodejs.NodeJsMobile;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MIKEOSS";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Boot the embedded Node.js runtime (Express backend on
        // 127.0.0.1:3001) before the WebView loads. The WebView points at
        // server.url from capacitor.config.json; the server needs a couple
        // of seconds, and Capacitor's errorPath reloads into the app once
        // it is reachable.
        try {
            NodeJsMobile.init(getApplicationContext());
            NodeJsMobile.startNodeProject("dist/index.js");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to start embedded Node runtime", t);
        }
        super.onCreate(savedInstanceState);
    }
}
