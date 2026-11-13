package wattecoDev.easycodec;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OsaKeyStore")
public class OsaKeyStorePlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String MASTER_ALIAS = "watteco_osa_storage_master_v1";
    private static final String PREFS = "watteco_osa_secure_store_v1";
    private static final String PREFIX = "osa_";

    @PluginMethod
    public void store(PluginCall call) {
        try {
            String devEui = normalizeHex(call.getString("devEui"), 16, "DevEUI");
            String keyHex = normalizeHex(call.getString("keyHex"), 32, "OSA key");
            Long expiresAt = call.getLong("expiresAt");
            if (expiresAt == null || expiresAt <= System.currentTimeMillis()) throw new IllegalArgumentException("expiresAt must be in the future");
            JSONObject payload = new JSONObject();
            payload.put("devEui", devEui); payload.put("keyHex", keyHex); payload.put("expiresAt", expiresAt);
            preferences().edit().putString(preferenceKey(devEui), encrypt(payload.toString())).apply();
            JSObject result = baseResult(devEui); result.put("success", true); result.put("expiresAt", expiresAt); call.resolve(result);
        } catch (Exception exception) { call.reject("Unable to store OSA key: " + exception.getMessage(), exception); }
    }

    @PluginMethod
    public void get(PluginCall call) {
        try {
            String devEui = normalizeHex(call.getString("devEui"), 16, "DevEUI");
            String encrypted = preferences().getString(preferenceKey(devEui), null);
            if (encrypted == null) throw new IllegalStateException("OSA key not found");
            JSONObject payload = new JSONObject(decrypt(encrypted));
            if (!devEui.equals(payload.getString("devEui"))) throw new IllegalStateException("OSA key identity mismatch");
            long expiresAt = payload.getLong("expiresAt");
            if (expiresAt <= System.currentTimeMillis()) { preferences().edit().remove(preferenceKey(devEui)).apply(); throw new IllegalStateException("OSA key expired"); }
            JSObject result = new JSObject(); result.put("devEui", devEui); result.put("keyHex", payload.getString("keyHex")); result.put("expiresAt", expiresAt); call.resolve(result);
        } catch (Exception exception) { call.reject(exception.getMessage(), exception); }
    }

    @PluginMethod
    public void delete(PluginCall call) {
        try {
            String devEui = normalizeHex(call.getString("devEui"), 16, "DevEUI");
            boolean existed = preferences().contains(preferenceKey(devEui)); preferences().edit().remove(preferenceKey(devEui)).apply();
            JSObject result = baseResult(devEui); result.put("success", true); result.put("deleted", existed); call.resolve(result);
        } catch (Exception exception) { call.reject("Unable to delete OSA key: " + exception.getMessage(), exception); }
    }

    @PluginMethod
    public void purgeExpired(PluginCall call) {
        int purged = 0;
        try {
            SharedPreferences.Editor editor = preferences().edit();
            for (Map.Entry<String, ?> entry : preferences().getAll().entrySet()) {
                try {
                    JSONObject payload = new JSONObject(decrypt((String) entry.getValue()));
                    if (payload.getLong("expiresAt") <= System.currentTimeMillis()) { editor.remove(entry.getKey()); purged++; }
                } catch (Exception invalid) { editor.remove(entry.getKey()); purged++; }
            }
            editor.apply(); JSObject result = new JSObject(); result.put("success", true); result.put("devEui", ""); result.put("purged", purged); call.resolve(result);
        } catch (Exception exception) { call.reject("Unable to purge OSA keys: " + exception.getMessage(), exception); }
    }

    private SharedPreferences preferences() { return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE); }

    private SecretKey masterKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE); keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(MASTER_ALIAS, null); if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(MASTER_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }

    private String encrypt(String clearText) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, masterKey());
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(cipher.doFinal(clearText.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
    }

    private String decrypt(String envelope) throws Exception {
        String[] parts = envelope.split("\\.", 2); if (parts.length != 2) throw new IllegalArgumentException("Invalid secure record");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private String preferenceKey(String devEui) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(devEui.getBytes(StandardCharsets.UTF_8));
        StringBuilder output = new StringBuilder(PREFIX); for (byte value : digest) output.append(String.format(Locale.ROOT, "%02x", value & 0xff)); return output.toString();
    }

    private String normalizeHex(String value, int length, String label) {
        String normalized = value == null ? "" : value.replaceAll("[^0-9A-Fa-f]", "").toUpperCase(Locale.ROOT);
        if (normalized.length() != length) throw new IllegalArgumentException(label + " must contain " + (length / 2) + " bytes"); return normalized;
    }
    private JSObject baseResult(String devEui) { JSObject result = new JSObject(); result.put("devEui", devEui); return result; }
}
