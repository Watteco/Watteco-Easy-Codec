import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplace,
  }),
}));

const localize = (key: string) => ({
  '@backLabel': 'Back',
  '@noSensorConnected': 'No sensor connected',
}[key] ?? key);

const mountNavigation = (props: Record<string, unknown> = {}) => shallowMount(
  SensorMobileNavigation,
  {
    props: {
      activePage: 'tools',
      localize,
      status: 'choose',
      ...props,
    },
    global: {
      stubs: {
        IonIcon: true,
        IonSpinner: true,
      },
    },
  },
);

describe('SensorMobileNavigation back variant', () => {
  beforeEach(() => routerReplace.mockReset());

  it('keeps the logo by default', () => {
    const wrapper = mountNavigation();

    expect(wrapper.find('.sensor-mobile-logo').exists()).toBe(true);
    expect(wrapper.find('.sensor-mobile-back').exists()).toBe(false);
  });

  it('replaces the logo with a same-size back control', () => {
    const wrapper = mountNavigation({ backTo: '/sensor-tools', backLabel: 'Back to tools' });
    const back = wrapper.get('.sensor-mobile-back');

    expect(wrapper.find('.sensor-mobile-logo').exists()).toBe(false);
    expect(back.classes()).toContain('sensor-mobile-leading');
    expect(back.attributes('aria-label')).toBe('Back to tools');
  });

  it('uses the localized fallback label and replaces the current route', async () => {
    const wrapper = mountNavigation({ backTo: '/sensor-tools' });

    expect(wrapper.get('.sensor-mobile-back').attributes('aria-label')).toBe('Back');
    await wrapper.get('.sensor-mobile-back').trigger('click');

    expect(routerReplace).toHaveBeenCalledWith('/sensor-tools');
  });

  it('shows the page title and back control without sensor actions', async () => {
    const wrapper = mountNavigation({ title: 'Firmware update', backTo: '/ble-connect' });

    expect(wrapper.get('h1').text()).toBe('Firmware update');
    expect(wrapper.get('header').classes()).not.toContain('sensor-mobile-header--disconnected');
    expect(wrapper.find('.sensor-mobile-identity').exists()).toBe(false);
    expect(wrapper.find('.sensor-mobile-header-actions').exists()).toBe(false);
    await wrapper.get('.sensor-mobile-back').trigger('click');
    expect(routerReplace).toHaveBeenCalledWith('/ble-connect');
  });
});

