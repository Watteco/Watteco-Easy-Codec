/// Watteco BLE OSA offline auth helpers (APSK derivation + CMAC response)
///
/// Implements:
///  - APSK derivation: NIST SP 800-108 (PRF=CMAC-AES128), single-block 16B
///  - OSA response: CMAC(APSK, Chal16)
///
/// KDF:
///   APSK = CMAC( OTA_AppKey,
///               0x01 || "WATTECO-BLE-OSA-V1" || 0x00 || DevEUI || 0x0080 )
///
/// Notes:
///  - DevEUI byte order must match exactly what the device exposes via BLE/ADV.
///  - L=0x0080 is the requested output length in bits (128).
///
/// Dependency:
///   pointycastle: ^3.x
library watteco_ble_osa_kdf;

import 'dart:typed_data';

import 'package:pointycastle/export.dart';

const String _label = 'WATTECO-BLE-OSA-V1';

/// Derive 16-byte APSK (SP800-108 PRF=CMAC-AES128, single block).
Uint8List deriveApskSp800108({
  required Uint8List otaAppKey16,
  required Uint8List devEui8,
}) {
  if (otaAppKey16.length != 16) {
    throw ArgumentError('otaAppKey16 must be 16 bytes');
  }
  if (devEui8.length != 8) {
    throw ArgumentError('devEui8 must be 8 bytes');
  }

  // Build KDF message:
  // counter(0x01) || label || 0x00 || devEui || L_bits_be16 (0x0080)
  final labelBytes = Uint8List.fromList(_label.codeUnits);
  final msg = BytesBuilder(copy: false)
    ..add([0x01])
    ..add(labelBytes)
    ..add([0x00])
    ..add(devEui8)
    ..add([0x00, 0x80]); // 128 bits

  return _aesCmac128(key16: otaAppKey16, data: msg.toBytes());
}

/// Compute OSA response: Resp = CMAC(APSK, Chal16).
Uint8List computeOsaResp({
  required Uint8List otaAppKey16,
  required Uint8List devEui8,
  required Uint8List chal16,
}) {
  if (chal16.length != 16) {
    throw ArgumentError('chal16 must be 16 bytes');
  }
  final apsk = deriveApskSp800108(otaAppKey16: otaAppKey16, devEui8: devEui8);
  return _aesCmac128(key16: apsk, data: chal16);
}

/// AES-CMAC 128-bit tag (16 bytes) using pointycastle.
Uint8List _aesCmac128({
  required Uint8List key16,
  required Uint8List data,
}) {
  if (key16.length != 16) {
    throw ArgumentError('key16 must be 16 bytes');
  }

  // pointycastle CMac takes a BlockCipher and macSizeInBits
  final mac = CMac(AESEngine(), 128)
    ..init(KeyParameter(key16));

  mac.update(data, 0, data.length);
  final out = Uint8List(16);
  mac.doFinal(out, 0);
  return out;
}

/// Helpers

Uint8List hexToBytes(String hex) {
  final cleaned = hex.replaceAll(RegExp(r'[^0-9a-fA-F]'), '');
  if (cleaned.length.isOdd) {
    throw FormatException('Hex string has odd length');
  }
  final out = Uint8List(cleaned.length ~/ 2);
  for (var i = 0; i < out.length; i++) {
    final byteStr = cleaned.substring(i * 2, i * 2 + 2);
    out[i] = int.parse(byteStr, radix: 16);
  }
  return out;
}

String bytesToHex(Uint8List bytes) {
  final sb = StringBuffer();
  for (final b in bytes) {
    sb.write(b.toRadixString(16).padLeft(2, '0').toUpperCase());
  }
  return sb.toString();
}
