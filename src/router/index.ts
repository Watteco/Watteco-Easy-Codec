import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import TabsPage from '../views/TabsPage.vue'

const isNative = Capacitor.isNativePlatform();

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: isNative ? '/ble-connect' : '/tabs/downlink'
  },
  {
    path: '/ble-connect',
    component: () => import('@/views/BleConnectPage.vue'),
    beforeEnter: (_to, _from, next) => {
      // On web, skip the BLE connect page entirely
      if (!isNative) { next('/tabs/downlink'); return; }
      next();
    }
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/downlink'
      },
      {
        path: 'downlink',
        component: () => import('@/views/DownlinkPage.vue')
      },
      {
        path: 'uplink',
        component: () => import('@/views/UplinkPage.vue')
      },
      {
        path: 'modbus',
        component: () => import('@/views/ModbusPage.vue')
      },
      {
        path: 'battery',
        component: () => import('@/views/BatteryPage.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
