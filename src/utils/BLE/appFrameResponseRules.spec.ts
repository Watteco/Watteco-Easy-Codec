import { describe, expect, it } from 'vitest';
import {
  APP_FRAME_FALLBACK_DELAY_MS,
  getCustomAppFrameResponsePolicy,
  prepareCustomAppTxRequest,
  getAppFrameResponseRule,
  getAppFrameResponseErrorAttributeId,
  getAppFrameResponseStatus,
  getAppFrameStatusName,
  isSuccessfulAppFrameResponse,
  matchesAppFrameResponse,
} from '@/utils/BLE/appFrameResponseRules';

describe('application frame response rules', () => {
  it('keeps the current delay for commands without an expected response', () => {
    const request = Uint8Array.of(0x11, 0x05, 0x80, 0x04, 0x00, 0x00, 0x08, 0x00);

    expect(APP_FRAME_FALLBACK_DELAY_MS).toBe(500);
    expect(getAppFrameResponseRule(request)?.response).toBeNull();
  });

  it('maps a Write Attributes request (0x02) to its response (0x04)', () => {
    const request = Uint8Array.of(0x11, 0x02, 0x00, 0x0f, 0x04, 0x02, 0x23, 0, 0, 0, 42);
    const success = Uint8Array.of(0x11, 0x04, 0x00, 0x0f, 0x00);
    const error = Uint8Array.of(0x11, 0x04, 0x00, 0x0f, 0x86, 0x04, 0x02);

    expect(getAppFrameResponseRule(request)?.response?.cmdId).toBe('04');
    expect(matchesAppFrameResponse(request, success)).toBe(true);
    expect(isSuccessfulAppFrameResponse(request, success)).toBe(true);
    expect(getAppFrameResponseStatus(request, error)).toBe(0x86);
    expect(getAppFrameResponseErrorAttributeId(request, error)).toBe(0x0402);
    expect(getAppFrameStatusName(0x86)).toBe('Unsupported attribute');
    expect(isSuccessfulAppFrameResponse(request, error)).toBe(false);
  });

  it('rejects an unrelated response even when its command ID is correct', () => {
    const request = Uint8Array.of(0x11, 0x02, 0x00, 0x0f, 0x04, 0x02, 0x23, 0, 0, 0, 42);

    expect(matchesAppFrameResponse(
      request,
      Uint8Array.of(0x31, 0x04, 0x00, 0x0f, 0x00),
    )).toBe(false);
    expect(matchesAppFrameResponse(
      request,
      Uint8Array.of(0x11, 0x04, 0x04, 0x02, 0x00),
    )).toBe(false);
  });

  it('correlates read responses by endpoint, cluster and attribute', () => {
    const request = Uint8Array.of(0x11, 0x00, 0x00, 0x00, 0x00, 0x02);
    const response = Uint8Array.of(0x11, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x0d);
    const otherAttribute = Uint8Array.of(0x11, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x42);

    expect(matchesAppFrameResponse(request, response)).toBe(true);
    expect(matchesAppFrameResponse(request, otherAttribute)).toBe(false);
  });

  it('correlates standard and batch reporting responses', () => {
    const standardRequest = Uint8Array.of(0x11, 0x06, 0x00, 0x0f, 0x00, 0x04, 0x02, 0x23);
    const standardResponse = Uint8Array.of(0x11, 0x07, 0x00, 0x0f, 0x00, 0x00, 0x04, 0x02);
    const batchRequest = Uint8Array.of(0x31, 0x06, 0x00, 0x0f, 0x1d, 0x04, 0x02, 0x00);
    const batchResponse = Uint8Array.of(0x31, 0x07, 0x00, 0x0f, 0x00, 0x01, 0x04, 0x02);

    expect(matchesAppFrameResponse(standardRequest, standardResponse)).toBe(true);
    expect(matchesAppFrameResponse(batchRequest, batchResponse)).toBe(true);
    expect(matchesAppFrameResponse(batchRequest, standardResponse)).toBe(false);
  });

  it('correlates a threshold reporting response with its 0x80 reporting kind', () => {
    const request = Uint8Array.of(
      0x31, 0x06, 0x04, 0x02, 0x80, 0x00, 0x00, 0x29,
      0x80, 0x0a, 0x80, 0x3c, 0x70, 0x05, 0xdc, 0x00,
      0x00, 0x01, 0x71, 0x0b, 0xb8, 0x00, 0x01,
    );
    const response = Uint8Array.of(0x31, 0x07, 0x04, 0x02, 0x00, 0x80, 0x00, 0x00);

    expect(matchesAppFrameResponse(request, response)).toBe(true);
    expect(getAppFrameResponseStatus(request, response)).toBe(0x00);
    expect(isSuccessfulAppFrameResponse(request, response)).toBe(true);
  });

  it('accepts a short configure-reporting error response', () => {
    const request = Uint8Array.of(
      0x11, 0x06, 0x00, 0x50, 0x15, 0x00, 0x06, 0x04,
      0x85, 0xa0, 0x85, 0xa0, 0x00, 0x00, 0x00, 0x64, 0x34,
    );
    const response = Uint8Array.of(0x11, 0x07, 0x00, 0x50, 0xc3);

    expect(matchesAppFrameResponse(request, response)).toBe(true);
    expect(getAppFrameResponseStatus(request, response)).toBe(0xc3);
    expect(isSuccessfulAppFrameResponse(request, response)).toBe(false);
    expect(getAppFrameStatusName(0xc3)).toBe('Invalid batch tag size');
  });

  it('accepts a configure-reporting error that echoes the request command ID', () => {
    const request = Uint8Array.of(
      0x53, 0x06, 0x04, 0x02, 0x15, 0x00, 0x00, 0x00,
      0x80, 0x3c, 0x80, 0xf0, 0x00, 0x00, 0x00, 0x0a, 0x24,
    );
    const response = Uint8Array.of(0x53, 0x06, 0x04, 0x02, 0x81);

    expect(matchesAppFrameResponse(request, response)).toBe(true);
    expect(getAppFrameResponseStatus(request, response)).toBe(0x81);
    expect(isSuccessfulAppFrameResponse(request, response)).toBe(false);
  });

  it('does not accept an echoed configure-reporting command ID as a success', () => {
    const request = Uint8Array.of(0x53, 0x06, 0x04, 0x02, 0x15, 0x00, 0x00);
    const response = Uint8Array.of(0x53, 0x06, 0x04, 0x02, 0x00);

    expect(matchesAppFrameResponse(request, response)).toBe(false);
  });

  it('does not accept a short error response from another endpoint or cluster', () => {
    const request = Uint8Array.of(
      0x11, 0x06, 0x00, 0x50, 0x15, 0x00, 0x06, 0x04,
      0x85, 0xa0, 0x85, 0xa0, 0x00, 0x00, 0x00, 0x64, 0x34,
    );

    expect(matchesAppFrameResponse(
      request,
      Uint8Array.of(0x31, 0x07, 0x00, 0x50, 0xc3),
    )).toBe(false);
    expect(matchesAppFrameResponse(
      request,
      Uint8Array.of(0x11, 0x07, 0x04, 0x02, 0xc3),
    )).toBe(false);
  });

  it('uses the legacy response collection for an unknown custom command', () => {
    expect(getCustomAppFrameResponsePolicy(
      Uint8Array.of(0x11, 0x42, 0x00, 0x50),
    )).toEqual({
      mode: 'legacy',
      firstResponseTimeoutMs: 2000,
      idleTimeoutMs: 1000,
    });
  });

  it('does not wait for a known command without a response', () => {
    expect(getCustomAppFrameResponsePolicy(
      Uint8Array.of(0x11, 0x05, 0x80, 0x04, 0x00, 0x00, 0x08, 0x00),
    )).toEqual({ mode: 'none' });
  });

  it('finishes a known single-response command on its matching response', () => {
    expect(getCustomAppFrameResponsePolicy(
      Uint8Array.of(0x11, 0x02, 0x00, 0x0f, 0x04, 0x02, 0x23, 0x00),
    )).toEqual({ mode: 'single', firstResponseTimeoutMs: 2000 });
  });

  it('accounts for the requested delay when collecting all report configurations', () => {
    expect(getCustomAppFrameResponsePolicy(
      Uint8Array.of(0x11, 0x50, 0x00, 0x50, 0x09, 0x03, 0x00, 0x03),
    )).toEqual({
      mode: 'multiple',
      firstResponseTimeoutMs: 4500,
      idleTimeoutMs: 4500,
    });
    expect(getCustomAppFrameResponsePolicy(
      Uint8Array.of(0x11, 0x50, 0x00, 0x50, 0x02, 0x03),
    )).toEqual({
      mode: 'legacy',
      firstResponseTimeoutMs: 2000,
      idleTimeoutMs: 1000,
    });
  });

  it('wraps the asynchronous configuration request in an AppTx capture envelope', () => {
    const request = Uint8Array.of(0x11, 0x50, 0x00, 0x50, 0x09, 0x03, 0x00, 0x00);
    const prepared = prepareCustomAppTxRequest(request);

    expect(Array.from(prepared.appTxFrame)).toEqual([
      0xef, 0x01, 0x00, 0x01,
      0x11, 0x50, 0x00, 0x50, 0x09, 0x03, 0x00, 0x00,
    ]);
    expect(prepared.responseRequest).toEqual(request);
    expect(prepared.responsePolicy).toEqual({
      mode: 'multiple',
      firstResponseTimeoutMs: 2000,
      idleTimeoutMs: 1500,
    });
  });

  it('keeps an existing AppTx capture envelope without adding it twice', () => {
    const request = Uint8Array.of(
      0xef, 0x01, 0x00, 0x03,
      0x11, 0x50, 0x00, 0x50, 0x09, 0x03, 0x00, 0x01,
    );
    const prepared = prepareCustomAppTxRequest(request);

    expect(prepared.appTxFrame).toEqual(request);
    expect(Array.from(prepared.responseRequest)).toEqual([
      0x11, 0x50, 0x00, 0x50, 0x09, 0x03, 0x00, 0x01,
    ]);
    expect(prepared.responsePolicy).toEqual({
      mode: 'multiple',
      firstResponseTimeoutMs: 3500,
      idleTimeoutMs: 3500,
    });
  });
});
