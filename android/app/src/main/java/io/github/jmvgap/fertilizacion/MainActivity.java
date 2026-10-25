// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
package io.github.jmvgap.fertilizacion;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Calculadora de Fertilización.
 *
 * La app web va dentro del paquete (assets) y se sirve con WebViewAssetLoader
 * bajo https://appassets.androidplatform.net/, así funciona sin conexión.
 *
 * Un WebView no imprime con window.print(), no descarga archivos con
 * a[download] ni abre el selector de archivos por sí solo: para eso está el
 * puente "AndroidApp" (imprimir a PDF y guardar el CSV) y onShowFileChooser
 * (importar CSV).
 *
 * Como en el pasturómetro, con targetSdk 36 el "atrás" se maneja con
 * OnBackPressedDispatcher y los insets del edge-to-edge se aplican como padding.
 */
public class MainActivity extends ComponentActivity {

    private static final String HOST = "appassets.androidplatform.net";

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private ValueCallback<Uri[]> callbackArchivo;
    private String contenidoPendiente;

    // Importar CSV: selector de archivos del sistema.
    private final ActivityResultLauncher<String> elegirArchivo =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (callbackArchivo != null) {
                    callbackArchivo.onReceiveValue(uri != null ? new Uri[]{uri} : null);
                    callbackArchivo = null;
                }
            });

    // Exportar CSV: el usuario elige dónde guardarlo.
    private final ActivityResultLauncher<String> crearCsv =
            registerForActivityResult(new ActivityResultContracts.CreateDocument("text/csv"), uri -> {
                if (uri != null && contenidoPendiente != null) {
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(contenidoPendiente.getBytes(StandardCharsets.UTF_8));
                        aviso("Archivo guardado");
                    } catch (Exception e) {
                        aviso("No se pudo guardar el archivo");
                    }
                }
                contenidoPendiente = null;
            });

    /** Funciones que la página llama como window.AndroidApp.xxx(). */
    private class Puente {
        @JavascriptInterface
        public void imprimir(String titulo) {
            runOnUiThread(() -> {
                String t = (titulo == null || titulo.isEmpty()) ? "Informe" : titulo;
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                PrintAttributes atributos = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .build();
                pm.print(t, webView.createPrintDocumentAdapter(t), atributos);
            });
        }

        @JavascriptInterface
        public void guardarArchivo(String nombre, String contenido, String mime) {
            runOnUiThread(() -> {
                contenidoPendiente = contenido;
                crearCsv.launch(nombre);
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xFFF6F8F5);
        setContentView(webView);

        // Edge-to-edge (obligatorio desde API 35): que nada quede bajo las barras.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
                            | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage: ensayos, lote y precios
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        webView.addJavascriptInterface(new Puente(), "AndroidApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            // Los links externos (por ejemplo, el código en GitHub) se abren
            // en el navegador, no dentro de la app.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    aviso("No hay una aplicación para abrir el enlace");
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (callbackArchivo != null) callbackArchivo.onReceiveValue(null);
                callbackArchivo = callback;
                try {
                    elegirArchivo.launch("*/*");
                } catch (ActivityNotFoundException e) {
                    callbackArchivo = null;
                    return false;
                }
                return true;
            }
        });

        // "Atrás": primero le pregunta a la página (vuelve de Informe, Ayuda
        // o Acerca de); si la página no lo usa, se cierra la app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript("window.atrasApp ? window.atrasApp() : false", valor -> {
                    if (!"true".equals(valor)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("https://" + HOST + "/assets/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    private void aviso(String texto) {
        Toast.makeText(this, texto, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
