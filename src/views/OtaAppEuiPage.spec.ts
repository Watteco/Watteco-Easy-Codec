import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtaAppEuiPage from '@/views/OtaAppEuiPage.vue';
import EuiInput from '@/components/EuiInput.vue';
import HexKeypad from '@/components/HexKeypad.vue';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';
import { readOtaAppEui, writeAndVerifyOtaAppEui } from '@/utils/BLE/otaAppEui';

const testState = vi.hoisted(() => ({
  enter: undefined as (() => void) | undefined,
  leave: undefined as (() => void) | undefined,
  refreshAuthentication: vi.fn(),
  createAlert: vi.fn(),
}));

vi.mock('@ionic/vue', async importOriginal => ({
  ...await importOriginal<typeof import('@ionic/vue')>(),
  onIonViewDidEnter: (callback: () => void) => { testState.enter = callback; },
  onIonViewDidLeave: (callback: () => void) => { testState.leave = callback; },
  alertController: { create: testState.createAlert },
}));

vi.mock('@/composables/useBle', () => ({
  useBle: () => ({
    connected: { value: true },
    connectedDevice: { value: { deviceId: 'device-1' } },
    osaAuthenticated: { value: true },
    refreshOsaAuthenticationStatus: testState.refreshAuthentication,
  }),
}));

vi.mock('@/composables/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: { value: 'fr' } }),
}));

vi.mock('@/utils/BLE/otaAppEui', () => ({
  readOtaAppEui: vi.fn(),
  writeAndVerifyOtaAppEui: vi.fn(),
}));

const mountPage = () => mount(OtaAppEuiPage, {
  global: {
    stubs: {
      SensorMobileNavigation: true,
      IonPage: { template: '<div><slot /></div>' },
      IonContent: { template: '<div><slot /></div>' },
      IonButton: {
        props: ['disabled'],
        template: '<button :disabled="disabled"><slot /></button>',
      },
    },
  },
});

describe('OtaAppEuiPage', () => {
  beforeEach(() => {
    testState.enter = undefined;
    testState.leave = undefined;
    testState.refreshAuthentication.mockReset().mockResolvedValue(true);
    testState.createAlert.mockReset().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
    });
    vi.mocked(readOtaAppEui).mockReset().mockResolvedValue('0011223344556677');
    vi.mocked(writeAndVerifyOtaAppEui).mockReset().mockResolvedValue('0123456789ABCDEF');
  });

  it('uses the tools subpage navigation and a full EUI field', () => {
    const wrapper = mountPage();

    expect(wrapper.getComponent(SensorMobileNavigation).props()).toMatchObject({
      activePage: 'tools',
      backTo: '/sensor-tools',
    });
    expect(wrapper.getComponent(EuiInput).props()).toMatchObject({
      fixedPrefix: '',
      byteLength: 8,
      inputMode: 'none',
    });
    expect(wrapper.getComponent(HexKeypad).props('showSpace')).toBe(false);
  });

  it('formats entered bytes while keeping save disabled until the current value is read', async () => {
    const wrapper = mountPage();
    const input = wrapper.get('#ota-app-eui-input');

    await input.setValue('0123456789abcdef');

    expect((input.element as HTMLInputElement).value).toBe('01:23:45:67:89:AB:CD:EF');
    expect(wrapper.getComponent(EuiInput).props('modelValue')).toBe('0123456789ABCDEF');
    expect(wrapper.findAll('button').at(-1)?.attributes('disabled')).toBeDefined();
  });

  it('switches the EUI field to the system keyboard', async () => {
    const wrapper = mountPage();

    await wrapper.get('.hex-keypad__mode').trigger('click');

    expect(wrapper.getComponent(EuiInput).props('inputMode')).toBe('text');
    expect(wrapper.find('.hex-keypad__keys').exists()).toBe(false);
  });

  it('checks authentication and reads the current AppEUI when the page opens', async () => {
    const wrapper = mountPage();

    testState.enter?.();
    await flushPromises();

    expect(testState.refreshAuthentication).toHaveBeenCalledOnce();
    expect(readOtaAppEui).toHaveBeenCalledWith('device-1', expect.any(Function));
    expect(wrapper.get('.app-eui-current strong').text()).toBe('00:11:22:33:44:55:66:77');
  });

  it('confirms, writes and displays the read-back value', async () => {
    const wrapper = mountPage();
    testState.enter?.();
    await flushPromises();
    await wrapper.get('#ota-app-eui-input').setValue('0123456789ABCDEF');

    const saveButton = wrapper.findAll('button').at(-1);
    expect(saveButton?.attributes('disabled')).toBeUndefined();
    await saveButton?.trigger('click');
    await flushPromises();

    expect(testState.createAlert).toHaveBeenCalledOnce();
    expect(writeAndVerifyOtaAppEui).toHaveBeenCalledWith(
      'device-1',
      '0123456789ABCDEF',
      expect.any(Function),
    );
    expect(wrapper.get('.app-eui-current strong').text()).toBe('01:23:45:67:89:AB:CD:EF');
    expect(wrapper.text()).toContain('Le nouvel AppEUI a été enregistré et vérifié.');
  });
});

