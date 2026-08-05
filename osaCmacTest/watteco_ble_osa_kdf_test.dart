/// Simple console test for Watteco BLE OSA KDF + response.
///
/// Run:
///   dart run watteco_ble_osa_kdf_test.dart
///
/// Or from a Flutter repo, put this in /tool or /bin and run with `dart run`.
import 'dart:typed_data';

import 'watteco_ble_osa_kdf.dart';

void main() {
  // Same dummy values as the C test harness we generated earlier.
  final otaAppKey = Uint8List.fromList([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
  ]);
  final devEui = Uint8List.fromList([0x70, 0xB3, 0xD5, 0x7E, 0xF0, 0x00, 0x12, 0x34]);
  final chal = Uint8List.fromList([
    0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
    0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
  ]);

  final apsk = deriveApskSp800108(otaAppKey16: otaAppKey, devEui8: devEui);
  final resp = computeOsaResp(otaAppKey16: otaAppKey, devEui8: devEui, chal16: chal);

  print('OTA_AppKey: ${bytesToHex(otaAppKey)}');
  print('DevEUI:     ${bytesToHex(devEui)}');
  print('Chal:       ${bytesToHex(chal)}');
  print('APSK:       ${bytesToHex(apsk)}');
  print('Resp:       ${bytesToHex(resp)}');

  // Optional: if you paste expected values from firmware, you can assert here:
  // const expectedApskHex = '...';
  // const expectedRespHex = '...';
  // if (bytesToHex(apsk) != expectedApskHex) throw StateError('APSK mismatch');
  // if (bytesToHex(resp) != expectedRespHex) throw StateError('Resp mismatch');
}
