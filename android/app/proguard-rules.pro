# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- HomeMed release rules (R8 shrink + obfuscation) ----

# Readable crash stack traces in the Play Console (the mapping file is
# uploaded automatically with the .aab).
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Capacitor finds plugins and their methods by reflection/annotation, and the
# WebView bridge calls @JavascriptInterface methods by name.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.ActivityCallback <methods>;
    @android.webkit.JavascriptInterface <methods>;
}

# Plugins in use. Local notifications stores scheduled reminders as JSON
# (Gson) to restore them after a reboot, so field names must stay as they are.
-keep class com.capacitorjs.plugins.** { *; }
-keep class ee.forgr.capacitor.social.login.** { *; }
-keep class com.getcapacitor.community.safearea.** { *; }
