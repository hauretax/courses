package fr.huggo.courses;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// Appli 100 % locale : l'interface web est dans assets/www, les données dans le stockage du WebView.
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // Inspection depuis le PC (chrome://inspect, par USB) : pour diagnostiquer l'état de l'appli.
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f6f5f1"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        web.setWebViewClient(new WebViewClient());
        // Caméra pour le scan code-barres : on demande la permission Android puis on l'accorde à la page
        web.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onPermissionRequest(android.webkit.PermissionRequest req) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        req.grant(req.getResources());
                    } else {
                        pendingCam = req;
                        requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 1);
                    }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        // Android 15 affiche bord à bord : on réserve la place de la barre d'état et de la barre de gestes.
        // (un WebView ignore son propre padding, d'où le conteneur)
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#f6f5f1"));
        root.addView(web);
        if (android.os.Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets i = insets.getInsets(android.view.WindowInsets.Type.systemBars()
                    | android.view.WindowInsets.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return android.view.WindowInsets.CONSUMED;
        });
        setContentView(root);
        if (b != null) web.restoreState(b);
        else web.loadUrl("file:///android_asset/www/index.html");
    }

    private android.webkit.PermissionRequest pendingCam;

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (pendingCam == null) return;
        if (res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) pendingCam.grant(pendingCam.getResources());
        else pendingCam.deny();
        pendingCam = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    // Retour : ferme d'abord le mode cuisine, sinon quitte.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onBack ? onBack() : false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    class Bridge {
        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, "Partager la liste"));
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        // GET HTTP côté natif (évite le blocage CORS d'une page locale). Réponse via window.__net(id, status, body).
        @JavascriptInterface
        public void httpGet(String url, String id) {
            new Thread(() -> {
                int status = 0;
                String body = "";
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setRequestProperty("User-Agent", "CoursesApp/1.0 (Android; usage personnel)");
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    status = c.getResponseCode();
                    java.io.InputStream in = status < 400 ? c.getInputStream() : c.getErrorStream();
                    if (in != null) {
                        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                        body = out.toString("UTF-8");
                    }
                } catch (Exception e) {
                    status = 0;
                    body = String.valueOf(e.getMessage());
                }
                final String js = "window.__net(" + org.json.JSONObject.quote(id) + "," + status + "," + org.json.JSONObject.quote(body) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        // Export des données : fichier écrit par morceaux dans Téléchargements/Courses (visible dans l'appli Fichiers, et par adb)
        private java.io.OutputStream exportOut;
        private String exportName;

        @JavascriptInterface
        public boolean exportBegin(String name) {
            if (android.os.Build.VERSION.SDK_INT < 29) return false;
            try {
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/json");
                v.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Courses");
                android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                exportOut = getContentResolver().openOutputStream(uri);
                exportName = name;
                return exportOut != null;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean exportWrite(String chunk) {
            try {
                exportOut.write(chunk.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String exportEnd() {
            try { exportOut.close(); } catch (Exception e) { }
            exportOut = null;
            return "Téléchargements/Courses/" + exportName;
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        }
    }
}
