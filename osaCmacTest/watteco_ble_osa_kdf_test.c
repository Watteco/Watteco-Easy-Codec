/**
 * @file watteco_ble_osa_kdf_test.c
 * @brief Simple test harness for APSK derivation and OSA response.
 *
 * Build example (adjust include paths to your project):
 *   gcc -Wall -Wextra -I. watteco_ble_osa_kdf_test.c watteco_ble_osa_kdf.c cmac.c aes.c -o test
 *
 * NOTE: this uses the same AES/CMAC implementation you ship (Semtech soft_se).
 */

#include <stdio.h>
#include <stdint.h>
#include <string.h>

#include "watteco_ble_osa_kdf.h"

static void print_hex(const char* label, const uint8_t* b, size_t n)
{
    size_t i;
    printf("%s (%zu): ", label, n);
    for (i = 0; i < n; i++) { printf("%02X", b[i]); }
    printf("\n");
}

int main(void)
{
    /* Dummy inputs (replace by real vectors if you want) */
    const uint8_t ota_appkey[16] = {
        0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,
        0x08,0x09,0x0A,0x0B,0x0C,0x0D,0x0E,0x0F
    };
    const uint8_t deveui[8] = { 0x70,0xB3,0xD5,0x7E,0xF0,0x00,0x12,0x34 };
    const uint8_t chal[16]  = { 0xA0,0xA1,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,
                                0xA8,0xA9,0xAA,0xAB,0xAC,0xAD,0xAE,0xAF };

    uint8_t apsk[16];
    uint8_t resp[16];

    watteco_ble_derive_apsk_sp800_108(apsk, ota_appkey, deveui);
    watteco_ble_compute_osa_resp(resp, ota_appkey, deveui, chal);

    print_hex("OTA_AppKey", ota_appkey, 16);
    print_hex("DevEUI", deveui, 8);
    print_hex("Chal", chal, 16);
    print_hex("APSK", apsk, 16);
    print_hex("Resp", resp, 16);

    return 0;
}
