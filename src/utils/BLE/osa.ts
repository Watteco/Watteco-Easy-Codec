import { BleClient } from '@capacitor-community/bluetooth-le';
import { computeOsaResp } from '@/utils/wattecoOsa';
import {
  OSA_ADMIN_SERVICE_UUID,
  OSA_CHALLENGE_CHAR_UUID,
  OSA_RESPONSE_CHAR_UUID,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { parseHexToUint8Array, toSpacedHex, toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export async function runOsaChallenge(
  deviceId: string,
  otaAppKeyHex: string,
  devEuiHex: string,
  onLog: (line: string) => void
): Promise<void> {
  const otaAppKey = parseHexToUint8Array(otaAppKeyHex);
  const devEui = parseHexToUint8Array(devEuiHex);

  if (!otaAppKey || otaAppKey.length !== 16) {
    onLog('OSA failed: OTA AppKey must be exactly 16 bytes');
    return;
  }
  if (!devEui || devEui.length !== 8) {
    onLog('OSA failed: DevEUI must be exactly 8 bytes');
    return;
  }

  const challengeChar = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    OSA_CHALLENGE_CHAR_UUID,
    onLog
  );
  const responseChar = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    OSA_RESPONSE_CHAR_UUID,
    onLog
  );

  if (!challengeChar) {
    onLog('OSA failed: challenge characteristic not found in admin service');
    return;
  }
  if (!responseChar) {
    onLog('OSA failed: response characteristic not found in admin service');
    return;
  }

  try {
    const challengeRaw = await BleClient.read(deviceId, challengeChar.service, challengeChar.characteristic);
    const challenge = toUint8ArrayFromBleValue(challengeRaw);
    if (!challenge) {
      onLog('OSA failed: unable to decode challenge value');
      return;
    }
    if (challenge.length !== 16) {
      onLog(`OSA failed: challenge must be 16 bytes (got ${challenge.length})`);
      return;
    }

    onLog(`${new Date().toLocaleTimeString()} [READ OSA/CHALLENGE] ${toSpacedHex(challenge)}`);

    const response = computeOsaResp(otaAppKey, devEui, challenge);
    const data = new DataView(response.buffer, response.byteOffset, response.byteLength);

    if (responseChar.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, responseChar.service, responseChar.characteristic, data);
      onLog(`${new Date().toLocaleTimeString()} [WRITE-wo OSA/RESPONSE] ${toSpacedHex(response)}`);
    } else if (responseChar.props.write) {
      await BleClient.write(deviceId, responseChar.service, responseChar.characteristic, data);
      onLog(`${new Date().toLocaleTimeString()} [WRITE OSA/RESPONSE] ${toSpacedHex(response)}`);
    } else {
      onLog('OSA failed: response characteristic is not writable');
      return;
    }

    onLog('OSA challenge-response completed');
  } catch (error: any) {
    onLog(`OSA failed: ${error?.message ?? error}`);
  }
}

export async function readOsaChallenge(deviceId: string, onLog: (line: string) => void): Promise<void> {
  const challenge = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    OSA_CHALLENGE_CHAR_UUID,
    onLog
  );

  if (!challenge) {
    onLog('OSA challenge char not found in admin service');
    return;
  }

  try {
    const read = await BleClient.read(deviceId, challenge.service, challenge.characteristic);
    onLog(`${new Date().toLocaleTimeString()} [READ OSA/CHALLENGE] ${toSpacedHex(toUint8ArrayFromBleValue(read) || new Uint8Array())}`);
  } catch (error: any) {
    onLog(`Read failed OSA challenge: ${error?.message ?? error}`);
  }
}
