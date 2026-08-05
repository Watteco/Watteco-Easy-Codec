/**
 * @file watteco_ble_osa_kdf.c
 * @brief Watteco BLE OSA offline auth - APSK derivation (NIST SP 800-108, PRF=CMAC-AES128)
 */

#include "watteco_ble_osa_kdf.h"
#include "cmac.h"   /* AES_CMAC_* */

#include <stddef.h>

#define WATTECO_LABEL      "WATTECO-BLE-OSA-V1"
#define WATTECO_LABEL_LEN  ( (uint32_t)(sizeof(WATTECO_LABEL) - 1u) )

static inline void be16( uint8_t out[2], uint16_t v )
{
    out[0] = (uint8_t)( (v >> 8) & 0xFFu );
    out[1] = (uint8_t)( v & 0xFFu );
}

void watteco_ble_memzero( void* buf, uint32_t len )
{
    /* Best-effort zeroize: use volatile pointer to reduce optimization removal */
    volatile uint8_t* p = (volatile uint8_t*) buf;
    while( (p != NULL) && (len-- != 0u) )
    {
        *p++ = 0u;
    }
}

void watteco_ble_derive_apsk_sp800_108( uint8_t apsk_out[WATTECO_BLE_APSK_LEN],
                                        const uint8_t ota_appkey[16],
                                        const uint8_t deveui[8] )
{
    const uint8_t counter = 0x01u;
    const uint8_t sep     = 0x00u;
    uint8_t       Lbits[2];

    /* 16 bytes -> 128 bits -> 0x0080 */
    be16( Lbits, 128u );

    AES_CMAC_CTX ctx[1];
    AES_CMAC_Init( ctx );
    AES_CMAC_SetKey( ctx, ota_appkey );

    AES_CMAC_Update( ctx, &counter, 1u );
    AES_CMAC_Update( ctx, (const uint8_t*) WATTECO_LABEL, WATTECO_LABEL_LEN );
    AES_CMAC_Update( ctx, &sep, 1u );
    AES_CMAC_Update( ctx, deveui, 8u );
    AES_CMAC_Update( ctx, Lbits, 2u );

    AES_CMAC_Final( apsk_out, ctx );

    /* Optional: wipe ctx (contains intermediate state) */
    watteco_ble_memzero( ctx, (uint32_t) sizeof( ctx ) );
}

void watteco_ble_compute_osa_resp( uint8_t resp_out[WATTECO_BLE_RESP_LEN],
                                   const uint8_t ota_appkey[16],
                                   const uint8_t deveui[8],
                                   const uint8_t chal[WATTECO_BLE_CHAL_LEN] )
{
    uint8_t apsk[WATTECO_BLE_APSK_LEN];

    watteco_ble_derive_apsk_sp800_108( apsk, ota_appkey, deveui );

    AES_CMAC_CTX ctx[1];
    AES_CMAC_Init( ctx );
    AES_CMAC_SetKey( ctx, apsk );
    AES_CMAC_Update( ctx, chal, WATTECO_BLE_CHAL_LEN );
    AES_CMAC_Final( resp_out, ctx );

    /* Wipe sensitive material */
    watteco_ble_memzero( apsk, (uint32_t) sizeof( apsk ) );
    watteco_ble_memzero( ctx,  (uint32_t) sizeof( ctx ) );
}
