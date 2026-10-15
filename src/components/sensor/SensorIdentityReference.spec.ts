import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import SensorIdentityReference from '@/components/sensor/SensorIdentityReference.vue';

const rect = (width: number): DOMRect => ({
  width,
  height: 0,
  top: 0,
  right: width,
  bottom: 0,
  left: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

describe('SensorIdentityReference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockWidths = (availableWidth: number) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('sensor-identity-reference')) return rect(availableWidth);
      if (this.classList.contains('sensor-identity-reference__measurement')) {
        return rect((this.textContent?.length ?? 0) * 10);
      }
      return rect(0);
    });
  };

  it('keeps the full product reference while six DevEUI characters still fit', async () => {
    mockWidths(191);
    const wrapper = mount(SensorIdentityReference, {
      props: {
        productReference: '50-70-200',
        devEui: '70B3D5E712345678',
      },
    });
    await nextTick();

    expect(wrapper.get('.sensor-identity-reference__visual').text().replace(/\u00a0/g, ' '))
      .toBe('50-70-200 · …345678');
    wrapper.unmount();
  });

  it('removes only the 50-70 prefix and gives the recovered width to the DevEUI', async () => {
    mockWidths(189);
    const wrapper = mount(SensorIdentityReference, {
      props: {
        productReference: '50-70-200',
        devEui: '70B3D5E712345678',
      },
    });
    await nextTick();

    expect(wrapper.get('.sensor-identity-reference__visual').text().replace(/\u00a0/g, ' '))
      .toBe('…-200 · …712345678');
    wrapper.unmount();
  });
});
