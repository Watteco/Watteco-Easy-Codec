/**
 * @file watteco_ble_osa_kdf.h
 * @brief Watteco BLE OSA offline auth - APSK derivation (NIST SP 800-108, PRF=CMAC-AES128)
 *
 * This module derives a 16-byte APSK from:
 *   - OTA_AppKey (16 bytes)
 *   - DevEUI     (8 bytes)
 *
 * KDF (PRF mode, single-block):
 *   APSK = CMAC( OTA_AppKey,
 *               0x01 || "WATTECO-BLE-OSA-V1" || 0x00 || DevEUI || 0x0080 )
 *
 * Then the OSA response is:
 *   Resp = CMAC(APSK, Chal16)
 *
 * Dependencies:
 *   - cmac.h from Semtech LBM soft_se (AES_CMAC_* API)
 */

#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** 16-byte BLE OSA Application Pairing Secret Key */
#define WATTECO_BLE_APSK_LEN (16u)
/** 16-byte OSA challenge */
#define WATTECO_BLE_CHAL_LEN (16u)
/** 16-byte OSA response (AES-CMAC output) */
#define WATTECO_BLE_RESP_LEN (16u)

/**
 * @brief Derive APSK using NIST SP 800-108 (PRF=CMAC-AES128), single-block (16 bytes).
 *
 * @param[out] apsk_out     16-byte derived APSK
 * @param[in]  ota_appkey   16-byte LoRaWAN OTAA AppKey
 * @param[in]  deveui       8-byte DevEUI (exact byte order as transported via BLE/ADV)
 */
void watteco_ble_derive_apsk_sp800_108( uint8_t apsk_out[WATTECO_BLE_APSK_LEN],
                                        const uint8_t ota_appkey[16],
                                        const uint8_t deveui[8] );

/**
 * @brief Compute OSA response for a given challenge (derives APSK then CMAC over challenge).
 *
 * @param[out] resp_out     16-byte response to write to Admin_AuthResp
 * @param[in]  ota_appkey   16-byte LoRaWAN OTAA AppKey
 * @param[in]  deveui       8-byte DevEUI
 * @param[in]  chal         16-byte challenge read from Admin_AuthChal
 */
void watteco_ble_compute_osa_resp( uint8_t resp_out[WATTECO_BLE_RESP_LEN],
                                   const uint8_t ota_appkey[16],
                                   const uint8_t deveui[8],
                                   const uint8_t chal[WATTECO_BLE_CHAL_LEN] );

/**
 * @brief Optional: Zeroize a buffer (best-effort; avoids being optimized out).
 */
void watteco_ble_memzero( void* buf, uint32_t len );

#ifdef __cplusplus
}
#endif
