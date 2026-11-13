import Foundation
import Security
import Capacitor

@objc(OsaKeyStorePlugin)
public class OsaKeyStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OsaKeyStorePlugin"
    public let jsName = "OsaKeyStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "store", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purgeExpired", returnType: CAPPluginReturnPromise)
    ]

    private let service = "watteco.easycodec.osa.v1"

    @objc func store(_ call: CAPPluginCall) {
        do {
            let devEui = try normalizedHex(call.getString("devEui"), length: 16, label: "DevEUI")
            let keyHex = try normalizedHex(call.getString("keyHex"), length: 32, label: "OSA key")
            guard let expiresAt = call.getDouble("expiresAt"), expiresAt > Date().timeIntervalSince1970 * 1000 else {
                throw StoreError.message("expiresAt must be in the future")
            }
            let payload = try JSONSerialization.data(withJSONObject: ["devEui": devEui, "keyHex": keyHex, "expiresAt": expiresAt])
            SecItemDelete(query(account: devEui) as CFDictionary)
            var add = query(account: devEui)
            add[kSecValueData as String] = payload
            add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let status = SecItemAdd(add as CFDictionary, nil)
            guard status == errSecSuccess else { throw StoreError.status(status) }
            call.resolve(["success": true, "devEui": devEui, "expiresAt": expiresAt])
        } catch { call.reject("Unable to store OSA key: \(error.localizedDescription)") }
    }

    @objc func get(_ call: CAPPluginCall) {
        do {
            let devEui = try normalizedHex(call.getString("devEui"), length: 16, label: "DevEUI")
            var lookup = query(account: devEui)
            lookup[kSecReturnData as String] = true
            lookup[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let status = SecItemCopyMatching(lookup as CFDictionary, &item)
            guard status != errSecItemNotFound else { throw StoreError.message("OSA key not found") }
            guard status == errSecSuccess, let data = item as? Data else { throw StoreError.status(status) }
            guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  payload["devEui"] as? String == devEui,
                  let keyHex = payload["keyHex"] as? String,
                  let expiresAt = payload["expiresAt"] as? Double else { throw StoreError.message("Invalid OSA key record") }
            if expiresAt <= Date().timeIntervalSince1970 * 1000 {
                SecItemDelete(query(account: devEui) as CFDictionary)
                throw StoreError.message("OSA key expired")
            }
            call.resolve(["devEui": devEui, "keyHex": keyHex, "expiresAt": expiresAt])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func delete(_ call: CAPPluginCall) {
        do {
            let devEui = try normalizedHex(call.getString("devEui"), length: 16, label: "DevEUI")
            let status = SecItemDelete(query(account: devEui) as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw StoreError.status(status) }
            call.resolve(["success": true, "devEui": devEui, "deleted": status == errSecSuccess])
        } catch { call.reject("Unable to delete OSA key: \(error.localizedDescription)") }
    }

    @objc func purgeExpired(_ call: CAPPluginCall) {
        var lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]
        var items: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &items)
        guard status == errSecSuccess || status == errSecItemNotFound else { call.reject(StoreError.status(status).localizedDescription); return }
        var purged = 0
        for item in (items as? [[String: Any]]) ?? [] {
            guard let account = item[kSecAttrAccount as String] as? String else { continue }
            let expired: Bool
            if let data = item[kSecValueData as String] as? Data,
               let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let expiry = payload["expiresAt"] as? Double { expired = expiry <= Date().timeIntervalSince1970 * 1000 }
            else { expired = true }
            if expired { SecItemDelete(query(account: account) as CFDictionary); purged += 1 }
        }
        call.resolve(["success": true, "devEui": "", "purged": purged])
    }

    private func query(account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
    }

    private func normalizedHex(_ value: String?, length: Int, label: String) throws -> String {
        let normalized = (value ?? "").filter { $0.isHexDigit }.uppercased()
        guard normalized.count == length else { throw StoreError.message("\(label) must contain \(length / 2) bytes") }
        return normalized
    }

    private enum StoreError: LocalizedError {
        case message(String), status(OSStatus)
        var errorDescription: String? {
            switch self { case .message(let text): return text; case .status(let status): return SecCopyErrorMessageString(status, nil) as String? ?? "Keychain error \(status)" }
        }
    }
}
