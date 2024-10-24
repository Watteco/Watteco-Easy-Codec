import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/downlink'
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
        component: () => import('@/views/downlinkPage.vue')
      },
      {
        path: 'uplink',
        component: () => import('@/views/uplinkPage.vue')
      },
      {
        path: 'battery',
        component: () => import('@/views/batteryPage.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
